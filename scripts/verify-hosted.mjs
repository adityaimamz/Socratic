import assert from 'node:assert/strict';
const {NEXT_PUBLIC_SUPABASE_URL:url,SUPABASE_ACCESS_TOKEN:token}=process.env;
if(!url||!token?.startsWith('sbp_')){console.error('Diperlukan Project URL dan Personal Access Token Supabase.');process.exit(1);}
const ref=new URL(url).hostname.split('.')[0];
async function query(sql,readOnly=true){const r=await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({query:sql,read_only:readOnly}),signal:AbortSignal.timeout(60000)});if(!r.ok){const detail=await r.json().catch(()=>({}));throw new Error(`Pemeriksaan hosted gagal (HTTP ${r.status}): ${String(detail.message??'Tidak ada diagnostik SQL.').replaceAll(token,'[redacted]')}`);}return r.json();}
const rows=await query(`select
 (select count(*) from private.app_migrations) as migrations,
 (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'school_%' and (has_function_privilege('anon',p.oid,'execute') or has_function_privilege('authenticated',p.oid,'execute'))) as exposed_functions,
 (select count(*) from pg_tables where schemaname='private' and not rowsecurity) as tables_without_rls,
 (select count(*) from cron.job where jobname='safe-exam-finalize' and active) as finalizer,
 (select count(*) from cron.job where jobname='safe-exam-retention' and active) as retention,
 (select count(*) from storage.buckets where id='exam-media' and not public) as private_bucket,
 (select count(*) from private.invitations where role='admin') as admin_invitations;`);
const r=rows[0];assert.equal(Number(r.exposed_functions),0,'RPC sensitif dapat diakses role browser');assert.equal(Number(r.tables_without_rls),0,'Ada tabel aplikasi tanpa RLS');assert.equal(Number(r.finalizer),1);assert.equal(Number(r.retention),1);assert.equal(Number(r.private_bucket),1);assert.ok(Number(r.admin_invitations)>=1);
console.log(`PASS hosted: ${r.migrations} migrasi; RPC server-only; RLS aktif; finalizer dan retensi aktif; storage privat; undangan admin siap.`);
if(process.argv.includes('--smoke')){
 await query(`begin;
 do $$
 declare teacher uuid:=gen_random_uuid(); student uuid:=gen_random_uuid(); sess uuid:=gen_random_uuid(); correct uuid:=gen_random_uuid(); wrong uuid:=gen_random_uuid(); q jsonb; essay jsonb; grading jsonb; operation uuid; exam jsonb; attempt jsonb; saved jsonb; reset jsonb; receipt jsonb; first_deadline text; event uuid:=gen_random_uuid();
 begin
 insert into private.profiles(id,email,name,role) values(teacher,teacher::text||'@smoke.invalid','Smoke teacher','teacher'),(student,student::text||'@smoke.invalid','Smoke participant','student');
 q:=public.school_api(teacher,'questions.save',jsonb_build_object('prompt','Hosted smoke test','options',jsonb_build_array(jsonb_build_object('id',correct,'text','Benar'),jsonb_build_object('id',wrong,'text','Salah')),'correct_option_id',correct,'weight',1,'tag','Smoke'));
 exam:=public.school_api(teacher,'exams.save',jsonb_build_object('title','Hosted smoke test','instructions','Temporary transaction','mode','exam','opens_at',now()-interval '1 minute','closes_at',now()+interval '1 hour','duration_minutes',30,'passing_score',70,'penalty',0,'shuffle_questions',true,'shuffle_options',true,'question_ids',jsonb_build_array(q->>'id'),'participant_emails',jsonb_build_array(student::text||'@smoke.invalid')));
 perform public.school_api(teacher,'exams.publish',jsonb_build_object('id',exam->>'id'));
 attempt:=public.school_api(student,'attempt.start',jsonb_build_object('id',exam->>'id','session_id',sess));first_deadline:=attempt->>'deadline_at';
 if (attempt->'items'->0) ? 'correctOptionId' then raise exception 'KEY_LEAK'; end if;
 saved:=public.school_api(student,'attempt.save',jsonb_build_object('id',attempt->>'id','session_id',sess,'answer_epoch',0,'item_id',q->>'id','option_id',correct,'expected_revision',0,'operation_id',gen_random_uuid(),'marked',true,'current_question',0));
 reset:=public.school_api(student,'attempt.events',jsonb_build_object('id',attempt->>'id','session_id',sess,'answer_epoch',0,'event_id',event,'type','visibility_hidden'));
 if reset->'attempt'->'answers'<>'{}'::jsonb or (reset->'attempt'->>'answer_epoch')::int<>1 or reset->'attempt'->>'deadline_at'<>first_deadline then raise exception 'RESET_INVARIANT_FAILED'; end if;
 reset:=public.school_api(student,'attempt.events',jsonb_build_object('id',attempt->>'id','session_id',sess,'answer_epoch',0,'event_id',event,'type','visibility_hidden'));
 if (reset->'attempt'->>'reset_count')::int<>1 then raise exception 'DUPLICATE_RESET'; end if;
 begin perform public.school_api(student,'attempt.save',jsonb_build_object('id',attempt->>'id','session_id',sess,'answer_epoch',0,'item_id',q->>'id','option_id',correct,'expected_revision',0,'operation_id',gen_random_uuid()));raise exception 'STALE_SAVE_ACCEPTED';exception when others then if sqlerrm<>'ANSWER_EPOCH_MISMATCH' then raise;end if;end;
 saved:=public.school_api(student,'attempt.save',jsonb_build_object('id',attempt->>'id','session_id',sess,'answer_epoch',1,'item_id',q->>'id','option_id',correct,'expected_revision',0,'operation_id',gen_random_uuid(),'marked',false,'current_question',0));
 receipt:=public.school_api(student,'attempt.submit',jsonb_build_object('id',attempt->>'id','session_id',sess,'answer_epoch',1));
 if (receipt->>'score')::numeric<>100 then raise exception 'INVALID_SCORE';end if;
 if public.school_api(student,'attempt.result',jsonb_build_object('id',attempt->>'id'))->'receipt' ? 'score' then raise exception 'WITHHELD_SCORE_LEAK';end if;
 if public.school_api(student,'attempt.submit',jsonb_build_object('id',attempt->>'id','session_id',sess,'answer_epoch',1))->>'receipt_id'<>receipt->>'receipt_id' then raise exception 'DUPLICATE_RECEIPT';end if;

 essay:=public.school_api(teacher,'questions.save',jsonb_build_object('kind','essay','prompt','Jelaskan fotosintesis','options','[]'::jsonb,'correct_option_id',null,'rubric','Rubrik privat hosted','weight',4));
 exam:=public.school_api(teacher,'exams.save',jsonb_build_object('title','Hosted essay smoke','instructions','Temporary transaction','mode','quiz','opens_at',now()-interval '1 minute','closes_at',now()+interval '1 hour','duration_minutes',30,'passing_score',70,'penalty',0,'shuffle_questions',false,'shuffle_options',false,'question_ids',jsonb_build_array(q->>'id',essay->>'id'),'participant_emails',jsonb_build_array(student::text||'@smoke.invalid')));
 perform public.school_api(teacher,'exams.publish',jsonb_build_object('id',exam->>'id'));
 attempt:=public.school_api(student,'attempt.start',jsonb_build_object('id',exam->>'id','session_id',sess));
 if (attempt->'items'->1) ? 'rubric' then raise exception 'RUBRIC_LEAK';end if;
 perform public.school_api(student,'attempt.save',jsonb_build_object('id',attempt->>'id','session_id',sess,'answer_epoch',0,'item_id',q->>'id','option_id',correct,'expected_revision',0,'operation_id',gen_random_uuid(),'marked',false,'current_question',0));
 perform public.school_api(student,'attempt.save',jsonb_build_object('id',attempt->>'id','session_id',sess,'answer_epoch',0,'item_id',essay->>'id','option_id',null,'text','Tumbuhan memakai energi cahaya','expected_revision',0,'operation_id',gen_random_uuid(),'marked',false,'current_question',1));
 receipt:=public.school_api(student,'attempt.submit',jsonb_build_object('id',attempt->>'id','session_id',sess,'answer_epoch',0));
 if receipt->>'grading_status'<>'pending' or receipt->>'score' is not null then raise exception 'PARTIAL_SCORE_LEAK';end if;
 operation:=gen_random_uuid();grading:=jsonb_build_array(jsonb_build_object('item_id',essay->>'id','points',3,'feedback','Tambahkan produk fotosintesis'));
 receipt:=public.school_api(teacher,'manage.grade',jsonb_build_object('id',attempt->>'id','operation_id',operation,'grades',grading));
 if (receipt->>'score')::numeric<>80 then raise exception 'INVALID_ESSAY_SCORE';end if;
 receipt:=public.school_api(student,'attempt.result',jsonb_build_object('id',attempt->>'id'));
 if receipt->'receipt' ? 'grade_payload' or receipt->'essay_grades'->0->>'prompt'<>'Jelaskan fotosintesis' then raise exception 'INVALID_FEEDBACK';end if;
 if not public.school_auth_allowed(teacher::text||'@smoke.invalid') or public.school_auth_allowed(gen_random_uuid()::text||'@unknown.invalid') then raise exception 'INVALID_PASSWORD_ADMISSION';end if;
 end $$;
 rollback;`,false);
 console.log('PASS hosted smoke: publish → start → save → reset → stale epoch rejected → save → server grading → withheld results → idempotent submit. Esai campuran, koreksi manual, komentar, dan admission email juga lulus. Seluruh data smoke di-ROLLBACK.');
}

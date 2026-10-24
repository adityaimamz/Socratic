// Hosted regression smoke: creates its own records and rolls the whole transaction back.
const {NEXT_PUBLIC_SUPABASE_URL:url,SUPABASE_ACCESS_TOKEN:token}=process.env;
if(!url||!token?.startsWith('sbp_'))throw new Error('Siapkan URL Supabase dan Management token lokal.');
const ref=new URL(url).hostname.split('.')[0];
if(!/^[a-z0-9]+$/.test(ref))throw new Error('Project URL tidak valid.');
const operation=crypto.randomUUID(),questionOperation=crypto.randomUUID(),classOperation=crypto.randomUUID();
const sql=`begin;
do $smoke$
declare actor uuid; qid uuid; cid uuid; eid uuid; result jsonb; retry jsonb;
begin
 select id into actor from private.profiles where active and role='teacher' order by created_at limit 1;
 if actor is null then raise exception 'SMOKE_NEEDS_TEACHER'; end if;
 qid:=(public.school_api(actor,'questions.save',jsonb_build_object('kind','essay','prompt','[SMOKE] Soal untuk penghapusan','options','[]'::jsonb,'correct_option_id',null,'rubric','','weight',1,'tag','[SMOKE]'))->>'id')::uuid;
 cid:=(public.school_api(actor,'classes.save',jsonb_build_object('name','[SMOKE] Kelas hapus','emails','[]'::jsonb))->>'id')::uuid;
 eid:=(public.school_api(actor,'exams.save',jsonb_build_object('title','[SMOKE] Draft hapus','instructions','','class_id',cid,'mode','quiz','opens_at',now(),'closes_at',now()+interval '1 day','duration_minutes',30,'passing_score',70,'penalty',0,'shuffle_questions',false,'shuffle_options',false,'question_ids',jsonb_build_array(qid),'participant_emails','[]'::jsonb))->>'id')::uuid;
 begin
  perform public.school_api(actor,'questions.delete',jsonb_build_object('id',qid,'operation_id',gen_random_uuid()));
  raise exception 'SMOKE_QUESTION_GUARD_FAILED';
 exception when others then if sqlerrm<>'QUESTION_IN_USE' then raise; end if; end;
 begin
  perform public.school_api(actor,'classes.delete',jsonb_build_object('id',cid,'operation_id',gen_random_uuid()));
  raise exception 'SMOKE_CLASS_GUARD_FAILED';
 exception when others then if sqlerrm<>'CLASS_IN_USE' then raise; end if; end;
 result:=public.school_api(actor,'exams.delete',jsonb_build_object('id',eid,'operation_id','${operation}'));
 retry:=public.school_api(actor,'exams.delete',jsonb_build_object('id',eid,'operation_id','${operation}'));
 if result<>retry or result->>'deleted'<>'true' then raise exception 'SMOKE_RETRY_FAILED'; end if;
 perform public.school_api(actor,'classes.delete',jsonb_build_object('id',cid,'operation_id','${classOperation}'));
 perform public.school_api(actor,'questions.delete',jsonb_build_object('id',qid,'operation_id','${questionOperation}'));
 if (select count(*) from private.audit_logs where resource_id=eid and action='exams.delete')<>1 then raise exception 'SMOKE_AUDIT_FAILED'; end if;
end;
$smoke$;
rollback;
select exists(select 1 from private.app_migrations where version='202610240012_resource_delete.sql') migration_applied,
 not exists(select 1 from private.audit_logs where details->>'operation_id' in ('${operation}','${classOperation}','${questionOperation}')) rolled_back,
 not has_function_privilege('authenticated','private.delete_resource(uuid,text,uuid,uuid)','execute') browser_helper_blocked;`;
const response=await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({query:sql,read_only:false}),signal:AbortSignal.timeout(45000)});
if(!response.ok){const detail=await response.json().catch(()=>({}));throw new Error(`Smoke hapus gagal, HTTP ${response.status}: ${String(detail.message??'periksa SQL').replaceAll(token,'[redacted]').slice(0,700)}`);}
const result=await response.json();
if(!result[0]?.migration_applied||!result[0]?.rolled_back||!result[0]?.browser_helper_blocked)throw new Error('Verifikasi hapus hosted belum lengkap.');
console.log(JSON.stringify({deletedOwnTemporaryRecords:3,dependencyGuards:true,retryWithoutDuplicateAudit:true,...result[0]}));

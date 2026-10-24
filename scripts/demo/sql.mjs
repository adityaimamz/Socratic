import {demoId} from './data.mjs';

export const literal=value=>`'${String(value).replaceAll("'","''")}'`;
const json=value=>`${literal(JSON.stringify(value))}::jsonb`;
const uuid=value=>`${literal(value)}::uuid`;
const list=values=>`array[${values.map(literal).join(',')}]::uuid[]`;

export function buildDemoSql(d){
 const user=key=>uuid(d.users[key].id),exam=key=>d.exams.find(e=>e.key===key),q=key=>d.questions.find(x=>x.key===key);
 const api=(actor,action,payload)=>`public.school_api(${user(actor)},${literal(action)},${json(payload)})`;
 const lines=[];
 const run=(actor,action,payload)=>lines.push(`perform ${api(actor,action,payload)};`);
 const allIds=list(d.accounts.map(u=>u.id)),allEmails=d.accounts.map(u=>u.email);
 lines.push(`if exists(select 1 from private.exams where id=${uuid(exam('strict').id)}) then
  if not exists(select 1 from private.exams where id=${uuid(exam('strict').id)} and owner_id=${user('pengajar')} and title like '[DEMO]%') then raise exception 'DEMO_ID_COLLISION'; end if;
  return;
 end if;`);
 lines.push(`if exists(select 1 from private.profiles where id=any(${allIds}) or email=any(array[${allEmails.map(literal).join(',')}])) then raise exception 'DEMO_PROFILE_COLLISION'; end if;`);
 for(const u of d.accounts){
  lines.push(`insert into private.invitations(email,name,role) values(${literal(u.email)},${literal(u.name)},${literal(u.role)});`);
  if(u.confirmed){
   lines.push(`perform public.school_accept(${uuid(u.id)},${literal(u.email)},${literal(u.name)});`);
  }
 }
 for(const u of d.accounts.filter(u=>!u.active))run('admin','admin.user',{id:u.id,role:u.role,active:false});
 for(const invitation of d.invitations)run('admin','admin.invite',invitation);
 for(const c of d.classes){
  lines.push(`insert into private.classes(id,name,owner_id) values(${uuid(c.id)},${literal(c.name)},${user(c.owner)});`);
  run(c.owner,'classes.save',{id:c.id,name:c.name,emails:c.emails});
 }
 for(const item of d.questions){
  const media=item.image?d.mediaPath:null;
  lines.push(`insert into private.questions(id,owner_id,prompt,options,correct_option_id,weight,tag,media_path,kind,rubric)
   values(${uuid(item.id)},${user(item.owner)},${literal(item.prompt)},${json(item.options)},${item.correct_option_id?uuid(item.correct_option_id):'null'},${item.weight},${literal(item.tag)},${media?literal(media):'null'},${literal(item.kind)},${literal(item.rubric)});`);
  if(item.key==='algebra')run(item.owner,'questions.save',{id:item.id,kind:item.kind,prompt:item.prompt,options:item.options,correct_option_id:item.correct_option_id,weight:item.weight,tag:item.tag,rubric:item.rubric,media_path:media});
  if(item.archived)run(item.owner,'questions.archive',{id:item.id});
 }
 for(const e of d.exams){
  const c=d.classes.find(c=>c.key===e.class);
  lines.push(`insert into private.exams(id,owner_id,title,instructions,class_id,mode,opens_at,closes_at,duration_minutes,passing_score,penalty,shuffle_questions,shuffle_options,question_ids,participant_emails)
   values(${uuid(e.id)},${user(e.owner)},${literal(e.title)},${literal('Data simulasi untuk pengujian. Mode Exam mereset seluruh jawaban jika meninggalkan tab. Jangan gunakan akun dummy untuk ujian nyata.')},${uuid(c.id)},${literal(e.mode)},clock_timestamp()+interval '${e.scheduled?'1 day':'-2 hours'}',clock_timestamp()+interval '7 days',${e.duration_minutes},70,${e.penalty},true,true,${list(e.questions.map(key=>q(key).id))},'{}');`);
  if(!e.draft)run(e.owner,'exams.publish',{id:e.id});
  if(e.key==='strict')run('admin','exams.staff',{id:e.id,staff_ids:[d.users.pengawas.id]});
  if(e.closed||e.archived)run(e.owner,'exams.close',{id:e.id});
  if(e.archived)lines.push(`update private.exams set status='archived',opens_at=clock_timestamp()-interval '4 days',closes_at=clock_timestamp()-interval '2 days' where id=${uuid(e.id)};`);
 }
 lines.push(`perform public.school_accommodation_set(${user('pengajar')},${uuid(exam('strict').id)},${literal(d.users.peserta01.email)},true,'[DEMO] Pengujian akomodasi perangkat tanpa fullscreen. Aturan reset tetap berlaku.');`);
 for(const a of d.attempts){
  const e=exam(a.exam),session=uuid(a.session);
  const answerSql=a.quality==='weak'?literal('[DEMO] Saya belum menjelaskan langkah penyelesaian secara lengkap.'):`case ${d.questions.filter(item=>item.kind==='essay').map(item=>`when item->>'id'=${literal(item.id)} then ${literal(item.sampleAnswer)}`).join(' ')} else '[DEMO] Contoh jawaban peserta.' end`;
  lines.push(`a:=${api(a.student,'attempt.start',{id:e.id,session_id:a.session})};
   select answer_epoch into epoch from private.attempts where id=(a->>'id')::uuid;`);
  const fill=()=>{
   lines.push(`n:=0;
    for item in select value from private.attempts attempt cross join lateral jsonb_array_elements(attempt.snapshot->'items') where attempt.id=(a->>'id')::uuid loop
     if ${a.quality==='partial'?'n<2':a.quality==='blank-essay'?"item->>'kind'<>'essay'":'true'} then
      perform public.school_api(${user(a.student)},'attempt.save',jsonb_build_object('id',a->>'id','session_id',${session},'answer_epoch',epoch,'item_id',item->>'id',
       'option_id',case when item->>'kind'='essay' then null else ${a.quality==='weak'?"(item->'options'->1->>'id')":"(item->>'correctOptionId')"} end,
       'text',case when item->>'kind'='essay' then ${answerSql} else null end,
       'marked',n=1,'expected_revision',0,'operation_id',gen_random_uuid(),'current_question',n));
     end if;
     n:=n+1;
    end loop;`);
  };
  fill();
  lines.push(`perform public.school_api(${user(a.student)},'attempt.events',jsonb_build_object('id',a->>'id','session_id',${session},'answer_epoch',epoch,'event_id',gen_random_uuid(),'type','fullscreen_enter'));`);
  if(a.state==='reset'){
   lines.push(`v:=public.school_api(${user(a.student)},'attempt.events',jsonb_build_object('id',a->>'id','session_id',${session},'answer_epoch',epoch,'event_id',gen_random_uuid(),'type','visibility_hidden'));epoch:=(v->'attempt'->>'answer_epoch')::integer;`);
   fill();
  }else if(a.exam==='quiz')lines.push(`perform public.school_api(${user(a.student)},'attempt.events',jsonb_build_object('id',a->>'id','session_id',${session},'answer_epoch',epoch,'event_id',gen_random_uuid(),'type','visibility_hidden'));`);
  if(a.state==='takeover')lines.push(`perform public.school_api(${user(a.student)},'attempt.takeover',jsonb_build_object('id',a->>'id','session_id',${uuid(demoId(`takeover:${a.key}`))}));`);
  if(a.state==='offline')lines.push(`perform public.school_api(${user(a.student)},'attempt.events',jsonb_build_object('id',a->>'id','session_id',${session},'answer_epoch',epoch,'event_id',gen_random_uuid(),'type','connection_lost'));
   update private.attempts set last_seen_at=clock_timestamp()-interval '5 minutes' where id=(a->>'id')::uuid;`);
  if(a.state==='extend')lines.push(`perform public.school_api(${user(e.owner)},'manage.action',jsonb_build_object('id',a->>'id','action','extend','minutes',15,'reason','[DEMO] Tambahan waktu karena gangguan jaringan peserta.'));`);
  if(a.state==='deadline'){
   lines.push(`update private.attempts set deadline_at=clock_timestamp()-interval '1 second' where id=(a->>'id')::uuid;
    perform public.school_api(${user(a.student)},'attempt.heartbeat',jsonb_build_object('id',a->>'id','session_id',${session}));`);
  }else if(a.state==='terminate')lines.push(`perform public.school_api(${user(e.owner)},'manage.action',jsonb_build_object('id',a->>'id','action','terminate','reason','[DEMO] Pengawas mengakhiri sesi simulasi setelah peninjauan insiden.'));`);
  else if(['submit','graded','retake'].includes(a.state))lines.push(`perform public.school_api(${user(a.student)},'attempt.submit',jsonb_build_object('id',a->>'id','session_id',${session},'answer_epoch',epoch));`);
  if(['graded','terminate'].includes(a.state)){
   lines.push(`select coalesce(jsonb_agg(jsonb_build_object('item_id',value->>'id','points',case when private.answer_present(attempt.answers->(value->>'id')) then ${a.quality==='weak'?'1':"(value->>'weight')::numeric"} else 0 end,'feedback',${literal(a.quality==='weak'?'[DEMO] Jelaskan rumus, alasan, dan langkah perhitungan agar jawaban lebih lengkap.':'[DEMO] Jawaban sudah dinilai. Cocokkan langkah dan konsep dengan rubrik pembahasan.')})),'[]'::jsonb) into grades
    from private.attempts attempt cross join lateral jsonb_array_elements(attempt.snapshot->'items') where attempt.id=(a->>'id')::uuid and value->>'kind'='essay';
    if jsonb_array_length(grades)>0 then perform public.school_api(${user(e.owner)},'manage.grade',jsonb_build_object('id',a->>'id','operation_id',gen_random_uuid(),'grades',grades));end if;`);
  }
  if(a.state==='retake')lines.push(`perform public.school_api(${user(e.owner)},'manage.action',jsonb_build_object('id',a->>'id','action','retake','reason','[DEMO] Peserta mendapat kesempatan ulang setelah evaluasi pembelajaran.'));`);
  const decision=a.state==='reset'?'flagged':a.state==='takeover'?'inconclusive':a.state==='offline'?'cleared':a.state==='terminate'?'confirmed':a.exam==='review'&&a.quality==='weak'?'invalidated':null;
  if(decision)lines.push(`perform public.school_api(${user(e.owner)},'manage.action',jsonb_build_object('id',a->>'id','action','review','decision',${literal(decision)},'reason','[DEMO] Catatan simulasi untuk menguji keputusan peninjauan pengawas.'));`);
 }
 for(const e of d.exams.filter(e=>e.history)){
  lines.push(`update private.exams set opens_at=clock_timestamp()-interval '4 days',closes_at=clock_timestamp()-interval '2 days' where id=${uuid(e.id)};
   update private.attempts set started_at=clock_timestamp()-interval '3 days',deadline_at=clock_timestamp()-interval '3 days'+interval '8 hours',last_seen_at=clock_timestamp()-interval '3 days'+interval '30 minutes' where exam_id=${uuid(e.id)};
   update private.results set finalized_at=clock_timestamp()-interval '3 days'+interval '30 minutes',graded_at=case when grading_status='complete' then clock_timestamp()-interval '3 days'+interval '1 hour' end where attempt_id in(select id from private.attempts where exam_id=${uuid(e.id)});
   update private.essay_grades set graded_at=clock_timestamp()-interval '3 days'+interval '1 hour' where attempt_id in(select id from private.attempts where exam_id=${uuid(e.id)});
   update private.integrity_events set received_at=clock_timestamp()-interval '3 days'+interval '15 minutes' where attempt_id in(select id from private.attempts where exam_id=${uuid(e.id)});`);
 }
 for(const e of d.exams.filter(e=>e.release))run(e.owner,'manage.release',{id:e.id,review:e.release==='review'});
 lines.push(`if (select count(*) from private.exams where id=any(${list(d.exams.map(e=>e.id))}))<>${d.exams.length} then raise exception 'DEMO_EXAM_COUNT_MISMATCH';end if;
  if (select count(*) from private.attempts where exam_id=any(${list(d.exams.map(e=>e.id))}))<>${d.attempts.length} then raise exception 'DEMO_ATTEMPT_COUNT_MISMATCH';end if;`);
 return `begin;\ndo $seed_demo$\ndeclare a jsonb;v jsonb;item jsonb;grades jsonb;epoch integer;n integer;\nbegin\nperform pg_advisory_xact_lock(hashtext('socratic-demo-v1'));\n${lines.join('\n')}\nend $seed_demo$;\ncommit;`;
}

export function buildCleanupSql(d){
 const ids=list(d.accounts.map(u=>u.id)),emails=[...d.accounts,...d.invitations].map(u=>u.email),emailArray=`array[${emails.map(literal).join(',')}]::text[]`;
 return `begin;
 do $clean_demo$ begin
 perform pg_advisory_xact_lock(hashtext('socratic-demo-v1'));
 if exists(select 1 from private.profiles where id=any(${ids}) and (email<>all(${emailArray}) or name not like '[DEMO]%')) then raise exception 'DEMO_OWNERSHIP_MISMATCH';end if;
 delete from private.audit_logs where actor_id=any(${ids});
 delete from private.exam_accommodations where exam_id in(select id from private.exams where owner_id=any(${ids}));
 delete from private.attempts where user_id=any(${ids}) or exam_id in(select id from private.exams where owner_id=any(${ids}));
 delete from private.enrollments where user_id=any(${ids});
 delete from private.exams where owner_id=any(${ids});
 delete from private.questions where owner_id=any(${ids});
 delete from private.memberships where email=any(${emailArray});
 delete from private.classes where owner_id=any(${ids});
 delete from private.invitations where email=any(${emailArray}) or accepted_by=any(${ids});
 delete from private.profiles where id=any(${ids});
 end $clean_demo$;
 commit;`;
}

export function demoReportSql(d){
 const users=list(d.accounts.map(u=>u.id)),exams=list(d.exams.map(e=>e.id));
 return `select jsonb_build_object(
 'profiles',(select count(*) from private.profiles where id=any(${users})),
 'classes',(select count(*) from private.classes where owner_id=any(${users})),
 'questions',(select count(*) from private.questions where owner_id=any(${users})),
 'exams',(select count(*) from private.exams where id=any(${exams})),
 'attempts',(select count(*) from private.attempts where exam_id=any(${exams})),
 'active_attempts',(select count(*) from private.attempts where exam_id=any(${exams}) and status='in_progress'),
 'results',(select count(*) from private.results where attempt_id in(select id from private.attempts where exam_id=any(${exams}))),
 'pending_grading',(select count(*) from private.results where grading_status='pending' and attempt_id in(select id from private.attempts where exam_id=any(${exams}))),
 'essay_grades',(select count(*) from private.essay_grades where attempt_id in(select id from private.attempts where exam_id=any(${exams}))),
 'events',(select count(*) from private.integrity_events where attempt_id in(select id from private.attempts where exam_id=any(${exams}))),
 'reviews',(select count(*) from private.reviews where attempt_id in(select id from private.attempts where exam_id=any(${exams}))),
 'audit',(select count(*) from private.audit_logs where actor_id=any(${users})),
 'invitations',(select count(*) from private.invitations where email like '%@socratic-demo.test'),
 'accommodations',(select count(*) from private.exam_accommodations where exam_id=any(${exams}))) as summary;
`;
}

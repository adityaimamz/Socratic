-- Extend published snapshots and final receipts without changing old MCQ exams.
alter table private.questions add column kind text not null default 'mcq' check(kind in ('mcq','essay'));
alter table private.questions add column rubric text not null default '' check(length(rubric)<=10000);
alter table private.questions alter column correct_option_id drop not null;
alter table private.questions add constraint questions_kind_shape check (
 (kind='mcq' and correct_option_id is not null and jsonb_array_length(options) between 2 and 6)
 or (kind='essay' and correct_option_id is null and options='[]'::jsonb));

alter table private.results alter column score drop not null;
alter table private.results add column grading_status text not null default 'complete' check(grading_status in ('pending','complete'));
alter table private.results add column essay_count integer not null default 0;
alter table private.results add column mcq_points numeric not null default 0;
alter table private.results add column total_points numeric not null default 0;
alter table private.results add column essay_points numeric;
alter table private.results add column graded_at timestamptz;
alter table private.results add column graded_by uuid references private.profiles;
alter table private.results add column grade_operation uuid;
alter table private.results add column grade_payload jsonb;
alter table private.results add constraint results_grading_state check(
 (grading_status='pending' and score is null) or (grading_status='complete' and score is not null));

create table private.essay_grades (
 attempt_id uuid not null references private.attempts on delete cascade,
 item_id uuid not null, points numeric not null check(points>=0),
 feedback text not null default '' check(length(feedback)<=1000),
 actor_id uuid not null references private.profiles, graded_at timestamptz not null default now(),
 primary key(attempt_id,item_id)
);
alter table private.essay_grades enable row level security;

create or replace function private.answer_present(answer jsonb) returns boolean language sql immutable as $$
 select coalesce(answer->>'optionId','')<>'' or length(btrim(coalesce(answer->>'text','')))>0
$$;
create or replace function private.public_items(items jsonb) returns jsonb language sql immutable as $$
 select coalesce(jsonb_agg(value-'correctOptionId'-'rubric' order by ord),'[]') from jsonb_array_elements(items) with ordinality t(value,ord)
$$;
create or replace function private.result_view(r private.results) returns jsonb language sql stable as $$
 select to_jsonb(r)-'mcq_points'-'total_points'-'grade_operation'-'grade_payload'-'graded_by'
$$;
create or replace function private.finish(target uuid, cause text) returns jsonb language plpgsql as $$
declare a private.attempts; item jsonb; selected jsonb; correct integer:=0; wrong integer:=0; empty_n integer:=0; essays integer:=0; raw numeric:=0; total numeric:=0; result private.results;
begin
 select * into a from private.attempts where id=target for update;
 if not found then raise exception 'NOT_FOUND'; end if;
 if a.status='finalized' then select * into result from private.results where attempt_id=a.id; return to_jsonb(result); end if;
 for item in select value from jsonb_array_elements(a.snapshot->'items') loop
   total:=total+(item->>'weight')::numeric; selected:=a.answers->(item->>'id');
   if item->>'kind'='essay' then
     essays:=essays+1;
     if not private.answer_present(selected) then empty_n:=empty_n+1; end if;
   elsif selected is null or selected->>'optionId' is null then empty_n:=empty_n+1;
   elsif selected->>'optionId'=item->>'correctOptionId' then correct:=correct+1; raw:=raw+(item->>'weight')::numeric;
   else wrong:=wrong+1; raw:=raw-(a.snapshot->>'penalty')::numeric; end if;
 end loop;
 insert into private.results(attempt_id,score,correct_count,wrong_count,empty_count,reason,grading_status,essay_count,mcq_points,total_points,essay_points,graded_at)
 values(a.id,case when essays=0 then round(greatest(0,least(100,100*raw/nullif(total,0))),2) end,correct,wrong,empty_n,cause,
  case when essays>0 then 'pending' else 'complete' end,essays,raw,total,case when essays=0 then 0 end,case when essays=0 then clock_timestamp() end) returning * into result;
 update private.attempts set status='finalized',operations='{}' where id=a.id;
 return to_jsonb(result);
end $$;

create or replace function private.grading_view(actor uuid, target uuid) returns jsonb language plpgsql as $$
declare a private.attempts; e private.exams; r private.results;
begin
 select * into a from private.attempts where id=target;
 if not found then raise exception 'NOT_FOUND'; end if;
 select * into e from private.exams where id=a.exam_id;
 if not private.can_manage(actor,e) then raise exception 'NOT_FOUND'; end if;
 if a.status<>'finalized' then raise exception 'ATTEMPT_ACTIVE'; end if;
 select * into r from private.results where attempt_id=a.id;
 return jsonb_build_object('attempt_id',a.id,'exam_id',e.id,'title',e.title,'name',(select name from private.profiles where id=a.user_id),
  'grading_status',r.grading_status,'score',r.score,
  'items',coalesce((select jsonb_agg(value order by ord) from jsonb_array_elements(a.snapshot->'items') with ordinality t(value,ord) where value->>'kind'='essay'),'[]'::jsonb),
  'answers',coalesce((select jsonb_object_agg(entry.key,entry.value) from jsonb_each(a.answers) entry where exists(select 1 from jsonb_array_elements(a.snapshot->'items') it where it->>'id'=entry.key and it->>'kind'='essay')),'{}'::jsonb),
  'grades',coalesce((select jsonb_agg(jsonb_build_object('item_id',g.item_id,'points',g.points,'feedback',g.feedback)) from private.essay_grades g where g.attempt_id=a.id),'[]'::jsonb));
end $$;

create or replace function private.grade_essays(actor uuid, target uuid, operation uuid, grades jsonb) returns jsonb language plpgsql as $$
declare a private.attempts; e private.exams; r private.results; item jsonb; grade jsonb; points numeric; total numeric:=0; essay_n integer;
begin
 -- Same attempt lock and lock order as submit, reset and finalization.
 select * into a from private.attempts where id=target for update;
 if not found then raise exception 'NOT_FOUND'; end if;
 select * into e from private.exams where id=a.exam_id;
 if not private.can_manage(actor,e) then raise exception 'NOT_FOUND'; end if;
 if a.status<>'finalized' then raise exception 'ATTEMPT_ACTIVE'; end if;
 select * into r from private.results where attempt_id=a.id for update;
 if operation is null then raise exception 'INVALID_GRADE'; end if;
 if r.grade_operation=operation then
   if r.grade_payload is distinct from grades then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
   return private.result_view(r);
 end if;
 if r.grading_status<>'pending' then raise exception 'GRADE_FINALIZED'; end if;
 select count(*) into essay_n from jsonb_array_elements(a.snapshot->'items') it where it->>'kind'='essay';
 if jsonb_typeof(grades) is distinct from 'array' or jsonb_array_length(grades)<>essay_n or
  (select count(distinct g->>'item_id') from jsonb_array_elements(grades) g)<>essay_n then raise exception 'INVALID_GRADE'; end if;
 for item in select value from jsonb_array_elements(a.snapshot->'items') where value->>'kind'='essay' loop
   select value into grade from jsonb_array_elements(grades) where value->>'item_id'=item->>'id';
   if grade is null or jsonb_typeof(grade->'points') is distinct from 'number' then raise exception 'INVALID_GRADE'; end if;
   points:=(grade->>'points')::numeric;
   if points<0 or points>(item->>'weight')::numeric or round(points,2)<>points or length(coalesce(grade->>'feedback',''))>1000 then raise exception 'INVALID_GRADE'; end if;
   if not private.answer_present(a.answers->(item->>'id')) and points<>0 then raise exception 'INVALID_GRADE'; end if;
   insert into private.essay_grades(attempt_id,item_id,points,feedback,actor_id) values(a.id,(item->>'id')::uuid,points,coalesce(grade->>'feedback',''),actor);
   total:=total+points;
 end loop;
 update private.results set essay_points=total,score=round(greatest(0,least(100,100*(mcq_points+total)/nullif(total_points,0))),2),
  grading_status='complete',graded_at=clock_timestamp(),graded_by=actor,grade_operation=operation,grade_payload=grades
  where attempt_id=a.id returning * into r;
 perform private.audit(actor,'essays.graded',a.id,jsonb_build_object('essay_count',essay_n,'score',r.score));
 return private.result_view(r);
end $$;


create or replace function public.school_api(p_actor uuid,p_action text,p_data jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare p private.profiles; e private.exams; a private.attempts; q private.questions; c private.classes;
 target uuid; v_id uuid; n integer; v_epoch integer; item jsonb; opt jsonb; ordered jsonb; options jsonb; snapshot jsonb;
 result jsonb; existing jsonb; v_answers jsonb; v_key text; v_reason text; v_session uuid; v_event uuid; is_staff boolean;
begin
 select * into p from private.profiles where id=p_actor and active;
 if not found then raise exception 'UNAUTHORIZED'; end if;
 target:=nullif(p_data->>'id','')::uuid;
 if p_action='manage.grading' then return private.grading_view(p_actor,target); end if;
 if p_action='manage.grade' then return private.grade_essays(p_actor,target,(p_data->>'operation_id')::uuid,p_data->'grades'); end if;
 if p_action='workspace' then
   return jsonb_build_object('profile',to_jsonb(p),'settings',(select to_jsonb(s) from private.settings s),
    'exams',coalesce((select jsonb_agg((case when private.can_manage(p_actor,x) then to_jsonb(x)-'items' else to_jsonb(x)-'items'-'participant_emails'-'staff_ids'-'question_ids' end)||jsonb_build_object('question_count',jsonb_array_length(x.items),'can_manage',private.can_manage(p_actor,x))) from private.exams x where private.can_manage(p_actor,x) or (x.status<>'draft' and private.assigned(p_actor,x))),'[]'),
    'classes',coalesce((select jsonb_agg(to_jsonb(x)||jsonb_build_object('emails',coalesce((select jsonb_agg(m.email) from private.memberships m where m.class_id=x.id),'[]'))) from private.classes x where p.role='admin' or x.owner_id=p_actor),'[]'),
    'questions',coalesce((select jsonb_agg(to_jsonb(x)) from private.questions x where p.role='admin' or x.owner_id=p_actor or (p.role='teacher' and exists(select 1 from private.exams managed where x.id=any(managed.question_ids) and private.can_manage(p_actor,managed)))),'[]'),
    'attempts',coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'exam_id',x.exam_id,'status',x.status,'deadline_at',x.deadline_at,'attempt_number',x.attempt_number)) from private.attempts x where x.user_id=p_actor),'[]'),
    'users',case when p.role='admin' then coalesce((select jsonb_agg(to_jsonb(x)) from private.profiles x),'[]') else '[]'::jsonb end,
    'invitations',case when p.role='admin' then coalesce((select jsonb_agg(to_jsonb(x)) from private.invitations x),'[]') else '[]'::jsonb end,
    'audit',case when p.role='admin' then coalesce((select jsonb_agg(to_jsonb(x)) from (select * from private.audit_logs order by id desc limit 100) x),'[]') else '[]'::jsonb end,
    'server_now',clock_timestamp());
 end if;
 if p_action like 'admin.%' then
   if p.role<>'admin' then raise exception 'FORBIDDEN'; end if;
   if p_action='admin.invite' then
     insert into private.invitations(email,name,role) values(lower(p_data->>'email'),p_data->>'name',p_data->>'role') on conflict(email) do update set name=excluded.name,role=excluded.role where private.invitations.accepted_by is null;
   elsif p_action='admin.user' then
     if target=p_actor then raise exception 'CANNOT_EDIT_SELF'; end if;
     update private.profiles set role=p_data->>'role',active=(p_data->>'active')::boolean where id=target;
   elsif p_action='admin.settings' then
     update private.settings set institution=p_data->>'institution',result_retention_days=(p_data->>'result_retention_days')::integer,
       event_retention_days=(p_data->>'event_retention_days')::integer,audit_retention_days=(p_data->>'audit_retention_days')::integer;
   else raise exception 'NOT_FOUND'; end if;
   perform private.audit(p_actor,p_action,target,p_data-'id'); return jsonb_build_object('ok',true);
 end if;
 if p_action='classes.save' then
   if p.role not in ('admin','teacher') then raise exception 'FORBIDDEN'; end if;
   if target is not null then select * into c from private.classes where id=target for update; if not found or (p.role<>'admin' and c.owner_id<>p_actor) then raise exception 'NOT_FOUND'; end if; end if;
   insert into private.classes(id,name,owner_id) values(coalesce(target,gen_random_uuid()),p_data->>'name',coalesce(c.owner_id,p_actor))
   on conflict(id) do update set name=excluded.name returning * into c;
   delete from private.memberships where class_id=c.id;
   insert into private.memberships(class_id,email) select c.id,lower(value) from jsonb_array_elements_text(p_data->'emails') on conflict do nothing;
   insert into private.invitations(email,name,role) select lower(value),'','student' from jsonb_array_elements_text(p_data->'emails') on conflict do nothing;
   perform private.audit(p_actor,p_action,c.id); return to_jsonb(c);
 end if;
 if p_action in ('questions.save','questions.archive') then
   if p.role not in ('admin','teacher') then raise exception 'FORBIDDEN'; end if;
   if target is not null then select * into q from private.questions where id=target for update; if not found or (p.role<>'admin' and q.owner_id<>p_actor) then raise exception 'NOT_FOUND'; end if; end if;
   if p_action='questions.archive' then update private.questions set archived=true where id=target; perform private.audit(p_actor,p_action,target); return jsonb_build_object('ok',true); end if;
   if p_data->>'media_path' is not null and p_data->>'media_path' not like p_actor::text||'/%' and p_data->>'media_path' is distinct from q.media_path and p.role<>'admin' then raise exception 'FORBIDDEN'; end if;
   if coalesce(p_data->>'kind','mcq') not in ('mcq','essay') then raise exception 'INVALID_QUESTION'; end if;
   if coalesce(p_data->>'kind','mcq')='mcq' and (jsonb_typeof(p_data->'options') is distinct from 'array' or jsonb_array_length(p_data->'options') not between 2 and 6 or not exists(select 1 from jsonb_array_elements(p_data->'options') o where o->>'id'=p_data->>'correct_option_id')) then raise exception 'INVALID_QUESTION'; end if;
   if coalesce(p_data->>'kind','mcq')='essay' and (coalesce(p_data->'options','[]')<>'[]'::jsonb or p_data->>'correct_option_id' is not null or length(coalesce(p_data->>'rubric',''))>10000) then raise exception 'INVALID_QUESTION'; end if;
   insert into private.questions(id,owner_id,prompt,options,correct_option_id,weight,tag,media_path,kind,rubric)
   values(coalesce(target,gen_random_uuid()),coalesce(q.owner_id,p_actor),p_data->>'prompt',p_data->'options',(p_data->>'correct_option_id')::uuid,(p_data->>'weight')::numeric,coalesce(p_data->>'tag',''),p_data->>'media_path',coalesce(p_data->>'kind','mcq'),case when p_data->>'kind'='essay' then coalesce(p_data->>'rubric','') else '' end)
   on conflict(id) do update set prompt=excluded.prompt,options=excluded.options,correct_option_id=excluded.correct_option_id,weight=excluded.weight,tag=excluded.tag,media_path=excluded.media_path,kind=excluded.kind,rubric=excluded.rubric,version=private.questions.version+1 returning * into q;
   perform private.audit(p_actor,p_action,q.id); return to_jsonb(q);
 end if;
 if p_action like 'exams.%' then
   if p.role not in ('admin','teacher') then raise exception 'FORBIDDEN'; end if;
   if target is not null then select * into e from private.exams where id=target for update; if not found or not private.can_manage(p_actor,e) then raise exception 'NOT_FOUND'; end if; end if;
   if p_action='exams.save' then
     if target is not null and e.status<>'draft' then raise exception 'EXAM_IMMUTABLE'; end if;
     if p_data->>'class_id' is not null and not exists(select 1 from private.classes x where x.id=(p_data->>'class_id')::uuid and (p.role='admin' or x.owner_id=p_actor or x.id=e.class_id)) then raise exception 'FORBIDDEN'; end if;
     if exists(select 1 from jsonb_array_elements_text(p_data->'question_ids') x where not exists(select 1 from private.questions z where z.id=x::uuid and not z.archived and (p.role='admin' or z.owner_id=p_actor or z.id=any(e.question_ids)))) then raise exception 'INVALID_QUESTION'; end if;
     insert into private.exams(id,owner_id,title,instructions,class_id,mode,opens_at,closes_at,duration_minutes,passing_score,penalty,shuffle_questions,shuffle_options,question_ids,participant_emails)
     values(coalesce(target,gen_random_uuid()),coalesce(e.owner_id,p_actor),p_data->>'title',p_data->>'instructions',nullif(p_data->>'class_id','')::uuid,p_data->>'mode',(p_data->>'opens_at')::timestamptz,(p_data->>'closes_at')::timestamptz,(p_data->>'duration_minutes')::integer,(p_data->>'passing_score')::numeric,(p_data->>'penalty')::numeric,(p_data->>'shuffle_questions')::boolean,(p_data->>'shuffle_options')::boolean,
      array(select value::uuid from jsonb_array_elements_text(p_data->'question_ids')),array(select lower(value) from jsonb_array_elements_text(p_data->'participant_emails')))
     on conflict(id) do update set title=excluded.title,instructions=excluded.instructions,class_id=excluded.class_id,mode=excluded.mode,opens_at=excluded.opens_at,closes_at=excluded.closes_at,duration_minutes=excluded.duration_minutes,passing_score=excluded.passing_score,penalty=excluded.penalty,shuffle_questions=excluded.shuffle_questions,shuffle_options=excluded.shuffle_options,question_ids=excluded.question_ids,participant_emails=excluded.participant_emails returning * into e;
   elsif p_action='exams.publish' then
     if e.status<>'draft' or cardinality(e.question_ids) not between 1 and 100 or e.closes_at<=clock_timestamp() then raise exception 'INVALID_EXAM'; end if;
     select jsonb_agg(jsonb_build_object('id',bank.id,'prompt',bank.prompt,'options',bank.options,'correctOptionId',bank.correct_option_id,'weight',bank.weight,'media_path',bank.media_path,'version',bank.version,'kind',bank.kind,'rubric',bank.rubric) order by list.ord) into snapshot
       from unnest(e.question_ids) with ordinality list(id,ord) join private.questions bank on bank.id=list.id where not bank.archived and (p.role='admin' or bank.owner_id=e.owner_id);
     if jsonb_array_length(coalesce(snapshot,'[]'))<>cardinality(e.question_ids) then raise exception 'INVALID_QUESTION'; end if;
     update private.exams set status='published',items=snapshot,score_released=(mode='quiz') where id=e.id returning * into e;
     insert into private.invitations(email,name,role) select value,'','student' from unnest(e.participant_emails) value on conflict do nothing;
   elsif p_action='exams.close' then update private.exams set status='closed' where id=e.id returning * into e;
   elsif p_action='exams.staff' then
     if p.role<>'admin' then raise exception 'FORBIDDEN'; end if;
     if exists(select 1 from jsonb_array_elements_text(p_data->'staff_ids') value where not exists(select 1 from private.profiles staff where staff.id=value::uuid and staff.active and staff.role='teacher')) then raise exception 'FORBIDDEN'; end if;
     update private.exams set staff_ids=array(select value::uuid from jsonb_array_elements_text(p_data->'staff_ids')) where id=e.id returning * into e;
   elsif p_action='exams.participants' then
     update private.exams set participant_emails=array(select lower(value) from jsonb_array_elements_text(p_data->'participant_emails')) where id=e.id returning * into e;
     insert into private.invitations(email,name,role) select value,'','student' from unnest(e.participant_emails) value on conflict do nothing;
   else raise exception 'NOT_FOUND'; end if;
   perform private.audit(p_actor,p_action,e.id); return to_jsonb(e)-'items';
 end if;
 if p_action='attempt.start' then
   select * into e from private.exams where id=target;
   if not found or not private.assigned(p_actor,e) then raise exception 'NOT_FOUND'; end if;
   insert into private.enrollments(exam_id,user_id) values(e.id,p_actor) on conflict do nothing;
   perform 1 from private.enrollments where exam_id=e.id and user_id=p_actor for update;
   select * into a from private.attempts where exam_id=e.id and user_id=p_actor order by attempt_number desc limit 1 for update;
   if found and a.status='in_progress' then
     if a.deadline_at<=clock_timestamp() then perform private.finish(a.id,'deadline'); select * into a from private.attempts where id=a.id;
     elsif a.session_id<>(p_data->>'session_id')::uuid then raise exception 'STALE_SESSION'; end if;
     return private.attempt_view(a);
   end if;
   select count(*) into n from private.attempts where exam_id=e.id and user_id=p_actor;
   if n>=(select max_attempts from private.enrollments where exam_id=e.id and user_id=p_actor) then
     if a.id is not null then return private.attempt_view(a); end if; raise exception 'ATTEMPT_LIMIT'; end if;
   if e.status<>'published' or clock_timestamp()<e.opens_at or clock_timestamp()>=e.closes_at then raise exception 'EXAM_NOT_OPEN'; end if;
   ordered:='[]';
   for item in select value from jsonb_array_elements(e.items) with ordinality t(value,ord) order by case when e.shuffle_questions then random() else ord::double precision end loop
     select jsonb_agg(value order by case when e.shuffle_options then random() else ord::double precision end) into options from jsonb_array_elements(item->'options') with ordinality t(value,ord);
     ordered:=ordered||jsonb_build_array(item||jsonb_build_object('options',coalesce(options,'[]'::jsonb)));
   end loop;
   insert into private.attempts(exam_id,user_id,attempt_number,deadline_at,session_id,snapshot)
   values(e.id,p_actor,n+1,least(clock_timestamp()+make_interval(mins=>e.duration_minutes),e.closes_at),(p_data->>'session_id')::uuid,
    jsonb_build_object('items',ordered,'title',e.title,'mode',e.mode,'penalty',e.penalty,'passing_score',e.passing_score)) returning * into a;
   perform private.audit(p_actor,p_action,a.id); return private.attempt_view(a);
 end if;
 if p_action like 'attempt.%' then
   select * into a from private.attempts where id=target and user_id=p_actor for update;
   if not found then raise exception 'NOT_FOUND'; end if;
   select * into e from private.exams where id=a.exam_id;
   if a.status='in_progress' and a.deadline_at<=clock_timestamp() then perform private.finish(a.id,'deadline'); select * into a from private.attempts where id=target; end if;
   if p_action='attempt.result' then
     select private.result_view(r) into result from private.results r where r.attempt_id=a.id;
     if result is null then raise exception 'ATTEMPT_ACTIVE'; end if;
     if not e.score_released or result->>'grading_status'<>'complete' then result:=result-'score'-'correct_count'-'wrong_count'-'empty_count'-'essay_points'; end if;
     return jsonb_build_object('receipt',result,'score_released',e.score_released and result->>'grading_status'='complete','review_released',e.review_released,'passing_score',(a.snapshot->>'passing_score')::numeric,
      'essay_grades',case when e.score_released and result->>'grading_status'='complete' then coalesce((select jsonb_agg(jsonb_build_object('item_id',g.item_id,'points',g.points,'feedback',g.feedback)) from private.essay_grades g where g.attempt_id=a.id),'[]'::jsonb) else '[]'::jsonb end,
      'review',case when e.review_released then a.snapshot->'items' else '[]'::jsonb end,'answers',case when e.review_released then a.answers else '{}'::jsonb end);
   end if;
   v_session:=nullif(p_data->>'session_id','')::uuid;
   if p_action='attempt.takeover' then
     if a.status='finalized' then raise exception 'ATTEMPT_FINALIZED'; end if;
     if e.mode='exam' and (a.takeover_requested is distinct from v_session or not a.takeover_approved) then
       update private.attempts set takeover_requested=v_session,takeover_approved=false where id=a.id;
       return jsonb_build_object('pending',true);
     end if;
     update private.attempts set session_id=v_session,session_generation=session_generation+1,takeover_requested=null,takeover_approved=false where id=a.id returning * into a;
     perform private.audit(p_actor,'session.takeover',a.id); return private.attempt_view(a);
   end if;
   if a.session_id is distinct from v_session then raise exception 'STALE_SESSION'; end if;
   if p_action='attempt.get' then return private.attempt_view(a); end if;
   v_epoch:=(p_data->>'answer_epoch')::integer;
   if p_action='attempt.events' then
     v_event:=(p_data->>'event_id')::uuid;
     select jsonb_build_object('outcome',outcome,'reset_epoch',reset_epoch) into existing from private.integrity_events where id=v_event and attempt_id=a.id;
     if existing is not null then return jsonb_build_object('event',existing,'attempt',private.attempt_view(a)); end if;
     if p_data->>'type' not in ('visibility_hidden','visibility_visible','fullscreen_exit','fullscreen_enter','connection_lost','connection_restored') then raise exception 'INVALID_EVENT'; end if;
     v_reason:='logged';
     if p_data->>'type'='visibility_hidden' and e.mode='exam' then
       if a.status='finalized' then v_reason:='late';
       elsif v_epoch<>a.answer_epoch then v_reason:='stale';
       else
         select count(*) into n from jsonb_object_keys(a.answers);
         update private.attempts set answers='{}',operations='{}',answer_epoch=answer_epoch+1,reset_count=reset_count+1,current_question=0 where id=a.id returning * into a;
         perform private.audit(p_actor,'answers.reset',a.id,jsonb_build_object('event_id',v_event,'answer_count',n,'new_epoch',a.answer_epoch)); v_reason:='reset';
       end if;
     end if;
     insert into private.integrity_events(id,attempt_id,type,answer_epoch,client_at,outcome,reset_epoch)
      values(v_event,a.id,p_data->>'type',v_epoch,nullif(p_data->>'client_at','')::timestamptz,v_reason,case when v_reason='reset' then a.answer_epoch end);
     return jsonb_build_object('event',jsonb_build_object('outcome',v_reason,'reset_epoch',a.answer_epoch),'attempt',private.attempt_view(a));
   end if;
   if p_action='attempt.heartbeat' then
     update private.attempts set last_seen_at=clock_timestamp() where id=a.id;
     return jsonb_build_object('server_now',clock_timestamp(),'deadline_at',a.deadline_at,'status',a.status,'answer_epoch',a.answer_epoch);
   end if;
   if p_action='attempt.submit' and a.status='finalized' then return (select to_jsonb(r) from private.results r where attempt_id=a.id); end if;
   if a.status<>'in_progress' then return jsonb_build_object('ok',false,'code','ATTEMPT_FINALIZED'); end if;
   if v_epoch is null or v_epoch<>a.answer_epoch then raise exception 'ANSWER_EPOCH_MISMATCH'; end if;
   if p_action='attempt.submit' then return private.finish(a.id,'manual'); end if;
   if p_action='attempt.save' then
     v_key:=p_data->>'item_id'; v_id:=(p_data->>'operation_id')::uuid;
     existing:=a.operations->v_id::text;
     if existing is not null then
       if existing->'payload'<>p_data-'operation_id' then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
       return existing->'response';
     end if;
     select value into item from jsonb_array_elements(a.snapshot->'items') where value->>'id'=v_key;
     if item is null then raise exception 'INVALID_ANSWER'; end if;
     if coalesce(item->>'kind','mcq')='essay' then
       if p_data->>'option_id' is not null or length(coalesce(p_data->>'text',''))>20000 then raise exception 'INVALID_ANSWER'; end if;
     elsif coalesce(p_data->>'text','')<>'' or (p_data->>'option_id' is not null and not exists(select 1 from jsonb_array_elements(item->'options') o where o->>'id'=p_data->>'option_id')) then raise exception 'INVALID_ANSWER'; end if;
         n:=coalesce((a.answers->v_key->>'revision')::integer,0);
     if n<>(p_data->>'expected_revision')::integer then raise exception 'REVISION_CONFLICT'; end if;
     result:=jsonb_build_object('optionId',p_data->>'option_id','text',case when item->>'kind'='essay' then coalesce(p_data->>'text','') else null end,'marked',coalesce((p_data->>'marked')::boolean,false),'revision',n+1,'saved_at',clock_timestamp());
     v_answers:=jsonb_set(a.answers,array[v_key],result);
     result:=jsonb_build_object('answer',result,'answer_epoch',a.answer_epoch);
     update private.attempts set answers=v_answers,operations=jsonb_set(operations,array[v_id::text],jsonb_build_object('payload',p_data-'operation_id','response',result)),current_question=coalesce((p_data->>'current_question')::integer,0),last_seen_at=clock_timestamp() where id=a.id;
     return result;
   end if;
   raise exception 'NOT_FOUND';
 end if;
 if p_action like 'manage.%' then
   if p_action='manage.action' then
     select * into a from private.attempts where id=target for update;
     if not found then raise exception 'NOT_FOUND'; end if;
     select * into e from private.exams where id=a.exam_id;
   else select * into e from private.exams where id=target for update; end if;
   if e.id is null or not private.can_manage(p_actor,e) then raise exception 'NOT_FOUND'; end if;
   if p_action in ('manage.monitor','manage.export') then
     if p_action='manage.export' then perform private.audit(p_actor,'results.export',e.id); end if;
     return jsonb_build_object('exam',to_jsonb(e),'attempts',coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'user_id',x.user_id,'name',u.name,'email',u.email,'status',x.status,'started_at',x.started_at,'deadline_at',x.deadline_at,'last_seen_at',x.last_seen_at,'reset_count',x.reset_count,'answered',(select count(*) from jsonb_each(x.answers) answered_entry where private.answer_present(answered_entry.value)),'total',jsonb_array_length(x.snapshot->'items'),'takeover_requested',x.takeover_requested,'attempt_number',x.attempt_number,'result',to_jsonb(r),'review',to_jsonb(v),'events',coalesce((select jsonb_agg(to_jsonb(z)) from private.integrity_events z where z.attempt_id=x.id),'[]'))) from private.attempts x join private.profiles u on u.id=x.user_id left join private.results r on r.attempt_id=x.id left join private.reviews v on v.attempt_id=x.id where x.exam_id=e.id),'[]'),'server_now',clock_timestamp());
   elsif p_action='manage.release' then
     if exists(select 1 from private.results pending join private.attempts attempt on attempt.id=pending.attempt_id where attempt.exam_id=e.id and pending.grading_status='pending') then raise exception 'GRADING_PENDING'; end if;
     if (p_data->>'review')::boolean and (clock_timestamp()<e.closes_at or exists(select 1 from private.attempts where exam_id=e.id and deadline_at>clock_timestamp())) then raise exception 'REVIEW_TOO_EARLY'; end if;
     update private.exams set score_released=true,review_released=review_released or (p_data->>'review')::boolean where id=e.id;
   elsif p_action='manage.action' then
     v_reason:=p_data->>'reason'; if length(trim(v_reason))<5 then raise exception 'REASON_REQUIRED'; end if;
     if p_data->>'action' in ('extend','terminate','approve_takeover') and (a.status='finalized' or a.deadline_at<=clock_timestamp()) then
       if a.status='in_progress' then perform private.finish(a.id,'deadline'); end if;
       return jsonb_build_object('ok',false,'code','ATTEMPT_FINALIZED');
     end if;
     if p_data->>'action'='extend' then
       update private.attempts set deadline_at=deadline_at+make_interval(mins=>(p_data->>'minutes')::integer) where id=a.id;
     elsif p_data->>'action'='terminate' then perform private.finish(a.id,'staff_termination');
     elsif p_data->>'action'='approve_takeover' then
       if a.takeover_requested is null then raise exception 'NO_TAKEOVER_REQUEST'; end if;
       update private.attempts set takeover_approved=true where id=a.id;
     elsif p_data->>'action'='retake' then
       if a.status<>'finalized' or e.review_released then raise exception 'RETAKE_NOT_ALLOWED'; end if;
       update private.enrollments set max_attempts=max_attempts+1 where exam_id=e.id and user_id=a.user_id;
     elsif p_data->>'action'='review' then
       insert into private.reviews(attempt_id,decision,reason,actor_id) values(a.id,p_data->>'decision',v_reason,p_actor)
       on conflict(attempt_id) do update set decision=excluded.decision,reason=excluded.reason,actor_id=excluded.actor_id,updated_at=clock_timestamp();
     else raise exception 'INVALID_ACTION'; end if;
   else raise exception 'NOT_FOUND'; end if;
   perform private.audit(p_actor,p_action,coalesce(a.id,e.id),p_data-'id'); return jsonb_build_object('ok',true);
 end if;
 raise exception 'NOT_FOUND';
end $$;

revoke all on private.essay_grades from public, anon, authenticated;
revoke all on all functions in schema private from public, anon, authenticated;
revoke all on function public.school_api(uuid,text,jsonb) from public, anon, authenticated;
grant execute on function public.school_api(uuid,text,jsonb) to service_role;

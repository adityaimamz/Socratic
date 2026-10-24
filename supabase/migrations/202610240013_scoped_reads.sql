-- Additive read models. Existing school_api callers remain compatible.
create index questions_owner_page on private.questions(owner_id,created_at desc,id desc);
create index classes_owner_page on private.classes(owner_id,created_at desc,id desc);
create index exams_owner_page on private.exams(owner_id,created_at desc,id desc);
create index memberships_email_class on private.memberships(email,class_id);
create index attempts_user_exam on private.attempts(user_id,exam_id,attempt_number desc);
create index integrity_events_attempt_page on private.integrity_events(attempt_id,received_at desc,id desc);
create index profiles_page on private.profiles(created_at desc,id desc);
create index rate_limits_expiry on private.rate_limits(minute);

create function private.exam_list_item(e private.exams, actor uuid) returns jsonb
language sql stable set search_path='' as $$
 select jsonb_build_object('id',e.id,'owner_id',e.owner_id,'title',e.title,'mode',e.mode,'status',e.status,'opens_at',e.opens_at,'closes_at',e.closes_at,'duration_minutes',e.duration_minutes,
 'question_count',case when e.status='draft' then cardinality(e.question_ids) else jsonb_array_length(e.items) end,'can_manage',private.can_manage(actor,e))
$$;

create function private.exam_summary(e private.exams, actor uuid) returns jsonb
language sql stable set search_path='' as $$
 select (case when private.can_manage(actor,e) then to_jsonb(e)-'items'
 else to_jsonb(e)-'items'-'participant_emails'-'staff_ids'-'question_ids'-'owner_id' end)
 ||jsonb_build_object('question_count',case when e.status='draft' then cardinality(e.question_ids) else jsonb_array_length(e.items) end,'can_manage',private.can_manage(actor,e))
$$;

create function private.question_summary(q private.questions) returns jsonb
language sql immutable set search_path='' as $$
 select jsonb_build_object('id',q.id,'owner_id',q.owner_id,'kind',q.kind,'prompt',q.prompt,'weight',q.weight,'tag',q.tag,'archived',q.archived,'version',q.version,'option_count',jsonb_array_length(q.options))
$$;

create function private.question_visible(actor uuid, target private.questions) returns boolean
language sql stable set search_path='' as $$
 select exists(select 1 from private.profiles p where p.id=actor and p.active and
 (p.role='admin' or p.role='teacher' and (target.owner_id=actor or exists(
 select 1 from private.exams e where target.id=any(e.question_ids) and private.can_manage(actor,e)))))
$$;

create function private.school_view(actor uuid, view_name text, input jsonb) returns jsonb
language plpgsql set search_path='' as $$
declare p private.profiles; e private.exams; a private.attempts; q private.questions;
 target uuid:=nullif(input->>'id','')::uuid; page_no integer:=greatest(1,coalesce((input->>'page')::integer,1));
 skip_n integer; search text:=coalesce(input->>'q',''); rows jsonb; total_n bigint; result jsonb; selected uuid[];
begin
 skip_n:=(page_no-1)*50;
 select * into p from private.profiles where id=actor and active;
 if not found then raise exception 'UNAUTHORIZED'; end if;
 if view_name like 'admin-%' and p.role<>'admin' then raise exception 'FORBIDDEN'; end if;
 if view_name in ('teacher-overview','questions','question','classes','class','class-options','exams','exam','exam-editor','exam-preview','exam-participants','teachers','question-selection','monitor','events','grading') and p.role='student' then raise exception 'FORBIDDEN'; end if;

 if view_name='session' then return to_jsonb(p);
 elsif view_name='teacher-overview' then
  select coalesce(jsonb_agg(private.exam_list_item(x,actor) order by x.created_at desc,x.id desc),'[]') into rows from
   (select * from private.exams x where (p.role='admin' or p.role='teacher' and (x.owner_id=actor or actor=any(x.staff_ids))) order by x.created_at desc,x.id desc limit 6) x;
  return jsonb_build_object('exams',rows,'published',(select count(*) from private.exams x where (p.role='admin' or p.role='teacher' and (x.owner_id=actor or actor=any(x.staff_ids))) and status='published'),
   'questions',(select count(*) from private.questions x where not archived and (p.role='admin' or p.role='teacher' and (x.owner_id=actor or exists(select 1 from private.exams managed where x.id=any(managed.question_ids) and (managed.owner_id=actor or actor=any(managed.staff_ids)))))),
   'classes',(select count(*) from private.classes x where p.role='admin' or owner_id=actor));
 elsif view_name='student-dashboard' then
  if p.role<>'student' then raise exception 'FORBIDDEN'; end if;
  select count(*) into total_n from private.exams x where x.status<>'draft' and (p.email=any(x.participant_emails) or exists(select 1 from private.memberships m where m.class_id=x.class_id and m.email=p.email)) and position(lower(search) in lower(x.title))>0;
  select coalesce(jsonb_agg(private.exam_list_item(x,actor) order by x.opens_at,x.id),'[]') into rows from
   (select * from private.exams x where x.status<>'draft' and (p.email=any(x.participant_emails) or exists(select 1 from private.memberships m where m.class_id=x.class_id and m.email=p.email)) and position(lower(search) in lower(x.title))>0 order by x.opens_at,x.id limit 50 offset skip_n) x;
  return jsonb_build_object('exams',rows,'total',total_n,'page',page_no,'pageSize',50,'server_now',clock_timestamp(),
   'attempts',coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'exam_id',x.exam_id,'status',x.status,'deadline_at',x.deadline_at,'attempt_number',x.attempt_number) order by x.attempt_number)
    from private.attempts x where x.user_id=actor and x.exam_id in (select (v->>'id')::uuid from jsonb_array_elements(rows) v)),'[]'),
   'available',(select count(*) from private.exams x where x.status='published' and (p.email=any(x.participant_emails) or exists(select 1 from private.memberships m where m.class_id=x.class_id and m.email=p.email)) and x.opens_at<=clock_timestamp() and x.closes_at>clock_timestamp()),
   'scheduled',(select count(*) from private.exams x where x.status<>'draft' and (p.email=any(x.participant_emails) or exists(select 1 from private.memberships m where m.class_id=x.class_id and m.email=p.email)) and position(lower(search) in lower(x.title))>0 and x.opens_at>clock_timestamp()),
   'completed',(select count(*) from private.attempts x where x.user_id=actor and x.status='finalized'));
 elsif view_name in ('questions','question-selection') then
  select count(*) into total_n from private.questions x where not archived and (p.role='admin' or p.role='teacher' and (x.owner_id=actor or exists(select 1 from private.exams managed where x.id=any(managed.question_ids) and (managed.owner_id=actor or actor=any(managed.staff_ids))))) and (position(lower(search) in lower(x.prompt))>0 or position(lower(search) in lower(x.tag))>0);
  select coalesce(jsonb_agg(private.question_summary(x) order by x.created_at desc,x.id desc),'[]') into rows from
   (select * from private.questions x where not archived and (p.role='admin' or p.role='teacher' and (x.owner_id=actor or exists(select 1 from private.exams managed where x.id=any(managed.question_ids) and (managed.owner_id=actor or actor=any(managed.staff_ids))))) and (position(lower(search) in lower(x.prompt))>0 or position(lower(search) in lower(x.tag))>0) order by x.created_at desc,x.id desc limit 50 offset skip_n) x;
 elsif view_name='question' then
  select * into q from private.questions x where x.id=target and (p.role='admin' or p.role='teacher' and (x.owner_id=actor or exists(select 1 from private.exams managed where x.id=any(managed.question_ids) and (managed.owner_id=actor or actor=any(managed.staff_ids)))));
  if not found then raise exception 'NOT_FOUND'; end if;
  return jsonb_build_object('question',to_jsonb(q));
 elsif view_name='class' then
  select to_jsonb(x)||jsonb_build_object('emails',coalesce((select jsonb_agg(m.email order by m.email) from private.memberships m where m.class_id=x.id),'[]')) into result
   from private.classes x where x.id=target and (p.role='admin' or x.owner_id=actor);
  if result is null then raise exception 'NOT_FOUND'; end if;
  return jsonb_build_object('class',result);
 elsif view_name in ('classes','class-options') then
  select count(*) into total_n from private.classes x where (p.role='admin' or x.owner_id=actor) and position(lower(search) in lower(x.name))>0;
  select coalesce(jsonb_agg((case when view_name='class-options' then jsonb_build_object('id',x.id,'name',x.name) else jsonb_build_object('id',x.id,'name',x.name,'owner_id',x.owner_id,'member_count',(select count(*) from private.memberships m where m.class_id=x.id)) end) order by x.created_at desc,x.id desc),'[]') into rows from
   (select * from private.classes x where (p.role='admin' or x.owner_id=actor) and position(lower(search) in lower(x.name))>0 order by x.created_at desc,x.id desc limit 50 offset skip_n) x;
 elsif view_name='exams' then
  select count(*) into total_n from private.exams x where (p.role='admin' or p.role='teacher' and (x.owner_id=actor or actor=any(x.staff_ids))) and position(lower(search) in lower(x.title))>0;
  select coalesce(jsonb_agg(private.exam_list_item(x,actor) order by x.created_at desc,x.id desc),'[]') into rows from
   (select * from private.exams x where (p.role='admin' or p.role='teacher' and (x.owner_id=actor or actor=any(x.staff_ids))) and position(lower(search) in lower(x.title))>0 order by x.created_at desc,x.id desc limit 50 offset skip_n) x;
 elsif view_name in ('exam','exam-editor','exam-preview','exam-participants','exam-rules','monitor') then
  if target is not null then
   select * into e from private.exams x where x.id=target and ((p.role='admin' or p.role='teacher' and (x.owner_id=actor or actor=any(x.staff_ids))) or view_name='exam-rules' and x.status<>'draft' and (p.email=any(x.participant_emails) or exists(select 1 from private.memberships m where m.class_id=x.class_id and m.email=p.email)) and position(lower(search) in lower(x.title))>0);
   if not found then raise exception 'NOT_FOUND'; end if;
  elsif view_name<>'exam-editor' then raise exception 'NOT_FOUND'; end if;
  result:=jsonb_build_object('exam',case when e.id is null then null else private.exam_summary(e,actor) end);
  if view_name='exam-editor' then
   return result||jsonb_build_object('selected_questions',coalesce((select jsonb_agg(private.question_summary(x)) from private.questions x where x.id=any(e.question_ids) and (p.role='admin' or p.role='teacher' and (x.owner_id=actor or exists(select 1 from private.exams managed where x.id=any(managed.question_ids) and (managed.owner_id=actor or actor=any(managed.staff_ids)))))),'[]'),
    'selected_class',(select jsonb_build_object('id',x.id,'name',x.name) from private.classes x where x.id=e.class_id));
  elsif view_name='exam-preview' then
   if e.status<>'draft' then raise exception 'EXAM_IMMUTABLE'; end if;
   return result||jsonb_build_object('questions',coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'kind',x.kind,'prompt',x.prompt,'weight',x.weight,'options',x.options,'media_path',x.media_path) order by array_position(e.question_ids,x.id)) from private.questions x where x.id=any(e.question_ids)),'[]'));
  elsif view_name='exam-participants' then
   return result||jsonb_build_object('selected_staff',coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'name',x.name)) from private.profiles x where x.id=any(e.staff_ids) and x.active),'[]'));
  elsif view_name='exam-rules' then
   return result||jsonb_build_object('server_now',clock_timestamp(),'fullscreen_exempt',public.school_accommodation_get(actor,e.id)->'fullscreen_exempt','settings',(select to_jsonb(x) from private.settings x),'attempts',coalesce((select jsonb_agg(to_jsonb(x)) from (select id,exam_id,status,deadline_at,attempt_number from private.attempts where user_id=actor and exam_id=e.id order by attempt_number desc limit 1) x),'[]'));
  elsif view_name='monitor' then
   select count(*) into total_n from private.attempts x join private.profiles u on u.id=x.user_id where x.exam_id=e.id and position(lower(search) in lower(u.name||' '||u.email))>0;
   select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'user_id',x.user_id,'name',u.name,'email',u.email,'status',x.status,'started_at',x.started_at,'deadline_at',x.deadline_at,'last_seen_at',x.last_seen_at,'reset_count',x.reset_count,
    'answered',(select count(*) from jsonb_each(x.answers) v where private.answer_present(v.value)),'total',jsonb_array_length(x.snapshot->'items'),'takeover_requested',x.takeover_requested,'attempt_number',x.attempt_number,'result',to_jsonb(r),'review',to_jsonb(v)) order by x.started_at desc,x.id desc),'[]') into rows
    from (select attempt_row.* from private.attempts attempt_row join private.profiles u on u.id=attempt_row.user_id where attempt_row.exam_id=e.id and position(lower(search) in lower(u.name||' '||u.email))>0 order by attempt_row.started_at desc,attempt_row.id desc limit 50 offset skip_n) x
    join private.profiles u on u.id=x.user_id left join private.results r on r.attempt_id=x.id left join private.reviews v on v.attempt_id=x.id;
   return result||jsonb_build_object('attempts',rows,'total',total_n,'page',page_no,'pageSize',50,'server_now',clock_timestamp(),'stats',
    (select jsonb_build_object('sessions',count(*),'active',count(*) filter(where status='in_progress'),'finished',count(*) filter(where status='finalized'),'resets',coalesce(sum(reset_count),0)) from private.attempts where exam_id=e.id));
  end if;
  return result||jsonb_build_object('class_name',(select x.name from private.classes x where x.id=e.class_id));
 elsif view_name in ('events','grading','result') then
  if view_name='grading' then return public.school_api(actor,'manage.grading',input); end if;
  if view_name='result' then return public.school_api(actor,'attempt.result',input); end if;
  select * into a from private.attempts where id=target;
  select * into e from private.exams where id=a.exam_id;
  if a.id is null or not private.can_manage(actor,e) then raise exception 'NOT_FOUND'; end if;
  select count(*) into total_n from private.integrity_events where attempt_id=target;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.received_at desc,x.id desc),'[]') into rows from
   (select * from private.integrity_events where attempt_id=target order by received_at desc,id desc limit 50 offset skip_n) x;
 elsif view_name in ('admin-users','teachers') then
  if view_name='teachers' and p.role<>'admin' then raise exception 'FORBIDDEN'; end if;
  select count(*) into total_n from private.profiles x where (view_name='admin-users' or x.role='teacher' and x.active) and position(lower(search) in lower(x.name||' '||x.email))>0;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc,x.id desc),'[]') into rows from
   (select * from private.profiles x where (view_name='admin-users' or x.role='teacher' and x.active) and position(lower(search) in lower(x.name||' '||x.email))>0 order by x.created_at desc,x.id desc limit 50 offset skip_n) x;
 elsif view_name='admin-invitations' then
  select count(*) into total_n from private.invitations x where accepted_by is null and position(lower(search) in lower(x.name||' '||x.email))>0;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc,x.email),'[]') into rows from
   (select * from private.invitations x where accepted_by is null and position(lower(search) in lower(x.name||' '||x.email))>0 order by x.created_at desc,x.email limit 50 offset skip_n) x;
 elsif view_name='admin-settings' then return jsonb_build_object('settings',(select to_jsonb(x) from private.settings x));
 elsif view_name='admin-audit' then
  select count(*) into total_n from private.audit_logs where position(lower(search) in lower(action))>0;
  select coalesce(jsonb_agg(to_jsonb(x)||jsonb_build_object('actor_name',u.name) order by x.id desc),'[]') into rows from
   (select * from private.audit_logs where position(lower(search) in lower(action))>0 order by id desc limit 50 offset skip_n) x left join private.profiles u on u.id=x.actor_id;
 else raise exception 'NOT_FOUND'; end if;
 return jsonb_build_object('items',rows,'total',total_n,'page',page_no,'pageSize',50);
end $$;

-- Rate-limit bookkeeping is outside the operation savepoint: failed writes still count.
create function public.school_request(p_actor uuid,p_email text,p_name text,p_action text,p_data jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare p jsonb; result jsonb; lane text; code text;
begin
 begin p:=public.school_accept(p_actor,p_email,p_name);
 exception when others then return jsonb_build_object('ok',false,'code',sqlerrm); end;
 lane:=case when p_action='attempt.save' then 'answers' when p_action='attempt.events' and p_data->>'type'='visibility_hidden' then 'reset'
 when p_action='attempt.heartbeat' then 'heartbeat' when p_action like 'view.%' or p_action in ('workspace','attempt.get','attempt.result','manage.monitor','manage.export','manage.grading','admin.health','exams.accommodation.get','media.allowed') then 'read' else 'write' end;
 if not public.school_rate_limit(p_actor,lane) then return jsonb_build_object('ok',false,'code','RATE_LIMITED'); end if;
 begin
  if p_action like 'view.%' then result:=private.school_view(p_actor,substr(p_action,6),p_data);
  elsif p_action='admin.health' then result:=public.school_health(p_actor);
  elsif p_action='exams.accommodation.get' then result:=public.school_accommodation_get(p_actor,(p_data->>'id')::uuid);
  elsif p_action='exams.accommodation.set' then result:=public.school_accommodation_set(p_actor,(p_data->>'id')::uuid,p_data->>'email',(p_data->>'fullscreen_exempt')::boolean,p_data->>'reason');
  elsif p_action in ('import.authorize','media.authorize') then
   if p->>'role' not in ('teacher','admin') then raise exception 'FORBIDDEN'; end if; result:=p;
  elsif p_action='import.commit' then result:=public.school_import_questions(p_actor,(p_data->>'operation_id')::uuid,p_data->'questions');
  elsif p_action='media.allowed' then result:=to_jsonb(public.school_media_allowed(p_actor,p_data->>'path'));
  else result:=public.school_api(p_actor,p_action,p_data); end if;
  return jsonb_build_object('ok',true,'data',result,'profile',p);
 exception when others then
  get stacked diagnostics code=message_text;
  return jsonb_build_object('ok',false,'code',code,'profile',p);
 end;
end $$;
revoke all on function private.exam_list_item(private.exams,uuid),private.exam_summary(private.exams,uuid),private.question_summary(private.questions),private.question_visible(uuid,private.questions),private.school_view(uuid,text,jsonb) from public,anon,authenticated;
revoke all on function public.school_request(uuid,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.school_request(uuid,text,text,text,jsonb) to service_role;

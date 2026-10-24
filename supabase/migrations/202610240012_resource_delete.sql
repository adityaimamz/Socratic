-- Explicit deletion of unused bank questions/classes and unpublished drafts only.
-- Receipts live in the audited operation so retrying a lost response is safe.
create index resource_delete_receipts on private.audit_logs(actor_id,(details->>'operation_id'))
 where action in ('questions.delete','classes.delete','exams.delete');

create function private.delete_resource(actor uuid, action text, target uuid, operation uuid)
returns jsonb language plpgsql set search_path='' as $$
declare p private.profiles; q private.questions; c private.classes; e private.exams; previous private.audit_logs; label text;
begin
 select * into p from private.profiles where id=actor and active;
 if not found then raise exception 'UNAUTHORIZED'; end if;
 if p.role not in ('admin','teacher') then raise exception 'FORBIDDEN'; end if;
 if target is null or operation is null or action not in ('questions.delete','classes.delete','exams.delete') then raise exception 'NOT_FOUND'; end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text||operation::text,0));
 select * into previous from private.audit_logs a where a.actor_id=actor and a.action in ('questions.delete','classes.delete','exams.delete') and a.details->>'operation_id'=operation::text limit 1;
 if found then
  if previous.action<>action or previous.resource_id<>target then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
  return jsonb_build_object('ok',true,'deleted',true,'name',previous.details->>'name');
 end if;
 if action='questions.delete' then
  select * into q from private.questions where id=target for update;
  if not found or (p.role<>'admin' and q.owner_id<>actor) then raise exception 'NOT_FOUND'; end if;
  if exists(select 1 from private.exams x where target=any(x.question_ids)) then raise exception 'QUESTION_IN_USE'; end if;
  label:=left(q.prompt,200);
  delete from private.questions where id=target;
 elsif action='classes.delete' then
  select * into c from private.classes where id=target for update;
  if not found or (p.role<>'admin' and c.owner_id<>actor) then raise exception 'NOT_FOUND'; end if;
  if exists(select 1 from private.exams x where x.class_id=target) then raise exception 'CLASS_IN_USE'; end if;
  label:=c.name;
  delete from private.classes where id=target;
 else
  select * into e from private.exams where id=target for update;
  if not found or (p.role<>'admin' and e.owner_id<>actor) then raise exception 'NOT_FOUND'; end if;
  if e.status<>'draft' then raise exception 'DRAFT_ONLY'; end if;
  if exists(select 1 from private.attempts x where x.exam_id=target) then raise exception 'EXAM_HAS_ATTEMPTS'; end if;
  label:=e.title;
  delete from private.exams where id=target;
 end if;
 perform private.audit(actor,action,target,jsonb_build_object('name',label,'operation_id',operation));
 return jsonb_build_object('ok',true,'deleted',true,'name',label);
end;
$$;
revoke all on function private.delete_resource(uuid,text,uuid,uuid) from public,anon,authenticated;

do $migration$
declare definition text;
 dispatch text := $$if p_action='manage.grading' then$$;
 guard text := $$if p_action='exams.save' then$$;
begin
 definition:=pg_get_functiondef('public.school_api(uuid,text,jsonb)'::regprocedure);
 if position(dispatch in definition)=0 or position(guard in definition)=0 then raise exception 'RESOURCE_DELETE_ANCHOR_MISSING'; end if;
 definition:=replace(definition,dispatch,$$if p_action in ('questions.delete','classes.delete','exams.delete') then
  return private.delete_resource(p_actor,p_action,target,(p_data->>'operation_id')::uuid);
 end if;
 if p_action='manage.grading' then$$);
 -- Array references do not have a foreign key: hold each selected question until
 -- the exam save commits, so deletion cannot race validation and leave dangling IDs.
 definition:=replace(definition,guard,$$if p_action='exams.save' then
     perform 1 from private.questions bank
      where bank.id in (select value::uuid from jsonb_array_elements_text(p_data->'question_ids'))
      order by bank.id for share;$$);
 execute definition;
end;
$migration$;

-- Published exams stay editable while attempts are running. Attempts keep their own snapshot
-- (items, order, key), so edits only apply to participants who start afterwards.
create or replace function public.school_exam_update(p_actor uuid,p_exam uuid,p_data jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p private.profiles; e private.exams; snapshot jsonb; qids uuid[]; started boolean;
begin
 select * into p from private.profiles where id=p_actor and active;
 if not found then raise exception 'UNAUTHORIZED'; end if;
 if p.role not in ('admin','teacher') then raise exception 'FORBIDDEN'; end if;
 select * into e from private.exams where id=p_exam for update;
 if not found or not private.can_manage(p_actor,e) then raise exception 'NOT_FOUND'; end if;
 if e.status<>'published' then raise exception 'EXAM_IMMUTABLE'; end if;
 if (p_data->>'closes_at')::timestamptz<=clock_timestamp() or (p_data->>'closes_at')::timestamptz<=(p_data->>'opens_at')::timestamptz then raise exception 'INVALID_EXAM'; end if;
 if p_data->>'class_id' is not null and not exists(select 1 from private.classes x where x.id=(p_data->>'class_id')::uuid and (p.role='admin' or x.owner_id=p_actor or x.id=e.class_id)) then raise exception 'FORBIDDEN'; end if;
 qids:=array(select value::uuid from jsonb_array_elements_text(p_data->'question_ids'));
 started:=exists(select 1 from private.attempts where exam_id=e.id);
  if cardinality(qids) not between 1 and 100 then raise exception 'INVALID_EXAM'; end if;
  if exists(select 1 from unnest(qids) x where not exists(select 1 from private.questions z where z.id=x and not z.archived and (p.role='admin' or z.owner_id=p_actor or z.id=any(e.question_ids)))) then raise exception 'INVALID_QUESTION'; end if;
  select jsonb_agg(jsonb_build_object('id',bank.id,'prompt',bank.prompt,'options',bank.options,'correctOptionId',bank.correct_option_id,'weight',bank.weight,'media_path',bank.media_path,'version',bank.version,'kind',bank.kind,'rubric',bank.rubric) order by list.ord) into snapshot
   from unnest(qids) with ordinality list(id,ord) join private.questions bank on bank.id=list.id where not bank.archived and (p.role='admin' or bank.owner_id=e.owner_id or bank.id=any(e.question_ids));
  if jsonb_array_length(coalesce(snapshot,'[]'))<>cardinality(qids) then raise exception 'INVALID_QUESTION'; end if;
  update private.exams set title=p_data->>'title',instructions=p_data->>'instructions',class_id=nullif(p_data->>'class_id','')::uuid,mode=p_data->>'mode',opens_at=(p_data->>'opens_at')::timestamptz,closes_at=(p_data->>'closes_at')::timestamptz,
   duration_minutes=(p_data->>'duration_minutes')::integer,passing_score=(p_data->>'passing_score')::numeric,penalty=(p_data->>'penalty')::numeric,shuffle_questions=(p_data->>'shuffle_questions')::boolean,shuffle_options=(p_data->>'shuffle_options')::boolean,
   question_ids=qids,items=snapshot,score_released=(p_data->>'mode'='quiz') or e.score_released,participant_emails=array(select lower(value) from jsonb_array_elements_text(p_data->'participant_emails')) where id=e.id returning * into e;
 insert into private.invitations(email,name,role) select value,'','student' from unnest(e.participant_emails) value on conflict do nothing;
 perform private.audit(p_actor,'exams.update',e.id,jsonb_build_object('started',started));
 return to_jsonb(e)-'items';
end $$;

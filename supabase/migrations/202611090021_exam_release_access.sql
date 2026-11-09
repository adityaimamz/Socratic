create function private.review_release_status(exam private.exams, checked_at timestamptz)
returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object(
  'reason',case
   when exam.review_released then 'released'
   when exam.status='draft' then 'draft'
   when exam.status='published' and checked_at<exam.closes_at then 'window_open'
   when active_until is not null then 'attempts_active'
   when exists(select 1 from private.results r join private.attempts a on a.id=r.attempt_id
               where a.exam_id=exam.id and r.grading_status='pending') then 'grading_pending'
   else 'ready' end,
  'active_until',active_until)
 from (select max(deadline_at) as active_until from private.attempts
       where exam_id=exam.id and status='in_progress') active;
$$;
revoke all on function private.review_release_status(private.exams,timestamptz) from public,anon,authenticated;

do $migration$
declare
 definition text;
 start_guard text := $$if e.status<>'published' or clock_timestamp()<e.opens_at or clock_timestamp()>=e.closes_at then raise exception 'EXAM_NOT_OPEN'; end if;$$;
 exam_lock text := $$select * into e from private.exams where id=target for update$$;
 release_guard text := $$if exists(select 1 from private.results pending join private.attempts attempt on attempt.id=pending.attempt_id where attempt.exam_id=e.id and pending.grading_status='pending') then raise exception 'GRADING_PENDING'; end if;
     if (p_data->>'review')::boolean and (clock_timestamp()<e.closes_at or exists(select 1 from private.attempts where exam_id=e.id and deadline_at>clock_timestamp())) then raise exception 'REVIEW_TOO_EARLY'; end if;$$;
 edit_guard text := $$if e.status<>'published' then raise exception 'EXAM_IMMUTABLE'; end if;$$;
 edit_lock text := $$select * into e from private.exams where id=p_exam for update$$;
begin
 definition:=pg_get_functiondef('public.school_api(uuid,text,jsonb)'::regprocedure);
 if position(start_guard in definition)=0 or position(exam_lock in definition)=0 or position(release_guard in definition)=0 then
  raise exception 'EXAM_RELEASE_API_ANCHOR_MISSING';
 end if;
 -- Keep the shared start lock compatible with enrollment foreign-key checks.
 definition:=replace(definition,exam_lock,$$select * into e from private.exams where id=target for no key update$$);
 definition:=replace(definition,start_guard,$$select * into e from private.exams where id=target for share;
   if not found or not private.assigned(p_actor,e) then raise exception 'NOT_FOUND'; end if;
   if e.review_released or e.status<>'published' or clock_timestamp()<e.opens_at or clock_timestamp()>=e.closes_at then raise exception 'EXAM_NOT_OPEN'; end if;$$);
 definition:=replace(definition,release_guard,$$if (p_data->>'review')::boolean then
       case private.review_release_status(e,clock_timestamp())->>'reason'
         when 'released' then return jsonb_build_object('ok',true);
         when 'ready' then null;
         when 'grading_pending' then raise exception 'GRADING_PENDING';
         else raise exception 'REVIEW_TOO_EARLY';
       end case;
     elsif exists(select 1 from private.results pending join private.attempts attempt on attempt.id=pending.attempt_id where attempt.exam_id=e.id and pending.grading_status='pending') then
       raise exception 'GRADING_PENDING';
     end if;$$);
 execute definition;

 definition:=pg_get_functiondef('public.school_exam_update(uuid,uuid,jsonb)'::regprocedure);
 if position(edit_guard in definition)=0 or position(edit_lock in definition)=0 then raise exception 'EXAM_RELEASE_EDIT_ANCHOR_MISSING'; end if;
 definition:=replace(definition,edit_lock,$$select * into e from private.exams where id=p_exam for no key update$$);
 execute replace(definition,edit_guard,$$if e.status<>'published' or e.review_released then raise exception 'EXAM_IMMUTABLE'; end if;$$);
end;
$migration$;

alter function private.school_view(uuid,text,jsonb) rename to school_view_v3;

create function private.school_view(actor uuid, view_name text, input jsonb)
returns jsonb language plpgsql set search_path='' as $$
declare
 data jsonb:=private.school_view_v3(actor,view_name,input);
 target_exam uuid;
 exam private.exams;
 remaining integer;
begin
 if view_name='exam-rules' then
  target_exam:=(data->'exam'->>'id')::uuid;
  select greatest(0,coalesce((select max_attempts from private.enrollments en
          where en.exam_id=target_exam and en.user_id=actor),1)-count(*)) into remaining
  from private.attempts a where a.exam_id=target_exam and a.user_id=actor;
  return data||jsonb_build_object('attempts_remaining',remaining);
 elsif view_name='monitor' then
  select * into exam from private.exams where id=(data->'exam'->>'id')::uuid;
  return data||jsonb_build_object('review_release',private.review_release_status(exam,(data->>'server_now')::timestamptz));
 end if;
 return data;
end;
$$;
revoke all on function private.school_view(uuid,text,jsonb),private.school_view_v3(uuid,text,jsonb) from public,anon,authenticated;

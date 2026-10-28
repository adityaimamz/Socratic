-- Staff-only per-question detail of one attempt: the items as that participant saw them,
-- the answer key and the chosen option. Wraps school_view again; previous body stays as school_view_v2.
alter function private.school_view(uuid,text,jsonb) rename to school_view_v2;

create function private.school_view(actor uuid, view_name text, input jsonb) returns jsonb
language plpgsql set search_path='' as $$
declare a private.attempts; e private.exams; target uuid:=nullif(input->>'id','')::uuid;
begin
 if view_name='attempt-detail' then
  perform 1 from private.profiles where id=actor and active;
  if not found then raise exception 'UNAUTHORIZED'; end if;
  select * into a from private.attempts where id=target;
  select * into e from private.exams where id=a.exam_id;
  if a.id is null or not private.can_manage(actor,e) then raise exception 'NOT_FOUND'; end if;
  return jsonb_build_object('attempt_id',a.id,'exam_id',e.id,'name',(select name from private.profiles where id=a.user_id),'status',a.status,
   'items',coalesce(a.snapshot->'items','[]'::jsonb),'answers',a.answers);
 end if;
 return private.school_view_v2(actor,view_name,input);
end $$;

revoke all on function private.school_view(uuid,text,jsonb),private.school_view_v2(uuid,text,jsonb) from public,anon,authenticated;

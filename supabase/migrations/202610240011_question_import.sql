-- One transaction per import. A retry uses the same operation and returns the receipt.
create table private.question_imports (
 actor_id uuid not null references private.profiles(id) on delete cascade,
 operation_id uuid not null,
 payload_hash text not null,
 receipt jsonb not null,
 created_at timestamptz not null default now(),
 primary key(actor_id, operation_id)
);
alter table private.question_imports enable row level security;
revoke all on private.question_imports from public, anon, authenticated;

create function public.school_import_questions(p_actor uuid, p_operation uuid, p_questions jsonb)
returns jsonb language plpgsql security definer set search_path=public,private,pg_temp as $$
declare
 profile private.profiles; previous private.question_imports;
 question jsonb; saved jsonb; ids jsonb := '[]'; receipt jsonb; fingerprint text;
begin
 select * into profile from private.profiles where id=p_actor and active for share;
 if not found then raise exception 'UNAUTHORIZED'; end if;
 if profile.role not in ('admin','teacher') then raise exception 'FORBIDDEN'; end if;
 if p_operation is null or jsonb_typeof(p_questions) is distinct from 'array' then raise exception 'INVALID_QUESTION'; end if;
 if jsonb_array_length(p_questions) not between 1 and 100 or octet_length(p_questions::text)>1048576 then raise exception 'INVALID_QUESTION'; end if;
 -- Serialize retries from this actor, including two requests that arrive concurrently.
 perform pg_advisory_xact_lock(hashtextextended(p_actor::text||p_operation::text,0));
 fingerprint:=md5(p_questions::text);
 select * into previous from private.question_imports where actor_id=p_actor and operation_id=p_operation;
 if found then
  if previous.payload_hash<>fingerprint then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
  return previous.receipt;
 end if;
 for question in select value from jsonb_array_elements(p_questions) loop
  if jsonb_typeof(question) is distinct from 'object' or question ? 'id' or question->>'media_path' is not null
    or length(coalesce(question->>'prompt','')) not between 3 and 10000
    or length(coalesce(question->>'tag',''))>100
    or coalesce(question->>'kind','') not in ('mcq','essay')
    or coalesce((question->>'weight')::numeric,0)<=0 or (question->>'weight')::numeric>1000 then
   raise exception 'INVALID_QUESTION';
  end if;
  saved:=public.school_api(p_actor,'questions.save',question);
  ids:=ids||jsonb_build_array(saved->'id');
 end loop;
 receipt:=jsonb_build_object('operation_id',p_operation,'count',jsonb_array_length(ids),'question_ids',ids);
 insert into private.question_imports(actor_id,operation_id,payload_hash,receipt) values(p_actor,p_operation,fingerprint,receipt);
 perform private.audit(p_actor,'questions.import',null,jsonb_build_object('operation_id',p_operation,'count',jsonb_array_length(ids)));
 return receipt;
end;
$$;
revoke all on function public.school_import_questions(uuid,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.school_import_questions(uuid,uuid,jsonb) to service_role;

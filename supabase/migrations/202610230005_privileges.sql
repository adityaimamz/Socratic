-- Supabase projects may grant EXECUTE directly to anon/authenticated through
-- default privileges. Revoking only PUBLIC is insufficient for service-only RPCs.
do $$ declare fn record; role_name text; begin
 for fn in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname like 'school_%' loop
  execute format('revoke all on function %s from public',fn.signature);
  foreach role_name in array array['anon','authenticated'] loop
   if exists(select 1 from pg_roles where rolname=role_name) then execute format('revoke all on function %s from %I',fn.signature,role_name); end if;
  end loop;
  if exists(select 1 from pg_roles where rolname='service_role') then execute format('grant execute on function %s to service_role',fn.signature); end if;
 end loop;
 foreach role_name in array array['anon','authenticated'] loop
  if exists(select 1 from pg_roles where rolname=role_name) then
   execute format('revoke all on schema private from %I',role_name);
   execute format('revoke all on all tables in schema private from %I',role_name);
   execute format('revoke all on all functions in schema private from %I',role_name);
  end if;
 end loop;
end $$;

-- Password login uses exactly the same invitation/profile admission rules.
create or replace function public.school_auth_allowed(p_email text) returns boolean
language sql security definer set search_path='' as $$
 select case when exists(select 1 from private.profiles where email=lower(p_email))
 then exists(select 1 from private.profiles where email=lower(p_email) and active)
 else exists(select 1 from private.invitations where email=lower(p_email) and accepted_by is null) end
$$;
revoke all on function public.school_auth_allowed(text) from public,anon,authenticated;
grant execute on function public.school_auth_allowed(text) to service_role;

create or replace function public.school_rate_limit(p_actor uuid,p_lane text) returns boolean language plpgsql security definer set search_path='' as $$
declare v_count integer; v_limit integer; v_minute bigint:=floor(extract(epoch from clock_timestamp())/60);
begin
 v_limit:=case p_lane when 'auth' then 10 when 'answers' then 240 when 'reset' then 120 when 'heartbeat' then 120 when 'read' then 360 else 120 end;
 insert into private.rate_limits values(p_actor,p_lane,v_minute,1)
 on conflict(actor_id,lane,minute) do update set requests=private.rate_limits.requests+1 returning requests into v_count;
 delete from private.rate_limits where minute<v_minute-2;
 return v_count<=v_limit;
end $$;
revoke all on function public.school_rate_limit(uuid,text) from public,anon,authenticated;
grant execute on function public.school_rate_limit(uuid,text) to service_role;

create table private.rate_limits (
 actor_id uuid not null, lane text not null, minute bigint not null, requests integer not null,
 primary key(actor_id,lane,minute)
);
alter table private.rate_limits enable row level security;
revoke all on private.rate_limits from public;
create function public.school_rate_limit(p_actor uuid,p_lane text) returns boolean language plpgsql security definer set search_path='' as $$
declare v_count integer; v_limit integer; v_minute bigint:=floor(extract(epoch from clock_timestamp())/60);
begin
 v_limit:=case p_lane when 'answers' then 240 when 'reset' then 120 when 'heartbeat' then 120 when 'read' then 360 else 120 end;
 insert into private.rate_limits values(p_actor,p_lane,v_minute,1)
 on conflict(actor_id,lane,minute) do update set requests=private.rate_limits.requests+1 returning requests into v_count;
 delete from private.rate_limits where minute<v_minute-2;
 return v_count<=v_limit;
end $$;
create function public.school_media_allowed(p_actor uuid,p_path text) returns boolean language sql security definer set search_path='' as $$
 select exists(select 1 from private.profiles p where p.id=p_actor and p.active and (
  exists(select 1 from private.questions q where q.media_path=p_path and (p.role='admin' or q.owner_id=p_actor)) or
  exists(select 1 from private.attempts a cross join lateral jsonb_array_elements(a.snapshot->'items') i where a.user_id=p_actor and i->>'media_path'=p_path) or
  exists(select 1 from private.exams e cross join lateral jsonb_array_elements(e.items) i where private.can_manage(p_actor,e) and i->>'media_path'=p_path)
 ))
$$;
revoke all on function public.school_rate_limit(uuid,text),public.school_media_allowed(uuid,text) from public;
do $$ begin
 if exists(select 1 from pg_roles where rolname='anon') then revoke all on function public.school_rate_limit(uuid,text),public.school_media_allowed(uuid,text) from anon; end if;
 if exists(select 1 from pg_roles where rolname='authenticated') then revoke all on function public.school_rate_limit(uuid,text),public.school_media_allowed(uuid,text) from authenticated; end if;
 if exists(select 1 from pg_roles where rolname='service_role') then
  grant execute on function public.school_rate_limit(uuid,text),public.school_media_allowed(uuid,text) to service_role;
 end if;
end $$;

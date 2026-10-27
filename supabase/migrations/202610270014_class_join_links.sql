-- Bearer links grant student admission only after the server verifies the email identity.
create table private.class_join_links (
 class_id uuid primary key references private.classes on delete cascade,
 token_hash text unique not null check(token_hash ~ '^[0-9a-f]{64}$'),
 expires_at timestamptz not null,
 max_uses integer not null check(max_uses between 1 and 1000),
 uses integer not null default 0 check(uses >= 0 and uses <= max_uses),
 revoked_at timestamptz,
 created_at timestamptz not null default now()
);
revoke all on private.class_join_links from public,anon,authenticated;

create function public.school_class_link_preview(p_hash text) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('class_name',c.name,'expires_at',l.expires_at,'remaining',l.max_uses-l.uses)
 from private.class_join_links l join private.classes c on c.id=l.class_id
 join private.profiles owner on owner.id=c.owner_id
 where l.token_hash=p_hash and l.revoked_at is null and l.expires_at>now()
 and owner.active and owner.role in ('teacher','admin')
$$;

create function public.school_class_link_manage(p_actor uuid,p_class uuid,p_operation text,p_hash text default null,p_days integer default 7,p_limit integer default 40) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p private.profiles; c private.classes; l private.class_join_links;
begin
 select * into p from private.profiles where id=p_actor and active;
 if p.id is null then raise exception 'UNAUTHORIZED'; end if;
 if p.role not in ('admin','teacher') then raise exception 'FORBIDDEN'; end if;
 select * into c from private.classes where id=p_class for update;
 if c.id is null or (p.role<>'admin' and c.owner_id<>p_actor) then raise exception 'NOT_FOUND'; end if;
 if p_operation='create' then
  if p_hash is null or p_hash !~ '^[0-9a-f]{64}$' or p_days is null or p_days not between 1 and 30 or p_limit is null or p_limit not between 1 and 1000 then raise exception 'INVALID_INPUT'; end if;
  insert into private.class_join_links(class_id,token_hash,expires_at,max_uses)
  values(p_class,p_hash,now()+make_interval(days=>p_days),p_limit)
  on conflict(class_id) do update set token_hash=excluded.token_hash,expires_at=excluded.expires_at,max_uses=excluded.max_uses,uses=0,revoked_at=null,created_at=now();
  perform private.audit(p_actor,'classes.link.create',p_class,jsonb_build_object('days',p_days,'max_uses',p_limit));
 elsif p_operation='revoke' then
  update private.class_join_links set revoked_at=coalesce(revoked_at,now()) where class_id=p_class;
  perform private.audit(p_actor,'classes.link.revoke',p_class);
 elsif p_operation<>'get' or p_operation is null then raise exception 'INVALID_INPUT'; end if;
 select * into l from private.class_join_links where class_id=p_class;
 return jsonb_build_object('link',case when l.class_id is null then null else to_jsonb(l)-'token_hash' end);
end $$;

create function public.school_class_link_join(p_actor uuid,p_email text,p_name text,p_hash text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c private.classes; l private.class_join_links; p private.profiles; invite private.invitations;
begin
 -- Lock the class before its link, matching class edits and link rotation/revocation.
 select c0.* into c from private.classes c0 join private.class_join_links l0 on l0.class_id=c0.id where l0.token_hash=p_hash for update of c0;
 if c.id is null then raise exception 'JOIN_LINK_UNAVAILABLE'; end if;
 select * into l from private.class_join_links where class_id=c.id for update;
 if l.token_hash<>p_hash or l.revoked_at is not null or l.expires_at<=now()
 or not exists(select 1 from private.profiles where id=c.owner_id and active and role in ('teacher','admin')) then raise exception 'JOIN_LINK_UNAVAILABLE'; end if;
 -- Serialize admission for an identity joining different classes concurrently.
 perform pg_advisory_xact_lock(hashtext('class-join:'||p_actor::text));
 select * into p from private.profiles where id=p_actor for update;
 if p.id is not null then
  if not p.active then raise exception 'ACCOUNT_DISABLED'; end if;
  if p.email<>lower(p_email) or p.role<>'student' then raise exception 'FORBIDDEN'; end if;
 end if;
 if exists(select 1 from private.memberships where class_id=c.id and email=lower(p_email)) and p.id is not null then
  return jsonb_build_object('ok',true,'class_name',c.name,'already_joined',true);
 end if;
 if l.uses>=l.max_uses then raise exception 'JOIN_LINK_FULL'; end if;
 if p.id is null then
  select * into invite from private.invitations where email=lower(p_email) for update;
  if invite.email is not null and (invite.role<>'student' or (invite.accepted_by is not null and invite.accepted_by<>p_actor)) then raise exception 'FORBIDDEN'; end if;
  insert into private.profiles(id,email,name,role) values(p_actor,lower(p_email),coalesce(nullif(trim(p_name),''),lower(p_email)),'student');
  update private.invitations set accepted_by=p_actor where email=lower(p_email);
 end if;
 insert into private.memberships(class_id,email) values(c.id,lower(p_email)) on conflict do nothing;
 update private.class_join_links set uses=uses+1 where class_id=c.id;
 perform private.audit(p_actor,'classes.join',c.id);
 return jsonb_build_object('ok',true,'class_name',c.name,'already_joined',false);
end $$;

revoke all on function public.school_class_link_preview(text),public.school_class_link_manage(uuid,uuid,text,text,integer,integer),public.school_class_link_join(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.school_class_link_preview(text),public.school_class_link_manage(uuid,uuid,text,text,integer,integer),public.school_class_link_join(uuid,text,text,text) to service_role;

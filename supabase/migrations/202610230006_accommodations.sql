create table private.exam_accommodations (
 exam_id uuid not null references private.exams on delete cascade,email text not null,
 fullscreen_exempt boolean not null,reason text not null,actor_id uuid not null references private.profiles,
 updated_at timestamptz not null default now(),primary key(exam_id,email)
);
alter table private.exam_accommodations enable row level security;
revoke all on private.exam_accommodations from public;
create function public.school_accommodation_get(p_actor uuid,p_exam uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare e private.exams; v_email text; exempt boolean;
begin
 select * into e from private.exams where id=p_exam;
 if not found or not(private.assigned(p_actor,e) or private.can_manage(p_actor,e)) then raise exception 'NOT_FOUND';end if;
 select p.email into v_email from private.profiles p where p.id=p_actor and p.active;
 select x.fullscreen_exempt into exempt from private.exam_accommodations x where x.exam_id=p_exam and x.email=v_email;
 return jsonb_build_object('fullscreen_exempt',coalesce(exempt,false));
end $$;
create function public.school_accommodation_set(p_actor uuid,p_exam uuid,p_email text,p_exempt boolean,p_reason text) returns jsonb language plpgsql security definer set search_path='' as $$
declare e private.exams;
begin
 select * into e from private.exams where id=p_exam;
 if not found or not private.can_manage(p_actor,e) then raise exception 'NOT_FOUND';end if;
 if length(trim(p_reason))<5 then raise exception 'REASON_REQUIRED';end if;
 if not(lower(p_email)=any(e.participant_emails) or exists(select 1 from private.memberships m where m.class_id=e.class_id and m.email=lower(p_email))) then raise exception 'NOT_FOUND';end if;
 insert into private.exam_accommodations(exam_id,email,fullscreen_exempt,reason,actor_id) values(p_exam,lower(p_email),p_exempt,p_reason,p_actor)
 on conflict(exam_id,email) do update set fullscreen_exempt=excluded.fullscreen_exempt,reason=excluded.reason,actor_id=excluded.actor_id,updated_at=clock_timestamp();
 perform private.audit(p_actor,'exam.accommodation',p_exam,jsonb_build_object('email',lower(p_email),'fullscreen_exempt',p_exempt,'reason',p_reason));
 return jsonb_build_object('ok',true);
end $$;
revoke all on function public.school_accommodation_get(uuid,uuid),public.school_accommodation_set(uuid,uuid,text,boolean,text) from public;
do $$ begin
 if exists(select 1 from pg_roles where rolname='anon') then revoke all on private.exam_accommodations from anon;revoke all on function public.school_accommodation_get(uuid,uuid),public.school_accommodation_set(uuid,uuid,text,boolean,text) from anon;end if;
 if exists(select 1 from pg_roles where rolname='authenticated') then revoke all on private.exam_accommodations from authenticated;revoke all on function public.school_accommodation_get(uuid,uuid),public.school_accommodation_set(uuid,uuid,text,boolean,text) from authenticated;end if;
 if exists(select 1 from pg_roles where rolname='service_role') then grant execute on function public.school_accommodation_get(uuid,uuid),public.school_accommodation_set(uuid,uuid,text,boolean,text) to service_role;end if;
end $$;

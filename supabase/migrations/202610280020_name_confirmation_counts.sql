-- Students must confirm a full name before taking exams; existing students are asked once.
alter table private.profiles add column name_confirmed boolean not null default false;
update private.profiles set name_confirmed=true where role<>'student';

create or replace function public.school_accept(p_actor uuid,p_email text,p_name text) returns jsonb language plpgsql security definer set search_path='' as $$
declare p private.profiles; invite private.invitations;
begin
 select * into p from private.profiles where id=p_actor;
 if found then if not p.active then raise exception 'ACCOUNT_DISABLED'; end if; return to_jsonb(p); end if;
 select * into invite from private.invitations where email=lower(p_email) for update;
 if not found or (invite.accepted_by is not null and invite.accepted_by<>p_actor) then raise exception 'INVITATION_REQUIRED'; end if;
 insert into private.profiles(id,email,name,role,name_confirmed) values(p_actor,lower(p_email),coalesce(nullif(invite.name,''),p_name),invite.role,invite.role<>'student') returning * into p;
 update private.invitations set accepted_by=p_actor where email=lower(p_email);
 return to_jsonb(p);
end $$;

-- Same as the scoped-reads version, plus profile.name, a NAME_REQUIRED guard on starting an attempt,
-- and always-visible correct/wrong/empty counts on the student's result (score stays hidden until released).
create or replace function public.school_request(p_actor uuid,p_email text,p_name text,p_action text,p_data jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare p jsonb; result jsonb; lane text; code text; counts private.results;
begin
 begin p:=public.school_accept(p_actor,p_email,p_name);
 exception when others then return jsonb_build_object('ok',false,'code',sqlerrm); end;
 lane:=case when p_action='attempt.save' then 'answers' when p_action='attempt.events' and p_data->>'type'='visibility_hidden' then 'reset'
 when p_action='attempt.heartbeat' then 'heartbeat' when p_action like 'view.%' or p_action in ('workspace','attempt.get','attempt.result','manage.monitor','manage.export','manage.grading','admin.health','exams.accommodation.get','media.allowed') then 'read' else 'write' end;
 if not public.school_rate_limit(p_actor,lane) then return jsonb_build_object('ok',false,'code','RATE_LIMITED'); end if;
 begin
  if p_action='profile.name' then
   update private.profiles set name=btrim(p_data->>'name'),name_confirmed=true where id=p_actor returning to_jsonb(private.profiles.*) into p;
   result:=p;
  elsif p_action='attempt.start' and p->>'role'='student' and not (p->>'name_confirmed')::boolean then raise exception 'NAME_REQUIRED';
  elsif p_action like 'view.%' then result:=private.school_view(p_actor,substr(p_action,6),p_data);
  elsif p_action='admin.health' then result:=public.school_health(p_actor);
  elsif p_action='exams.accommodation.get' then result:=public.school_accommodation_get(p_actor,(p_data->>'id')::uuid);
  elsif p_action='exams.accommodation.set' then result:=public.school_accommodation_set(p_actor,(p_data->>'id')::uuid,p_data->>'email',(p_data->>'fullscreen_exempt')::boolean,p_data->>'reason');
  elsif p_action in ('import.authorize','media.authorize') then
   if p->>'role' not in ('teacher','admin') then raise exception 'FORBIDDEN'; end if; result:=p;
  elsif p_action='import.commit' then result:=public.school_import_questions(p_actor,(p_data->>'operation_id')::uuid,p_data->'questions');
  elsif p_action='media.allowed' then result:=to_jsonb(public.school_media_allowed(p_actor,p_data->>'path'));
  else result:=public.school_api(p_actor,p_action,p_data); end if;
  if p_action in ('view.result','attempt.result') and result ? 'receipt' then
   select * into counts from private.results where attempt_id=(result->'receipt'->>'attempt_id')::uuid;
   if found then result:=jsonb_set(result,'{receipt}',result->'receipt'||jsonb_build_object('correct_count',counts.correct_count,'wrong_count',counts.wrong_count,'empty_count',counts.empty_count)); end if;
  end if;
  return jsonb_build_object('ok',true,'data',result,'profile',p);
 exception when others then
  get stacked diagnostics code=message_text;
  return jsonb_build_object('ok',false,'code',code,'profile',p);
 end;
end $$;

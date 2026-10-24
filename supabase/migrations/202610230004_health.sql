create table private.request_metrics (
 bucket timestamptz not null, operation text not null, requests bigint not null default 0,
 failures bigint not null default 0, total_ms numeric not null default 0, max_ms numeric not null default 0,
 primary key(bucket,operation)
);
alter table private.request_metrics enable row level security;
revoke all on private.request_metrics from public;
create function public.school_record_metric(p_operation text,p_elapsed numeric,p_failed boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
 insert into private.request_metrics(bucket,operation,requests,failures,total_ms,max_ms)
 values(date_trunc('minute',clock_timestamp()),left(p_operation,60),1,case when p_failed then 1 else 0 end,greatest(p_elapsed,0),greatest(p_elapsed,0))
 on conflict(bucket,operation) do update set requests=private.request_metrics.requests+1,
 failures=private.request_metrics.failures+excluded.failures,total_ms=private.request_metrics.total_ms+excluded.total_ms,
 max_ms=greatest(private.request_metrics.max_ms,excluded.max_ms);
 delete from private.request_metrics where bucket<clock_timestamp()-interval '24 hours';
end $$;
create function public.school_health(p_actor uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare due_n integer; lag numeric; total_n bigint; failed_n bigint; alerts jsonb:='[]'; cron_state jsonb:='{"available":false}';
begin
 if not exists(select 1 from private.profiles where id=p_actor and role='admin' and active) then raise exception 'FORBIDDEN'; end if;
 select count(*),coalesce(greatest(0,extract(epoch from clock_timestamp()-min(deadline_at))),0) into due_n,lag from private.attempts where status='in_progress' and deadline_at<=clock_timestamp();
 select coalesce(sum(requests),0),coalesce(sum(failures),0) into total_n,failed_n from private.request_metrics
 where bucket>=clock_timestamp()-interval '5 minutes' and operation in ('attempt.save','attempt.submit');
 if lag>60 then alerts:=alerts||jsonb_build_array('Finalisasi ujian tertunda lebih dari 60 detik.'); end if;
 if total_n>0 and failed_n::numeric/total_n>0.01 then alerts:=alerts||jsonb_build_array('Error simpan/kirim melebihi 1% pada jendela 5 menit terakhir.'); end if;
 if to_regclass('cron.job') is not null then
  execute 'select jsonb_build_object(''available'',true,''enabled'',exists(select 1 from cron.job where jobname=''safe-exam-finalize'' and active),''failed_runs'',(select count(*) from cron.job_run_details d join cron.job j on j.jobid=d.jobid where j.jobname=''safe-exam-finalize'' and d.status=''failed'' and d.start_time>now()-interval ''15 minutes''))' into cron_state;
  if not (cron_state->>'enabled')::boolean then alerts:=alerts||jsonb_build_array('Job finalisasi belum aktif.'); end if;
  if (cron_state->>'failed_runs')::integer>0 then alerts:=alerts||jsonb_build_array('Job finalisasi gagal pada 15 menit terakhir.'); end if;
 else alerts:=alerts||jsonb_build_array('Cron belum tersedia pada database ini.'); end if;
 return jsonb_build_object('server_now',clock_timestamp(),'due_attempts',due_n,'oldest_due_seconds',lag,'requests_5m',total_n,'failures_5m',failed_n,'cron',cron_state,'alerts',alerts);
end $$;
revoke all on function public.school_record_metric(text,numeric,boolean),public.school_health(uuid) from public;
do $$ begin
if exists(select 1 from pg_roles where rolname='anon') then revoke all on function public.school_record_metric(text,numeric,boolean),public.school_health(uuid) from anon; end if;
if exists(select 1 from pg_roles where rolname='authenticated') then revoke all on function public.school_record_metric(text,numeric,boolean),public.school_health(uuid) from authenticated; end if;
if exists(select 1 from pg_roles where rolname='service_role') then
 grant execute on function public.school_record_metric(text,numeric,boolean),public.school_health(uuid) to service_role;
end if; end $$;

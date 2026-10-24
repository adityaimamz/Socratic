-- Supabase-only integrations. The core migration also runs on ordinary PostgreSQL.
create extension if not exists pg_cron;
select cron.schedule('safe-exam-finalize','10 seconds','select public.school_finalize_due()');
select cron.schedule('safe-exam-retention','17 2 * * *','select public.school_retention()');
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('exam-media','exam-media',false,2097152,array['image/jpeg','image/png','image/webp'])
on conflict(id) do nothing;

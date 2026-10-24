// Hosted smoke test: every temporary question, receipt and audit record rolls back.
const {NEXT_PUBLIC_SUPABASE_URL:url,SUPABASE_ACCESS_TOKEN:token}=process.env;
if(!url||!token?.startsWith('sbp_'))throw new Error('Siapkan Project URL dan Supabase Management token lokal.');
const ref=new URL(url).hostname.split('.')[0];
if(!/^[a-z0-9]+$/.test(ref))throw new Error('Project URL tidak valid.');
const operation=crypto.randomUUID(),a=crypto.randomUUID(),b=crypto.randomUUID();
const questions=[{kind:'mcq',prompt:'[SMOKE] Berapakah dua ditambah dua?',options:[{id:a,text:'4'},{id:b,text:'5'}],correct_option_id:a,weight:2,tag:'[SMOKE]',rubric:'',media_path:null},{kind:'essay',prompt:'[SMOKE] Jelaskan alasan jawaban.',options:[],correct_option_id:null,weight:5,tag:'[SMOKE]',rubric:'Penalaran yang sesuai.',media_path:null}];
const payload=JSON.stringify(questions).replaceAll("'","''");
const sql=`begin;
do $smoke$
declare actor uuid; before_count bigint; result jsonb; retry jsonb;
begin
 select id into actor from private.profiles where active and role='teacher' order by created_at limit 1;
 if actor is null then raise exception 'SMOKE_NEEDS_TEACHER'; end if;
 select count(*) into before_count from private.questions;
 result:=public.school_import_questions(actor,'${operation}','${payload}'::jsonb);
 retry:=public.school_import_questions(actor,'${operation}','${payload}'::jsonb);
 if result<>retry or (result->>'count')::int<>2 then raise exception 'SMOKE_RECEIPT_FAILED'; end if;
 if (select count(*) from private.questions)<>before_count+2 then raise exception 'SMOKE_DUPLICATED'; end if;
 if (select count(*) from private.questions where id in (select value::uuid from jsonb_array_elements_text(result->'question_ids')) and owner_id=actor)<>2 then raise exception 'SMOKE_OWNERSHIP_FAILED'; end if;
end;
$smoke$;
rollback;
select exists(select 1 from private.app_migrations where version='202610240011_question_import.sql') migration_applied,
 not exists(select 1 from private.question_imports where operation_id='${operation}') rolled_back,
 not has_function_privilege('authenticated','public.school_import_questions(uuid,uuid,jsonb)','execute') browser_rpc_blocked;`;
const response=await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({query:sql,read_only:false}),signal:AbortSignal.timeout(45000)});
if(!response.ok)throw new Error(`Smoke impor gagal, HTTP ${response.status}.`);
const result=await response.json();
if(!result[0]?.migration_applied||!result[0]?.rolled_back||!result[0]?.browser_rpc_blocked)throw new Error('Verifikasi hosted impor belum lengkap.');
console.log(JSON.stringify({imported:2,retryWithoutDuplicates:true,rollback:true,...result[0]}));

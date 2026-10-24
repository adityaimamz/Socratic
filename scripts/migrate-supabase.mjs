import {readFileSync,readdirSync} from 'node:fs';
const {NEXT_PUBLIC_SUPABASE_URL:url,SUPABASE_ACCESS_TOKEN:token}=process.env;
if(!url||!token){console.error('Migrasi hosted membutuhkan SUPABASE_ACCESS_TOKEN di environment. Secret key aplikasi tidak memberikan akses SQL Management API.');process.exit(1);}
if(!token.startsWith('sbp_')){console.error('SUPABASE_ACCESS_TOKEN harus berupa Personal Access Token sbp_..., bukan connection string database atau secret key aplikasi.');process.exit(1);}
const ref=new URL(url).hostname.split('.')[0];
if(!/^[a-z0-9]+$/.test(ref))throw new Error('Project URL Supabase tidak valid.');
async function query(sql){const r=await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({query:sql,read_only:false}),signal:AbortSignal.timeout(60000)});if(!r.ok){const d=await r.json().catch(()=>({}));console.error(`Migrasi gagal (HTTP ${r.status}).`,typeof d.message==='string'?d.message.replaceAll(token,'[redacted]'):'Periksa izin token dan log SQL Supabase.');process.exit(1);}return r.json();}
await query("create schema if not exists private; create table if not exists private.app_migrations(version text primary key,applied_at timestamptz not null default now()); revoke all on schema private from public; revoke all on private.app_migrations from public;");
const done=new Set((await query('select version from private.app_migrations')).map(r=>r.version));
for(const name of readdirSync('supabase/migrations').filter(n=>/^\d+_.*\.sql$/.test(n)).sort()){
 if(done.has(name)){console.log(`Sudah diterapkan: ${name}`);continue;}
 const sql=readFileSync(`supabase/migrations/${name}`,'utf8');
 await query(`begin;\n${sql}\ninsert into private.app_migrations(version) values ('${name}');\ncommit;`);console.log(`Diterapkan: ${name}`);
}
await query("notify pgrst, 'reload schema';");
console.log('Migrasi hosted selesai. Tidak ada kredensial yang ditulis ke SQL atau log.');

import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {parseArgs,parseEnv} from 'node:util';

const {values}=parseArgs({options:{origin:{type:'string'},'apply-auth':{type:'boolean',default:false}}});
const target=values.origin;
if(!target)throw new Error('Tentukan --origin dengan origin HTTPS produksi Vercel.');
const parsed=new URL(target);
if(parsed.protocol!=='https:'||parsed.username||parsed.password||parsed.pathname!=='/'||parsed.search||parsed.hash)throw new Error('Origin produksi harus HTTPS tanpa path, query, atau kredensial.');
const base=parsed.origin;
const keys=['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY','SUPABASE_SECRET_KEY'];
const runtime={};
for(const key of keys){const value=process.env[key]?.trim();if(!value||/[\r\n]/.test(value))throw new Error(`Environment ${key} belum valid.`);runtime[key]=value;}
runtime.NEXT_PUBLIC_APP_URL=base;
if(new URL(runtime.NEXT_PUBLIC_SUPABASE_URL).protocol!=='https:')throw new Error('Gunakan URL Supabase hosted HTTPS untuk produksi.');
const directory=resolve('.local');mkdirSync(directory,{recursive:true});
const path=resolve(directory,'vercel-production.env');
const content=Object.entries(runtime).map(([key,value])=>`${key}=${JSON.stringify(value)}`).join('\n')+'\n';
assert.deepEqual(parseEnv(content),runtime);
assert.equal(Object.keys(runtime).length,4);
assert.equal('SUPABASE_ACCESS_TOKEN' in runtime,false);
assert.equal('BOOTSTRAP_ADMIN_EMAIL' in runtime,false);
writeFileSync(path,content);
const report={origin:base,environmentFile:path,variableNames:Object.keys(runtime),target:'Production',auth:{status:'not-checked'},deployment:{status:'pending-vercel-access'}};
const token=process.env.SUPABASE_ACCESS_TOKEN;
if(token?.startsWith('sbp_')){
 const ref=new URL(runtime.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0];
 if(!/^[a-z0-9]+$/.test(ref))throw new Error('Project reference Supabase tidak valid.');
 const endpoint=`https://api.supabase.com/v1/projects/${ref}/config/auth`;
 async function config(method='GET',body){
  const response=await fetch(endpoint,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw new Error(`Konfigurasi Auth tidak dapat diakses: HTTP ${response.status}.`);
  return response.json();
 }
 const before=await config();
 const previous=(before.uri_allow_list??'').split(',').map(v=>v.trim()).filter(Boolean);
 const required=[`${base}/auth/callback`,`${base}/auth/callback?next=reset-password`];
 const local=process.env.NEXT_PUBLIC_APP_URL;
 const localOrigin=local&&new URL(local).origin;
 const retainedLocal=localOrigin&&localOrigin!==base?[`${localOrigin}/auth/callback`,`${localOrigin}/auth/callback?next=reset-password`]:[];
 const allowed=[...new Set([...previous,...retainedLocal,...required])];
 const patch={};if(before.site_url!==base)patch.site_url=base;
 if(allowed.some(url=>!previous.includes(url)))patch.uri_allow_list=allowed.join(',');
 const backup=resolve(directory,'vercel-auth-before.json');
 if(values['apply-auth']&&Object.keys(patch).length){
  if(!existsSync(backup))writeFileSync(backup,JSON.stringify({site_url:before.site_url,uri_allow_list:before.uri_allow_list},null,2)+'\n');
  await config('PATCH',patch);
 }
 const after=values['apply-auth']?await config():before;
 const afterAllowed=(after.uri_allow_list??'').split(',').map(v=>v.trim());
 const ready=after.site_url===base&&required.every(url=>afterAllowed.includes(url));
 if(values['apply-auth']){
  assert.ok(ready,'Konfigurasi callback produksi belum sesuai setelah disimpan.');
  assert.ok(previous.every(url=>afterAllowed.includes(url)),'Redirect sebelumnya tidak boleh terhapus.');
  for(const key of ['mailer_autoconfirm','disable_signup','external_email_enabled','external_google_enabled'])assert.equal(after[key],before[key],`Kebijakan ${key} berubah tanpa diminta.`);
 }
 report.auth={status:ready?'ready':'changes-required',siteUrl:after.site_url,productionCallbacks:required,previousRedirectsRetained:previous.every(url=>afterAllowed.includes(url)),localCallbacksRetained:retainedLocal.every(url=>afterAllowed.includes(url)),emailEnabled:after.external_email_enabled,googleEnabled:after.external_google_enabled,customSmtp:Boolean(after.smtp_host),applied:values['apply-auth']};
}
const reportPath=resolve(directory,'vercel-setup.json');writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');
const instructions=`# Setup produksi Socratic di Vercel\n\nOrigin: ${base}\n\nStatus persiapan Supabase: ${report.auth.status}. Penerapan environment Vercel dan redeploy masih perlu dilakukan dari akun Vercel proyek.\n\n1. Buka proyek Socratic pada Vercel → Settings → Environment Variables.\n2. Pilih environment Production dan impor file .local/vercel-production.env dari folder proyek ini. File berisi empat environment runtime yang diperlukan; secret tetap tanpa awalan NEXT_PUBLIC_.\n3. Pastikan Framework Preset Next.js, Node.js 24.x, build command npm run build, install command npm ci, serta Root Directory pada folder yang memuat package.json.\n4. Simpan environment lalu Redeploy deployment produksi. Variabel NEXT_PUBLIC_ harus tersedia ketika build.\n5. Buka ${base}/login; pesan Layanan masuk belum siap harus hilang.\n6. Login menggunakan akun lembaga atau akun dummy dari .local/DEMO-ACCESS.md, lalu periksa workspace dan logout.\n\nFile environment berisi secret server; gunakan untuk pengaturan Vercel proyek ini dan simpan di luar Git. Personal Access Token Supabase dan BOOTSTRAP_ADMIN_EMAIL tidak perlu dipasang sebagai runtime Vercel.\n\nCallback yang diperlukan:\n- ${base}/auth/callback\n- ${base}/auth/callback?next=reset-password\n\nCallback lokal sebelumnya dipertahankan. SMTP dan Google OAuth tetap memerlukan konfigurasi provider yang sesuai. Menyiapkan URL produksi tidak mengaktifkan kedua layanan tersebut.\n\nImpor soal TXT, PDF, dan Markdown belum tersedia pada implementasi saat persiapan ini.\n`;
writeFileSync(resolve(directory,'VERCEL-SETUP.md'),instructions);
console.log(JSON.stringify(report,null,2));
console.log(`Panduan pengisian Vercel: ${resolve(directory,'VERCEL-SETUP.md')}`);

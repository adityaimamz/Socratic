// Read/write only the redirect configuration needed by this application.
// Provider secrets are never printed or written to disk.
const {NEXT_PUBLIC_SUPABASE_URL:url,NEXT_PUBLIC_APP_URL:app,SUPABASE_ACCESS_TOKEN:token}=process.env;
if(!url||!app||!token?.startsWith('sbp_'))throw Error('Project URL, App URL dan Personal Access Token diperlukan.');
const ref=new URL(url).hostname.split('.')[0],base=new URL(app).origin;
const endpoint=`https://api.supabase.com/v1/projects/${ref}/config/auth`;
async function config(method='GET',body){const r=await fetch(endpoint,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error(`Konfigurasi Auth tidak tersedia (HTTP ${r.status}); gunakan Authentication → URL Configuration bila token tidak memiliki izin Auth.`);return r.json();}
let current=await config();
const required=[`${base}/auth/callback`,`${base}/auth/callback?next=reset-password`];
const existing=(current.uri_allow_list||'').split(',').map(x=>x.trim()).filter(Boolean);
const patch={};if(required.some(x=>!existing.includes(x)))patch.uri_allow_list=[...new Set([...existing,...required])].join(',');
if(!current.site_url||['http://localhost:3000','http://127.0.0.1:3000'].includes(current.site_url.replace(/\/$/,''))){if(current.site_url!==base)patch.site_url=base;}
if(process.argv.includes('--apply')&&Object.keys(patch).length){await config('PATCH',patch);current=await config();console.log('Redirect aplikasi ditambahkan; Site URL default disesuaikan bila diperlukan.');}
console.log(`Email/password: ${current.external_email_enabled?'aktif':'belum aktif'}`);
console.log(`Pendaftaran akun: ${current.disable_signup?'dinonaktifkan, buat akun melalui Supabase Auth':'aktif'}`);
console.log(`Konfirmasi email: ${current.mailer_autoconfirm?'otomatis':'melalui email'}`);
const allowed=(current.uri_allow_list||'').split(',').map(x=>x.trim());console.log(`Callback aplikasi: ${required.every(x=>allowed.includes(x))?'siap':'perlu ditambahkan'}`);

console.log(`SMTP khusus: ${current.smtp_host?'aktif':'belum dikonfigurasi; pengirim bawaan hanya untuk anggota tim proyek'}`);
console.log(`Batas email proyek: ${current.rate_limit_email_sent??'tidak tersedia'} per jam`);
if(!current.smtp_host)console.log('Untuk peserta di luar anggota tim Supabase, siapkan SMTP khusus pada Authentication → Email → SMTP Settings.');
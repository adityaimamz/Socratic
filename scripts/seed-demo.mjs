import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {createClient} from '@supabase/supabase-js';
import {buildDemoData,DATASET} from './demo/data.mjs';
import {buildDemoSql,buildCleanupSql,demoReportSql,literal} from './demo/sql.mjs';

const d=buildDemoData(),args=new Set(process.argv.slice(2));
const manifestPath=resolve('.local/demo-accounts.json'),guidePath=resolve('.local/DEMO-ACCESS.md');
const plan={dataset:DATASET,auth_accounts:d.accounts.length,profiles:d.accounts.filter(u=>u.confirmed).length,classes:d.classes.length,questions:d.questions.length,exams:d.exams.length,attempts:d.attempts.length,pending_invitations:d.invitations.length+1};

async function main(){
 if(args.has('--plan')){console.log(JSON.stringify(plan,null,2));return;}
 const env=process.env;
 const url=env.NEXT_PUBLIC_SUPABASE_URL,key=env.SUPABASE_SECRET_KEY,token=env.SUPABASE_ACCESS_TOKEN,publishable=env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 if(!url||!key||!token?.startsWith('sbp_')||!publishable)throw new Error('Isi URL, publishable key, secret key, dan Personal Access Token Supabase pada environment.');
 const hostname=new URL(url).hostname;
 if(!/^[a-z0-9]+\.supabase\.co$/.test(hostname))throw new Error('Seed ini ditujukan untuk proyek Supabase hosted pada environment aplikasi.');
 const project=hostname.split('.')[0];
 const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(u,i)=>fetch(u,{...i,signal:AbortSignal.timeout(30000)})}});
 let manifest=existsSync(manifestPath)?JSON.parse(readFileSync(manifestPath,'utf8')):null;
 if(manifest&&(manifest.project!==project||manifest.dataset!==DATASET))throw new Error('Manifest berasal dari proyek berbeda. Simpan manifest terpisah sebelum memakai proyek lain.');
 async function query(sql,readOnly=true){
  const r=await fetch(`https://api.supabase.com/v1/projects/${project}/database/query`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({query:sql,read_only:readOnly}),signal:AbortSignal.timeout(60000)});
  if(!r.ok){const body=await r.json().catch(()=>({}));throw new Error(`SQL demo gagal (HTTP ${r.status}): ${String(body.message??'Periksa izin dan migrasi proyek.').replaceAll(token,'[redacted]').replaceAll(key,'[redacted]')}`);}
  return r.json();
 }
 async function ownedAuth(u){
  const {data,error}=await client.auth.admin.getUserById(u.id);
  if(error?.status===404||error?.code==='user_not_found')return null;
  if(error)throw new Error(`Pemeriksaan akun dummy gagal (${error.code??error.status}).`);
  if(data.user.email!==u.email||data.user.app_metadata.demo_dataset!==DATASET)throw new Error(`Akun ${u.key} bertabrakan dengan akun lain; operasi dihentikan.`);
  return data.user;
 }
 function saveManifest(status){
  manifest={...manifest,status,updatedAt:new Date().toISOString()};
  mkdirSync(resolve('.local'),{recursive:true});writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');
 }
 function writeGuide(summary){
 const guide=`# Akun dan skenario dummy Socratic\n\nDibuat ${manifest.createdAt}. Semua identitas dan jawaban pada daftar ini adalah data simulasi.\n\nPassword bersama untuk seluruh akun dummy:\n\n\`${manifest.password}\`\n\nBuka aplikasi menggunakan origin NEXT_PUBLIC_APP_URL pada environment, lalu Masuk dengan email. Akun aktif sudah dikonfirmasi melalui Admin API khusus untuk identitas dummy; pengiriman email nyata tidak diuji.\n\n| Email | Peran | Kondisi |\n| --- | --- | --- |\n${d.accounts.map(u=>`| ${u.email} | ${u.role} | ${!u.confirmed?'Belum diverifikasi: login ditolak':!u.active?'Nonaktif: akses aplikasi ditolak':u.key==='tanpa-kelas'?'Dashboard kosong tanpa penugasan':u.key==='peserta01'?'Akun utama: ujian siap, nilai ditahan/terbit, pembahasan, retake':u.key==='peserta02'?'Reset jawaban pada Exam sudah terjadi':u.key==='peserta03'?'Permintaan pindah sesi menunggu pengawas':u.key==='peserta04'?'Sesi tanpa heartbeat terbaru':u.key==='peserta05'?'Sesi dengan tambahan waktu':u.key==='peserta06'?'Quiz aktif dan esai menunggu nilai':u.key==='peserta07'?'Quiz IPA aktif':u.key==='peserta08'?'Quiz IPA sudah dinilai':'Aktif'} |`).join('\n')}\n\n## Ujian\n\n${d.exams.map(e=>`- ${e.title}: /${e.draft?'manage/':''}exams/${e.id}`).join('\n')}\n\n## Penggunaan\n\n- Mulai dari admin untuk daftar pengguna, undangan, audit, pengaturan, dan kesehatan layanan.\n- Pengajar mengelola bank soal, kelas, draft, monitoring, esai, publikasi, dan ekspor CSV. Pengawas juga ditugaskan pada Exam Ketat.\n- peserta01 cocok untuk mengerjakan ujian baru, membaca hasil, dan memulai retake. Akun ini mendapat akomodasi tanpa fullscreen pada Exam Ketat; reset saat meninggalkan tab tetap berlaku.\n- Sesi strict yang sudah diisi memakai session ID seed. Untuk membukanya dari browser, ajukan pindah sesi dan setujui melalui monitoring pengajar di browser/profil lain.\n- Jadwal siap berlaku tujuh hari sejak seed. Sesi aktif memiliki durasi delapan jam dan berakhir secara alami. Ujian berjudul Besok dibuka satu hari setelah seed.\n- Data historis sengaja ditempatkan tiga hari sebelumnya agar rilis pembahasan dapat diuji. Nilai dihitung fungsi aplikasi dari jawaban, bukan diisi sembarang.\n- Tidak semua gangguan bisa dibuat sebagai data: putus jaringan, fullscreen, refresh, dan tab tersembunyi diuji melalui interaksi browser. SMTP/Google tetap mengikuti konfigurasi layanan asli.\n- Seed ulang mempertahankan data yang sudah Anda ubah. Untuk kembali ke kondisi awal: npm run seed:demo:clean -- --apply, lalu npm run seed:demo.\n- Gunakan npm run seed:demo:check untuk memeriksa dataset dan login. Laporan rinci tersimpan di .local/demo-verification.json.\n\n## Jumlah setelah seed\n\n\`\`\`json\n${JSON.stringify(summary,null,2)}\n\`\`\`\n`;
 writeFileSync(guidePath,guide);console.log(`Akun dan password: ${guidePath}`);
 }
 async function report(){return (await query(demoReportSql(d)))[0].summary;}
 async function verify(){
  const summary=await report();
  assert.equal(Number(summary.profiles),15,'Jumlah profil dummy tidak sesuai');
  assert.equal(Number(summary.exams),16,'Dataset ujian belum lengkap');
  assert.ok(Number(summary.questions)>=18,'Bank soal dummy belum lengkap');
  assert.ok(Number(summary.classes)>=3,'Kelas dummy belum lengkap');
  for(const u of d.accounts){
   const auth=await ownedAuth(u);assert.ok(auth,`Akun ${u.key} belum dibuat`);
   assert.equal(Boolean(auth.email_confirmed_at),u.confirmed,`Status verifikasi ${u.key} tidak sesuai`);
  }
  const loginChecks=[];
  if(manifest?.password){
   for(const key of ['admin','pengajar','pengawas','peserta01','tanpa-kelas','belum-verifikasi']){
    const u=d.users[key],auth=createClient(url,publishable,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data,error}=await auth.auth.signInWithPassword({email:u.email,password:manifest.password});
    if(u.confirmed){assert.ok(!error,`Login ${key} gagal (${error?.code??'unknown'})`);assert.equal(data.user.id,u.id);await auth.auth.signOut({scope:'local'});}
    else assert.equal(error?.code,'email_not_confirmed','Akun belum verifikasi seharusnya ditolak');
    loginChecks.push(key);
   }
  }
  for(const key of ['admin','pengajar','peserta01','tanpa-kelas']){
   const {data,error}=await client.rpc('school_api',{p_actor:d.users[key].id,p_action:'workspace',p_data:{}});
   assert.ok(!error,`Workspace ${key} gagal`);assert.equal(data.profile.role,d.users[key].role);
   if(key==='tanpa-kelas')assert.equal(data.exams.length,0);
  }
  const disabled=await client.rpc('school_auth_allowed',{p_email:d.users.nonaktif.email});assert.equal(disabled.data,false);
  const media=await client.storage.from('exam-media').download(d.mediaPath);assert.ok(!media.error,'Gambar soal dummy belum tersedia');assert.ok(media.data.size>0);
  const verification={checkedAt:new Date().toISOString(),summary,auth_accounts:d.accounts.length,loginChecks,media:'private bucket verified',disabledAccount:'rejected'};
  mkdirSync(resolve('.local'),{recursive:true});writeFileSync(resolve('.local/demo-verification.json'),JSON.stringify(verification,null,2)+'\n');
  console.log(JSON.stringify(verification,null,2));return summary;
 }
 if(args.has('--clean')){
  if(!args.has('--apply')){console.log('Pratinjau: hanya data milik akun socratic-demo-v1 dan media dummy yang akan dibersihkan. Jalankan kembali dengan --clean --apply untuk menerapkan.');console.log(JSON.stringify(plan,null,2));return;}
  for(const u of d.accounts)await ownedAuth(u);
  await query(buildCleanupSql(d),false);
  const removed=await client.storage.from('exam-media').remove([d.mediaPath]);if(removed.error)throw new Error('Data database bersih, tetapi media dummy belum dapat dihapus. Ulangi cleanup.');
  for(const u of d.accounts){if(await ownedAuth(u)){const {error}=await client.auth.admin.deleteUser(u.id);if(error)throw new Error(`Akun dummy ${u.key} belum dapat dihapus. Ulangi cleanup.`);}}
  if(manifest)saveManifest('cleaned');console.log('Data, media, dan akun Auth dummy sudah dibersihkan.');return;
 }
 if(args.has('--check')){await verify();return;}
 if(!args.has('--apply')){console.log('Gunakan --plan untuk ringkasan atau --apply untuk menambahkan data dummy.');return;}
 const preflight=(await query(`select to_regprocedure('public.school_auth_allowed(text)') is not null and to_regprocedure('private.essay_feedback(uuid)') is not null as ready,exists(select 1 from private.exams where id=${literal(d.exams[0].id)}::uuid) as seeded`))[0];
 if(!preflight.ready)throw new Error('Terapkan seluruh migrasi aplikasi sebelum seed.');
 if(preflight.seeded){if(!manifest?.password)throw new Error('Dataset sudah ada tetapi manifest kredensial tidak ditemukan. Gunakan cleanup eksplisit sebelum membuat ulang.');const summary=await verify();saveManifest('ready');writeGuide(summary);console.log('Dataset sudah tersedia. Data dan password pengujian dipertahankan.');return;}
 if(!manifest||manifest.status==='cleaned'){
  manifest={dataset:DATASET,project,password:`Demo-${randomBytes(18).toString('base64url')}!9a`,createdAt:new Date().toISOString(),accounts:d.accounts.map(({key,email,name,role,active,confirmed})=>({key,email,name,role,active,confirmed})),exams:d.exams.map(({key,id,title})=>({key,id,title}))};
 }
 saveManifest('preparing');console.log('Menyiapkan akun Auth dummy…');
 for(const u of d.accounts){
  if(await ownedAuth(u))continue;
  const {error}=await client.auth.admin.createUser({id:u.id,email:u.email,password:manifest.password,email_confirm:u.confirmed,user_metadata:{full_name:u.name},app_metadata:{demo_dataset:DATASET}});
  if(error)throw new Error(`Pembuatan akun dummy ${u.key} gagal (${error.code??error.status}). Tidak ada email yang dikirim.`);
 }
 const bucket=await client.storage.getBucket('exam-media');
 if(bucket.error||bucket.data.public)throw new Error('Bucket exam-media harus tersedia dan privat. Jalankan supabase:prepare jika belum siap.');
 const existing=await client.storage.from('exam-media').download(d.mediaPath);
 if(existing.error){const upload=await client.storage.from('exam-media').upload(d.mediaPath,readFileSync(resolve('public/logo.jpeg')),{contentType:'image/jpeg',upsert:false});if(upload.error)throw new Error(`Gambar soal dummy belum dapat diunggah (${upload.error.statusCode??upload.error.name}). Ulangi seed untuk melanjutkan.`);}
 console.log('Menambahkan kelas, soal, ujian, jawaban, dan hasil dalam satu transaksi…');
 await query(buildDemoSql(d),false);
 const summary=await verify();saveManifest('ready');
 writeGuide(summary);
}

main().catch(error=>{console.error(error instanceof Error?error.message:'Seed dummy gagal.');process.exitCode=1;});

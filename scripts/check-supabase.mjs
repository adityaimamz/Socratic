import { createClient } from '@supabase/supabase-js';
const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishable=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secret=process.env.SUPABASE_SECRET_KEY;
if(!url||!publishable||!secret){console.error('Konfigurasi Supabase belum lengkap.');process.exit(1);}
const timeout=AbortSignal.timeout(15000);
try{
 const response=await fetch(`${url}/auth/v1/settings`,{headers:{apikey:publishable},signal:timeout});
 if(!response.ok){console.error(`Auth: gagal (HTTP ${response.status}). Periksa URL dan publishable key.`);process.exit(1);}
 const settings=await response.json();console.log('Auth API: terhubung');console.log(`Google OAuth: ${settings.external?.google?'aktif':'belum aktif'}`);
 console.log(`Email/password: ${settings.external?.email?'aktif':'belum aktif'}`);
 const admin=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(15000)})}});
 const {error:userError}=await admin.auth.admin.listUsers({page:1,perPage:1});
 console.log(`Secret key: ${userError?'tidak dapat mengakses admin API':'valid untuk admin API'}`);
 const {error:rpcError}=await admin.rpc('school_api',{p_actor:'00000000-0000-4000-8000-000000000000',p_action:'workspace',p_data:{}});
 const exists=!rpcError||rpcError.message.includes('UNAUTHORIZED');
 console.log(`Migrasi inti: ${exists?'tersedia':'belum tersedia'}`);
 if(rpcError&&!exists)console.log(`Kode pemeriksaan migrasi: ${rpcError.code??'unknown'}`);
 const {data:bucket,error:bucketError}=await admin.storage.getBucket('exam-media');
 console.log(`Storage exam-media: ${bucketError?'belum tersedia':bucket.public?'PERLU DIUBAH MENJADI PRIVAT':'privat'}`);
 if(userError)process.exitCode=1;
}catch(error){console.error(`Pemeriksaan jaringan gagal: ${error.cause?.code??error.name}. Nilai kredensial tidak ditampilkan.`);process.exitCode=1;}

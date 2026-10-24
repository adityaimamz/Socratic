import {createClient} from '@supabase/supabase-js';
const {NEXT_PUBLIC_SUPABASE_URL:url,SUPABASE_SECRET_KEY:key}=process.env;
if(!url||!key){console.error('Konfigurasi Supabase belum lengkap.');process.exit(1);}
const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(20000)})}});
try{
 const {data:bucket,error}=await client.storage.getBucket('exam-media');
 if(error){const {error:createError}=await client.storage.createBucket('exam-media',{public:false,fileSizeLimit:2097152,allowedMimeTypes:['image/jpeg','image/png','image/webp']});if(createError)throw new Error(`Storage setup gagal (${createError.statusCode??'unknown'}).`);console.log('Storage exam-media dibuat privat.');}
 else if(bucket.public){throw new Error('Bucket exam-media sudah publik. Perlu ditinjau sebelum digunakan untuk ujian.');}
 else console.log('Storage exam-media sudah privat.');
}catch(error){console.error(error.message);process.exitCode=1;}

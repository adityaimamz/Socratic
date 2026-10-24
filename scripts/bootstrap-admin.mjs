import {createClient} from '@supabase/supabase-js';
const {NEXT_PUBLIC_SUPABASE_URL:url,SUPABASE_SECRET_KEY:key,BOOTSTRAP_ADMIN_EMAIL:email}=process.env;
if(!url||!key||!email){console.error('Isi Supabase URL, secret key, dan BOOTSTRAP_ADMIN_EMAIL pada environment.');process.exit(1);}
const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const {error}=await client.rpc('school_bootstrap',{p_email:email.trim().toLowerCase()});
if(error){console.error('Bootstrap gagal:',error.code??'unknown');process.exit(1);}
console.log('Undangan admin pertama dibuat. Masuk melalui Google menggunakan email yang dikonfigurasi.');

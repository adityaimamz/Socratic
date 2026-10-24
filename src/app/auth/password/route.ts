import {createHash} from "node:crypto";
import {NextResponse} from "next/server";
import {passwordAction} from "@/lib/auth-validation";
import {authClient,adminClient,configured} from "@/lib/supabase/server";
import {currentProfile} from "@/lib/server";
import {messages} from "@/lib/domain";
const generic=messages.AUTH_FAILED;
export async function POST(request:Request){
 const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{"Cache-Control":"private, no-store"}});
 const fail=(code:string,status:number,message=messages[code])=>reply({code,message},status);
 const base=process.env.NEXT_PUBLIC_APP_URL||new URL(request.url).origin;
 if(request.headers.get("origin")!==new URL(base).origin)return fail("ORIGIN_NOT_ALLOWED",403);
 if(!configured())return fail("SETUP_REQUIRED",503);
 if(Number(request.headers.get("content-length")??0)>4096)return fail("PAYLOAD_TOO_LARGE",413);
 try{
  const raw=await request.text();if(raw.length>4096)return fail("PAYLOAD_TOO_LARGE",413);
  const parsed=passwordAction.safeParse(JSON.parse(raw));if(!parsed.success)return fail("INVALID_INPUT",422,"Periksa format email dan kelengkapan isian. Kata sandi baru harus berisi 10–128 huruf, angka, atau tanda baca. Nama minimal 2 huruf.");
  const data=parsed.data,auth=await authClient();
  const identity=data.mode==="update"?(await auth.auth.getUser()).data.user?.id:data.email;
  if(!identity)return fail("RECOVERY_SESSION_EXPIRED",401);
  const h=createHash("sha256").update(`auth:${identity}`).digest("hex").slice(0,32),actor=`${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
  const {data:allowedRate,error:rateError}=await adminClient().rpc("school_rate_limit",{p_actor:actor,p_lane:"auth"});
  if(rateError)return fail("SERVER_ERROR",503);
  if(!allowedRate)return fail("RATE_LIMITED",429,"Terlalu banyak percobaan. Tunggu satu menit, lalu coba lagi.");
  if(data.mode==="update"){
   const profile=await currentProfile();if(!profile)return fail("RECOVERY_SESSION_EXPIRED",401);
   const {error}=await auth.auth.updateUser({password:data.password});if(error)return fail("PASSWORD_UPDATE_FAILED",400,"Gunakan kata sandi yang berbeda dari sebelumnya, sepanjang 10–128 huruf, angka, atau tanda baca. Jika tetap gagal, minta tautan ganti kata sandi baru.");
   return reply({ok:true,redirect:"/dashboard"});
  }
  const {data:admitted,error:admissionError}=await adminClient().rpc("school_auth_allowed",{p_email:data.email});
  if(admissionError)return fail("SERVER_ERROR",503);
  if(data.mode==="login"){
   if(!admitted)return fail("AUTH_FAILED",401,generic);
   const {error}=await auth.auth.signInWithPassword({email:data.email,password:data.password});
   if(error)return fail("AUTH_FAILED",401,generic);
   try{if(!await currentProfile()){await auth.auth.signOut();return fail("AUTH_FAILED",401,generic);}}catch{await auth.auth.signOut();return fail("AUTH_FAILED",401,generic);}
   return reply({ok:true,redirect:"/dashboard"});
  }
  // Registration and recovery never reveal whether an address is invited.
  if(admitted){
   // Keep the same public response for invited and unknown addresses.
   // A provider error must not be described as a confirmed email delivery.
   const result=data.mode==="register"?await auth.auth.signUp({email:data.email,password:data.password,options:{data:{full_name:data.name},emailRedirectTo:`${base}/auth/callback`}}):await auth.auth.resetPasswordForEmail(data.email,{redirectTo:`${base}/auth/callback?next=reset-password`});
   if(result.error)console.error("[auth-email]",{mode:data.mode,code:result.error.code??"unknown",status:result.error.status});
  }
  return reply({ok:true,message:data.mode==="register"?"Permintaan pendaftaran diterima. Email pengaktifan akun hanya dapat dikirim jika emailmu sudah didaftarkan dan layanan email tersedia. Periksa kotak masuk dan spam. Jika tidak ada email, minta pengajar memeriksa pendaftaran akun dan pengiriman email. Jika akun sudah ada, gunakan Lupa kata sandi.":"Permintaan ganti kata sandi diterima. Jika akunmu terdaftar dan layanan email tersedia, tautan ganti kata sandi akan dikirim. Periksa kotak masuk dan spam. Jika tidak ada email, minta pengajar memeriksa akun dan pengiriman email."});
 }catch(error){return error instanceof SyntaxError?fail("INVALID_INPUT",422,"Data tidak dapat dibaca. Periksa isian, lalu kirim kembali."):fail("SERVER_ERROR",503);}
}

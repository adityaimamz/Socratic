"use client";
import {useEffect,useRef,useState} from "react";
import {useRouter} from "next/navigation";
import {requestJson} from "@/lib/client";
import {ApiError} from "@/lib/domain";
import {Notice} from "./ui";

type Feedback={title:string;message:string};
type AuthReply={redirect?:string;message:string};
function failure(error:unknown,title:string):Feedback{
 const titles:Record<string,string>={ORIGIN_NOT_ALLOWED:"Alamat aplikasi tidak sesuai",RATE_LIMITED:"Terlalu banyak percobaan",NETWORK_ERROR:"Koneksi belum tersedia",SETUP_REQUIRED:"Layanan belum siap",SERVER_ERROR:"Layanan sedang bermasalah",INVALID_RESPONSE:"Respons layanan bermasalah",RECOVERY_SESSION_EXPIRED:"Tautan pemulihan perlu diperbarui"};
 return {title:error instanceof ApiError?titles[error.code]??title:title,message:error instanceof Error?error.message:"Permintaan belum berhasil. Coba lagi beberapa saat atau hubungi admin lembaga."};
}
async function passwordRequest(body:unknown){
 return requestJson<AuthReply>("/auth/password",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
}

export function PasswordLogin({ready}:{ready:boolean}){
 const [mode,setMode]=useState<"login"|"register"|"recover">("login");
 const [busy,setBusy]=useState(false),[error,setError]=useState<Feedback|null>(null),[message,setMessage]=useState<Feedback|null>(null),[loginEmail,setLoginEmail]=useState("");
 const router=useRouter(),passwordRef=useRef<HTMLInputElement>(null),feedbackRef=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(error)feedbackRef.current?.focus();},[error]);
 useEffect(()=>{if(mode==="login"&&message)passwordRef.current?.focus();},[mode,message]);
 async function submit(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();setError(null);setMessage(null);const f=new FormData(e.currentTarget);
  if(mode==="register"&&f.get("password")!==f.get("confirmation")){setError({title:"Konfirmasi password belum sama",message:"Ketik ulang konfirmasi agar sama persis dengan password, lalu kirim kembali."});return;}
  setBusy(true);
  try{
   const d=await passwordRequest({mode,email:f.get("email"),password:f.get("password"),name:f.get("name")});
   if(d.redirect){router.replace(d.redirect);router.refresh();}
   else{
    if(mode==="register"){setLoginEmail(String(f.get("email")??""));setMode("login");}
    setMessage({title:mode==="register"?"Periksa email konfirmasi":"Periksa email pemulihan",message:d.message});
   }
  }catch(e){setError(failure(e,mode==="login"?"Login belum berhasil":mode==="register"?"Pendaftaran belum berhasil":"Pemulihan belum berhasil"));}
  finally{setBusy(false);}
 }
 function switchMode(value:typeof mode){setMode(value);setError(null);setMessage(null);}
 return <div className="stack" style={{gap:18}}>
  {mode!=="login"&&<h3>{mode==="register"?"Buat akun undangan":"Pulihkan password"}</h3>}
  {!ready&&<Notice tone="warning" title="Layanan masuk belum siap">Hubungi admin lembaga untuk menyiapkan layanan sebelum masuk atau membuat akun.</Notice>}
  <form className="form" onSubmit={e=>void submit(e)} key={mode} aria-busy={busy}>
   {mode==="register"&&<div className="field"><label htmlFor="login-name">Nama</label><input id="login-name" name="name" autoComplete="name" minLength={2} maxLength={100} required disabled={busy||!ready}/></div>}
   <div className="field"><label htmlFor="login-email">Email</label><input id="login-email" name="email" type="email" autoComplete="email" defaultValue={mode==="login"?loginEmail:""} required maxLength={254} disabled={busy||!ready}/></div>
   {mode!=="recover"&&<div className="field"><label htmlFor="login-password">Password</label><input ref={passwordRef} id="login-password" name="password" type="password" autoComplete={mode==="login"?"current-password":"new-password"} minLength={mode==="register"?10:1} maxLength={128} required disabled={busy||!ready}/>{mode==="register"&&<small>Minimal 10 karakter. Email harus sudah diundang lembaga.</small>}</div>}
   {mode==="register"&&<div className="field"><label htmlFor="password-confirmation">Konfirmasi password</label><input id="password-confirmation" name="confirmation" type="password" autoComplete="new-password" required minLength={10} maxLength={128} disabled={busy||!ready}/></div>}
   <div ref={feedbackRef} tabIndex={-1} className="form-feedback" aria-label="Hasil permintaan">{error&&<Notice tone="error" title={error.title}>{error.message}</Notice>}{message&&<Notice title={message.title}>{message.message}</Notice>}</div>
   <button className="btn primary" disabled={busy||!ready}>{busy?"Memproses…":mode==="login"?"Masuk dengan email":mode==="register"?"Buat akun":"Kirim tautan pemulihan"}</button>
  </form>
  <div className="actions password-links">{mode==="login"?<><button type="button" className="text-btn" disabled={busy} onClick={()=>switchMode("register")}>Buat akun undangan</button><button type="button" className="text-btn" disabled={busy} onClick={()=>switchMode("recover")}>Lupa password?</button></>:<button type="button" className="text-btn" disabled={busy} onClick={()=>switchMode("login")}>Kembali ke masuk</button>}</div>
 </div>;
}

export function ResetPassword(){
 const [busy,setBusy]=useState(false),[error,setError]=useState<Feedback|null>(null);const router=useRouter(),feedbackRef=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(error)feedbackRef.current?.focus();},[error]);
 return <form className="form" aria-busy={busy} onSubmit={async e=>{
  e.preventDefault();setError(null);const f=new FormData(e.currentTarget);
  if(f.get("password")!==f.get("confirmation")){setError({title:"Konfirmasi password belum sama",message:"Ketik ulang konfirmasi agar sama persis dengan password baru."});return;}
  setBusy(true);try{await passwordRequest({mode:"update",password:f.get("password")});router.replace("/dashboard");router.refresh();}catch(e){setError(failure(e,"Password belum diperbarui"));}finally{setBusy(false);}
 }}>
  <div className="field"><label htmlFor="new-password">Password baru</label><input id="new-password" name="password" type="password" autoComplete="new-password" required minLength={10} maxLength={128} disabled={busy}/><small>Gunakan 10–128 karakter dan password yang berbeda dari sebelumnya.</small></div>
  <div className="field"><label htmlFor="confirm-new-password">Konfirmasi password baru</label><input id="confirm-new-password" name="confirmation" type="password" autoComplete="new-password" required minLength={10} maxLength={128} disabled={busy}/></div>
  <div ref={feedbackRef} tabIndex={-1} className="form-feedback" aria-label="Hasil pembaruan password">{error&&<Notice tone="error" title={error.title}>{error.message}</Notice>}</div>
  <button className="btn primary" disabled={busy}>{busy?"Menyimpan…":"Simpan password baru"}</button>
 </form>;
}

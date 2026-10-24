import { Check,Clock3,ShieldCheck,ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { Brand,Notice } from "@/components/ui";
import { configured } from "@/lib/supabase/server";
import {PasswordLogin} from "@/components/password-login";
export default async function Login({searchParams}:{searchParams:Promise<{error?:string}>}){
 const {error}=await searchParams; const ready=configured();
 const loginErrors:Record<string,{title:string;message:string}>={
  google_disabled:{title:"Login Google belum tersedia",message:"Gunakan email dan password akun undangan. Jika belum memiliki password, pilih Lupa password atau hubungi admin lembaga."},
  confirmation:{title:"Tautan konfirmasi tidak berlaku",message:"Tautan mungkin sudah digunakan atau kedaluwarsa. Untuk konfirmasi akun, ulangi Buat akun undangan. Untuk pemulihan, pilih Lupa password. Buka tautan terbaru pada browser yang sama."},
  oauth:{title:"Login belum berhasil",message:"Coba masuk kembali pada browser yang sama. Anda juga dapat menggunakan email dan password. Jika berulang, hubungi admin lembaga."}
 };
 const feedback=error?loginErrors[error]??loginErrors.oauth:undefined;
 return <main className="login-wrap" id="main"><div className="login-body"><section className="login-copy"><Brand/><h1>Fokus pada pemahaman.</h1><p>Ruang ujian untuk bertanya dan bernalar. Kerjakan dengan tenang, dari soal pertama sampai jawaban terakhir.</p><div className="login-proof">{[{icon:Check,title:"Jawaban tercatat",text:"Status simpan jelas pada setiap perubahan."},{icon:Clock3,title:"Waktu yang konsisten",text:"Batas waktu ditentukan server, bukan perangkat."},{icon:ShieldCheck,title:"Aturan yang transparan",text:"Ketahui aturan pengawasan sebelum mulai."}].map(x=><div key={x.title}><x.icon size={18}/><span>{x.title}<small>{x.text}</small></span></div>)}</div></section><section className="login-card"><h2>Masuk ke ruang ujian</h2><p>Gunakan email dan password akun undangan, atau masuk dengan Google.</p>{error&&<div style={{marginBottom:20}}><Notice tone="error" title={feedback?.title}>{feedback?.message}</Notice></div>}<PasswordLogin ready={ready}/><div className="login-alternative">atau</div><a href={ready?"/auth/login":"/setup"} className="btn"><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M21.6 12.2c0-.7-.1-1.5-.2-2.2H12v4h5.4c-.2 1.2-.9 2.2-1.9 2.9A6.1 6.1 0 0 1 6 12a6 6 0 0 1 10.2-4.3L19.3 4A10 10 0 1 0 22 12.2z"/></svg>Lanjutkan dengan Google</a><div className="divider"/><p className="small" style={{marginBottom:0}}>Belum punya akses? Hubungi pengajar atau admin lembaga untuk mendaftarkan akun Anda.</p>{!ready&&<Link href="/setup" className="link actions" style={{marginTop:20,fontSize:12}}>Panduan konfigurasi admin<ArrowUpRight size={14}/></Link>}</section></div><footer className="login-footer"><span>Socratic · Question · Reason · Progress</span><Link href="/privacy">Privasi & aturan ujian</Link></footer></main>;
}

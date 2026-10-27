import Link from "next/link";
import {Brand,Notice} from "@/components/ui";
import {PasswordLogin} from "@/components/password-login";
import {JoinClass} from "@/components/join-class";
import {classLinkPreview} from "@/lib/class-links-server";
import {verifiedUser} from "@/lib/server";
import {configured} from "@/lib/supabase/server";
import {formatDate} from "@/lib/domain";

export const dynamic="force-dynamic";
export const metadata={title:"Undangan kelas",referrer:"no-referrer" as const};
export default async function JoinPage({params,searchParams}:{params:Promise<{token:string}>;searchParams:Promise<{error?:string}>}){
 const {token}=await params;const {error}=await searchParams;
 let preview=null,failed=false;
 try{if(configured())preview=await classLinkPreview(token);else failed=true;}catch{failed=true;}
 const user=preview?await verifiedUser():null;
 return <main id="main" className="join-wrap"><div className="join-card stack"><Brand/>
  {!preview?<><h1>Undangan kelas</h1><Notice tone={failed?"error":"warning"} title={failed?"Layanan belum tersedia":"Link tidak berlaku"}>{failed?"Undangan belum bisa diperiksa. Coba lagi beberapa saat atau minta bantuan pengajar.":"Link sudah kedaluwarsa, dinonaktifkan, atau tidak ditemukan. Minta link baru kepada pengajar."}</Notice><Link className="btn" href="/login">Ke halaman masuk</Link></>:<>
   <div><h1>Bergabung ke kelas</h1><h2 className="join-class-name">{preview.class_name}</h2><p className="small">Undangan berlaku sampai {formatDate(preview.expires_at)}. {preview.remaining} tempat tersisa.</p></div>
   {error&&<Notice tone="error" title="Belum berhasil masuk">{error==="google_disabled"?"Masuk dengan Google belum tersedia. Gunakan email dan kata sandi pada undangan ini.":error==="confirmation"?"Tautan pengaktifan akun tidak berlaku. Minta tautan terbaru melalui Daftar dengan email.":"Coba masuk kembali menggunakan email atau Google pada undangan ini."}</Notice>}
   {user?<><p className="small">Masuk sebagai {user.email}.</p><JoinClass token={token}/></>:<>
    <p>Daftar atau masuk menggunakan emailmu. Setelah email terverifikasi, kamu otomatis bergabung sebagai peserta kelas ini.</p>
    {preview.remaining===0&&<Notice tone="warning">Batas peserta link sudah tercapai. Anggota yang sudah bergabung tetap dapat masuk. Jika kamu peserta baru, minta link baru kepada pengajar.</Notice>}
    <PasswordLogin ready joinToken={token}/><div className="login-alternative">atau</div><a className="btn" href={`/auth/login?next=${encodeURIComponent(`/join/${token}`)}`}>Lanjutkan dengan Google</a>
   </>}
  </>}
 </div></main>;
}

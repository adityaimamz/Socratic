import Link from "next/link";
import {redirect} from "next/navigation";
import {currentProfile} from "@/lib/server";
import {Brand} from "@/components/ui";
import {ResetPassword} from "@/components/password-login";
export default async function ResetPasswordPage(){
 const profile=await currentProfile().catch(()=>null);if(!profile)redirect("/login?error=confirmation");
 return <main className="setup" id="main" style={{maxWidth:520}}><Brand/><h1>Atur password baru</h1><p>Gunakan minimal 10 karakter untuk akun {profile.email}.</p><ResetPassword/><Link className="link" href="/login">Kembali ke masuk</Link></main>;
}

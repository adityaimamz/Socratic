import {NextResponse} from "next/server";
import {authClient} from "@/lib/supabase/server";
export async function GET(request:Request){
 const url=new URL(request.url),base=process.env.NEXT_PUBLIC_APP_URL||url.origin;
 const hash=url.searchParams.get("token_hash"),type=url.searchParams.get("type");
 if(hash&&(type==="signup"||type==="recovery")){
  const auth=await authClient();const {error}=await auth.auth.verifyOtp({token_hash:hash,type});
  if(!error)return NextResponse.redirect(new URL(type==="recovery"?"/auth/reset-password":"/dashboard",base));
 }
 return NextResponse.redirect(new URL("/login?error=confirmation",base));
}

import { NextResponse } from "next/server";
import { authClient, configured } from "@/lib/supabase/server";
export async function GET(request: Request) {
  const base = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  if (!configured()) return NextResponse.redirect(new URL("/setup",base));
  try {
    const settings=await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`,{headers:{apikey:process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!},cache:"no-store",signal:AbortSignal.timeout(10000)});
    if(!settings.ok) return NextResponse.redirect(new URL("/login?error=oauth",base));
    if(!(await settings.json()).external?.google)return NextResponse.redirect(new URL("/login?error=google_disabled",base));
  } catch {return NextResponse.redirect(new URL("/login?error=oauth",base));}
  const client = await authClient();
  const {data,error} = await client.auth.signInWithOAuth({ provider:"google",options:{redirectTo:`${base}/auth/callback`,queryParams:{prompt:"select_account"}} });
  return NextResponse.redirect(error || !data.url ? new URL("/login?error=oauth",base).toString() : data.url);
}

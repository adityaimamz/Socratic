import { NextResponse } from "next/server";
import { authClient, configured } from "@/lib/supabase/server";
import {joinDestination} from "@/lib/class-links";
import {rememberJoin} from "@/lib/class-links-server";
export async function GET(request: Request) {
  const base = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  const next=joinDestination(new URL(request.url).searchParams.get("next"));
  const failed=(error:string)=>new URL(`${next??"/login"}?error=${error}`,base);
  if (!configured()) return NextResponse.redirect(new URL("/setup",base));
  try {
    const settings=await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`,{headers:{apikey:process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!},cache:"no-store",signal:AbortSignal.timeout(10000)});
    if(!settings.ok) return NextResponse.redirect(failed("oauth"));
    if(!(await settings.json()).external?.google)return NextResponse.redirect(failed("google_disabled"));
  } catch {return NextResponse.redirect(failed("oauth"));}
  const client = await authClient();
  if(next)await rememberJoin(next.slice("/join/".length));
  const {data,error} = await client.auth.signInWithOAuth({ provider:"google",options:{redirectTo:next?`${base}/auth/callback?next=${encodeURIComponent(next)}`:`${base}/auth/callback`,queryParams:{prompt:"select_account"}} });
  return NextResponse.redirect(error || !data.url ? failed("oauth").toString() : data.url);
}

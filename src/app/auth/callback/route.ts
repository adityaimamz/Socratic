import { NextResponse } from "next/server";
import { authClient } from "@/lib/supabase/server";
import {afterAuthDestination} from "@/lib/class-links-server";
export async function GET(request: Request) {
  const url = new URL(request.url); const base = process.env.NEXT_PUBLIC_APP_URL || url.origin; const code = url.searchParams.get("code");
  if(code) { const client = await authClient(); const {error} = await client.auth.exchangeCodeForSession(code); if(!error) return NextResponse.redirect(new URL(url.searchParams.get("next")==="reset-password"?"/auth/reset-password":await afterAuthDestination(url.searchParams.get("next")),base)); }
 const destination=await afterAuthDestination(url.searchParams.get("next"));
 return NextResponse.redirect(new URL(`${destination.startsWith("/join/")?destination:"/login"}?error=oauth`,base));
}

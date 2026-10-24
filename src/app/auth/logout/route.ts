import { NextResponse } from "next/server";
import { authClient } from "@/lib/supabase/server";
export async function POST(request: Request) {
  const base=process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  if(request.headers.get("origin")!==new URL(base).origin) return new Response(null,{status:403});
  const client = await authClient(); await client.auth.signOut();
  return NextResponse.redirect(new URL("/login",base),303);
}

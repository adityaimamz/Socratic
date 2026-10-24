import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  // Route Handlers validate once and can refresh their own response cookies.
  if(request.nextUrl.pathname.startsWith("/api/"))return response;
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) return response;
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { cookies: {
    getAll: () => request.cookies.getAll(),
    setAll: entries => { entries.forEach(({name,value}) => request.cookies.set(name,value)); response = NextResponse.next({ request }); entries.forEach(({name,value,options}) => response.cookies.set(name,value,options)); }
  } });
  await supabase.auth.getClaims();
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)"] };

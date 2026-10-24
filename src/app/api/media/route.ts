import { NextRequest, NextResponse } from "next/server";
import { serverRequest } from "@/lib/server";
import type {Profile} from "@/lib/types";
import {ApiError} from "@/lib/domain";
import { adminClient } from "@/lib/supabase/server";
import { messages } from "@/lib/domain";
export async function POST(request: NextRequest) {
  const headers = {"Cache-Control":"private, no-store"};
  const origin = new URL(process.env.NEXT_PUBLIC_APP_URL || request.url).origin;
  if (request.headers.get("origin") !== origin) return NextResponse.json({code:"ORIGIN_NOT_ALLOWED",message:messages.ORIGIN_NOT_ALLOWED},{status:403,headers});
  let p:Profile;
  try{p=await serverRequest<Profile>("media.authorize",{});}catch(error){const e=error instanceof ApiError?error:new ApiError("SERVER_ERROR",undefined,503);return NextResponse.json({code:e.code,message:e.message},{status:e.status,headers});}
  if (Number(request.headers.get("content-length") ?? 0) > 2200000) return NextResponse.json({message:"Maksimum gambar 2 MB."},{status:413,headers});
  const form = await request.formData(); const file = form.get("file");
  if (!(file instanceof File) || file.size > 2097152) return NextResponse.json({message:"Maksimum gambar 2 MB."},{status:422,headers});
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = bytes[0]===0xff && bytes[1]===0xd8 && bytes[2]===0xff ? "image/jpeg" : bytes.slice(0,8).join(",")==="137,80,78,71,13,10,26,10" ? "image/png" : new TextDecoder().decode(bytes.slice(0,4))==="RIFF" && new TextDecoder().decode(bytes.slice(8,12))==="WEBP" ? "image/webp" : null;
  if (!mime || mime !== file.type) return NextResponse.json({message:"Gunakan JPEG, PNG, atau WebP yang valid."},{status:422,headers});
  const path = `${p.id}/${crypto.randomUUID()}.${mime.split("/")[1]}`;
  const client = adminClient(); const {error} = await client.storage.from("exam-media").upload(path,bytes,{contentType:mime,upsert:false});
  if(error) return NextResponse.json({message:"Gambar belum berhasil diunggah. Coba lagi beberapa saat. Jika berulang, minta admin memeriksa penyimpanan gambar."},{status:503,headers});
  return NextResponse.json({path},{headers});
}
export async function GET(request: NextRequest) {
  const path = request.nextUrl.searchParams.get("path");
  if(!path||path.length>200)return new Response(null,{status:404});
  const allowed=await serverRequest<boolean>("media.allowed",{path}).catch(()=>false);
  if(!allowed) return new Response(null,{status:404});
  const client=adminClient();
  const {data} = await client.storage.from("exam-media").createSignedUrl(path,900);
  if(!data) return new Response(null,{status:404});
  return NextResponse.redirect(data.signedUrl,{headers:{"Cache-Control":"private, no-store"}});
}

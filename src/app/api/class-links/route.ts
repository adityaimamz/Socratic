import {randomBytes} from "node:crypto";
import {NextResponse} from "next/server";
import {ZodError} from "zod";
import {cookies} from "next/headers";
import {classLinkInput,pendingJoinCookie} from "@/lib/class-links";
import {hashJoinToken} from "@/lib/class-links-server";
import {adminClient,configured} from "@/lib/supabase/server";
import {databaseError,verifiedUser} from "@/lib/server";
import {ApiError} from "@/lib/domain";

export async function POST(request:Request){
 const headers={"Cache-Control":"private, no-store"};
 try{
  if(request.headers.get("origin")!==new URL(process.env.NEXT_PUBLIC_APP_URL||request.url).origin)throw new ApiError("ORIGIN_NOT_ALLOWED",undefined,403);
  if(!configured())throw new ApiError("SETUP_REQUIRED",undefined,503);
  if(Number(request.headers.get("content-length")??0)>4096)throw new ApiError("PAYLOAD_TOO_LARGE",undefined,413);
  const raw=await request.text();if(raw.length>4096)throw new ApiError("PAYLOAD_TOO_LARGE",undefined,413);
  const input=classLinkInput.parse(JSON.parse(raw)),user=await verifiedUser();
  if(!user)throw new ApiError("UNAUTHORIZED",undefined,401);
  const db=adminClient(),rate=await db.rpc("school_rate_limit",{p_actor:user.id,p_lane:"write"});
  if(rate.error)throw databaseError(rate.error.message);
  if(!rate.data)throw new ApiError("RATE_LIMITED",undefined,429);
  if(input.operation==="join"){
   const {data,error}=await db.rpc("school_class_link_join",{p_actor:user.id,p_email:user.email,p_name:user.user_metadata.full_name??user.email,p_hash:hashJoinToken(input.token)});
   if(error)throw databaseError(error.message);
   (await cookies()).delete(pendingJoinCookie);
   return NextResponse.json(data,{headers});
  }
  const token=input.operation==="create"?randomBytes(32).toString("hex"):null;
  const {data,error}=await db.rpc("school_class_link_manage",{p_actor:user.id,p_class:input.class_id,p_operation:input.operation,p_hash:token?hashJoinToken(token):null,p_days:input.operation==="create"?input.days:7,p_limit:input.operation==="create"?input.limit:40});
  if(error)throw databaseError(error.message);
  return NextResponse.json({...data,...(token?{join_url:new URL(`/join/${token}`,process.env.NEXT_PUBLIC_APP_URL||request.url).toString()}:{})},{headers});
 }catch(error){
  if(error instanceof SyntaxError||error instanceof ZodError)return NextResponse.json({code:"INVALID_INPUT",message:"Periksa masa berlaku dan batas peserta link."},{status:422,headers});
  const e=error instanceof ApiError?error:new ApiError("SERVER_ERROR",undefined,500);
  return NextResponse.json({code:e.code,message:e.message},{status:e.status,headers});
 }
}

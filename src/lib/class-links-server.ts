import "server-only";
import {createHash} from "node:crypto";
import {cookies} from "next/headers";
import {adminClient} from "./supabase/server";
import {joinDestination,joinToken,pendingJoinCookie,type JoinPreview} from "./class-links";
import {databaseError} from "./server";

export function hashJoinToken(token:string){return createHash("sha256").update(token).digest("hex");}
export async function classLinkPreview(token:unknown):Promise<JoinPreview|null>{
 const parsed=joinToken.safeParse(token);if(!parsed.success)return null;
 const {data,error}=await adminClient().rpc("school_class_link_preview",{p_hash:hashJoinToken(parsed.data)});
 if(error)throw databaseError(error.message);
 return data as JoinPreview|null;
}
export async function rememberJoin(token:string){
 (await cookies()).set(pendingJoinCookie,token,{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/",maxAge:86400});
}
export async function afterAuthDestination(next:unknown){
 return joinDestination(next)??joinDestination(`/join/${(await cookies()).get(pendingJoinCookie)?.value}`)??"/dashboard";
}

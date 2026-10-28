import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { adminClient, authClient, configured } from "./supabase/server";
import { ApiError } from "./domain";
import type { Profile, Workspace, Attempt } from "./types";
import { parseAction } from "./validation";
import { parseView } from "./views";

export const verifiedUser = cache(async () => {
  if (!configured()) return null;
  const auth = await authClient();
  const { data: { user }, error } = await auth.auth.getUser();
  if (error || !user || !user.email || !user.email_confirmed_at || !user.identities?.some(i=>i.provider==="google"||i.provider==="email")) return null;
  return user;
});
export const currentProfile = cache(async (): Promise<Profile | null> => {
  const user=await verifiedUser();if(!user)return null;
  const { data, error: admissionError } = await adminClient().rpc("school_accept", { p_actor: user.id, p_email: user.email, p_name: user.user_metadata.full_name ?? user.email });
  if (admissionError) {
    if (/INVITATION_REQUIRED/.test(admissionError.message)) throw new ApiError("INVITATION_REQUIRED", undefined, 403);
    if (/ACCOUNT_DISABLED/.test(admissionError.message)) throw new ApiError("ACCOUNT_DISABLED", undefined, 403);
    throw new ApiError("SETUP_REQUIRED", "Layanan ujian belum siap. Minta bantuan pengajar atau pengelola sekolah.", 503);
  }
  return data as Profile;
});
export type RequestTiming = {auth?:number;db?:number;media?:number;viewer?:Profile};
export function databaseError(message:string):ApiError {
 const code=message.match(/\b(?:NAME_REQUIRED|JOIN_LINK_UNAVAILABLE|JOIN_LINK_FULL|QUESTION_IN_USE|CLASS_IN_USE|DRAFT_ONLY|EXAM_HAS_ATTEMPTS|GRADING_PENDING|GRADE_FINALIZED|INVALID_GRADE|ATTEMPT_ACTIVE|UNAUTHORIZED|ACCOUNT_DISABLED|INVITATION_REQUIRED|FORBIDDEN|NOT_FOUND|STALE_SESSION|ANSWER_EPOCH_MISMATCH|REVISION_CONFLICT|ATTEMPT_FINALIZED|DEADLINE_PASSED|EXAM_NOT_OPEN|ATTEMPT_LIMIT|EXAM_IMMUTABLE|INVALID_QUESTION|INVALID_EXAM|INVALID_ANSWER|REVIEW_TOO_EARLY|REASON_REQUIRED|CANNOT_EDIT_SELF|RETAKE_NOT_ALLOWED|NO_TAKEOVER_REQUEST|IDEMPOTENCY_CONFLICT|RATE_LIMITED)\b/)?.[0]??"SERVER_ERROR";
 return new ApiError(code,undefined,code==="NOT_FOUND"?404:code==="UNAUTHORIZED"?401:["FORBIDDEN","ACCOUNT_DISABLED","INVITATION_REQUIRED"].includes(code)?403:code==="RATE_LIMITED"?429:code==="SERVER_ERROR"?500:409);
}
export async function serverRequest<T>(action:string,input:unknown,timing:RequestTiming={},signal?:AbortSignal):Promise<T>{
 const authAt=performance.now();const user=await verifiedUser();timing.auth=performance.now()-authAt;
 if(!user)throw new ApiError("UNAUTHORIZED",undefined,401);
 const payload=action.startsWith("view.")?parseView(action.slice(5),input).params:action.startsWith("import.")||action.startsWith("media.")?input:parseAction(action,input);
 const dbAt=performance.now();
 const operation=adminClient().rpc("school_request",{p_actor:user.id,p_email:user.email,p_name:user.user_metadata.full_name??user.email,p_action:action,p_data:payload});
 const {data,error}=await (signal?operation.abortSignal(signal):operation);
 timing.db=performance.now()-dbAt;
 if(data?.profile)timing.viewer=data.profile as Profile;
 if(error)throw databaseError(error.message);
 if(!data||data.ok!==true)throw databaseError(String(data?.code??"SERVER_ERROR"));
 return data.data as T;
}
export async function requireProfile() {
  const profile = await currentProfile();
  if (!profile) redirect("/login");
  return profile;
}
export async function rpc<T>(profile: Profile, action: string, input: unknown): Promise<T> {
  const payload = parseAction(action,input);
  const client=adminClient();
  const p=payload as Record<string,unknown>;
  const request=action==="admin.health" ? client.rpc("school_health",{p_actor:profile.id}) : action==="exams.accommodation.get" ? client.rpc("school_accommodation_get",{p_actor:profile.id,p_exam:p.id}) : action==="exams.update" ? client.rpc("school_exam_update",{p_actor:profile.id,p_exam:p.id,p_data:payload}) : action==="exams.accommodation.set" ? client.rpc("school_accommodation_set",{p_actor:profile.id,p_exam:p.id,p_email:p.email,p_exempt:p.fullscreen_exempt,p_reason:p.reason}) : client.rpc("school_api", { p_actor: profile.id, p_action: action, p_data: payload });
  const {data,error}=await request;
  if (error) {
    const code = error.message.match(/\b(?:QUESTION_IN_USE|CLASS_IN_USE|DRAFT_ONLY|EXAM_HAS_ATTEMPTS|GRADING_PENDING|GRADE_FINALIZED|INVALID_GRADE|ATTEMPT_ACTIVE|UNAUTHORIZED|FORBIDDEN|NOT_FOUND|STALE_SESSION|ANSWER_EPOCH_MISMATCH|REVISION_CONFLICT|ATTEMPT_FINALIZED|DEADLINE_PASSED|EXAM_NOT_OPEN|ATTEMPT_LIMIT|EXAM_IMMUTABLE|INVALID_QUESTION|INVALID_EXAM|INVALID_ANSWER|REVIEW_TOO_EARLY|REASON_REQUIRED|CANNOT_EDIT_SELF|RETAKE_NOT_ALLOWED|NO_TAKEOVER_REQUEST|IDEMPOTENCY_CONFLICT|RATE_LIMITED)\b/)?.[0];
    throw new ApiError(code ?? "SERVER_ERROR", undefined, code === "NOT_FOUND" ? 404 : code === "UNAUTHORIZED" ? 401 : code === "FORBIDDEN" ? 403 : code === "RATE_LIMITED" ? 429 : code ? 409 : 500);
  }
  return data as T;
}
export const workspace = cache(async () => rpc<Workspace>(await requireProfile(), "workspace", {}));
export async function withMedia(a: Attempt) {
  const client = adminClient();
  const paths=[...new Set(a.items.flatMap(item=>item.media_path?[item.media_path]:[]))];
  if(!paths.length)return a;
  const {data}=await client.storage.from("exam-media").createSignedUrls(paths,900);
  const signed=new Map(data?.map(file=>[file.path,file.signedUrl]));
  a.items=a.items.map(item=>item.media_path?{...item,media_url:signed.get(item.media_path)??undefined}:item);
  return a;
}

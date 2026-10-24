import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { adminClient, authClient, configured } from "./supabase/server";
import { ApiError } from "./domain";
import type { Profile, Workspace, Attempt } from "./types";
import { parseAction } from "./validation";

export const currentProfile = cache(async (): Promise<Profile | null> => {
  if (!configured()) return null;
  const auth = await authClient();
  const { data: { user }, error } = await auth.auth.getUser();
  if (error || !user || !user.email || !user.email_confirmed_at || !user.identities?.some(i=>i.provider==="google"||i.provider==="email")) return null;
  const { data, error: admissionError } = await adminClient().rpc("school_accept", { p_actor: user.id, p_email: user.email, p_name: user.user_metadata.full_name ?? user.email });
  if (admissionError) {
    if (/INVITATION_REQUIRED/.test(admissionError.message)) throw new ApiError("INVITATION_REQUIRED", undefined, 403);
    if (/ACCOUNT_DISABLED/.test(admissionError.message)) throw new ApiError("ACCOUNT_DISABLED", undefined, 403);
    throw new ApiError("SETUP_REQUIRED", "Database belum siap. Jalankan migrasi dan periksa konfigurasi server.", 503);
  }
  return data as Profile;
});
export async function requireProfile() {
  const profile = await currentProfile();
  if (!profile) redirect("/login");
  return profile;
}
export async function rpc<T>(profile: Profile, action: string, input: unknown): Promise<T> {
  const payload = parseAction(action,input);
  const client=adminClient();
  const p=payload as Record<string,unknown>;
  const request=action==="admin.health" ? client.rpc("school_health",{p_actor:profile.id}) : action==="exams.accommodation.get" ? client.rpc("school_accommodation_get",{p_actor:profile.id,p_exam:p.id}) : action==="exams.accommodation.set" ? client.rpc("school_accommodation_set",{p_actor:profile.id,p_exam:p.id,p_email:p.email,p_exempt:p.fullscreen_exempt,p_reason:p.reason}) : client.rpc("school_api", { p_actor: profile.id, p_action: action, p_data: payload });
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
  a.items = await Promise.all(a.items.map(async item => {
    if (!item.media_path) return item;
    const { data } = await client.storage.from("exam-media").createSignedUrl(item.media_path, 900);
    return { ...item, media_url: data?.signedUrl };
  }));
  return a;
}

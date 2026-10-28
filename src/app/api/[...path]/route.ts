import { after, NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { serverRequest, withMedia, type RequestTiming } from "@/lib/server";
import { adminClient, configured } from "@/lib/supabase/server";
import { ApiError, csvCell, messages } from "@/lib/domain";
import type { Attempt, Monitor } from "@/lib/types";
import {validationMessage} from "@/lib/validation";

export const dynamic = "force-dynamic";
function resolve(path: string[], method: string) {
  const key = path.join("/");
  if(path[0]==="views"&&path.length===2&&method==="GET")return {action:`view.${path[1]}`,id:undefined};
  if (key === "workspace" && method === "GET") return { action: "workspace", id: undefined };
  if (key === "profile/name" && method === "POST") return { action: "profile.name", id: undefined };
  if (key === "admin/health" && method === "GET") return { action: "admin.health", id: undefined };
  if (/^(questions|classes|exams)\/delete$/.test(key) && method === "POST") return { action: key.replace("/", "."), id: undefined };
  if(path[0]==="exams"&&path.length===3&&path[2]==="accommodation")return {action:`exams.accommodation.${method==="GET"?"get":"set"}`,id:path[1]};
  if (/^(classes|questions|exams|admin)\/(save|archive|invite|user|settings)$/.test(key) && method === "POST") return { action: key.replace("/", "."), id: undefined };
  if (path[0] === "exams" && path.length === 3 && method === "POST") return { action: path[2] === "attempts" ? "attempt.start" : `exams.${path[2]}`, id: path[1] };
  if (path[0] === "attempts" && path.length >= 2) {
    const op = path.length === 2 ? "get" : path[2] === "answers" ? "save" : path[2];
    if ((method === "GET" && ["get", "result"].includes(op)) || (method === "POST" && ["save", "heartbeat", "events", "takeover", "submit"].includes(op)) || (method === "PUT" && op==="save"))
      return { action: `attempt.${op}`, id: path[1], item_id: op === "save" ? path[3] : undefined };
  }
  if (path[0] === "manage" && path[1] === "exams" && path.length === 4 && ((method === "GET" && ["monitor", "export"].includes(path[3])) || (method === "POST" && path[3] === "release"))) return { action: `manage.${path[3]}`, id: path[2] };
  if (path[0] === "manage" && path[1] === "attempts" && path[3] === "actions" && method === "POST") return { action: "manage.action", id: path[2] };
  if (path[0] === "manage" && path[1] === "attempts" && path.length === 4 && path[3] === "grading" && ["GET","POST"].includes(method)) return {action:method==="GET"?"manage.grading":"manage.grade",id:path[2]};
  throw new ApiError("NOT_FOUND", undefined, 404);
}
async function handler(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const timing:RequestTiming={};
  const headers:Record<string,string> = { "Cache-Control": "private, no-store" };
  const measured=()=>{headers["Server-Timing"]=Object.entries(timing).filter((entry):entry is [string,number]=>typeof entry[1]==="number").map(([name,ms])=>`${name};dur=${ms.toFixed(1)}`).join(", ");if(timing.viewer)headers["X-Socratic-Viewer"]=`${timing.viewer.id}:${timing.viewer.role}`;return headers;};
  const started=performance.now();let operation="unknown",failed=false;
  try {
    if (!configured()) throw new ApiError("SETUP_REQUIRED", undefined, 503);
    if (request.method !== "GET") {
      const origin = request.headers.get("origin");
      const expected = new URL(process.env.NEXT_PUBLIC_APP_URL || request.url).origin;
      if (!origin || origin !== expected) throw new ApiError("ORIGIN_NOT_ALLOWED", undefined, 403);
      if (Number(request.headers.get("content-length") ?? 0) > 256000) throw new ApiError("PAYLOAD_TOO_LARGE", "Ukuran permintaan terlalu besar.", 413);
    }
    const { path } = await context.params;
    const resolved = resolve(path,request.method);
    operation=resolved.action;
    const raw = request.method === "GET" ? Object.fromEntries(request.nextUrl.searchParams) : await request.text();
    if (typeof raw === "string" && raw.length > 256000) throw new ApiError("PAYLOAD_TOO_LARGE", undefined, 413);
    const body = typeof raw === "string" ? JSON.parse(raw) : raw;
    const payload = { ...body, ...(resolved.id ? { id: resolved.id } : {}), ...(resolved.item_id ? { item_id: resolved.item_id } : {}) };
    let data = await serverRequest<unknown>(resolved.action,payload,timing,resolved.action.startsWith("view.")?request.signal:undefined);
    if (data && typeof data === "object" && "ok" in data && data.ok === false && "code" in data) throw new ApiError(String(data.code),undefined,409);
    const mediaAt=performance.now();
    if (["attempt.get","attempt.start","attempt.takeover"].includes(resolved.action) && data && typeof data === "object" && "items" in data) data = await withMedia(data as Attempt);
    if (resolved.action === "attempt.events") { const d = data as { attempt: Attempt }; d.attempt = await withMedia(d.attempt); }
    timing.media=performance.now()-mediaAt;
    if (resolved.action === "attempt.submit") { const r=data as Record<string,unknown>; data={attempt_id:r.attempt_id,receipt_id:r.receipt_id,finalized_at:r.finalized_at,reason:r.reason}; }
    if (resolved.action === "manage.export") {
      const monitor = data as Monitor;
      const rows = [["ID peserta","Nama","Email","Ujian","Nilai","Status penilaian","Status","Selesai","Reset","Review"], ...monitor.attempts.map(a => [a.user_id,a.name,a.email,monitor.exam.title,a.result?.score ?? "",a.result?.grading_status==="pending"?"Menunggu penilaian":a.result?"Selesai":"",a.status,a.result?.finalized_at ?? "",a.reset_count,a.review?.decision ?? ""])];
      return new Response("\uFEFF" + rows.map(r => r.map(csvCell).join(",")).join("\r\n"), { headers: { ...headers, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="hasil-${resolved.id}.csv"` } });
    }
    return NextResponse.json(data,{headers:measured()});
  } catch (error) {
    measured();
    failed=!(error instanceof ZodError)&&!(error instanceof SyntaxError)&&(!(error instanceof ApiError)||error.status>=500);
    if (error instanceof ZodError) return NextResponse.json({code:"INVALID_INPUT",message:validationMessage(error)},{status:422,headers});
    if (error instanceof ApiError) return NextResponse.json({code:error.code,message:error.message},{status:error.status,headers});
    if (error instanceof SyntaxError) return NextResponse.json({code:"INVALID_INPUT",message:"Format data tidak valid."},{status:422,headers});
    return NextResponse.json({code:"SERVER_ERROR",message:messages.SERVER_ERROR ?? "Layanan tidak tersedia. Coba lagi sebentar."},{status:500,headers});
  } finally {
    if(configured()&&operation!=="unknown"){
      const elapsed=performance.now()-started;
      after(async()=>{try{await adminClient().rpc("school_record_metric",{p_operation:operation,p_elapsed:Math.round(elapsed),p_failed:failed});}catch{/* Metrics must never undo an accepted exam operation. */}});
    }
  }
}
export { handler as GET, handler as POST, handler as PUT };

import { NextResponse } from "next/server";
import { ApiError } from "@/lib/domain";
import { adminClient } from "@/lib/supabase/server";
import { questionImportSchema } from "@/lib/validation";
import { importActor, importError, importHeaders, readImportBody } from "@/lib/question-import-server";

export async function POST(request: Request) {
  try {
    const profile = await importActor(request);
    if (!request.headers.get("content-type")?.startsWith("application/json")) throw new ApiError("INVALID_INPUT", "Format data impor harus JSON.", 422);
    const raw = await readImportBody(request, 1024 * 1024);
    const payload = questionImportSchema.parse(JSON.parse(new TextDecoder().decode(raw)));
    const { data, error } = await adminClient().rpc("school_import_questions", { p_actor: profile.id, p_operation: payload.operation_id, p_questions: payload.questions });
    if (error) {
      if (/IDEMPOTENCY_CONFLICT/.test(error.message)) throw new ApiError("IDEMPOTENCY_CONFLICT", "Permintaan impor sebelumnya berbeda. Muat ulang halaman untuk memulai impor baru.", 409);
      if (/FORBIDDEN|UNAUTHORIZED/.test(error.message)) throw new ApiError("FORBIDDEN", undefined, 403);
      if (/INVALID_QUESTION/.test(error.message)) throw new ApiError("INVALID_INPUT", "Periksa kembali seluruh soal. Tidak ada soal dari permintaan ini yang disimpan.", 422);
      throw new ApiError("SERVER_ERROR", "Penyimpanan impor belum dapat dipastikan. Coba simpan lagi dengan pilihan yang sama; permintaan ulang tidak menggandakan soal. Hubungi admin jika tetap gagal.", 503);
    }
    return NextResponse.json(data, { headers: importHeaders });
  } catch (error) { return importError(error); }
}

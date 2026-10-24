import { NextResponse } from "next/server";
import { ApiError } from "@/lib/domain";
import { serverRequest } from "@/lib/server";
import { questionImportSchema } from "@/lib/validation";
import { importOrigin, importError, importHeaders, readImportBody } from "@/lib/question-import-server";

export async function POST(request: Request) {
  try {
    importOrigin(request);
    let payload;
    try {
      if (!request.headers.get("content-type")?.startsWith("application/json")) throw new ApiError("INVALID_INPUT", "Format data impor harus JSON.", 422);
      const raw = await readImportBody(request, 1024 * 1024);
      payload = questionImportSchema.parse(JSON.parse(new TextDecoder().decode(raw)));
    } catch (validationError) {
      // Preserve auth-before-validation errors without a second RPC on valid commits.
      await serverRequest("import.authorize",{});
      throw validationError;
    }
    let data;
    try {data=await serverRequest("import.commit",payload);}catch(error){
      if(error instanceof ApiError){
        if(error.code==="IDEMPOTENCY_CONFLICT")throw new ApiError(error.code,"Permintaan impor sebelumnya berbeda. Muat ulang halaman untuk memulai impor baru.",409);
        if(error.code==="INVALID_QUESTION")throw new ApiError("INVALID_INPUT","Periksa kembali seluruh soal. Tidak ada soal dari permintaan ini yang disimpan.",422);
        if(error.code==="SERVER_ERROR")throw new ApiError(error.code,"Penyimpanan impor belum dapat dipastikan. Coba simpan lagi dengan pilihan yang sama; permintaan ulang tidak menggandakan soal. Hubungi admin jika tetap gagal.",503);
      }
      throw error;
    }
    return NextResponse.json(data, { headers: importHeaders });
  } catch (error) { return importError(error); }
}

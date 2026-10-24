import { NextResponse } from "next/server";
import { ApiError } from "@/lib/domain";
import { IMPORT_LIMITS, parseQuestionText } from "@/lib/question-import";
import { extractQuestionFile } from "@/lib/question-import-file";
import { importActor, importError, importHeaders, readImportBody } from "@/lib/question-import-server";

export const runtime = "nodejs";
export const maxDuration = 30;
export async function POST(request: Request) {
  try {
    await importActor(request);
    if (!request.headers.get("content-type")?.startsWith("multipart/form-data")) throw new ApiError("INVALID_INPUT", "Unggah dokumen melalui formulir impor.", 422);
    const body = await readImportBody(request, IMPORT_LIMITS.fileBytes + 65536);
    const form = await new Response(body, { headers: { "Content-Type": request.headers.get("content-type")! } }).formData();
    const files = form.getAll("file");
    if (files.length !== 1 || !(files[0] instanceof File)) throw new ApiError("INVALID_INPUT", "Pilih satu berkas soal untuk diimpor.", 422);
    const extracted = await extractQuestionFile(files[0]);
    try { return NextResponse.json({ ...parseQuestionText(extracted.text), pages: extracted.pages }, { headers: importHeaders }); }
    catch (error) {
      // Keep extracted text editable even when no question can be recognized yet.
      return NextResponse.json({ text: extracted.text.slice(0, IMPORT_LIMITS.textChars), rows: [], warnings: [error instanceof Error ? error.message : "Periksa format soal."] }, { headers: importHeaders });
    }
  } catch (error) { return importError(error); }
}

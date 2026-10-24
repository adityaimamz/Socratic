import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ApiError } from "./domain";
import { serverRequest } from "./server";
import { configured } from "./supabase/server";
import type {Profile} from "./types";

export const importHeaders = { "Cache-Control": "private, no-store" };
export function importOrigin(request:Request){
  if (!configured()) throw new ApiError("SETUP_REQUIRED", undefined, 503);
  const expected = new URL(process.env.NEXT_PUBLIC_APP_URL || request.url).origin;
  if (request.headers.get("origin") !== expected) throw new ApiError("ORIGIN_NOT_ALLOWED", undefined, 403);
}
export async function importActor(request: Request) {
  importOrigin(request);
  return serverRequest<Profile>("import.authorize",{});
}
// Bound streamed/chunked requests too; Content-Length alone is not a size guarantee.
export async function readImportBody(request: Request, maxBytes: number) {
  if (Number(request.headers.get("content-length")) > maxBytes) throw new ApiError("PAYLOAD_TOO_LARGE", "Ukuran permintaan impor terlalu besar.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError("INVALID_INPUT", "Permintaan impor kosong.", 422);
  const chunks: Uint8Array[] = []; let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      total += value.byteLength;
      if (total > maxBytes) { await reader.cancel(); throw new ApiError("PAYLOAD_TOO_LARGE", "Ukuran permintaan impor terlalu besar.", 413); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const result = new Uint8Array(total); let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
  return result.buffer;
}
export function importError(error: unknown) {
  if (error instanceof ZodError) return NextResponse.json({ code: "INVALID_INPUT", message: "Data impor tidak valid. Periksa jumlah soal (1–100), pertanyaan, opsi/kunci, dan bobot. Muat ulang halaman jika sesi impor berubah." }, { status: 422, headers: importHeaders });
  if (error instanceof ApiError) return NextResponse.json({ code: error.code, message: error.message }, { status: error.status, headers: importHeaders });
  if (error instanceof SyntaxError || error instanceof TypeError) return NextResponse.json({ code: "INVALID_INPUT", message: "Format permintaan impor tidak valid." }, { status: 422, headers: importHeaders });
  return NextResponse.json({ code: "SERVER_ERROR", message: "Impor belum dapat diproses. Coba lagi sebentar." }, { status: 500, headers: importHeaders });
}

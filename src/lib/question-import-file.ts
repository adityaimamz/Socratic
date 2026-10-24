import { getDocumentProxy } from "unpdf";
import { ApiError } from "./domain";
import { IMPORT_LIMITS } from "./question-import";

export async function extractQuestionFile(file: File): Promise<{ text: string; pages?: number }> {
  if (!file.size) throw new ApiError("INVALID_INPUT", "Berkas kosong. Pilih dokumen berisi soal.", 422);
  if (file.size > IMPORT_LIMITS.fileBytes) throw new ApiError("PAYLOAD_TOO_LARGE", "Ukuran berkas maksimum 2 MB.", 413);
  const extension = file.name.toLowerCase().split(".").at(-1);
  if (!["txt", "md", "pdf"].includes(extension ?? "")) throw new ApiError("INVALID_INPUT", "Pilih berkas TXT, MD, atau PDF.", 422);
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (extension !== "pdf") {
    let text: string;
    try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
    catch { throw new ApiError("INVALID_INPUT", "TXT/MD harus disimpan dalam encoding UTF-8.", 422); }
    if (text.length > IMPORT_LIMITS.textChars) throw new ApiError("PAYLOAD_TOO_LARGE", "Teks maksimum 200.000 karakter. Pisahkan dokumen terlebih dahulu.", 413);
    return { text };
  }
  if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") throw new ApiError("INVALID_INPUT", "Isi berkas bukan PDF yang valid.", 422);
  let pdf: Awaited<ReturnType<typeof getDocumentProxy>> | undefined;
  try {
    pdf = await getDocumentProxy(bytes, { useWorkerFetch: false, disableFontFace: true, useSystemFonts: true });
    if (pdf.numPages > IMPORT_LIMITS.pages) throw new ApiError("INVALID_INPUT", "PDF maksimum 50 halaman. Pisahkan berkas terlebih dahulu.", 422);
    const pages: string[] = [];
    let length = 0;
    for (let number = 1; number <= pdf.numPages; number++) {
      const page = await pdf.getPage(number);
      const content = await page.getTextContent();
      const lines: string[] = [];
      let line = "", previousY: number | undefined;
      for (const item of content.items) {
        if (!("str" in item)) continue;
        const y = item.transform[5];
        if (previousY !== undefined && Math.abs(y - previousY) > 3 && line.trim()) { lines.push(line.trim()); line = ""; }
        line += `${line && !/\s$/.test(line) ? " " : ""}${item.str}`;
        previousY = y;
        if (item.hasEOL) { lines.push(line.trim()); line = ""; previousY = undefined; }
      }
      if (line.trim()) lines.push(line.trim());
      const text = lines.join("\n");
      length += text.length + 2;
      if (length > IMPORT_LIMITS.textChars) throw new ApiError("PAYLOAD_TOO_LARGE", "Teks PDF maksimum 200.000 karakter.", 413);
      pages.push(text);
      page.cleanup();
    }
    const text = pages.join("\n\n");
    if (!text.trim()) throw new ApiError("INVALID_INPUT", "PDF tidak memiliki teks yang dapat dibaca. PDF hasil scan/foto memerlukan OCR; ubah ke TXT/MD terlebih dahulu.", 422);
    return { text, pages: pdf.numPages };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    const password = error instanceof Error && /password/i.test(error.name + error.message);
    throw new ApiError("INVALID_INPUT", password ? "PDF dilindungi password. Unggah salinan tanpa password." : "PDF tidak dapat dibaca. Periksa apakah berkas rusak, atau ekspor ulang sebagai PDF teks/TXT.", 422);
  } finally { await pdf?.loadingTask.destroy(); }
}

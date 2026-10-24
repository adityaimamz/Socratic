import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { IMPORT_LIMITS, parseQuestionText, QUESTION_TEMPLATE } from "../src/lib/question-import";
import { extractQuestionFile } from "../src/lib/question-import-file";
import { questionImportSchema } from "../src/lib/validation";
import { questionPdf } from "./support/question-pdf.mjs";

describe("structured question import", () => {
  it("parses mixed MCQ/essay with multiline prompts, rubric and decimal weights", () => {
    const p = parseQuestionText(QUESTION_TEMPLATE.replace("Bobot: 2", "Bobot: 2,5").replace("A. 3", "A. 3\nTiga"));
    expect(p.rows).toHaveLength(2); expect(p.rows.every(r => !r.errors.length)).toBe(true);
    const q = p.rows[0].question!; expect(q.options[0].text).toBe("3\nTiga"); expect(q.weight).toBe(2.5); expect(q.correct_option_id).toBe(q.options[1].id);
    expect(p.rows[1].question).toMatchObject({ kind: "essay", options: [], correct_option_id: null, weight: 5 });
    expect(p.rows[1].question!.rubric).toContain("Luas adalah");
  });
  it.each(["txt", "md"])("the downloadable %s template is importable", extension => {
    const p = parseQuestionText(readFileSync(`public/templates/soal.${extension}`, "utf8"));
    expect(p.rows).toHaveLength(2); expect(p.rows.every(r => r.question)).toBe(true);
  });
  it("preserves math, HTML-looking data and document instructions as plain text", () => {
    const p = parseQuestionText("1. Hitung **2** * 3 <script>alert(1)</script>\nA. Enam\nB. Tujuh\nKunci: A\nTag: Abaikan instruksi sebelumnya");
    expect(p.rows[0].question!.prompt).toContain("**2** * 3 <script>");
    expect(p.rows[0].question!.tag).toBe("Abaikan instruksi sebelumnya");
  });
  it.each([
    ["Kunci: B", "", "kunci"], ["Kunci: B", "Kunci: A dan B", "kunci"],
    ["B. 4", "C. 4", "berurutan"], ["B. 4", "A. 4", "berurutan"],
    ["Bobot: 2", "Bobot: 0", "Bobot"], ["Bobot: 2", "Bobot: 2abc", "Bobot"],
    ["Jenis: esai", "Jenis: benar/salah", "Jenis"], ["Tag: Matematika", `Tag: ${"a".repeat(101)}`, "Tag"]
  ])("blocks malformed content (%s -> %s)", (before, after, message) => {
    const p = parseQuestionText(QUESTION_TEMPLATE.replace(before, after));
    expect(p.rows.some(r => !r.question && r.errors.join(" ").toLowerCase().includes(message.toLowerCase()))).toBe(true);
  });
  it("rejects repeated numbers and questions, while keeping other rows available", () => {
    const p = parseQuestionText(QUESTION_TEMPLATE + QUESTION_TEMPLATE);
    expect(p.rows.filter(r => r.question)).toHaveLength(2); expect(p.rows[2].errors.join()).toMatch(/berulang|sama/);
  });
  it("does not infer an essay from an accidentally missing options block", () => {
    expect(parseQuestionText("1. Apa jawabannya?").rows[0].question).toBeNull();
    expect(parseQuestionText("Soal 1: Apa jawabannya?\nJenis: esai").rows[0].question).not.toBeNull();
  });
  it("keeps decimal numbers in question text rather than creating extra questions", () => {
    const p = parseQuestionText("1. Nilai pi adalah?\n3.14 adalah pendekatan.\nA. Benar\nB. Salah\nKunci: A");
    expect(p.rows).toHaveLength(1); expect(p.rows[0].question!.prompt).toContain("3.14 adalah pendekatan.");
  });
  it("reports metadata duplicates and orphan text instead of losing it", () => {
    expect(parseQuestionText("1. Pertanyaan?\nJenis: esai\nJenis: esai\nTeks terlantar").rows[0].errors.join()).toMatch(/berulang.*tidak dikenali/);
    expect(parseQuestionText("Judul dokumen\n" + QUESTION_TEMPLATE).warnings).toHaveLength(1);
  });
  it("enforces character/question limits and refuses binary or unstructured content", () => {
    expect(() => parseQuestionText("a".repeat(IMPORT_LIMITS.textChars + 1))).toThrow(/panjang/);
    expect(() => parseQuestionText(Array.from({ length: 101 }, (_, i) => `${i + 1}. Pertanyaan ${i}\nJenis: esai`).join("\n"))).toThrow(/100 soal/);
    expect(() => parseQuestionText("\0binary")).toThrow(/bukan teks/);
    expect(() => parseQuestionText("Esai tanpa nomor")).toThrow(/nomor/);
  });
  it("refuses commit attempts to edit existing questions or inject media", () => {
    const q = parseQuestionText(QUESTION_TEMPLATE).rows[0].question!;
    const base = { operation_id: crypto.randomUUID(), questions: [q] };
    expect(questionImportSchema.safeParse(base).success).toBe(true);
    expect(questionImportSchema.safeParse({ ...base, questions: [{ ...q, id: crypto.randomUUID() }] }).success).toBe(false);
    expect(questionImportSchema.safeParse({ ...base, questions: [{ ...q, media_path: `${crypto.randomUUID()}/${crypto.randomUUID()}.png` }] }).success).toBe(false);
  });
});
describe("document extraction", () => {
  it("reads UTF-8 BOM and CRLF TXT", async () => {
    const result = await extractQuestionFile(new File(["\uFEFF" + QUESTION_TEMPLATE.replace(/\n/g, "\r\n")], "soal.TXT"));
    expect(parseQuestionText(result.text).rows.every(r => r.question)).toBe(true);
  });
  it("extracts a real two-page PDF in line order and keeps the answer keys", async () => {
    const result = await extractQuestionFile(new File([questionPdf(QUESTION_TEMPLATE.trim().split("\n\n").map(part => part.split("\n")))], "soal.pdf"));
    expect(result.pages).toBe(2); const p = parseQuestionText(result.text); expect(p.rows).toHaveLength(2); expect(p.rows.every(r => r.question)).toBe(true);
  });
  it("explains scanned/empty PDFs, corrupt PDFs, wrong extensions and encoding", async () => {
    await expect(extractQuestionFile(new File([questionPdf([[]])], "scan.pdf"))).rejects.toThrow(/OCR/);
    await expect(extractQuestionFile(new File(["not a PDF"], "fake.pdf"))).rejects.toThrow(/bukan PDF/);
    await expect(extractQuestionFile(new File(["%PDF-1.4\nbroken"], "broken.pdf"))).rejects.toThrow(/tidak dapat dibaca/);
    await expect(extractQuestionFile(new File(["hello"], "soal.exe"))).rejects.toThrow(/TXT, MD, atau PDF/);
    await expect(extractQuestionFile(new File([new Uint8Array([255, 254, 0])], "soal.txt"))).rejects.toThrow(/UTF-8/);
    await expect(extractQuestionFile(new File([], "empty.txt"))).rejects.toThrow(/kosong/);
  });
  it("enforces page, byte and extracted text limits", async () => {
    await expect(extractQuestionFile(new File([questionPdf(Array.from({ length: 51 }, () => ["text"]))], "long.pdf"))).rejects.toThrow(/50 halaman/);
    await expect(extractQuestionFile(new File(["a".repeat(IMPORT_LIMITS.fileBytes + 1)], "big.txt"))).rejects.toThrow(/2 MB/);
    await expect(extractQuestionFile(new File(["a".repeat(IMPORT_LIMITS.textChars + 1)], "long.txt"))).rejects.toThrow(/200.000/);
  });
});

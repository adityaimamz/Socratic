import { questionSchema } from "./validation";
import type { z } from "zod";

export const IMPORT_LIMITS = { fileBytes: 2 * 1024 * 1024, textChars: 200000, questions: 100, pages: 50 } as const;
export type ImportedQuestion = z.infer<typeof questionSchema>;
export interface ImportRow { number: number; line: number; prompt: string; question: ImportedQuestion | null; errors: string[] }
export interface ImportPreview { text: string; rows: ImportRow[]; warnings: string[]; pages?: number }

export const QUESTION_TEMPLATE = `1. Berapakah hasil 2 + 2?
A. 3
B. 4
C. 5
D. 6
Kunci: B
Bobot: 2
Tag: Matematika

2. Jelaskan perbedaan keliling dan luas persegi.
Jenis: esai
Rubrik: Keliling adalah panjang seluruh sisi (2 poin).
Luas adalah ukuran daerah di dalam persegi (3 poin).
Bobot: 5
Tag: Matematika
`;

function plainLine(line: string) {
  return line.trim().replace(/^#{1,6}\s+/, "").replace(/^[-*+]\s+(?=[A-Fa-f][.)]\s|\*\*|__)/, "").replace(/^\*\*(.+?)\*\*/, "$1").replace(/^__(.+?)__/, "$1");
}

/** Deterministic structured import. Document text is data; no HTML, commands or AI execution. */
export function parseQuestionText(source: string): ImportPreview {
  const text = source.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  if (text.length > IMPORT_LIMITS.textChars) throw new Error("Teks terlalu panjang. Maksimum 200.000 karakter per impor.");
  if (/\u0000/.test(text)) throw new Error("Dokumen bukan teks yang didukung. Simpan TXT/MD sebagai UTF-8.");
  const blocks: { number: number; line: number; lines: string[] }[] = [];
  const warnings: string[] = [];
  let preamble = false;
  for (const [index, raw] of text.split("\n").entries()) {
    const line = plainLine(raw);
    const start = line.match(/^(?:soal\s+)?(\d{1,4})[.)](?:\s+|$)(.*)$/i) ?? line.match(/^soal\s+(\d{1,4})(?:\s*:\s*|\s+|$)(.*)$/i);
    // Indented numbered lines inside a rubric remain part of that rubric.
    if (start && !(/^\s{2,}\S/.test(raw) && blocks.at(-1)?.lines.some(l => /^rubrik\s*:/i.test(plainLine(l))))) {
      blocks.push({ number: Number(start[1]), line: index + 1, lines: [start[2]] });
      if (blocks.length > IMPORT_LIMITS.questions) throw new Error("Maksimum 100 soal per impor. Pisahkan dokumen menjadi beberapa berkas.");
    } else if (blocks.length) blocks.at(-1)!.lines.push(raw);
    else if (line && !/^[-*_]{3,}$/.test(line)) preamble = true;
  }
  if (!blocks.length) throw new Error("Belum menemukan soal. Awali setiap soal dengan nomor, misalnya 1. Pertanyaan, lalu gunakan format contoh.");
  if (preamble) warnings.push("Teks sebelum nomor soal pertama tidak diimpor. Periksa isi dokumen pada editor.");
  const seenNumbers = new Set<number>(), seenPrompts = new Set<string>();
  const rows: ImportRow[] = blocks.map(block => {
    const errors: string[] = [], prompt: string[] = [], rubric: string[] = [];
    const options: { label: string; text: string[] }[] = [];
    const meta = new Map<string, string>();
    let section: "prompt" | "option" | "rubric" | "metadata" = "prompt";
    for (const raw of block.lines) {
      const line = plainLine(raw);
      if (/^[-*_]{3,}$/.test(line)) continue;
      const field = line.match(/^(kunci(?:\s+jawaban)?|jawaban|bobot|tag|jenis|rubrik(?:\s+penilaian)?)\s*:\s*(.*)$/i);
      if (field) {
        const name = /^(kunci|jawaban)/i.test(field[1]) ? "kunci" : /^rubrik/i.test(field[1]) ? "rubrik" : field[1].toLowerCase();
        if (meta.has(name)) errors.push(`Isian ${name} berulang.`);
        meta.set(name, field[2].replace(/\*\*$/, "").trim());
        section = name === "rubrik" ? "rubric" : "metadata";
        if (name === "rubrik") rubric.push(meta.get(name)!);
        continue;
      }
      const choice = line.match(/^([A-Fa-f])[.)]\s*(.*)$/);
      if (choice && section !== "rubric") {
        options.push({ label: choice[1].toUpperCase(), text: [choice[2]] }); section = "option"; continue;
      }
      if (section === "prompt") prompt.push(raw.trim());
      else if (section === "option") options.at(-1)!.text.push(raw.trim());
      else if (section === "rubric") rubric.push(raw.trim());
      else if (line) errors.push(`Baris tidak dikenali setelah metadata: ${line.slice(0, 80)}. Letakkan teks lanjutan tepat setelah pertanyaan, opsi, atau rubrik.`);
    }
    const questionPrompt = prompt.join("\n").trim();
    const kindText = meta.get("jenis")?.toLowerCase();
    const kind = kindText ? /^(esai|essay)$/.test(kindText) ? "essay" : /^(pilgan|pilihan ganda|mcq)$/.test(kindText) ? "mcq" : null : options.length ? "mcq" : "essay";
    if (!kind) errors.push("Jenis soal harus pilgan atau esai.");
    if (!options.length && !kindText && !meta.has("rubrik")) errors.push("Tanpa pilihan jawaban, tuliskan Jenis: esai. Untuk pilgan, sertakan pilihan A–F dan kunci.");
    if (options.some((o, i) => o.label !== String.fromCharCode(65 + i))) errors.push("Pilihan harus berurutan dari A, tanpa huruf berulang atau terlewat.");
    const key = meta.get("kunci")?.toUpperCase().replace(/[.)]$/, "");
    if (kind === "mcq" && (!key || !/^[A-F]$/.test(key) || !options.some(o => o.label === key))) errors.push("Isi satu kunci A–F yang sesuai dengan pilihan jawaban.");
    if (kind === "essay" && (options.length || key)) errors.push("Esai tidak memakai pilihan atau kunci huruf. Gunakan Rubrik: untuk pedoman jawaban.");
    if (kind === "mcq" && meta.has("rubrik")) errors.push("Rubrik hanya untuk esai. Hapus rubrik atau ubah jenis soal.");
    if (seenNumbers.has(block.number)) errors.push("Nomor soal berulang dalam dokumen.");
    seenNumbers.add(block.number);
    const identity = questionPrompt.toLowerCase().replace(/\s+/g, " ");
    if (seenPrompts.has(identity)) errors.push("Pertanyaan yang sama sudah ada di dokumen ini.");
    seenPrompts.add(identity);
    const mappedOptions = options.map(o => ({ id: crypto.randomUUID(), text: o.text.join("\n").trim() }));
    const rawWeight = meta.get("bobot");
    const weight = rawWeight === undefined ? 1 : /^\d+(?:[.,]\d+)?$/.test(rawWeight) ? Number(rawWeight.replace(",", ".")) : NaN;
    const result = questionSchema.safeParse({ kind: kind ?? "mcq", prompt: questionPrompt, options: mappedOptions, correct_option_id: kind === "essay" ? null : mappedOptions[options.findIndex(o => o.label === key)]?.id ?? null, rubric: rubric.join("\n").trim(), weight, tag: meta.get("tag") ?? "", media_path: null });
    if (!result.success) for (const issue of result.error.issues) {
      const labels: Record<string, string> = { prompt: "Pertanyaan harus 3–10.000 karakter", options: "Isi 2–6 pilihan, masing-masing 1–2.000 karakter", weight: "Bobot harus lebih dari 0 dan maksimal 1.000", tag: "Tag maksimal 100 karakter", rubric: "Rubrik maksimal 10.000 karakter" };
      errors.push(labels[String(issue.path[0])] ?? "Periksa jenis, pilihan, dan kunci jawaban.");
    }
    return { number: block.number, line: block.line, prompt: questionPrompt, question: result.success && !errors.length ? result.data : null, errors: [...new Set(errors)] };
  });
  return { text, rows, warnings };
}

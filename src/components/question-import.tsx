"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, Save, FileDown } from "lucide-react";
import { api, requestJson } from "@/lib/client";
import { IMPORT_LIMITS, parseQuestionText, QUESTION_TEMPLATE, type ImportedQuestion, type ImportPreview } from "@/lib/question-import";
import { Notice } from "./ui";

interface Batch { operation_id: string; questions: ImportedQuestion[] }
export function QuestionImport() {
  const router = useRouter();
  const [source, setSource] = useState(""), [preview, setPreview] = useState<ImportPreview | null>(null);
  const [selected, setSelected] = useState<number[]>([]), [busy, setBusy] = useState<"read" | "save" | null>(null);
  const [error, setError] = useState(""), [name, setName] = useState(""), [dirty, setDirty] = useState(false);
  const [batch, setBatch] = useState<Batch | null>(null), [saved, setSaved] = useState<number | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  function show(result: ImportPreview) {
    setPreview(result); setSource(result.text); setSelected(result.rows.flatMap((r, i) => r.question ? [i] : [])); setDirty(false); setError("");
    requestAnimationFrame(() => resultRef.current?.focus());
  }
  async function upload(file: File) {
    setError(""); setPreview(null); setSource(""); setSelected([]); setName(file.name); setDirty(false);
    if (!/\.(txt|md|pdf)$/i.test(file.name)) { setError("Pilih berkas TXT, MD, atau PDF."); return; }
    if (!file.size || file.size > IMPORT_LIMITS.fileBytes) { setError("Berkas harus berisi soal dan berukuran maksimum 2 MB."); return; }
    setBusy("read");
    try {
      const form = new FormData(); form.set("file", file);
      const result = await requestJson<ImportPreview>("/api/questions/import", { method: "POST", body: form });
      setName(file.name); show(result);
    } catch (e) { setError(e instanceof Error ? e.message : "Dokumen belum dapat dibaca."); }
    finally { setBusy(null); }
  }
  function reparse() {
    try { show(parseQuestionText(source)); }
    catch (e) { setPreview(null); setSelected([]); setError(e instanceof Error ? e.message : "Periksa format soal."); }
  }
  async function save() {
    if (!preview || dirty || saved !== null) return;
    const payload = batch ?? { operation_id: crypto.randomUUID(), questions: selected.flatMap(i => preview.rows[i].question ?? []) };
    if (!payload.questions.length) return;
    setBatch(payload); setBusy("save"); setError("");
    try {
      const result = await api<{ count: number }>("questions/import/commit", payload);
      setSaved(result.count); router.refresh();
      requestAnimationFrame(() => resultRef.current?.focus());
    } catch (e) { setError(e instanceof Error ? e.message : "Penyimpanan belum dapat dipastikan. Coba simpan lagi dengan pilihan yang sama."); }
    finally { setBusy(null); }
  }
  const locked = busy !== null || batch !== null;
  const invalid = preview?.rows.filter(r => !r.question).length ?? 0;
  return <div className="import-flow">
    <section className="panel stack">
      <div className="panel-header"><h2>Dokumen soal</h2><a className="btn small" href="/templates/soal.txt" download><FileDown size={15}/>Unduh contoh TXT</a></div>
      <p>Unggah TXT, Markdown (.md), atau PDF teks. Maksimum 2 MB, 50 halaman PDF, dan 100 soal per impor.</p>
      <div className="field"><label htmlFor="question-document">Pilih dokumen</label><input id="question-document" type="file" accept=".txt,.md,.pdf,text/plain,text/markdown,application/pdf" disabled={locked} onChange={e => { const file = e.target.files?.[0]; if (file) void upload(file); e.target.value = ""; }}/><small>{busy === "read" ? "Membaca dokumen…" : name || "Pilgan dan esai dapat digabung dalam satu dokumen."}</small></div>
      <div className="actions"><button className="btn" disabled={locked} onClick={() => { setName("Contoh format"); show(parseQuestionText(QUESTION_TEMPLATE)); }}>Gunakan contoh</button><a href="/templates/soal.md" download className="text-btn">Unduh contoh MD</a></div>
      <details className="import-guide"><summary>Format yang dibaca</summary><div className="stack"><p>Awali setiap soal dengan <strong>1. Pertanyaan</strong>. Pilgan memakai opsi A–F berurutan dan satu <strong>Kunci: B</strong>. Esai memakai <strong>Jenis: esai</strong> dan dapat diberi <strong>Rubrik:</strong>. Bobot bawaan 1; tag boleh kosong.</p><pre>{QUESTION_TEMPLATE}</pre><p>PDF hasil scan/foto perlu dikonversi dengan OCR terlebih dahulu. Gambar, tabel, dan tata letak dokumen tidak ikut diimpor; tambahkan gambar melalui Edit soal setelah tersimpan.</p></div></details>
    </section>
    {(preview || source) && <section className="panel stack"><h2>Periksa teks dokumen</h2><div className="field"><label htmlFor="import-source">Teks soal yang akan dibaca</label><textarea id="import-source" className="import-source" value={source} maxLength={IMPORT_LIMITS.textChars} disabled={locked} spellCheck={false} onChange={e => { setSource(e.target.value); setDirty(true); setError(""); }}/><small>Perbaiki pertanyaan, pilihan, kunci, bobot, dan tag di sini, lalu perbarui pratinjau.</small></div><button className="btn" disabled={locked} onClick={reparse}><Upload size={15}/>Perbarui pratinjau</button>{dirty && <Notice tone="warning">Teks berubah. Perbarui pratinjau sebelum menyimpan.</Notice>}</section>}
    <div ref={resultRef} tabIndex={-1} className="import-result">
      {error && <Notice tone="error" title={batch ? "Impor belum terkonfirmasi" : "Dokumen belum siap"}>{error}{batch && " Pilihan dikunci agar percobaan ulang memakai permintaan yang sama."}</Notice>}
      {saved !== null ? <section className="panel stack"><Notice tone="success" title="Impor selesai">{saved} soal berhasil ditambahkan ke bank soal.</Notice><div className="actions"><Link className="btn primary" href="/manage/questions">Buka bank soal</Link><button className="btn" onClick={() => { setBatch(null); setSaved(null); setPreview(null); setSource(""); setSelected([]); setName(""); }}>Impor dokumen lain</button></div></section> : preview && <section className="panel stack" aria-busy={busy === "save"}>
        <div className="panel-header"><h2>Pratinjau soal</h2><span className="small">{preview.rows.length} terbaca · {invalid} perlu diperbaiki{preview.pages ? ` · ${preview.pages} halaman PDF` : ""}</span></div>
        {preview.warnings.map((warning, i) => <Notice key={i} tone="warning">{warning}</Notice>)}
        {!!invalid && <Notice tone="warning">Soal yang belum valid tidak dapat dipilih. Perbaiki teks dan perbarui pratinjau, atau simpan hanya soal valid yang dipilih.</Notice>}
        {!!preview.rows.length && <label className="check"><input type="checkbox" disabled={locked || dirty} checked={selected.length > 0 && selected.length === preview.rows.filter(r => r.question).length} onChange={e => setSelected(e.target.checked ? preview.rows.flatMap((r, i) => r.question ? [i] : []) : [])}/>Pilih semua soal valid</label>}
        <div className="import-rows">{preview.rows.map((row, i) => <article className="import-row" key={`${row.number}-${row.line}`}>
          <label className="check"><input type="checkbox" aria-label={`Pilih soal ${row.number}`} checked={selected.includes(i)} disabled={locked || dirty || !row.question} onChange={e => setSelected(v => e.target.checked ? [...v, i] : v.filter(n => n !== i))}/><strong>Soal {row.number}</strong><span className="small">Baris {row.line}</span></label>
          <p className="question-preview">{row.prompt || "Pertanyaan kosong"}</p>
          {row.question ? <><p className="small">{row.question.kind === "essay" ? "Esai" : "Pilihan ganda"} · Bobot {row.question.weight} · {row.question.tag || "Tanpa tag"}</p>{row.question.options.length > 0 && <ul className="import-options">{row.question.options.map((option, n) => <li key={option.id}><span>{String.fromCharCode(65 + n)}.</span><span>{option.text}{option.id === row.question!.correct_option_id && <strong className="import-key"> · Kunci jawaban</strong>}</span></li>)}</ul>}{row.question.kind === "essay" && <div className="import-rubric"><strong>Rubrik penilaian</strong><p>{row.question.rubric || "Belum diisi. Dapat dilengkapi melalui Edit soal."}</p></div>}</> : <ul className="import-errors">{row.errors.map(message => <li key={message}>{message}</li>)}</ul>}
        </article>)}</div>
        <div className="import-save"><p>{selected.length} soal dipilih. Soal tersimpan sebagai soal baru milik Anda dan siap dipakai dalam draft ujian.</p><button className="btn primary" disabled={busy !== null || dirty || !selected.length} onClick={() => void save()}><Save size={15}/>{busy === "save" ? "Menyimpan…" : batch ? "Coba simpan lagi" : `Simpan ${selected.length} soal`}</button></div>
      </section>}
    </div>
  </div>;
}

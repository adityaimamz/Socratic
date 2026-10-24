"use client";
import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { api } from "@/lib/client";
import { Modal } from "./modal";
import { Notice } from "./ui";

export function DeleteButton({ kind, id, name, redirectTo, small = false }: { kind: "questions" | "classes" | "exams"; id: string; name: string; redirectTo?: string; small?: boolean }) {
  const label = { questions: "soal", classes: "kelas", exams: "draft ujian" }[kind];
  const titleId = useId(), descriptionId = useId(), router = useRouter();
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const operation = useRef<string | null>(null), inFlight = useRef(false);
  async function remove() {
    if (inFlight.current) return;
    inFlight.current = true; operation.current ??= crypto.randomUUID();
    setBusy(true); setError("");
    try {
      await api(`${kind}/delete`, { id, operation_id: operation.current });
      setOpen(false);
      if (redirectTo) router.replace(redirectTo); else router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Penghapusan belum berhasil. Coba lagi."); }
    finally { inFlight.current = false; setBusy(false); }
  }
  return <>
    <button type="button" className={`btn danger ${small ? "small" : ""}`} aria-label={`Hapus ${label}: ${name}`} onClick={() => { setOpen(true); setError(""); }}><Trash2 size={14} aria-hidden="true"/>{small ? "Hapus" : `Hapus ${label}`}</button>
    {open && <Modal titleId={titleId} alert onCancel={() => { if (!busy) setOpen(false); }} className="delete-modal">
      <Trash2 size={24} className="modal-icon" aria-hidden="true"/>
      <h2 id={titleId}>Hapus {label}?</h2>
      <p className="delete-item">{name}</p>
      <p id={descriptionId}>Penghapusan permanen dan tidak dapat dibatalkan melalui aplikasi. {kind === "questions" ? "Soal yang masih digunakan ujian tidak dapat dihapus. Gunakan Arsip atau lepaskan dari draft terlebih dahulu." : kind === "classes" ? "Kelas yang masih terhubung ke ujian tidak dapat dihapus. Akun peserta tetap tersedia." : "Hanya draft yang belum memiliki sesi peserta yang dapat dihapus. Soal dan akun peserta tetap tersedia."}</p>
      {error && <Notice tone="error" title="Penghapusan belum terkonfirmasi">{error}</Notice>}
      <div className="actions delete-actions"><button className="btn" type="button" autoFocus disabled={busy} onClick={() => setOpen(false)}>Batal</button><button className="btn danger" type="button" disabled={busy} aria-describedby={descriptionId} onClick={() => void remove()}>{busy ? "Menghapus…" : "Hapus permanen"}</button></div>
    </Modal>}
  </>;
}

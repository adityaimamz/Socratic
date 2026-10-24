"use client";
import {useEffect} from "react";
import {navigationRendered} from "@/lib/navigation-metrics";
const titles: Record<string, string> = {
  "/manage": "Ruang pengajar",
  "/manage/classes": "Kelas & peserta",
  "/manage/questions": "Bank soal",
  "/manage/exams": "Ujian",
  "/admin/users": "Akun & undangan",
  "/admin/settings": "Pengaturan lembaga",
  "/admin/audit": "Jejak audit",
  "/dashboard": "Ujian saya",
};

export function PageSkeleton({ pathname = "" }: { pathname?: string }) {
  useEffect(()=>navigationRendered("visual",pathname),[pathname]);
  const path = pathname.split("?")[0];
  const title = titles[path] ?? (path.endsWith("/new") ? "Menyiapkan formulir" : "Memuat halaman");
  return <section className="page-skeleton" aria-busy="true" aria-label={`Memuat ${title}`}>
    <div className="page-header"><div><h1>{title}</h1><p role="status">Memuat data…</p></div></div>
    <div className="skeleton-panel" aria-hidden="true">
      <div className="skeleton-block skeleton-caption"/>
      {Array.from({ length: 5 }, (_, index) => <div className="skeleton-row" key={index}>
        <div className="skeleton-lines"><div className="skeleton-block skeleton-line"/><div className="skeleton-block skeleton-detail"/></div>
        <div className="skeleton-block skeleton-action"/>
      </div>)}
    </div>
  </section>;
}

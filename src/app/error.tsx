"use client";
import {Brand} from "@/components/ui";
export default function ErrorPage({reset}:{reset:()=>void}){return <main className="setup" id="main"><Brand/><h1>Halaman belum dapat dimuat</h1><p>Periksa sambungan internet, lalu coba lagi. Jawaban yang sudah diterima sistem tetap tersimpan, kecuali dihapus sesuai aturan ujian ketat. Jika masalah berulang saat ujian, segera beri tahu pengawas.</p><button className="btn" onClick={reset}>Coba kembali</button></main>}

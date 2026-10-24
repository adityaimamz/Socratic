"use client";
import {Brand} from "@/components/ui";
export default function ErrorPage({reset}:{reset:()=>void}){return <main className="setup" id="main"><Brand/><h1>Halaman belum dapat dimuat</h1><p>Periksa koneksi dan coba lagi. Jawaban yang sudah diterima server tetap tersimpan, kecuali terkena reset sesuai aturan ujian.</p><button className="btn" onClick={reset}>Coba kembali</button></main>}

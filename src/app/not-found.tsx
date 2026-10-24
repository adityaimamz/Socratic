import {Brand} from "@/components/ui";
import Link from "next/link";
export default function NotFound(){return <main className="setup" id="main"><Brand/><h1>Halaman tidak tersedia</h1><p>Halaman yang kamu cari tidak ditemukan atau belum bisa dibuka dengan akun ini. Periksa tautan dari pengajar atau minta bantuan.</p><Link className="btn" href="/dashboard">Kembali ke beranda</Link></main>}

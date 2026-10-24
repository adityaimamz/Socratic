import {Brand} from "@/components/ui";
import Link from "next/link";
export default function NotFound(){return <main className="setup" id="main"><Brand/><h1>Halaman tidak tersedia</h1><p>Data tidak ditemukan atau akun Anda tidak memiliki akses.</p><Link className="btn" href="/dashboard">Kembali ke beranda</Link></main>}

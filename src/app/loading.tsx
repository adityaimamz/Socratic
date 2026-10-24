import {Brand} from "@/components/ui";
export default function Loading(){return <main className="setup" id="main" aria-busy="true"><Brand/><h1>Menyiapkan ruang ujian</h1><div className="actions" role="status"><span className="spinner" aria-hidden="true"/><p>Memuat data Socratic…</p></div></main>}

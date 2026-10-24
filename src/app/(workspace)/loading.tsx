export default function Loading() {
  return <div className="page-loading" role="status" aria-busy="true">
    <span className="spinner" aria-hidden="true"/>
    <div><h1>Memuat halaman</h1><p>Sedang menyiapkan data…</p></div>
  </div>;
}

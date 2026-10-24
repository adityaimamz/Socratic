import { Notice } from "./ui";

export function ExamRules({mode}:{mode:"exam"|"quiz"}){
 return <section className="stack" aria-labelledby="exam-rules-title">
  <h2 id="exam-rules-title">{mode==="exam"?"Aturan ujian ketat":"Aturan kuis"}</h2>
  {mode==="exam"?<Notice tone="warning" title="Sekali keluar, jawaban dihapus">
   Saat halaman ujian tidak terlihat, seluruh jawaban pilihan ganda dan esai dihapus, termasuk yang sudah tersimpan. Kamu kembali ke soal pertama. Waktu tetap berjalan dan jawaban yang dihapus tidak bisa dikembalikan.
  </Notice>:<Notice title="Kuis: aktivitas tetap dicatat">
   Meninggalkan halaman ujian dicatat untuk ditinjau pengawas, tetapi tidak menghapus jawaban secara otomatis. Waktu tetap berjalan.
  </Notice>}
  <ol className="exam-rules-list">
   <li>Kerjakan sendiri. Ikuti petunjuk pengajar tentang buku, kalkulator, atau bahan lain yang boleh digunakan. Tanyakan sebelum mulai jika belum jelas.</li>
   <li>{mode==="exam"?"Tetap di halaman ujian. Membuka halaman lain, berpindah aplikasi, mengecilkan jendela ujian, atau mengunci layar bisa membuat halaman ujian tidak terlihat dan memicu penghapusan jawaban.":"Tetap fokus pada kuis dan ikuti arahan pengawas saat perlu membuka bahan lain."}</li>
   {mode==="exam"&&<li>Gunakan layar penuh. Keluar dari layar penuh dicatat dan memunculkan pengingat. Jawaban dihapus jika halaman ujian juga menjadi tidak terlihat. Jika pengawas mengizinkanmu mengerjakan tanpa layar penuh, aturan penghapusan jawaban tetap berlaku.</li>}
   <li>Jawaban disimpan otomatis. Pastikan muncul tulisan Tersimpan di sistem. Jika internet terputus, tetap di halaman ini dan sambungkan kembali sebelum waktu habis. Jawaban yang belum diterima sistem belum masuk penilaian.</li>
   <li>Buka ujian hanya di satu halaman dan satu perangkat. Jika perlu pindah perangkat atau membuka ujian di halaman lain, hubungi pengawas{mode==="exam"?" untuk mendapat persetujuan":""}. Waktu tidak berhenti saat berpindah.</li>
   <li>Periksa jawaban sebelum menekan Kirim ujian. Setelah dikirim atau waktu habis, jawaban tidak bisa diubah. Saat waktu habis, sistem menutup ujian dan menilai jawaban yang sudah diterima.</li>
  </ol>
  <h3>Apa yang dipantau?</h3>
  <p>Aplikasi mencatat saat halaman ujian tidak terlihat, saat masuk atau keluar dari layar penuh, serta perpindahan perangkat atau halaman ujian. Catatan ini membantu pengawas meninjau kejadian dan tidak otomatis membuktikan kecurangan.</p>
  <p>Aplikasi tidak menggunakan kamera, mikrofon, atau rekaman layar. Aplikasi juga tidak dapat memastikan semua aktivitas di perangkatmu terdeteksi.</p>
  <h3>Jika ada kendala</h3>
  <p>Segera beri tahu pengawas jika ada gangguan perangkat, jawaban terhapus, atau catatan aktivitas yang menurutmu tidak sesuai. Sampaikan apa yang terjadi. Pengawas dapat meninjau kejadian, tetapi jawaban yang sudah dihapus tidak bisa dipulihkan. Jika perangkatmu membutuhkan pengaturan khusus, minta bantuan pengawas sebelum mulai.</p>
 </section>;
}

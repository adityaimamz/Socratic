# Data dummy untuk pengujian

Dataset `socratic-demo-v1` ditambahkan secara eksplisit ke proyek Supabase hosted yang dipilih oleh `.env` / `.env.local`. Seluruh nama resource diberi awalan `[DEMO]`; email menggunakan domain reservasi `socratic-demo.test`. Seed tidak berjalan saat aplikasi dimulai dan tidak diimpor kode aplikasi.

## Perintah

```powershell
npm run seed:demo:plan
npm run seed:demo
npm run seed:demo:check
```

Skrip membutuhkan Project URL, publishable key, secret key server, dan Personal Access Token Supabase yang sudah digunakan skrip penyiapan proyek. Seluruh migrasi aplikasi harus sudah tersedia dan bucket `exam-media` harus privat.

Seed membuat kredensial acak dan menyimpannya pada `.local/DEMO-ACCESS.md` serta `.local/demo-accounts.json`, keduanya diabaikan Git. Password tidak dicetak ke log. Panduan lokal memuat akun, password, tautan ujian, kondisi masing-masing peserta, dan cara menguji perpindahan sesi. Laporan pemeriksaan tersimpan di `.local/demo-verification.json`.

## Isi dataset

| Data | Isi awal |
| --- | --- |
| Akun Auth | 16: satu admin, dua pengajar/pengawas, sepuluh peserta, satu peserta nonaktif, satu peserta tanpa kelas, satu akun belum diverifikasi |
| Profil aplikasi | 15; akun belum diverifikasi hanya memiliki akun Auth dan undangan tertunda |
| Undangan | 19; 15 diterima dan empat tertunda |
| Kelas | Tiga: Matematika, IPA, dan kelas kosong |
| Bank soal | 18: 13 pilgan dan lima esai, termasuk dua soal arsip, opsi 2–6 pilihan, bobot, tag, rubrik, satu gambar, serta satu soal versi kedua |
| Ujian | 16 dengan berbagai status, jadwal, mode, dan kebijakan hasil |
| Pengerjaan | 19: enam sesi aktif dan 13 selesai pada kondisi awal |
| Penilaian | Dua hasil menunggu koreksi, sembilan skor esai individual, hasil lulus dan tidak lulus |
| Pengawasan | Event aktivitas, satu reset, permintaan pindah sesi, peserta tanpa heartbeat terbaru, tambahan waktu, lima keputusan review, retake, dan akomodasi fullscreen |
| Media | Logo aplikasi yang sudah ada disalin sebagai gambar soal ke bucket privat; path dimiliki akun pengajar dummy |
| Audit | Catatan yang dihasilkan operasi kelas, publikasi, penilaian, dan intervensi lewat fungsi aplikasi |

Nama akun utama: `admin@socratic-demo.test`, `pengajar@socratic-demo.test`, `pengawas@socratic-demo.test`, dan `peserta01@socratic-demo.test`. Password acak berada pada panduan lokal. Akun aktif dikonfirmasi melalui Admin API hanya untuk identitas dummy sehingga tidak bergantung pada pengiriman email. Akun pribadi, SMTP, Google OAuth, Site URL, dan kebijakan konfirmasi proyek tidak diubah.

## Cakupan fitur

| Fitur | Data / langkah uji |
| --- | --- |
| Login dan role | Login dengan admin, pengajar, pengawas, serta peserta pada browser/profil terpisah |
| Akses ditolak | `nonaktif` ditolak aplikasi; `belum-verifikasi` ditolak Auth; `tanpa-kelas` mendapat dashboard kosong |
| Undangan dan pengguna | Admin melihat undangan belum diterima, akun aktif/nonaktif, dan seluruh role |
| Kelas | Kelas beranggota, kelas kosong, dan peserta tambahan melalui email |
| Bank soal | Buat/edit pilgan atau esai, ubah opsi/kunci, bobot/tag, rubrik, gambar privat, versi, dan arsip |
| Draft / preview / publish | Ujian Draft Campuran serta Draft Kosong dapat diedit dan diperiksa sebelum terbit |
| Jadwal | Ujian Siap Dikerjakan, Ujian Besok, Ujian Ditutup, dan Arsip Ujian Lama |
| Quiz / Exam | Quiz Otomatis menggunakan penalti 0,25 untuk jawaban salah; Exam Ketat memakai reset seluruh jawaban |
| Autosave / resume / tandai | Ujian baru dapat dikerjakan peserta01; sesi sebagian terisi tersedia untuk peserta02–07 |
| Reset jawaban | Sesi peserta02 sudah mengalami satu reset dan memiliki jawaban baru pada epoch terbaru |
| Perpindahan sesi | Sesi peserta03 memiliki permintaan takeover tertunda; pengajar/pengawas menyetujuinya melalui Monitoring |
| Koneksi dan tambahan waktu | Peserta04 terlihat tanpa heartbeat terbaru; peserta05 mendapat tambahan 15 menit |
| Fullscreen | Peserta01 mendapat akomodasi fullscreen pada Exam Ketat; aturan reset saat meninggalkan tab tetap berlaku |
| Pengiriman / deadline / penghentian | Hasil selesai karena kirim manual, waktu habis, serta penghentian pengawas tersedia |
| Koreksi esai | Ujian Menunggu Penilaian berisi jawaban esai terisi dan esai kosong; hasil tetap pending sampai koreksi difinalisasi |
| Nilai / pembahasan | Ujian Nilai Ditahan, Nilai Terbit, dan Nilai dan Pembahasan Terbit memiliki kebijakan rilis berbeda |
| Retake | Peserta01 memiliki satu hasil sebelumnya dan kesempatan kedua pada ujian Retake Tersedia |
| Review insiden | Kelima keputusan `flagged`, `cleared`, `confirmed`, `inconclusive`, dan `invalidated` tersedia |
| Monitoring / hasil / CSV | Ujian aktif, ujian selesai, serta Monitoring Kosong dapat dibuka dan hasil diekspor |
| Pengaturan / kesehatan | Admin dapat menguji halaman asli; seed mempertahankan pengaturan lembaga dan metrik layanan yang sebenarnya |

Hasil dihitung oleh fungsi penilaian aplikasi dari jawaban, bukan diisi dengan skor acak. Pembuatan resource awal memakai ID deterministik; publikasi, penyimpanan jawaban, reset, penilaian, dan intervensi melewati fungsi aplikasi. Data historis diberi waktu tiga hari sebelumnya agar pembahasan dapat dirilis. Penyesuaian waktu ini terbatas pada resource dummy.

Jadwal ujian siap berlaku tujuh hari sejak seed. Sesi aktif berdurasi delapan jam dan dapat selesai secara alami oleh finalizer. Seed ulang mempertahankan perubahan pengujian dan tidak memperbarui jadwal atau mengubah password. Untuk kondisi awal yang baru, bersihkan lalu seed ulang.

## Membersihkan data dummy

Pratinjau:

```powershell
npm run seed:demo:clean
```

Terapkan pembersihan dan buat ulang bila diperlukan:

```powershell
npm run seed:demo:clean -- --apply
npm run seed:demo
```

Cleanup memverifikasi tag metadata akun Auth dan identitas profil, lalu menghapus data milik akun dummy, media dummy, dan akun Auth dummy. Resource baru yang dibuat menggunakan akun dummy juga termasuk data pengujian yang dibersihkan. Data akun lain dan pengaturan lembaga dipertahankan; referensi silang yang menghalangi penghapusan menyebabkan transaksi database gagal, bukan dihapus paksa. Seed SQL berjalan dalam transaksi; akun Auth dan unggah Storage berada di layanan terpisah, sehingga bila proses terputus jalankan seed kembali atau cleanup eksplisit.

## Batas pengujian

Data siap pakai membantu pengujian seluruh alur fitur yang sudah diimplementasikan. Jaringan putus, duplikasi tab, refresh, fullscreen, Page Visibility, dan perilaku browser perlu dipicu melalui interaksi. SMTP, penerimaan/klik email nyata, Google OAuth, dan uji beban tetap memerlukan pengaturan serta pengujian layanan asli. Fitur setelah MVP pada PRD tidak dibuat menjadi fitur aktif oleh seed.

Tes `tests/demo-seed.test.ts` menjalankan seluruh migrasi dan seed pada PostgreSQL embedded khusus test, memeriksa state/score/role, memastikan seed ulang mempertahankan perubahan, dan memastikan cleanup mempertahankan data pembanding. Pemeriksaan hosted memvalidasi akun Auth, login, akses workspace, penolakan akun khusus, serta gambar privat tanpa menyalakan server lokal.

Validasi 24 Oktober 2026: 43 tes unit lulus, TypeScript dan ESLint lulus, serta seed ulang hosted mempertahankan jumlah data dan password. Smoke pada aplikasi yang sedang berjalan berhasil membuka halaman akun admin, ringkasan pengajar, koreksi esai tertunda, dashboard peserta, dan hasil lengkap dengan pembahasan serta nilai 100/100. Browser pemeriksaan ditutup setelah selesai. Cleanup diuji pada database embedded; data dummy hosted tetap tersedia untuk digunakan.

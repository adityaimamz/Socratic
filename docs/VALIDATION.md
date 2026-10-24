# Catatan validasi MVP

Tanggal: 23 Oktober 2026. Lingkungan: Node.js 24, Windows, Supabase hosted untuk runtime; fixture terisolasi untuk pengujian browser/SQL.

## Hasil

| Pemeriksaan | Hasil |
| --- | --- |
| Vitest | 211 test lulus: logika domain dan fungsi PostgreSQL aktual pada engine embedded |
| Playwright | 9 test lulus: login page/privacy, authoring, batas role, reset/refresh/epoch, hasil ditahan, offline, responsif, alur publish–preflight–submit–nilai–monitoring–CSV, navigasi ponsel |
| Supabase hosted | 10 migrasi; seluruh fungsi aplikasi server-only; RLS aktif; bucket privat; Cron finalisasi/retensi aktif; undangan admin tersedia |
| Smoke hosted | Publish → start → save → reset → retry → epoch lama ditolak → save → nilai server → hasil ditahan → receipt idempoten; seluruh data di-rollback |
| TypeScript | Lulus pada sumber dan test |
| ESLint | Lulus |
| Build produksi | `npm run build` lulus; route dan proxy berhasil dikompilasi |
| Audit dependensi | 0 vulnerabilities pada `npm audit --omit=optional --audit-level=moderate` |
| Visual inspector | 1440, 768, 390 px: 0 FAIL, 0 WARN pada putaran akhir dashboard dan penilaian esai |
| Google OAuth nyata | Belum aktif pada pemeriksaan terakhir; menunggu konfigurasi Google Client ID/Secret pada Supabase |

Playwright menggunakan fixture Auth/database khusus pengujian. Kelulusan browser tidak berarti handshake Google nyata sudah diuji. Embedded PostgreSQL tidak menguji Cron, penjadwalan sistem hosted, atau konkurensi koneksi produksi. Uji hosted memeriksa konfigurasi nyata serta transaksi alur inti; bukan pengukuran kapasitas.

## Pemeriksaan desain

Skill lokal `design-taste-frontend` menggunakan arah **framed-sheet**, seed `1713005768`, tanpa redraw. Wajah produk: IBM Plex Sans, bingkai abu kebiruan, tanda dokumen/check, status ujian serta alur persiapan dari data nyata. Warna dipakai pada status; angka ringkasan berasal dari objek yang ditampilkan.

Dashboard menjawab “ujian mana yang perlu disiapkan/dipantau?” melalui daftar ujian dan tindakan buat ujian. Editor menjawab “apa isi dan aturan versi yang akan diterbitkan?” melalui formulir. Runner menjawab “soal apa yang sedang dikerjakan dan apakah jawaban diterima?” melalui soal, pilihan, status simpan, serta timer. Monitoring menjawab “peserta mana yang membutuhkan penanganan?” melalui progres, koneksi, reset, dan timeline.

Tiga perbaikan hasil pemeriksaan browser: menyembunyikan tombol menu khusus mobile pada desktop, menjaga menu tetap terlihat/dapat dibuka pada ponsel, dan menyertakan font lokal pada snapshot visual agar pemeriksaan mengukur tipografi yang dipakai aplikasi. Screenshot akhir seluruh lebar diperiksa: panel mengikuti batas kanvas, tidak ada overflow halaman, navigasi terlipat, judul/status terbaca. Daftar pendek mempertahankan ruang kosong sebagai keadaan akun kecil; tidak diisi metrik buatan.

Pemeriksaan sumber skill memberi satu WARN monospace. Ini dipertahankan hanya untuk ID sesi, receipt, dan ID objek audit, sesuai pengecualian ID pada aturan app screens. Tidak ada aturan inspector yang di-allow. Data bernama Nadia Putri, Bima Pratama, Ratih Pramesti, kelas XII IPA, dan soal Matematika hanya berada pada fixture pengembangan `tests/support/supabase-fixture.mjs`. Tidak dimasukkan ke proyek hosted produksi.

## Gate yang belum lulus

- Login nyata melalui provider yang dipilih, pengiriman email/klik konfirmasi-pemulihan, serta pilot oleh pemilik lembaga.
- Uji 500 peserta/100 soal, burst save/reset/submit, serta pengukuran batas deadline 60 detik.
- Drill restore database dan file storage dengan RPO/RTO tercatat.
- Notifikasi eksternal save/submit gagal dan backlog finalisasi; dashboard kesehatan sudah tersedia.
- Deployment staging/produksi Vercel dan pemeriksaan environment/callback HTTPS.

Skrip dan prosedur tersedia pada `tests/load/exam.js` serta `docs/OPERATIONS.md`. Belum ada klaim aplikasi siap peluncuran umum sampai gate tersebut dipenuhi.

## Perluasan esai dan password

Tambahan SQL memvalidasi bentuk esai, rubrik privat, snapshot, batas teks, jawaban campuran, reset, pending grading, batas skor/otorisasi, transaksi koreksi dan retry, nilai gabungan, feedback, deadline, serta admission email dan akun nonaktif. Tambahan Playwright menguji login password tanpa jalan pintas autentikasi aplikasi, akses di luar undangan ditolak, dan esai dari authoring sampai hasil dirilis.

Smoke hosted sepuluh migrasi berhasil termasuk esai campuran dengan nilai 80 dan admission email; seluruh data uji di-rollback. Provider Email aktif, Google belum aktif. Tidak ada email nyata atau password pengguna yang dibuat melalui tool. Koreksi final tidak dapat diedit; penilaian tertunda tidak ditampilkan sebagai nilai nol.

Callback login/pemulihan telah dikonfigurasi dan diverifikasi di hosted; konfirmasi email tetap aktif. Build produksi setelah perluasan esai/password lulus. Pengujian akhir fitur yang berubah kembali lulus setelah penyajian komentar per soal dan perapian input skor.

Inspector baru dijalankan pada login dan koreksi esai di 1440/768/390 px. Koreksi esai: 0 FAIL/0 WARN. Login: 0 FAIL dan satu WARN `unused-canvas` pada desktop. WARN dipertahankan karena halaman publik memakai kanvas terpusat dengan margin kiri/kanan 192 px yang sama; ini bukan layar dengan sidebar, sehingga saran memperluas kanvas dashboard tidak berlaku. Screenshot seluruh ukuran diperiksa. Judul diperlebar agar dua baris, teks bantuan diperbesar, dan input skor disejajarkan dengan komentar. Arah desain dan seed tetap sama.

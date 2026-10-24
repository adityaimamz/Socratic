# Operasional dan gate peluncuran

## Status validasi

Pemeriksaan yang sudah dijalankan: 20 unit/integrasi SQL, Playwright untuk akses/authoring/reset/refresh/hasil ditahan/offline dan layar responsif, serta smoke hosted yang di-rollback. Pemeriksaan ini belum membuktikan kapasitas 500 peserta, pemulihan backup, atau keberhasilan OAuth Google nyata. Catatan validasi akhir berada di `docs/VALIDATION.md`.

## Sebelum pilot

1. Aktifkan Google OAuth dan uji email admin, pengajar, peserta undangan, serta akun tanpa undangan. Jangan mengaktifkan autentikasi alternatif untuk melewati whitelist.
2. Periksa jadwal WIB, daftar peserta, durasi efektif, instruksi, kunci, bobot, dan preview sebelum publish. Isi versi terbit tidak dapat diedit.
3. Informasikan aturan reset, termasuk minimize/layar mati yang dapat membuat halaman hidden. Tetapkan pengecualian fullscreen bagi peserta yang memerlukan perangkat bantu dan catat alasannya. Pengecualian ini tidak menghapus aturan reset tab.
4. Jalankan pemeriksaan hosted, simulasikan putus koneksi dan takeover yang disetujui, lalu periksa receipt serta nilai yang dihitung server.
5. Tetapkan retensi sesuai kebijakan lembaga. Default: hasil/jawaban 365 hari, event 90 hari, audit 365 hari; periksa pengaturan aktif sebelum ujian.

## Saat ujian

Monitoring memperbarui data setiap 10 detik. Heartbeat peserta setiap 30 detik. Status koneksi terlambat bukan bukti menyontek. Periksa timeline, waktu server, serta penjelasan peserta sebelum mengambil keputusan review.

Ketika peserta kehilangan sesi, ajukan takeover dari perangkat tujuan. Pada Exam, pengawas harus menyetujui sebelum pemindahan. Sesi lama kemudian ditolak; jawaban yang tersimpan dan deadline tetap dipertahankan. Tambahan waktu memerlukan alasan dan hanya berlaku pada attempt aktif. Retake membuat kesempatan baru, tidak membuka hasil final lama. Review administratif tidak mengubah jawaban atau nilai final.

Insiden hidden offline mengunci pengerjaan dan disimpan sementara pada browser. Setelah reconnect, laporan diproses sebelum save/submit. Bila laporan baru diterima setelah attempt difinalisasi, sistem mencatat `late` untuk review tanpa mengubah nilai final. Jam perangkat dan `client_at` bukan otoritas deadline. Page Visibility dapat dimanipulasi dan tidak mendeteksi perangkat kedua; jangan menjanjikan pengawasan sempurna.

## Finalisasi dan alert

Supabase Cron memanggil `school_finalize_due` setiap 10 detik, maksimal 100 attempt per batch dengan row lock dan `SKIP LOCKED`. Semua endpoint memeriksa deadline sehingga keterlambatan Cron tidak memperpanjang masa menjawab.

Halaman Admin → Pengaturan menampilkan kesehatan: backlog deadline lebih dari 60 detik, error aplikasi lebih dari 1% selama lima menit, serta job Cron gagal/nonaktif. Metrik agregat tidak menyimpan isi jawaban atau token. Ini indikator dashboard; notifikasi eksternal belum terpasang.

Sebelum peluncuran umum, hubungkan log/monitoring Vercel dan Supabase ke kanal petugas yang disepakati: beri alert untuk save/submit 5xx, backlog finalisasi, job gagal, dan lonjakan latensi. Uji satu alert end-to-end dengan petugas penerima. Bila save gagal, peserta perlu menjaga tab tetap terbuka dan menghubungi pengawas; jangan menjanjikan data lokal sebagai jawaban yang sudah diterima server.

## Uji beban k6

Jalankan hanya pada staging yang Anda kendalikan. Siapkan 500 akun peserta uji Google yang berbeda dan ditugaskan pada ujian 100 soal dengan durasi cukup. Setiap akun menggunakan cookie login valid miliknya; jangan gunakan service key pada skrip beban. Simpan fixture di `.local/load-users.json`, berupa array objek `{"exam_id":"UUID ujian staging","cookie":"header Cookie sesi peserta"}`. File ini rahasia, tidak boleh di-commit atau dibagikan.

Instal k6 dari distribusi resminya, lalu jalankan dari root repo:

```powershell
$env:CONFIRM_STAGING='yes'
$env:BASE_URL='https://domain-staging-anda'
$env:USERS_FILE='../../.local/load-users.json'
$env:VUS='500'
$env:THINK_SECONDS='1'
k6 run --summary-export=.local/k6-summary.json tests/load/exam.js
```

`USERS_FILE` relatif terhadap skrip k6. Mulai dari 5/50 peserta, lalu 500 setelah fixture dan batas paket infrastruktur diperiksa. Set `SUBMIT_AT_MS` ke timestamp Unix milidetik di masa depan untuk menyelaraskan burst submit. Skrip menulis 100 jawaban, melakukan reset setelah 50, mengulang event yang sama, heartbeat, lalu submit. Karena reset, 50 jawaban pertama memang kosong pada hasil akhir.

Threshold: save p95 <1.000 ms, reset ACK p95 <2.000 ms, error operasi <1%. Periksa assertion integritas dan hasil server secara terpisah. Jalankan varian deadline tanpa submit pada ujian staging tersendiri; bandingkan `deadline_at` dengan `finalized_at` untuk seluruh attempt. Maksimum keterlambatan harus ≤60 detik. Simpan konfigurasi, jumlah peserta, spesifikasi paket, timestamp, ringkasan, serta hasil pemeriksaan konsistensi.

Skrip tersedia tetapi uji 500 peserta dan burst belum dijalankan. Cron dan restore tidak dapat divalidasi melalui fixture embedded.

## Backup dan restore

Pilih mekanisme backup/PITR sesuai paket Supabase dan target pemulihan lembaga. Backup database tidak otomatis menjadi backup file storage. Siapkan salinan privat media, skema, migrasi, dan konfigurasi job/provider secara terpisah.

Lakukan restore ke proyek terisolasi: cocokkan jumlah/ID ujian, snapshot, attempt, receipt, nilai, serta referensi media; uji akses dan login; pastikan job finalisasi hanya berjalan di proyek yang dituju. Dokumentasikan RPO/RTO hasil pengukuran dan pemilik prosedur. Restore belum diuji dalam implementasi ini.

## Deployment Vercel

Hubungkan repo, pilih Node.js 24, masukkan environment runtime pada staging/produksi terpisah, jalankan build, dan tetapkan `NEXT_PUBLIC_APP_URL` sesuai domain HTTPS. Tambahkan redirect aplikasi pada konfigurasi Supabase. Pengelolaan callback Supabase di Google mengikuti proyek Supabase yang digunakan. Batasi akses log dan rahasia; PAT migrasi tidak diperlukan di Vercel.

Peluncuran umum menunggu OAuth nyata, uji akses/konsistensi, uji beban, restore, alert eksternal, dan pilot yang disetujui lembaga. Deployment/publish belum dilakukan.

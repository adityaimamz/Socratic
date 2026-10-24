# Socratic

Aplikasi ujian Bahasa Indonesia dengan Next.js App Router dan Supabase hosted. Mode Exam mengosongkan seluruh jawaban ketika halaman menjadi tersembunyi, mempertahankan deadline dan urutan soal, lalu mengembalikan peserta ke soal pertama. Mode Quiz mencatat aktivitas tanpa reset.

## Menjalankan aplikasi

Gunakan Node.js 24 dan npm. Jalankan `npm ci`, isi `.env` atau `.env.local` mengikuti `.env.example`, lalu `npm run dev`. Buka `http://127.0.0.1:3000` dengan origin yang sama seperti `NEXT_PUBLIC_APP_URL`.

Runtime tidak memerlukan PostgreSQL atau Docker lokal. Semua data aplikasi disimpan pada proyek Supabase hosted yang dipilih melalui environment.

## Menyiapkan proyek Supabase baru

1. Isi Project URL, publishable key, secret key server, URL aplikasi, dan email admin pertama.
2. Isi `SUPABASE_ACCESS_TOKEN` bila ingin menerapkan migrasi otomatis melalui Management API. Ini Personal Access Token akun Supabase, bukan connection string PostgreSQL.
3. Jalankan `npm run supabase:prepare`, `npm run supabase:migrate`, lalu `npm run bootstrap:admin`.
4. Gunakan [login email/password](docs/EMAIL_PASSWORD.md) atau aktifkan [Google OAuth](docs/GOOGLE_OAUTH.md), lalu jalankan `npm run supabase:check`.
5. Masuk menggunakan email admin yang diundang. Tambahkan pengajar/peserta melalui administrasi atau daftar kelas.

Token pengelolaan dan email bootstrap hanya dibutuhkan untuk penyiapan. Deployment aplikasi membutuhkan URL Supabase, publishable key, secret key server, dan URL aplikasi. Jangan memasukkan secret key pada variabel publik.

## Alur penggunaan

Pengajar membuat kelas dan bank soal pilgan/esai, menyusun draft ujian, memeriksa preview, lalu menerbitkannya. Peserta membuka ujian yang ditugaskan dan menyetujui aturan sebelum mulai. Jawaban tersimpan otomatis; monitoring menampilkan progres dan insiden. Pilgan dinilai server; esai menunggu skor manual pengajar sebelum nilai akhir tersedia. Exam menahan nilai sampai dirilis pengajar. Pembahasan hanya dapat dirilis setelah seluruh deadline selesai. Lihat [alur penilaian esai](docs/ESSAY.md).

Bank soal mendukung [impor TXT, Markdown, dan PDF teks](docs/QUESTION_IMPORT.md), dengan editor, pratinjau, validasi per soal, dan pemilihan sebelum simpan. Contoh format tersedia pada halaman impor.

[Hapus soal, kelas, dan draft ujian](docs/DELETE.md) tersedia dengan konfirmasi, audit, dan pembatasan data yang masih dipakai. Ujian yang sudah diterbitkan beserta sesi/hasilnya tetap dipertahankan.

## Validasi

| Perintah | Cakupan |
| --- | --- |
| `npm run typecheck` | TypeScript strict |
| `npm run lint` | ESLint |
| `npm test` | Logika dan SQL aktual pada engine PostgreSQL embedded khusus test |
| `npm run test:e2e` | Playwright dengan fixture Auth/database terisolasi, termasuk pemeriksaan visual |
| `npm run build` | Build produksi |
| `node --env-file=.env scripts/verify-hosted.mjs --smoke` | Pemeriksaan hosted; data smoke seluruhnya di-rollback |

Fixture test tidak diimpor aplikasi dan tidak menyediakan jalan pintas login produksi. Pengujian lokal ini tidak menjalankan ekstensi `pg_cron`; job Cron diperiksa pada Supabase hosted.

## Data dummy untuk mencoba fitur

Jalankan `npm run seed:demo` untuk menambahkan akun semua peran, kelas, bank soal, ujian berbagai status, sesi, hasil, dan pengawasan ke Supabase yang terhubung. Akun dan password tersedia di `.local/DEMO-ACCESS.md`. Seed ulang mempertahankan perubahan; `npm run seed:demo:check` memeriksa dataset. Lihat [panduan data dummy](docs/DEMO_DATA.md) untuk cakupan fitur dan pembersihan data.

## Dokumen

- [PRD](docs/PRD.md) dan [rencana implementasi](docs/PLAN.md).
- [Konfigurasi Supabase](docs/SUPABASE.md) dan [Google OAuth](docs/GOOGLE_OAUTH.md).
- [Deployment Vercel](docs/VERCEL.md), environment produksi, dan callback Auth.
- [Operasional, pengujian beban, dan gate pilot](docs/OPERATIONS.md).

Deteksi browser bergantung pada Page Visibility dan koneksi peserta. Ini tidak menjamin deteksi perangkat kedua, seluruh cara menyontek, atau telemetri browser yang dimanipulasi. Insiden yang baru diterima setelah finalisasi dicatat untuk review dan tidak mengubah hasil final.

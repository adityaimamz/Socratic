# Deployment Socratic ke Vercel

Domain produksi yang diminta: `https://socratic-beige.vercel.app`.

## Status persiapan — 24 Oktober 2026

- Halaman produksi dapat diakses, tetapi endpoint `/auth/password` mengembalikan `503 SETUP_REQUIRED`. Environment Supabase pada deployment belum lengkap atau belum tersedia pada build yang aktif.
- Site URL Supabase sudah disetel ke domain produksi. Kedua callback login/pemulihan produksi sudah ditambahkan dan diverifikasi. Redirect yang sebelumnya tersedia, termasuk localhost, tetap dipertahankan.
- Empat environment runtime sudah disiapkan di `.local/vercel-production.env`; nilainya tidak dicetak ke log dan file diabaikan Git. Panduan lokal tersedia di `.local/VERCEL-SETUP.md`.
- Penerapan environment ke Vercel dan redeploy masih menunggu akses ke akun/proyek Vercel. Persiapan lokal dan pengaturan Supabase tidak otomatis memperbarui environment pada Vercel.
- Validasi lokal: ESLint lulus; empat nilai environment cocok dengan sumber lokal dan origin produksi. Build `next build --webpack` lulus, termasuk TypeScript dan pembuatan halaman. Pemeriksaan 45 file bundle client tidak menemukan secret key server.
- `next build` dengan Turbopack pada mesin Windows ini gagal ketika worker CSS berhenti sebelum tersambung, termasuk saat dijalankan di luar sandbox. Bundler default proyek tetap dipertahankan; hasil build Vercel perlu diperiksa setelah akses deployment tersedia.

## Environment produksi

| Nama | Nilai / sumber |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL Supabase yang digunakan aplikasi lokal |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable / anon key proyek yang sama |
| `SUPABASE_SECRET_KEY` | Secret / service role key, khusus server |
| `NEXT_PUBLIC_APP_URL` | `https://socratic-beige.vercel.app` tanpa `/login` |

Di Vercel → proyek aplikasi → Settings → Environment Variables, impor `.local/vercel-production.env` dan pilih **Production**. Personal Access Token Supabase dan email bootstrap tidak dibutuhkan sebagai runtime. Jangan memberi awalan `NEXT_PUBLIC_` pada secret key.

Setelah environment disimpan, lakukan **Redeploy** pada deployment produksi. Nilai `NEXT_PUBLIC_` dibaca saat build; mengisi variabel tanpa deployment baru belum memperbaiki build aktif. [Dokumentasi environment Vercel](https://vercel.com/docs/environment-variables/managing-environment-variables).

Konfigurasi build:

- Framework: Next.js.
- Node.js: 24.x, sesuai `package.json`.
- Install: `npm ci`.
- Build: `npm run build`.
- Root Directory: folder yang berisi `package.json`; repository ini menempatkannya di root.
- Output Directory: biarkan mengikuti Next.js.
- Jangan aktifkan `SAFE_EXAM_TEST_BUILD` pada environment produksi; variabel itu khusus isolasi output pengujian lokal.

`vercel.json` mencatat framework dan perintah install/build. Finalisasi serta retensi ujian dijalankan oleh `pg_cron` Supabase yang sudah ada, sehingga tidak perlu menambahkan Vercel Cron untuk fungsi yang sama.

## Supabase Auth

Site URL:

```text
https://socratic-beige.vercel.app
```

Redirect yang harus tersedia:

```text
https://socratic-beige.vercel.app/auth/callback
https://socratic-beige.vercel.app/auth/callback?next=reset-password
```

Callback lokal tetap dipakai untuk pengembangan, dan `NEXT_PUBLIC_APP_URL` lokal tetap menggunakan alamat lokalnya. [Dokumentasi redirect Supabase](https://supabase.com/docs/guides/auth/redirect-urls).

Konfigurasi URL tidak mengaktifkan Google OAuth atau SMTP. Saat diperiksa, Google belum aktif dan SMTP khusus belum tersedia. Login akun yang sudah diverifikasi, termasuk akun dummy aktif, tidak memerlukan pengiriman email baru.

## Menyiapkan ulang

Pada PowerShell, gunakan Node langsung agar argumen diteruskan utuh:

```powershell
node --env-file-if-exists=.env --env-file-if-exists=.env.local scripts/prepare-vercel.mjs --origin https://socratic-beige.vercel.app --apply-auth
```

Tanpa `--apply-auth`, skrip menyiapkan environment lokal dan memeriksa konfigurasi Auth tanpa mengubahnya. Cadangan Site URL dan redirect sebelum perubahan pertama disimpan di `.local/vercel-auth-before.json`; laporan persiapan tanpa secret ada di `.local/vercel-setup.json`.

## Verifikasi setelah redeploy

1. Buka `/login`: pesan **Layanan masuk belum siap** hilang dan input serta tombol masuk aktif.
2. Login melalui email dengan akun lembaga atau akun dummy aktif. Workspace dan data Supabase tampil.
3. Periksa hak akses admin/pengajar/peserta, gambar soal privat, hasil, dan logout pada domain produksi.
4. Uji konfirmasi/pemulihan email setelah SMTP tersedia; uji Google setelah providernya diaktifkan.
5. Pastikan login di hostname lain tetap ditolak oleh pemeriksaan origin. Environment Preview perlu disiapkan sesuai origin-nya sendiri; konfigurasi ini ditujukan untuk Production.

## Impor soal

Impor TXT, Markdown, dan PDF teks tersedia melalui Bank soal → Impor soal. Terapkan migrasi `202610240011_question_import.sql` dan deploy source terbaru agar fitur tersedia. Tidak ada environment tambahan. Lihat [format dan batas impor](QUESTION_IMPORT.md). PDF hasil scan belum didukung tanpa OCR; impor CSV belum diimplementasikan.

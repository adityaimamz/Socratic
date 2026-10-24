# Deployment Socratic ke Vercel

Domain produksi yang diminta: `https://socratic-beige.vercel.app`.

## Status terverifikasi — 24 Oktober 2026

- Situs live dan login akun dummy admin/pengajar/siswa berhasil. Tujuh halaman admin terbuka tanpa error JavaScript, dan 13 pembacaan API lintas peran mendapat HTTP 200.
- Migrasi `202610240013_scoped_reads.sql` sudah diterapkan. Sebelumnya aplikasi yang lebih baru daripada skema database menampilkan “Halaman belum berhasil dimuat” karena `school_request` belum ada.
- Pemeriksaan hosted mencatat 13 migrasi; RPC tetap server-only, RLS aktif, finalizer/retensi aktif, dan bucket media privat.
- Build deployment berikutnya menjalankan pemeriksaan database terlebih dahulu. Perubahan konfigurasi pemeriksaan ini ada di source dan berlaku setelah source tersebut dideploy.
- Performa hosted dan kapasitas 500 peserta belum diukur. Lihat [catatan fetch dan pemulihan live](FETCH_OPTIMIZATION.md).

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
- Build: `npm run supabase:check && npm run build`.
- Root Directory: folder yang berisi `package.json`; repository ini menempatkannya di root.
- Output Directory: biarkan mengikuti Next.js.
- Jangan aktifkan `SAFE_EXAM_TEST_BUILD` pada environment produksi; variabel itu khusus isolasi output pengujian lokal.

`vercel.json` mencatat framework dan perintah install/build. Terapkan semua migrasi sebelum deploy dengan `npm run supabase:migrate`, lalu jalankan `npm run supabase:check`. Pemeriksaan menghentikan build jika RPC inti/optimasi atau storage privat belum siap; pemeriksaan ini tidak menerapkan migrasi otomatis dan tidak membutuhkan PAT di Vercel. Finalisasi serta retensi ujian dijalankan oleh `pg_cron` Supabase yang sudah ada, sehingga tidak perlu menambahkan Vercel Cron untuk fungsi yang sama.

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

Konfigurasi URL tidak mengaktifkan Google OAuth atau SMTP. Pemeriksaan pemulihan 24 Oktober 2026 menunjukkan provider Google dan email/password aktif. SMTP khusus tidak diperiksa ulang pada pemulihan ini. Login akun yang sudah diverifikasi, termasuk akun dummy aktif, tidak memerlukan pengiriman email baru.

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

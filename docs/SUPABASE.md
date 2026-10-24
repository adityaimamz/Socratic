# Konfigurasi Supabase hosted

Gunakan proyek Supabase hosted untuk Auth, PostgreSQL terkelola, dan storage privat. Tidak perlu menyiapkan database atau Docker lokal.

## Environment aplikasi

Salin `.env.example` menjadi `.env` atau `.env.local` di root project, kemudian isi:

| Variabel | Nilai yang diperlukan |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL dari Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key; legacy `anon` key juga dapat dipakai |
| `SUPABASE_SECRET_KEY` | Secret key khusus server; legacy `service_role` key juga dapat dipakai |
| `NEXT_PUBLIC_APP_URL` | `http://127.0.0.1:3000` saat lokal; URL HTTPS aplikasi saat deployment |
| `BOOTSTRAP_ADMIN_EMAIL` | Email admin pertama |

Isi kredensial langsung pada file environment. File tersebut sudah dikecualikan dari Git. Bila kedua file ada, `.env.local` didahulukan. Restart server Next.js setelah mengubah environment.

Browser menggunakan publishable key untuk alur autentikasi. Secret key hanya dibaca modul server untuk operasi database terotorisasi; jangan memasukkannya ke variabel berawalan `NEXT_PUBLIC_`. Aplikasi memakai API Supabase sehingga connection string dan password database tidak diperlukan untuk runtime ini. [Dokumentasi client Supabase](https://supabase.com/docs/guides/auth/server-side/creating-a-client?queryGroups=framework&framework=nextjs).

## Google OAuth

Aktifkan provider Google pada Supabase Authentication dan isi Google Client ID/Client Secret di pengaturan provider tersebut. Kedua kredensial Google tidak perlu ditambahkan ke environment Next.js.

Untuk pengembangan, gunakan:

- Site URL aplikasi: `http://127.0.0.1:3000`.
- Redirect URL aplikasi: `http://127.0.0.1:3000/auth/callback`.
- Authorized redirect URI di Google: gunakan callback Supabase yang ditampilkan pada pengaturan provider Google proyek tersebut.

Google login tidak otomatis memberi izin ujian. Akun tetap harus terdaftar pada daftar undangan lembaga.

## Setelah environment terisi

Pada proyek baru, jalankan `npm run supabase:prepare`, `npm run supabase:migrate`, dan `npm run bootstrap:admin`. Migrasi otomatis membutuhkan `SUPABASE_ACCESS_TOKEN` berupa Personal Access Token akun Supabase. Token tersebut hanya digunakan skrip penyiapan, tidak diperlukan runtime Next.js.

Pada proyek yang digunakan selama implementasi, sepuluh migrasi, bucket privat, Cron finalisasi/retensi, serta undangan admin sudah diterapkan dan diverifikasi. Pemeriksaan smoke transaksional berhasil dan seluruh data uji di-rollback. Login Google nyata tetap memerlukan konfigurasi provider; ikuti [panduan langkah demi langkah](GOOGLE_OAUTH.md).

Gunakan proyek staging terpisah sebelum produksi. Jalankan `npm run supabase:check` untuk status koneksi/provider dan `node --env-file=.env scripts/verify-hosted.mjs` untuk pemeriksaan akses, RLS, dan job hosted.

## Email/password

Provider Email aktif pada pemeriksaan hosted terakhir. Buka halaman login → Buat akun undangan dengan email admin yang sudah didaftarkan, lalu ikuti konfirmasi email bila aktif. [Panduan lengkap](EMAIL_PASSWORD.md). Email/password memakai verifikasi sesi, whitelist, dan role yang sama dengan Google.

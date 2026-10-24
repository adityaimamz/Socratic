# Mengaktifkan login Google

Database aplikasi menggunakan Supabase hosted. Google OAuth perlu dikonfigurasi sekali oleh pemilik akun Google Cloud/Supabase.

## 1. Google Cloud

1. Buka [Google Cloud Console](https://console.cloud.google.com/), lalu pilih atau buat proyek untuk Safe Exam.
2. Pada **Google Auth Platform → Branding**, isi nama aplikasi dan email kontak yang benar.
3. Pada **Audience**, gunakan External untuk akun Google umum. Selama Testing, tambahkan email admin dan peserta pilot ke Test users. Organisasi Google Workspace dapat memilih Internal bila semua peserta berada pada organisasi yang sama.
4. Pada **Data Access**, gunakan scope `openid`, `https://www.googleapis.com/auth/userinfo.email`, dan `https://www.googleapis.com/auth/userinfo.profile`.
5. Pada **Clients → Create client**, pilih Web application.
6. Pada Authorized redirect URIs, masukkan callback Supabase yang ditampilkan pada halaman provider Google proyek: `https://PROJECT-REF.supabase.co/auth/v1/callback`. Ganti PROJECT-REF dengan proyek Anda; jangan gunakan callback Next.js di kolom ini.
7. Salin Client ID dan Client Secret untuk langkah berikutnya.

## 2. Supabase

1. Buka proyek → Authentication → Sign In / Providers → Google.
2. Aktifkan Google dan masukkan Client ID/Client Secret dari Google Cloud, lalu simpan.
3. Buka Authentication → URL Configuration.
4. Set Site URL ke `http://127.0.0.1:3000`.
5. Tambahkan Redirect URL `http://127.0.0.1:3000/auth/callback`.

Client Secret Google disimpan pada provider Supabase, bukan variabel publik Next.js. Tidak perlu mengirim nilainya melalui chat.

## 3. Uji masuk

Jalankan `npm run supabase:check` dan pastikan Google OAuth aktif. Buka aplikasi pada origin yang sama dengan `NEXT_PUBLIC_APP_URL`, klik Lanjutkan dengan Google, lalu gunakan email `BOOTSTRAP_ADMIN_EMAIL`.

Undangan admin sudah disiapkan melalui `bootstrap:admin`. Login pertama membuat profil dari undangan tersebut. Akun lain tetap memerlukan undangan lembaga; menjadi Test user Google tidak otomatis memberi akses aplikasi.

## Penanganan masalah

| Pesan | Periksa |
| --- | --- |
| `redirect_uri_mismatch` | Authorized redirect URI di Google harus callback Supabase persis, tanpa perbedaan protokol/path |
| Google menolak akun uji | Tambahkan akun ke Audience → Test users selama aplikasi masih Testing |
| Kembali ke alamat yang salah | Site URL dan Redirect URLs Supabase harus sesuai origin aplikasi |
| Akses aplikasi belum tersedia | Email Google harus sama dengan email undangan dan akun harus aktif |
| Login berhasil tetapi halaman gagal | Jalankan pemeriksaan migrasi dan periksa bahwa secret key server benar |

Saat deploy, tambahkan origin/callback HTTPS deployment dan perbarui environment aplikasi. [Panduan resmi Supabase](https://supabase.com/docs/guides/auth/social-sign-in/auth-google).

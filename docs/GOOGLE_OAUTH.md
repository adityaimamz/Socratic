# Mengaktifkan login Google

Database aplikasi menggunakan Supabase hosted. Google OAuth perlu dikonfigurasi sekali oleh pemilik akun Google Cloud/Supabase.

## Status konfigurasi — 24 Oktober 2026

- Provider Google sudah diaktifkan pada Supabase menggunakan kredensial web yang diberikan pemilik proyek. Client ID sudah diperiksa cocok; client secret tidak dicetak ke log atau disimpan dalam source aplikasi.
- Pengaturan publik Supabase mengembalikan `external.google: true`. Membuka `/auth/login` pada `https://socratic-beige.vercel.app` berhasil menuju layar masuk Google dengan callback Supabase yang benar, tanpa kesalahan alamat pengembalian.
- Callback Google yang digunakan: `https://fbkphmvwmshxffhihuqb.supabase.co/auth/v1/callback`.
- Daftar pengembalian Supabase sudah mencakup callback login dan ganti kata sandi untuk `https://socratic-beige.vercel.app`, `http://127.0.0.1:3000`, `http://localhost:3000`, serta origin Site URL yang sudah terpasang. URL lama dipertahankan.
- Site URL yang ditemukan adalah `https://socratic-oktanora02-2887.vercel.app/` dan dipertahankan. Pada pemeriksaan ini alamat tersebut meminta autentikasi Vercel, sedangkan `https://socratic-beige.vercel.app` dapat diakses publik dan halaman `/privacy` memberi respons 200. Alur login aplikasi publik mengirim alamat kembali secara eksplisit ke domain publik tersebut.
- Pengaturan Email, konfirmasi email, pendaftaran, serta pengaturan keamanan Google lainnya tidak diubah.
- Uji sampai masuk ke akun aplikasi belum dilakukan; pemilik memilih menguji akun nanti. Pengiriman kode kembali, pertukaran sesi, persetujuan akun, dan akses dashboard belum diklaim berhasil.

### Perbaikan Branding yang masih diperlukan

Layar masuk Google saat diperiksa menautkan kebijakan privasi ke `https://socratic-beige.vercel.app/privac`. Perbaiki menjadi `https://socratic-beige.vercel.app/privacy` pada **Google Auth Platform → Branding → Application privacy policy link**, proyek `socratic-512606`.

Pengaturan Google Cloud membutuhkan akun pemilik/pengelola proyek yang sudah masuk. Kredensial aplikasi web dalam berkas JSON tidak memberikan akses untuk mengedit Google Cloud Console.

Berkas `client_secret*.json` dikecualikan melalui `.gitignore`. Berkas tersebut tetap lokal dan tidak diperlukan dalam deployment aplikasi karena secret disimpan pada layanan Auth Supabase.

## 1. Google Cloud

1. Buka [Google Cloud Console](https://console.cloud.google.com/), lalu pilih atau buat proyek untuk Safe Exam.
2. Pada **Google Auth Platform → Branding**, isi nama aplikasi dan email kontak yang benar. Gunakan domain publik aplikasi pada halaman utama dan kebijakan privasi; tambahkan domain tersebut tanpa protokol/path pada **Authorised domains**.
3. Pada **Audience**, gunakan External untuk akun Google umum. Selama Testing, tambahkan email admin dan peserta pilot ke Test users. Organisasi Google Workspace dapat memilih Internal bila semua peserta berada pada organisasi yang sama.
4. Pada **Data Access**, gunakan scope `openid`, `https://www.googleapis.com/auth/userinfo.email`, dan `https://www.googleapis.com/auth/userinfo.profile`.
5. Pada **Clients → Create client**, pilih Web application.
6. Pada Authorized redirect URIs, masukkan callback Supabase yang ditampilkan pada halaman provider Google proyek: `https://PROJECT-REF.supabase.co/auth/v1/callback`. Ganti PROJECT-REF dengan proyek Anda; jangan gunakan callback Next.js di kolom ini.
7. Salin Client ID dan Client Secret untuk langkah berikutnya.

## 2. Supabase

1. Buka proyek → Authentication → Sign In / Providers → Google.
2. Aktifkan Google dan masukkan Client ID/Client Secret dari Google Cloud, lalu simpan.
3. Buka Authentication → URL Configuration.
4. Set Site URL sesuai lingkungan yang dituju: alamat publik HTTPS untuk produksi atau `http://127.0.0.1:3000` untuk proyek pengembangan lokal. Jangan mengganti Site URL produksi hanya untuk menguji aplikasi lokal.
5. Tambahkan Redirect URL `http://127.0.0.1:3000/auth/callback` untuk lokal dan callback domain HTTPS untuk produksi. Sertakan `/auth/callback?next=reset-password` untuk alur ganti kata sandi. Jika aplikasi dibuka melalui `localhost`, tambahkan juga kedua URL dengan hostname tersebut.

Client Secret Google disimpan pada provider Supabase, bukan variabel publik Next.js. Tidak perlu mengirim nilainya melalui chat.

## 3. Uji masuk

Jalankan `npm run supabase:check` dan pastikan Google OAuth aktif. Buka aplikasi pada origin yang sama dengan `NEXT_PUBLIC_APP_URL`, klik Lanjutkan dengan Google, lalu gunakan email `BOOTSTRAP_ADMIN_EMAIL`.

Undangan admin disiapkan melalui `bootstrap:admin`. Login pertama membuat profil dari undangan tersebut. Akun lain tetap memerlukan undangan lembaga; menjadi Test user Google tidak otomatis memberi akses aplikasi. Jika aplikasi Google masih berstatus Testing, tambahkan akun yang akan menguji pada **Audience → Test users**.

## Penanganan masalah

| Pesan | Periksa |
| --- | --- |
| `redirect_uri_mismatch` | Authorized redirect URI di Google harus callback Supabase persis, tanpa perbedaan protokol/path |
| Google menolak akun uji | Tambahkan akun ke Audience → Test users selama aplikasi masih Testing |
| Kembali ke alamat yang salah | Site URL dan Redirect URLs Supabase harus sesuai origin aplikasi |
| Akses aplikasi belum tersedia | Email Google harus sama dengan email undangan dan akun harus aktif |
| Login berhasil tetapi halaman gagal | Jalankan pemeriksaan migrasi dan periksa bahwa secret key server benar |

Saat deploy, tambahkan origin/callback HTTPS deployment dan perbarui environment aplikasi. [Panduan resmi Supabase](https://supabase.com/docs/guides/auth/social-sign-in/auth-google).

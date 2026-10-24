# Login email dan password

Google tetap tersedia, tetapi pengguna dapat masuk melalui email/password Supabase tanpa menunggu Google OAuth.

## Akun pertama

1. Buka halaman login aplikasi pada origin yang sama dengan `NEXT_PUBLIC_APP_URL`.
2. Klik **Buat akun undangan**. Gunakan email `BOOTSTRAP_ADMIN_EMAIL` yang sudah diundang, isi nama dan password minimal 10 karakter.
3. Setelah pendaftaran diproses, formulir otomatis kembali ke login: email tetap terisi, password dikosongkan, dan petunjuk konfirmasi tetap tampil. Buka email konfirmasi lalu masuk. Role admin diambil dari undangan, bukan data formulir.
4. Akun berikutnya harus diundang melalui administrasi atau daftar peserta/kelas terlebih dahulu.

Jika akun sudah dibuat pada Supabase Auth, gunakan email/password yang dimiliki. Untuk akun Google yang belum memiliki password, gunakan **Lupa password?** melalui email yang sama.

Password disimpan dan diperiksa oleh Supabase Auth. Tidak ada password dalam environment aplikasi, tabel profil, dokumen, atau log aplikasi. Password tidak dikirim ke pengajar/admin aplikasi.

## Pengaturan Supabase

Pastikan provider **Email** aktif pada Authentication → Sign In / Providers. Jalankan `npm run supabase:check` untuk memeriksa status provider. Site URL mengikuti origin aplikasi. Tambahkan Redirect URLs berikut sesuai domain yang dipakai:

```text
http://127.0.0.1:3000/auth/callback
http://127.0.0.1:3000/auth/callback?next=reset-password
```

Pada proyek hosted implementasi, provider Email, pendaftaran, callback login/pemulihan, dan konfirmasi melalui email sudah diverifikasi. Callback telah ditambahkan tanpa menghapus URL lain. Untuk proyek baru, skrip `node --env-file=.env scripts/configure-email-auth.mjs --apply` dapat menyiapkan callback dengan Personal Access Token berizin Auth. Skrip mempertahankan kebijakan verifikasi email dan Site URL nondefault. [Referensi konfigurasi Auth Supabase](https://supabase.com/docs/reference/api/v1-update-auth-service-config).

Alur default memakai PKCE: buka tautan email pada browser yang memulai pendaftaran/pemulihan. Jika menggunakan template email khusus untuk alur token hash server, aplikasi juga mendukung:

```text
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery
```

Atur template Confirm signup dan Reset password sesuai jenisnya. Pengiriman email mengikuti konfigurasi, SMTP, dan batas Supabase proyek Anda. Aplikasi tidak menonaktifkan verifikasi email untuk melewati pengaturan tersebut.

## Pemulihan dan akses

Klik **Lupa password?**, masukkan email, lalu buka tautan pemulihan untuk mengatur password baru. Respons pendaftaran/pemulihan dibuat umum agar tidak mengungkap daftar undangan. Status **Permintaan diterima** berarti aplikasi menerima permintaan, bukan bukti akun dibuat atau email terkirim. Email yang belum diundang tidak diteruskan ke Supabase Auth.

Jika email tidak diterima, admin memeriksa secara berurutan:

1. Pastikan email sama persis dengan undangan aktif di aplikasi. Menambahkan undangan memberi izin akses dan tidak mengirim email otomatis.
2. Periksa apakah akun sudah ada dan email sudah dikonfirmasi pada Supabase Authentication → Users. Untuk akun yang sudah ada, gunakan login atau pemulihan password.
3. Periksa SMTP di Supabase Authentication → Email. Pengirim bawaan hanya dapat mengirim ke anggota tim proyek Supabase, bukan semua peserta yang diundang aplikasi. Konfigurasikan SMTP khusus untuk penerima lain. [Dokumentasi SMTP Supabase](https://supabase.com/docs/guides/auth/auth-smtp).
4. Periksa batas pengiriman proyek dan Auth Logs. Galat pendaftaran/pemulihan juga tercatat di log server dengan penanda `[auth-email]`, mode, kode galat, dan status HTTP; tanpa email, password, token, atau isi pesan provider.
5. Pastikan `NEXT_PUBLIC_APP_URL`, alamat yang dibuka di browser, Site URL, dan redirect callback sesuai, termasuk hostname dan port. `localhost`, `127.0.0.1`, port 3000, dan port 3001 adalah origin berbeda. Restart proses lokal setelah mengubah environment.
6. Periksa kotak masuk dan spam, lalu ulangi permintaan setelah masa tunggu layanan. Buka tautan terbaru pada browser yang memulai permintaan.

`node --env-file=.env scripts/configure-email-auth.mjs` memeriksa pengaturan Auth, SMTP, batas email, dan callback tanpa mengubah konfigurasi atau mencetak secret. Opsi `--apply` tetap hanya mengubah URL callback dan Site URL default sebagaimana dijelaskan di atas. Jangan menonaktifkan konfirmasi email untuk melewati masalah pengiriman.

Server memverifikasi sesi, email terkonfirmasi, status akun, serta role database pada setiap operasi. Akun di luar undangan atau yang dinonaktifkan tetap ditolak. Endpoint password memeriksa origin, validasi input, dan batas percobaan; role browser tidak dapat memanggil fungsi pemeriksaan undangan secara langsung.

Belum ada email nyata yang dikirim dalam pengujian otomatis. Uji login/pendaftaran/pemulihan browser memakai fixture lokal. Pengiriman dan klik email nyata perlu diuji pemilik akun sebelum pilot.

# Audit alert — 24 Oktober 2026

Audit sumber mencakup seluruh pemakaian `Notice`, `role="alert"`, kelas `notice`, konfirmasi native, modal ujian, pesan domain, dan respons error route pada `src`. Fokus perubahan adalah penyebab yang dapat dimengerti, langkah selanjutnya, status yang jujur, dan aksesibilitas. Layout dan identitas aplikasi dipertahankan.

| Area | Temuan dan hasil |
| --- | --- |
| Login email | Penolakan origin sebelumnya hanya berbunyi “Asal permintaan tidak diizinkan”. Kini mempunyai kode terpisah, judul “Alamat aplikasi tidak sesuai”, dan petunjuk membuka tautan lembaga serta menghubungi admin. Pemeriksaan origin tetap berlaku. |
| Login gagal | Judul jelas, petunjuk memeriksa isian, verifikasi, pemulihan, dan undangan. Respons tetap sama untuk password salah dan email di luar undangan. |
| Pendaftaran / pemulihan | Respons lama terkesan berhasil meskipun email tidak diundang atau provider gagal. Kini berstatus informasi, menjelaskan syarat undangan dan layanan email, serta langkah ketika email tidak diterima. Respons publik tetap seragam. Galat provider dicatat tanpa data pribadi atau secret. |
| Password baru | Ketidakcocokan konfirmasi, sesi pemulihan berakhir, serta aturan password mempunyai judul dan petunjuk. Fokus berpindah ke umpan balik saat terjadi error. |
| Google / tautan konfirmasi | Dibedakan antara Google belum aktif, tautan tidak berlaku, dan kegagalan callback. Ada alternatif email/password dan cara meminta tautan baru. |
| Layanan belum siap | Form login yang dinonaktifkan kini menjelaskan alasan dan tindakan admin. |
| Semua konsumen API | Penanganan bersama untuk jaringan putus, gateway HTML, JSON rusak, dan error server. Kode konflik jawaban tetap dipertahankan untuk mekanisme sinkronisasi ujian. |
| Form dan administrasi | Error memakai komponen alert yang sama, dengan judul sesuai konteks. Validasi server menggunakan Bahasa Indonesia serta label isian, bukan path kode. |
| Unggah gambar | Menggunakan penanganan respons bersama. Sesi berakhir, hak akses, origin, format/ukuran, dan gangguan penyimpanan memiliki petunjuk yang relevan. |
| Pemeriksaan sebelum ujian | Kegagalan pemeriksaan tidak lagi terus menampilkan “Memeriksa…”. Ada tindakan Periksa ulang; penolakan fullscreen dijelaskan dalam Bahasa Indonesia. |
| Pengerjaan / pindah sesi | Alert konsisten. Peringatan keluar fullscreen kini memakai semantik status dan tombol berlabel jelas. Modal reset, batas waktu, dan konfirmasi kirim mempertahankan aturan serta konsekuensi yang sudah dijelaskan. |
| Penilaian esai | Judul error menyatakan bahwa penilaian belum tersimpan. Konfirmasi finalisasi tetap menjelaskan skor dikunci setelah diterima server. |
| Monitoring | Error tidak lagi mengklaim mempertahankan data lama ketika belum pernah berhasil memuat data. Tindakan Coba lagi tetap tersedia. |
| Kesehatan layanan | Error pembaruan serta peringatan scheduler/log mendapat judul dan langkah pemeriksaan. |
| Peringatan statis | Aturan reset, retensi, akses tertunda, nilai belum terbit, dan hasil menunggu penilaian ditinjau; konsekuensi dan petunjuk yang benar dipertahankan. |
| Konfirmasi native / modal | Konfirmasi arsip, publikasi, penghentian ujian, jawaban belum sinkron, dan finalisasi esai ditinjau; konteks tindakan dan konsekuensinya sudah disebutkan. |
| Halaman error / 404 | Pesan dan tindakan pemulihan sudah tersedia; tidak dirombak dalam perubahan alert ini. |

`Notice` memberi judul pada error/peringatan/sukses, ikon berbeda per jenis, ikon dekoratif tersembunyi dari pembaca layar, dan `aria-atomic`. Error memakai `role="alert"`; informasi dan keberhasilan memakai `role="status"`. Judul serta teks dapat membungkus pada layar kecil.

## Batas pemeriksaan

Pengujian otomatis memakai fixture lokal dan tidak mengirim email nyata. Pemeriksaan hosted dilakukan secara baca-saja: untuk email yang ditunjukkan pada screenshot, undangan dan akun Auth belum tersedia; provider Email aktif, konfirmasi aktif, SMTP khusus belum dikonfigurasi, dan batas proyek 2 email/jam. Tidak ada undangan, role, akun, SMTP, atau konfigurasi hosted yang diubah. Lihat [pemecahan masalah email](EMAIL_PASSWORD.md).

Tes regresi tersedia di `tests/alerts.test.ts` dan `tests/e2e/alerts.spec.ts`. Pengujian browser mencakup origin ditolak, login gagal lalu berhasil, jaringan putus, respons HTML, batas percobaan, pergantian mode, respons pendaftaran yang seragam, pemulihan, fokus keyboard, dan layout 1440/768/390 px. Pemeriksaan visual mencakup halaman login serta alert konfirmasi. Area privat lain diaudit melalui sumber dan komponen bersama; seluruh cabang error produksi tidak dipicu secara langsung.

## Hasil pemeriksaan

- TypeScript, ESLint, dan 40 tes unit lulus.
- Enam tes browser alert lulus. Pemeriksaan visual otomatis di 1440/768/390 px menghasilkan 0 FAIL dan 1 WARN. Screenshot pada seluruh ukuran ditinjau: judul/petunjuk terbaca, tidak terpotong, dan tombol tetap dapat diakses.
- Tiga tes regresi browser tambahan lulus: pembuatan soal dan batas akses admin, reset ujian/sinkronisasi/refresh, serta login email dan penolakan akun tanpa undangan. Total 9 tes browser lulus.
- WARN `unused-canvas` memakai asumsi sidebar pada halaman login dua kolom. Margin luar desktop terlihat setara; layout login yang sudah ada dipertahankan karena perubahan ini terbatas pada alert.
- Lint desain pada komponen login, Notice, dan pemeriksaan pra-ujian: 0 FAIL, 0 WARN.

```text
ROUND 1
Seen in one second: Judul kegagalan dan pesan yang terpisah dari tombol masuk.
Idea (one sentence): Setiap alert menjelaskan kondisi dan langkah pemulihan dalam desain Socratic yang sudah ada.
Live thing: Form dapat dikoreksi dan dikirim kembali; error mendapat fokus keyboard.
Layout words by section: login=dua kolom / alert=ikon dan judul di atas petunjuk / ponsel=satu kolom.
Scores: design 7.5 · usability 8 · creativity 7 · content 8 → overall 7.6
Caps applied: Penilaian sebatas komponen alert di dalam layout yang sudah ada; tidak ada arah visual baru.
Top three problems (most visible first), each with the screenshot it shows in and the fix:
1. Screenshot awal pengguna: penyebab penolakan alamat tidak jelas. Diperbaiki dengan judul dan petunjuk alamat aplikasi.
2. Status pendaftaran lama menyiratkan keberhasilan pengiriman. Diperbaiki menjadi informasi bersyarat dan langkah pemeriksaan admin.
3. Ponsel memerlukan pembungkusan teks panjang. Diperiksa pada alert-origin-390.png dan mobile-page-01.jpg; tidak ada overflow.
```

# Impor soal TXT, Markdown, dan PDF

Admin dan pengajar membuka **Bank soal → Impor soal**, memilih berkas, memeriksa pratinjau, lalu menekan **Simpan … soal**. Pilgan dan esai dapat digabung dalam satu dokumen. Hasil impor menjadi soal baru milik pengguna; siap dipilih pada draft ujian, diedit, atau diarsipkan melalui bank soal.

## Format

Contoh siap pakai ada di `public/templates/soal.txt` dan `public/templates/soal.md`, juga dapat diunduh dari halaman impor.

```text
1. Berapakah hasil 2 + 2?
A. 3
B. 4
C. 5
D. 6
Kunci: B
Bobot: 2
Tag: Matematika

2. Jelaskan perbedaan keliling dan luas persegi.
Jenis: esai
Rubrik: Keliling adalah panjang seluruh sisi (2 poin).
Luas adalah ukuran daerah di dalam persegi (3 poin).
Bobot: 5
Tag: Matematika
```

- Awali setiap soal dengan `1.`, `1)`, `Soal 1:`, atau heading Markdown seperti `## 1. Pertanyaan`.
- Pilgan memiliki 2–6 pilihan berurutan A–F. `Kunci: B`, `Kunci jawaban: B`, dan `Jawaban: B` diterima. Kunci harus satu huruf yang ada pada pilihan; tidak ditebak otomatis.
- Esai memakai `Jenis: esai`/`essay`, tanpa opsi atau kunci huruf. `Rubrik:` adalah pedoman penilaian manual. Esai dengan rubrik dapat dikenali tanpa penanda jenis.
- Pertanyaan, isi opsi, dan rubrik dapat berlanjut ke baris berikutnya. Letakkan kelanjutan langsung setelah field tersebut; metadata seperti bobot/tag harus berada pada baris sendiri. Nomor di awal baris dianggap soal baru; indentasikan daftar bernomor dalam rubrik minimal dua spasi.
- `Bobot:` opsional, bawaan 1, lebih dari 0 sampai 1.000. Koma atau titik desimal diterima. `Tag:` opsional, maksimal 100 karakter.
- Markdown mendukung heading, bullet opsi, dan label metadata tebal seperti `**Kunci:** B`. Isi ditampilkan sebagai teks biasa, tanpa menjalankan HTML atau instruksi dari dokumen.

## Pratinjau dan koreksi

Nomor/pertanyaan berulang dalam dokumen, pilihan terlewat/berulang, kunci tidak cocok, metadata berulang, dan nilai di luar batas ditandai per soal. Soal tidak valid tidak dapat dipilih. Koreksi teks di editor, lalu **Perbarui pratinjau**. Perubahan teks menonaktifkan simpan sampai pratinjau diperbarui. Pengguna dapat melepas centang soal valid yang tidak ingin disimpan.

Teks sebelum nomor soal pertama diabaikan dengan peringatan. Teks tanpa format tetap ditampilkan agar dapat diperbaiki. Dokumen harus mengikuti format terstruktur di atas; fitur ini tidak menebak format bebas menggunakan AI.

## PDF dan batas

- Maksimum 2 MB per berkas, 200.000 karakter teks, 100 soal, dan 50 halaman PDF. Ukuran dibatasi juga pada body streaming request.
- TXT/MD harus UTF-8. PDF diproses di server dengan `unpdf` (PDF.js serverless), tanpa API eksternal, OCR, atau layanan berbayar tambahan.
- PDF harus mengandung teks yang bisa dipilih. PDF scan/foto perlu OCR terlebih dahulu; PDF berpassword perlu salinan tanpa password. PDF rusak menampilkan pesan koreksi.
- Urutan baca PDF mengikuti item teks per halaman. Kolom, tabel, rumus yang digambar, gambar, header/footer, dan font khusus mungkin memerlukan koreksi manual. Periksa pratinjau; gambar ditambahkan melalui Edit soal setelah impor.
- Dokumen asli tidak disimpan di Storage atau database. Yang disimpan hanya soal yang dipilih. Editor dan hasil ekstraksi berada dalam memori halaman selama alur impor.

## Penyimpanan dan akses

`POST /api/questions/import` menerima multipart `file` dan mengembalikan teks serta pratinjau. `POST /api/questions/import/commit` menerima `operation_id` UUID dan `questions` yang divalidasi ulang. Kedua endpoint memeriksa origin, sesi terverifikasi, profil aktif, peran admin/pengajar, dan rate limit. Peserta tidak memiliki akses.

Migrasi `202610240011_question_import.sql` menambahkan RPC khusus service role. Seluruh batch disimpan dalam satu transaksi melalui validasi/ownership/audit bank soal yang sudah ada. Satu soal gagal menyebabkan seluruh batch dibatalkan. Impor hanya menambah soal; ID soal yang sudah ada dan gambar eksternal ditolak.

Percobaan ulang dengan operation dan payload identik mengembalikan receipt sebelumnya. Setelah simpan pertama dikirim, pilihan dikunci sampai hasil dikonfirmasi agar retry akibat respons hilang tidak menggandakan soal. Payload berbeda dengan operation sama ditolak. Memulai alur impor baru terhadap dokumen yang sama membuat soal baru; deduplikasi lintas impor/bank soal belum dilakukan.

## Deployment

Jalankan `npm run supabase:migrate`, kemudian deploy source terbaru ke Vercel. Tidak ada environment baru selain empat variabel runtime aplikasi. Migrasi harus tersedia sebelum endpoint commit digunakan. Hosting tidak memerlukan OCR, binary native, atau Vercel Cron tambahan untuk fitur ini.

## Validasi

Unit test mencakup parser, template, batas, UTF-8, ekstraksi PDF dua halaman, scan/kosong/rusak, dan validasi commit. Test PostgreSQL embedded memeriksa transaksi, retry, ownership, audit, akses, serta pemakaian hasil impor pada ujian. E2E memeriksa unggah TXT/MD/PDF, koreksi, seleksi, respons simpan hilang, otorisasi, dan tampilan desktop/tablet/ponsel.

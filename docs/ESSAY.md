# Soal esai dan penilaian manual

## Membuat ujian

Pada Bank soal → Tambah soal, pilih jenis **Esai**. Isi pertanyaan, bobot skor maksimum, gambar opsional, dan rubrik/pedoman penilaian. Rubrik hanya tersedia bagi pengajar sampai pembahasan dirilis. Pilgan dan esai dapat dicampur dalam satu ujian, maksimal 100 soal.

Versi terbit menyimpan snapshot jenis soal, pertanyaan, bobot, serta rubrik. Perubahan bank soal kemudian tidak mengganti materi atau pedoman penilaian versi tersebut. Preview draft mengikuti urutan soal yang dipilih; urutan peserta dapat diacak saat mulai.

## Mengerjakan

Peserta mengetik jawaban teks biasa maksimal 20.000 karakter per esai. Jawaban mengikuti mekanisme autosave, revision, epoch, retry, antrean offline, dan sesi tunggal yang sama dengan pilgan. Penanda review tidak dianggap sebagai jawaban. Teks berisi spasi saja dianggap kosong.

Pada mode Exam, satu perpindahan tab menghapus seluruh jawaban esai, pilihan ganda, dan penanda review. Deadline serta urutan soal tetap. Antrean lama dan ACK epoch lama tidak memulihkan teks. Setelah submit/deadline, jawaban terkunci.

## Menilai

Hasil ujian menampilkan **Menunggu penilaian** bila attempt mengandung esai. Pengajar membuka **Nilai esai** pada baris peserta yang sudah selesai. Rubrik yang digunakan berasal dari snapshot attempt. Isi semua skor antara 0 dan bobot soal, maksimal dua desimal, beserta komentar opsional maksimal 1.000 karakter per soal. Jawaban kosong wajib bernilai nol.

Tombol **Finalisasi penilaian esai** menyimpan seluruh skor/komentar secara atomik. Tidak ada penyimpanan draft koreksi; layar memberi keterangan bahwa input belum tersimpan sebelum finalisasi. Receipt, jawaban, dan waktu submit tidak berubah. Setelah nilai diterima server, skor terkunci; retry operasi yang sama aman, sedangkan koreksi ulang ditolak. Rubrik dan komentar dirender sebagai teks biasa.

Nilai akhir = `clamp(100 × (poin pilgan setelah penalti + poin esai) / total bobot seluruh soal, 0, 100)`, dibulatkan dua desimal. Contoh pilgan bobot 1 benar dan esai bobot 4 diberi skor 3 menghasilkan **80**. Penalti salah hanya berlaku pada pilgan.

## Rilis hasil

Hasil parsial tidak ditampilkan sebagai nol. Selama esai belum selesai dinilai, peserta hanya melihat receipt dan status menunggu. Quiz menampilkan nilai setelah koreksi lengkap; Exam tetap menunggu rilis pengajar. Rilis hasil ditolak bila masih ada attempt yang menunggu koreksi esai.

Setelah nilai dirilis, peserta melihat nilai akhir, skor tiap esai, pertanyaan terkait, dan komentar. Rubrik/pembahasan mengikuti gate rilis pembahasan setelah seluruh deadline. CSV menyertakan status penilaian dan membiarkan kolom nilai kosong bila belum selesai dinilai.

## Validasi

SQL diuji untuk pembatasan akses, rubrik privat, snapshot immutable, bentuk jawaban, batas teks/skor, reset, retry, nilai campuran, penilaian atomik, hasil ditahan, dan deadline. Playwright menguji authoring → autosave/refresh → reset campuran → submit → koreksi → rilis nilai.

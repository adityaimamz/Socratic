# Audit bahasa untuk siswa SMA — 24 Oktober 2026

Tujuan audit: siswa memahami apa yang harus dilakukan, apa yang dicatat saat ujian, apa akibat meninggalkan halaman, dan kepada siapa harus meminta bantuan. Teks bawaan untuk siswa memakai sapaan “kamu”, kalimat langsung, serta petunjuk tindakan yang jelas.

## Perubahan utama

| Sebelumnya | Sekarang |
| --- | --- |
| Exam ketat / Quiz | Ujian ketat / Kuis |
| Fullscreen | Layar penuh |
| Reset jawaban | Semua jawaban dihapus |
| Belum tersinkron | Belum tersimpan |
| Server | Sistem ujian |
| Sesi lain | Halaman atau perangkat lain |
| Event / retensi / audit | Catatan aktivitas / lama penyimpanan / catatan tindakan pengelola |
| Password | Kata sandi |
| Mulai / lanjutkan ujian | Mulai ujian atau Lanjutkan ujian, mengikuti keadaan pengerjaan |

Aturan bersama di `src/components/exam-rules.tsx` ditampilkan pada detail ujian dan pemeriksaan sebelum mulai. Halaman aturan lengkap memakai sumber yang sama agar penjelasan tidak berbeda.

Aturan menyebutkan semua hal berikut sebelum siswa mulai:

1. Kerjakan sendiri dan ikuti petunjuk pengajar tentang bahan yang boleh digunakan.
2. Pada ujian ketat, sekali halaman ujian tidak terlihat, seluruh jawaban pilihan ganda dan esai dihapus, termasuk yang sudah tersimpan. Siswa kembali ke soal pertama, waktu tetap berjalan, dan jawaban terhapus tidak dapat dipulihkan.
3. Contoh penyebab: membuka halaman lain, berpindah aplikasi, mengecilkan jendela ujian, atau mengunci layar. Contoh menggunakan kata “bisa” karena perilaku perangkat dapat berbeda.
4. Keluar dari layar penuh dicatat dan menampilkan pengingat. Penghapusan dipicu oleh halaman yang tidak terlihat. Izin tanpa layar penuh tidak membebaskan aturan penghapusan jawaban.
5. Pada kuis, meninggalkan halaman dicatat tetapi tidak otomatis menghapus jawaban.
6. Catatan aktivitas membantu peninjauan pengawas dan tidak otomatis membuktikan kecurangan. Kamera, mikrofon, dan rekaman layar tidak digunakan; aplikasi tidak menjamin semua aktivitas perangkat terdeteksi.
7. Jika internet terputus, tetap di halaman dan sambungkan kembali sebelum waktu habis. Jawaban yang belum diterima sistem belum masuk penilaian.
8. Gunakan satu halaman dan satu perangkat. Perpindahan pada ujian ketat memerlukan persetujuan pengawas dan tidak menghentikan waktu.
9. Setelah dikirim atau waktu habis, jawaban tidak dapat diubah. Pengawas menjadi tujuan bantuan untuk masalah perangkat, dugaan catatan keliru, serta permintaan peninjauan.

## Cakupan penelusuran

| Area | Hasil audit |
| --- | --- |
| Masuk, daftar, lupa kata sandi, ganti kata sandi | Label dan pesan memakai bahasa sehari-hari. Pendaftaran dan permintaan tautan tetap tidak menjamin email terkirim atau membuka informasi pendaftaran akun lain. |
| Akses belum tersedia, halaman tidak ditemukan, gagal dimuat, pemuatan | Langkah selanjutnya jelas. Penjelasan pengaturan layanan tidak dibebankan kepada siswa. Pesan gagal dimuat tetap menjelaskan pengecualian jawaban yang dihapus menurut aturan. |
| Daftar ujian dan navigasi siswa | Nama mode diseragamkan. Tautan menuju aturan sebelum mulai dan peringatan penghapusan jawaban diperjelas. |
| Detail ujian dan pemeriksaan perangkat | Aturan lengkap, contoh durasi yang berkurang karena akhir jadwal, pengurangan poin pilihan ganda salah, serta penilaian esai dijelaskan. Persetujuan menyebut aturan penghapusan jawaban. |
| Melanjutkan ujian | Tidak lagi menyiratkan waktu belum berjalan. Perkiraan memakai batas waktu pengerjaan aktif, termasuk tambahan waktu dari pengawas, bukan durasi awal. Perkiraan diberi penjelasan bahwa waktu bisa berkurang selama menunggu. |
| Mengerjakan soal | Status penyimpanan, internet terputus, keluar layar penuh, pindah perangkat, peringatan waktu, dan penandaan soal diperjelas. Pesan penghapusan menyebut pengamatan sistem tanpa menuduh siswa sengaja keluar. |
| Konfirmasi kirim dan hasil | Disebutkan jawaban kosong, perubahan yang belum tersimpan, penguncian jawaban setelah pengiriman, bukti pengiriman, serta waktu penerbitan nilai dan pembahasan. Singkatan “pilgan” tidak dipakai pada hasil siswa. |
| Data pribadi dan aturan | Sumber aturan dibagikan dengan detail ujian. Data yang dicatat, pihak yang dapat melihat, lama penyimpanan, dan jalur bantuan disebutkan. |
| Pengajar: pengaturan ujian dan izin perangkat | Nama mode serta akibat meninggalkan halaman disamakan dengan penjelasan siswa. Petunjuk penulisan instruksi meminta pengajar menjelaskan bahan yang diperbolehkan. |
| Pengawas: pemantauan | Jenis kejadian dan hasil peninjauan diterjemahkan dari kode menjadi kalimat. Data yang belum diperbarui tidak lagi dipastikan sebagai koneksi terputus. Ada pengingat untuk meninjau catatan dan kendala perangkat sebelum menyimpulkan pelanggaran. |
| Pengelolaan lainnya | Bank soal, impor, kelas, undangan, penghapusan, penilaian esai, pengaturan, kesehatan layanan, dan jejak audit ditelusuri melalui sumber. Halaman pengelola tetap dapat memakai istilah operasional yang diperlukan untuk pekerjaannya. |

Sumber perilaku diperiksa pada `runner.tsx`, `start-exam.tsx`, pengenalan halaman/perangkat di `client.ts`, penanganan pesan bersama di `domain.ts`, serta migrasi pengerjaan dan penilaian, terutama `202610230008_essay.sql`. Aturan penghapusan, penilaian, dan batas waktu tidak diubah.

## Batas audit

- Audit bahasa mencakup teks bawaan aplikasi yang dilihat siswa, termasuk pesan kesalahan bersama. Judul, soal, instruksi, dan komentar yang ditulis pengajar merupakan konten tersimpan yang tidak ditulis ulang oleh audit ini.
- Tulisan pada logo dipertahankan sebagai identitas produk.
- Pemeriksaan menggunakan data uji lokal; tidak mengubah akun, ujian, data, atau layanan email sekolah yang sebenarnya.
- Penghapusan diuji melalui kejadian halaman tidak terlihat yang disimulasikan. Respons terhadap penguncian layar atau perpindahan aplikasi pada setiap jenis perangkat tidak diklaim sudah diuji secara fisik.

## Validasi

- 78 tes unit lulus. Satu persiapan basis data uji melampaui batas awal 10 detik saat dijalankan bersamaan dengan pemeriksaan browser; lima tes dalam berkas itu lulus pada pengulangan dengan batas persiapan 30 detik. Dua berkas tes pesan/validasi (16 tes) juga diperiksa kembali setelah penyederhanaan pesan terakhir dan lulus.
- 20 skenario browser yang relevan lulus: 19 pada rangkaian awal dan satu skenario internet terputus pada pengulangan dengan data baru setelah tesnya diperbaiki. Tes lama menunggu tombol coba lagi yang otomatis hilang ketika sambungan pulih; tes kini memeriksa penghapusan selesai, jawaban kosong, dan kemampuan melanjutkan. Perilaku aplikasi tidak diubah untuk meloloskan tes.
- Ketiga tes khusus audit bahasa diperiksa kembali pada teks akhir dan lulus. Cakupan meliputi persetujuan sebelum mulai, perbedaan ujian ketat/kuis, batas kemampuan pemantauan, izin tanpa layar penuh, jawaban tersimpan, internet terputus, penghapusan jawaban, sisa waktu setelah tambahan pengawas, serta pengiriman hasil.
- Pemeriksaan tampilan otomatis pada halaman sebelum mulai ujian ketat dan kuis menghasilkan 0 FAIL dan 0 WARN pada 1440, 768, dan 390 piksel. Semua tangkapan yang dihasilkan pemeriksa dibuka dan ditinjau. Teks dapat membungkus dan tombol dapat dijangkau tanpa halaman melebar.
- Pencarian istilah teknis pada teks yang benar-benar tampil di 15 halaman/keadaan siswa tidak menemukan istilah yang dilarang oleh pemeriksaan bahasa. Konten buatan pengajar tetap menjadi batas audit sebagaimana dijelaskan di atas.
- `npm run build` berhasil. Pemeriksaan TypeScript dan ESLint pada sumber akhir juga lulus setelah pembuatan berkas jenis halaman selesai. `git diff --check` tidak menemukan masalah spasi; perubahan berkas otomatis `next-env.d.ts` dari proses pengujian dikembalikan ke bentuk semula.

## Tinjauan tampilan

Tangkapan 15 halaman/keadaan siswa diperiksa pada lebar 1440, 768, dan 390 piksel: masuk, daftar, lupa kata sandi, data pribadi, daftar ujian, detail ujian ketat dan kuis, pemeriksaan sebelum kedua jenis ujian, pengerjaan, internet terputus, jawaban dihapus, melanjutkan, konfirmasi kirim, serta hasil. Seluruh 45 tangkapan dirangkum dalam lembar pemeriksaan; aturan panjang pada ponsel dibaca juga dalam potongan berukuran asli.

Desain Socratic yang sudah ada dipertahankan. Tidak ada arah visual baru, foto contoh, atau klaim produk yang ditambahkan.

```text
ROUND 1
Seen in one second: Judul ujian, jenis ujian, dan petunjuk pengajar.
Idea (one sentence): Setiap aturan menjelaskan pemicu, akibat, dan tindakan siswa dengan bahasa sehari-hari.
Live thing: Siswa menyatakan sudah membaca aturan sebelum tombol mulai dapat digunakan.
Layout words by section: detail=petunjuk dan aturan / pemeriksaan=keadaan perangkat dan persetujuan / ponsel=satu kolom.
Scores: design 7.5 · usability 8 · creativity 7 · content 8.5 → overall 7.7
Caps applied: Audit bahasa dalam desain yang sudah ada; bukan penilaian desain baru.
Top three problems (most visible first), each with the screenshot it shows in and the fix:
1. preflight-exam-390.png: akibat meninggalkan halaman perlu terbaca sebelum menyetujui. Istilah teknis diganti dan peringatan menyebut jawaban tersimpan ikut dihapus serta waktu tetap berjalan.
2. privacy-390.png: aturan umum perlu menyebut jenis ujian secara tegas. Judul bersama kini menjadi Aturan ujian ketat atau Aturan kuis.
3. resume-390.png: durasi awal tidak mewakili sisa waktu pengerjaan aktif. Perkiraan kini memakai batas waktu pengerjaan, termasuk tambahan waktu pengawas, dan tombol berbunyi Lanjutkan ujian.
```

Aturan tetap panjang pada ponsel karena memuat konsekuensi penghapusan jawaban, batas pemantauan, penilaian, dan bantuan. Informasi dipisahkan dengan judul dan jarak antaraturan; tidak disembunyikan di balik persetujuan.

# Hapus soal, kelas, dan draft ujian

Tombol **Hapus** tersedia di bank soal, di dalam rincian kelas, serta pada daftar/detail draft ujian. Di halaman edit soal tersedia juga **Hapus soal**, termasuk untuk soal arsip yang dibuka melalui tautannya. Dialog menampilkan nama data, dampak penghapusan permanen, serta tombol **Batal** yang menerima fokus awal. Data baru dihapus setelah pengguna menekan **Hapus permanen**.

## Aturan

| Data | Dapat dihapus | Ditolak jika |
| --- | --- | --- |
| Soal | Soal milik sendiri, termasuk arsip, yang tidak dipakai ujian | ID soal masih ada dalam draft/ujian mana pun |
| Kelas | Kelas milik sendiri yang tidak terhubung ke ujian | Kelas masih menjadi kelas peserta draft/ujian mana pun |
| Draft ujian | Draft milik sendiri yang belum memiliki sesi peserta | Status sudah published/closed/archived, atau ada attempt |

Admin dapat menghapus data milik pengajar lain dengan pembatasan yang sama. Pengajar yang hanya ditugaskan sebagai pengawas tidak memperoleh hak hapus data milik pemilik ujian. Peserta, profil nonaktif, dan sesi tanpa login ditolak server.

Hapus kelas membersihkan keanggotaan kelas; akun peserta dan undangan tetap tersedia. Hapus draft tidak menghapus bank soal, kelas, akun, atau undangan. Soal/kelas yang dipakai draft harus dilepaskan dari draft terlebih dahulu, atau draft tersebut dihapus. Soal yang dipakai ujian terbit dapat diarsipkan. Pengarsipan tetap berbeda dari penghapusan: arsip mempertahankan soal di database.

Penghapusan ini permanen melalui aplikasi; belum ada keranjang sampah/pemulihan. Tombol ini tidak menghapus akun Auth, sesi, nilai, atau riwayat ujian terbit. File gambar privat tidak ikut dihapus otomatis karena path gambar dapat dipakai soal lain; pembersihan media perlu pemeriksaan referensi tersendiri.

## Server dan audit

- Endpoint POST `/api/questions/delete`, `/api/classes/delete`, dan `/api/exams/delete` memerlukan `id` serta `operation_id` UUID.
- Pemeriksaan origin, sesi, rate limit, dan validasi payload mengikuti endpoint aplikasi yang sudah ada.
- SQL memeriksa ulang peran, status aktif, kepemilikan, status draft, dan referensi; pembatasan tidak hanya diterapkan di tombol.
- Perubahan dan audit berlangsung dalam transaksi yang sama. Audit menyimpan aktor, jenis data, resource ID, nama ringkas, dan operation ID.
- Retry dengan operation yang sama mengembalikan receipt audit sebelumnya. Payload/target berbeda untuk operation yang sama ditolak. Receipt mengikuti masa retensi audit lembaga.
- Penyimpanan draft mengunci soal yang dipilih sampai commit. Penghapusan soal menunggu lock tersebut dan memeriksa referensi setelahnya, mencegah race yang meninggalkan ID soal tanpa record.

## Deployment dan pengujian

Terapkan migrasi `202610240012_resource_delete.sql`, lalu deploy source terbaru. Tidak ada environment tambahan.

Test SQL mencakup izin, kepemilikan, penggunaan dalam draft/ujian, penghapusan arsip, cascade keanggotaan, audit/retry, serta perlindungan sesi peserta. E2E memakai database fixture terisolasi untuk menguji konfirmasi/batal/Escape, retry setelah respons hilang, penghapusan draft → kelas → soal, status published, validasi API, dan dialog pada tiga ukuran layar. Data pengguna tidak dipakai untuk pengujian penghapusan.

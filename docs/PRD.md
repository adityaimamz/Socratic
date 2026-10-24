# PRD — Safe Exam Web

Versi: 1.2  
Tanggal: 23 Oktober 2026  
Status: draft diperbarui; mode Exam ketat dengan reset seluruh jawaban sesuai arahan pengguna, asumsi lainnya menunggu konfirmasi  
Platform utama: Next.js  
Bahasa antarmuka MVP: Bahasa Indonesia  
Pendamping: [Analisis referensi dan arsitektur](./ANALISIS.md)

## 1. Ringkasan produk

Safe Exam Web adalah aplikasi quiz dan ujian untuk membantu lembaga membuat soal, menjadwalkan ujian, mengatur peserta, menjalankan sesi dengan penyimpanan jawaban yang andal, serta menerbitkan hasil dan meninjau indikasi pelanggaran.

Janji produk: **jawaban tercatat, waktu konsisten, nilai dihitung server, dan aktivitas dapat ditinjau**. Istilah “safe” tidak berarti browser dapat mencegah seluruh bentuk kecurangan.

Keputusan produk terbaru: **mode Exam ketat mereset semua jawaban pada kejadian pertama peserta meninggalkan tab ujian yang terdeteksi**. Peserta melanjutkan attempt yang sama dari soal pertama; waktu tidak diulang atau ditambah. Reset berlaku kembali untuk setiap kejadian berikutnya. Detail pemicu, transaksi, dan keterbatasan ada pada FR-08.

## 2. Masalah yang diselesaikan

1. Pengajar harus menggabungkan alat berbeda untuk soal, jadwal, hasil, dan pengawasan.
2. Peserta tidak mengetahui apakah jawabannya sudah tersimpan saat jaringan tidak stabil.
3. Ujian yang mengandalkan jam dan penilaian di browser sulit dipercaya.
4. Pengawas membutuhkan konteks kejadian, bukan sekadar jumlah pelanggaran.
5. Perubahan soal setelah ujian dimulai dapat merusak konsistensi penilaian.

## 3. Asumsi dan cakupan awal

| Area | Asumsi MVP |
| --- | --- |
| Pengguna awal | Satu sekolah/lembaga, bukan layanan SaaS banyak pelanggan |
| Jenis soal | Pilgan satu jawaban benar (2–6 opsi) dan esai teks; dapat dicampur, gambar opsional |
| Skala sasaran | 500 peserta aktif bersamaan; harus dibuktikan lewat uji beban |
| Besaran ujian | Maksimum awal 100 soal per ujian; gambar maksimum 2 MB, dikompresi untuk tampilan |
| Identitas | Google atau email/password; email terverifikasi dan akun harus diundang/terdaftar |
| Perangkat | Desktop/laptop Chrome dan Edge dua versi stabil terakhir pada saat rilis |
| Perangkat tambahan | Quiz dapat dipilotkan di mobile; mode Exam desktop sampai pengujian mobile selesai |
| Koneksi | Online dengan pemulihan gangguan sementara; tidak mendukung ujian sepenuhnya offline |
| Konsekuensi mode Exam | Satu kejadian meninggalkan tab yang terdeteksi langsung mereset semua jawaban; waktu tetap berjalan |
| Waktu | Disimpan UTC; ditampilkan dalam zona ujian, default Asia/Jakarta |
| Pendaftaran | Admin/pengajar mendaftarkan peserta; kode ujian tidak menggantikan penugasan |

Mode ketat dengan reset seluruh jawaban mengikuti arahan pengguna. Asumsi lainnya adalah dasar desain yang belum dikonfirmasi; ubah melalui revisi PRD bila kebutuhan lembaga berbeda.

## 4. Tujuan dan indikator keberhasilan

Angka di bawah adalah target rilis, bukan hasil pengukuran saat ini.

| Indikator | Target dan cara ukur |
| --- | --- |
| Kebocoran kunci | Nol kunci/bobot rahasia muncul di payload peserta sebelum kebijakan rilis mengizinkan |
| Keandalan jawaban | Tidak ada jawaban yang sudah diakui server hilang pada retry, refresh, atau submit bersamaan, kecuali reset kebijakan yang tercatat pada FR-08 |
| Integritas reset | Satu insiden pemicu menghasilkan satu reset atomik; respons/request lama tidak dapat mengembalikan jawaban sebelum reset |
| Autosave | p95 respons API ≤1 detik pada profil beban sasaran, di luar perjalanan jaringan peserta |
| Pengalaman simpan | Status “Tersimpan” tampil ≤2 detik pada jaringan uji RTT ≤150 ms, packet loss <1% |
| Finalisasi | Satu hasil final per attempt; job deadline memproses attempt kedaluwarsa ≤60 detik pada beban sasaran |
| Integritas waktu | Semua request jawaban yang diterima pada/setelah deadline ditolak, terlepas dari jam perangkat |
| Monitoring | Status baru terlihat ≤15 detik dalam kondisi normal |
| Ketersediaan | Sasaran layanan 99,5% per bulan; downtime terjadwal di luar jadwal ujian |
| Kemudahan pakai | ≥90% dari minimal 10 peserta pilot menyelesaikan alur tanpa bantuan teknis |

## 5. Peran dan hak akses

| Kemampuan | Admin | Pengajar/pengawas | Peserta |
| --- | --- | --- | --- |
| Mengelola akun, role, kelas | Ya | Hanya peserta pada kelas yang ditugaskan | Profil sendiri terbatas |
| Membuat bank soal dan ujian | Ya | Milik sendiri/penugasan eksplisit | Tidak |
| Mengatur jadwal, aturan, dan peserta | Ya | Ujian yang dikelola | Tidak |
| Mengawasi dan mereview insiden | Ya | Ujian yang ditugaskan | Melihat pemberitahuan sesi sendiri |
| Mengikuti ujian | Bila mendapat penugasan peserta | Bila mendapat penugasan peserta | Ujian yang ditugaskan |
| Melihat/mengekspor nilai | Semua dalam lembaga | Ujian yang dikelola | Hasil sendiri setelah dirilis |
| Mengubah durasi/menyetujui retake | Ya, dengan alasan | Ujian yang dikelola, dengan alasan | Tidak |

Peran disimpan dan diverifikasi server. Pengguna tidak dapat meningkatkan role lewat profil atau metadata login. Kepemilikan resource diperiksa pada setiap operasi, termasuk monitoring, ekspor, media, dan endpoint internal.

## 6. Cakupan rilis

### MVP / P0

- Login Google atau email/password, undangan akun, role, dan pengelolaan kelas.
- Bank soal pilgan dan esai, rubrik privat, gambar opsional, tag, dan pengarsipan.
- Koreksi esai manual dengan skor/komentar; nilai akhir menunggu koreksi lengkap.
- Editor ujian, jadwal, daftar peserta, preview sebagai peserta, dan versi terbit.
- Preset Quiz/Exam, durasi total, pengacakan soal/opsi, dan aturan hasil.
- Runner ujian, penanda soal, navigasi bebas, autosave, resume, dan submit.
- Deadline server, finalisasi ketika browser tertutup, dan penilaian server.
- Satu sesi penulis aktif per attempt, heartbeat, dan perpindahan sesi terkontrol.
- Log visibility/fullscreen, reset seluruh jawaban pada mode Exam ketat, peringatan pada Quiz, monitoring, review insiden, dan audit petugas.
- Hasil individu, rekap pengajar, dan ekspor CSV.
- Pemberitahuan pemantauan, aksesibilitas inti, backup dan prosedur pemulihan.

### Setelah MVP

| Prioritas | Fitur | Alasan ditunda |
| --- | --- | --- |
| P1 | Impor soal CSV, duplikasi ujian, pemilihan soal dari kategori | Efisiensi authoring setelah alur inti stabil |
| P1 | Timer per soal, navigasi satu arah | Memerlukan aturan timeout/resume tambahan |
| P1 | Integrasi identitas lembaga selain Google/email | Bergantung kebutuhan pilot |
| P2 | Multi-lembaga, paket langganan, pembayaran | Bukan sasaran satu lembaga |
| P2 | Integrasi LMS, kamera, AI proctoring, browser khusus | Membutuhkan kajian, pengujian, dan operasi terpisah |

Tidak termasuk MVP: klaim pemblokiran screenshot/DevTools secara menyeluruh, deteksi ponsel kedua, perekaman layar, ujian offline penuh, sertifikasi berisiko tinggi tanpa pengawasan tambahan, dan pembuatan soal otomatis AI.

## 7. Alur pengguna

### Pengajar

Login → pilih kelas → kelola soal → susun ujian → atur jadwal dan kebijakan → preview → publish → monitor → tinjau insiden → terbitkan hasil → ekspor.

Publikasi menampilkan ringkasan jumlah soal, nilai maksimum, daftar peserta, zona waktu, durasi, hasil, dan aturan pengawasan. Ujian tidak bisa diterbitkan bila ada konfigurasi tidak valid.

### Peserta

Login → daftar ujian → detail dan jadwal → pemeriksaan browser/koneksi → baca aturan dan pemberitahuan pemantauan → mulai → jawab dan lihat status simpan → review jawaban kosong → submit → bukti penerimaan → hasil jika sudah dirilis.

Pemeriksaan awal tidak menghabiskan durasi. Timer dimulai setelah server berhasil membuat attempt. Klik mulai berulang menghasilkan attempt yang sama.

Pada mode Exam, sebelum mulai peserta wajib menyetujui aturan: “Meninggalkan tab ujian akan mengosongkan seluruh jawaban Anda, termasuk jawaban yang sudah tersimpan. Waktu tetap berjalan.” Setelah kejadian terdeteksi: input dikunci sementara → reset dikonfirmasi server → semua opsi dan penanda review kosong → tampilkan pemberitahuan → lanjut dari soal pertama dengan sisa waktu yang sama.

### Pemulihan gangguan

Jawaban belum diakui → status “Belum tersinkron” → retry dengan identitas operasi yang sama → server mengakui revisi → status “Tersimpan”. Setelah refresh, muat attempt, generasi jawaban, dan jawaban server, lalu rekonsiliasi antrean lokal hanya untuk sesi dan generasi jawaban yang masih sah. Bila ada insiden reset tertunda, proses insiden sebelum retry jawaban atau submit. Waktu terus berjalan.

## 8. Kebutuhan fungsional dan acceptance criteria

### FR-01 — Identitas, kelas, dan penugasan

- Admin bootstrap dibuat lewat prosedur deployment; tidak tersedia pemilihan role admin pada registrasi publik.
- Login berhasil tidak otomatis memberikan akses ujian. Server memeriksa undangan, status akun, dan enrollment.
- Email domain dapat dibatasi bila lembaga membutuhkan; pemeriksaan dilakukan server, bukan hanya parameter login.
- Penonaktifan akun menghentikan operasi baru. Penanganan attempt aktif mengikuti keputusan petugas dan dicatat.

**Diterima bila:** peserta tidak dapat membaca attempt peserta lain atau ujian di luar penugasannya dengan mengganti URL/ID; pengajar tidak bisa mengelola ujian yang tidak ditugaskan kepadanya.

### FR-02 — Bank soal

- Soal memiliki teks, 2–6 opsi, tepat satu opsi benar, bobot positif, dan tag opsional.
- Media memakai tipe yang diizinkan (JPEG/PNG/WebP); validasi isi dan ukuran di server. HTML aktif dan unggahan executable ditolak.
- Opsi memakai ID stabil; pemetaan jawaban tidak mengandalkan teks atau posisi A/B/C/D.
- Soal terpakai dapat diarsipkan. Mengedit bank soal tidak mengubah versi ujian yang sudah terbit.

**Diterima bila:** soal tanpa kunci/opsi valid tidak dapat dipublish; perubahan urutan opsi tidak mengubah jawaban benar; metadata media yang dikirim ke peserta tidak menyertakan kunci.

### FR-03 — Konfigurasi dan publikasi ujian

Konfigurasi wajib: judul, instruksi, peserta, waktu buka/tutup, zona waktu, durasi total, preset, pengacakan, nilai lulus, penalti salah opsional, dan kebijakan rilis hasil.

- Default benar = bobot soal, salah = 0, kosong = 0; penalti salah nonnegatif dapat diaktifkan sebelum publish.
- Preset Quiz: pengawasan ringan, fullscreen tidak wajib, hasil langsung sebagai default.
- Preset Exam: kebijakan `strict_reset`, ambang 1 kejadian `visibility_hidden`, permintaan fullscreen pada perangkat yang mendukung, hasil ditahan sebagai default. Tidak ada masa toleransi sebelum reset.
- Keduanya memakai timer total dan navigasi bebas di MVP.
- Setelah ada attempt, isi soal, aturan penilaian, dan kebijakan pengawasan/reset terkunci. Koreksi menggunakan versi ujian baru dan penanganan attempt terdampak yang tercatat.
- Penambahan peserta setelah publish diperbolehkan untuk petugas berwenang dan diaudit; tidak mengubah attempt yang sudah ada.

**Diterima bila:** jadwal tutup sebelum buka, durasi tidak positif, soal kosong, atau nilai lulus di luar 0–100 ditolak. Preview tidak menciptakan attempt peserta produksi.

### FR-04 — Mulai dan snapshot attempt

- Server memeriksa enrollment, jendela ujian, kuota attempt, dan apakah sudah ada attempt.
- Default satu attempt per peserta per ujian. Retake hanya lewat izin petugas, dengan alasan dan kuota baru.
- Server menyimpan snapshot versi, urutan soal, urutan opsi, aturan pengawasan/reset, `started_at`, dan `deadline_at`; generasi jawaban `answer_epoch` dimulai dari 0.
- `deadline_at = min(started_at + effective_duration, effective_window_end)`.
- Peserta yang mulai mendekati waktu tutup melihat durasi efektif sebelum mulai dan mengonfirmasinya.
- Tidak dapat mulai saat `server_now >= effective_window_end`.

**Diterima bila:** dua request start bersamaan menghasilkan satu attempt; refresh mengembalikan soal/opsi dan deadline yang sama; payload peserta tidak berisi kunci atau penanda benar/salah.

### FR-05 — Runner dan autosave

- Tampilkan soal, opsi, nomor soal, timer total, jumlah terjawab, penanda review, koneksi, serta status penyimpanan.
- Simpan setelah perubahan dengan debounce maksimal 500 ms; flush jawaban tertunda saat pindah soal dan sebelum submit bila koneksi tersedia.
- Server menerima `question_id`, `option_id|null`, `client_operation_id`, `expected_revision`, dan `answer_epoch`; ID harus sesuai snapshot dan epoch harus sama dengan epoch aktif di server.
- Jawaban dapat dikosongkan sebelum deadline. Tidak ada umpan balik benar/salah selama attempt aktif.
- Status “Tersimpan” hanya setelah ACK server; saat menunggu gunakan “Menyimpan”; kegagalan/retry menampilkan “Belum tersinkron”.
- Untuk epoch yang masih aktif, retry operasi identik mengembalikan hasil operasi pertama. Server memeriksa epoch sebelum mengembalikan respons idempotency; request dari epoch lama ditolak meski pernah berhasil. Revisi lama dengan ID operasi baru mendapat konflik; UI rekonsiliasi tanpa menimpa jawaban baru diam-diam.
- Setelah reset, batalkan debounce, retry, dan antrean lama. Respons save menyertakan epoch; UI mengabaikan respons dari epoch lama agar jawaban tidak muncul kembali.

**Diterima bila:** perubahan cepat A→B dan respons jaringan terbalik tetap menyimpan B; retry tidak menggandakan operasi; jawaban diakui tetap ada setelah refresh kecuali sudah terkena reset; save/ACK lama tidak mengembalikan jawaban yang direset.

### FR-06 — Gangguan koneksi, waktu, dan deadline

- Runner menghitung tampilan dari deadline dan offset waktu server, lalu menyinkronkan kembali. Mengubah jam perangkat tidak memperpanjang deadline server.
- Simpan antrean jawaban minimum sementara di IndexedDB per attempt/epoch; tidak menyimpan kunci/token di sana. Bersihkan saat reset, finalisasi, logout, atau masa simpan lokal berakhir. Simpan ID insiden reset tertunda secara terpisah agar refresh tidak membatalkan pelaporannya.
- Ujian tidak berhenti ketika offline, tab tersembunyi, perangkat sleep, atau browser tertutup.
- Jawaban diterima hanya bila transaksi server masih aktif dan waktu penerimaan/validasi database `< deadline_at`.
- Timestamp dari peserta tidak menjadi dasar menerima jawaban terlambat. Tidak ada grace period unggahan jawaban pada MVP.
- Pada deadline, job server memfinalisasi jawaban tersimpan. Semua endpoint attempt juga memeriksa kedaluwarsa dan dapat memicu finalisasi yang sama.
- Server mengunci penerimaan jawaban tepat pada deadline meskipun job belum berjalan. Gangguan scheduler memicu alert dan proses catch-up.
- Saat tersambung setelah deadline, tampilkan hasil final dan daftar perubahan lokal yang tidak diterima, tanpa menyatakan perubahan tersebut tersimpan.
- Pada mode ketat, bila `visibility_hidden` terdeteksi ketika offline, hapus jawaban lokal, catat insiden tertunda, dan blokir input/submit sampai insiden diproses server. Retry insiden lebih dahulu saat reconnect; antrean jawaban sebelum insiden tidak dikirim ulang. Putus koneksi tanpa event pemicu tidak mereset jawaban.

**Diterima bila:** browser ditutup sebelum habis tetap menghasilkan hasil sesuai data server; offline tanpa insiden lalu kembali sebelum deadline dapat sinkron; offline disertai insiden tidak memulihkan jawaban lama; kembali sesudah deadline tidak menambah jawaban; sleep tidak menambah waktu.

### FR-07 — Satu sesi penulis aktif

- Satu attempt hanya memiliki satu sesi yang boleh menulis. Ini pembatasan sesi, bukan pembuktian perangkat fisik.
- Server menerbitkan identitas sesi dan `session_generation`; tiap mutasi memeriksa generasi aktif.
- Heartbeat setiap 30 detik; status “Koneksi terputus” setelah tidak ada heartbeat selama 90 detik. Tidak ada diskualifikasi akibat heartbeat hilang.
- Sesi kedua hanya melihat layar konflik. Takeover memerlukan konfirmasi pemilik yang sudah login dan dicatat; mode Exam dapat mewajibkan persetujuan pengawas.
- Takeover meningkatkan generasi secara atomik; request sesi lama ditolak, termasuk antrean offline. Resume di browser yang sama mempertahankan sesi bila masih sah.

**Diterima bila:** dua tab/perangkat tidak dapat mengubah jawaban secara bersamaan; setelah takeover, tab lama tidak dapat menyimpan; waktu tidak direset.

### FR-08 — Pengawasan dan reset seluruh jawaban pada mode ketat

- Catat `visibility_hidden`, `visibility_visible`, `fullscreen_exit`, `fullscreen_enter`, `session_takeover`, dan gangguan koneksi yang teramati.
- `blur` bila dipakai hanya konteks diagnostik, tidak dihitung sendiri sebagai pelanggaran.
- **Mode Quiz:** peringatan saat insiden pertama; flag “Perlu ditinjau” setelah 3 insiden unik. Tidak mereset jawaban.
- **Mode Exam ketat:** setiap transisi `visible → hidden` yang terdeteksi ketika ujian aktif memicu reset semua jawaban, mulai kejadian pertama. Tidak menunggu 3 kejadian atau persetujuan pengawas.
- Pemicu menggunakan `document.visibilityState === 'hidden'`. Membuka tab baru di latar belakang tanpa menyembunyikan halaman ujian tidak dijamin terdeteksi. Minimize atau layar mati juga dapat menghasilkan `hidden` dan terkena aturan yang sama; sampaikan sebelum mulai. Browser tidak memberikan isi atau alamat tab lain. [Batas Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API).
- `fullscreen_exit` saja tidak mereset jawaban; tampilkan permintaan kembali fullscreen dan catat event. Korelasikan event fullscreen dengan episode hidden yang sama. Setiap episode hidden memiliki ID unik; pengiriman ulang/dua event dari episode yang sama hanya memicu satu reset. Episode baru setelah kembali visible tetap memicu reset meski terjadi dalam 2 detik.
- Tidak ada pengurangan waktu, auto-submit, atau diskualifikasi akibat event tersebut. Pengosongan jawaban mengubah nilai yang nantinya dihitung dari jawaban setelah reset.
- Fullscreen meminta interaksi pengguna. Bila tidak didukung/ditolak, tampilkan masalah sebelum start; sediakan pengecualian oleh petugas dengan alasan atau alihkan ke perangkat yang didukung.
- Pembatasan clipboard bersifat opsional dan default mati; pengecualian aksesibilitas harus tersedia. Tidak membuat fitur “deteksi DevTools pasti”.
- Event peserta diberi label sebagai laporan dari klien. Event yang belum terkirim dapat di-retry, tetapi sistem tidak menjamin log lengkap bila browser dimatikan atau dimodifikasi.

**Transaksi reset dan pengalaman peserta:**

1. Client segera mengunci input/submit, membuang jawaban/penanda review lokal, membatalkan save tertunda, dan mengirim insiden dengan ID unik, sesi, serta `answer_epoch` asal. Jangan menampilkan reset server berhasil sebelum menerima ACK.
2. Server memverifikasi pemilik, sesi aktif, kebijakan snapshot, dan insiden; lalu memakai lock attempt yang sama dengan autosave/submit/finalisasi. Hanya attempt `in_progress` sebelum deadline yang dapat direset.
3. Dalam satu transaksi, kosongkan seluruh pilihan jawaban dan penanda review server, naikkan `answer_epoch`, set posisi runner ke soal pertama, serta tulis audit reset. Simpan ID insiden, waktu penerimaan server, alasan, dan jumlah jawaban yang dikosongkan; jangan menyimpan salinan pilihan lama yang bisa dipulihkan lewat aplikasi.
4. Pertahankan attempt ID, deadline, snapshot, dan urutan soal/opsi. Reset tidak memberi kuota attempt baru. Server mengembalikan epoch baru, keadaan kosong, serta sisa waktu.
5. Setelah ACK dan halaman visible, peserta melihat pesan “Seluruh jawaban direset karena Anda meninggalkan tab ujian. Waktu tetap berjalan.” Tombol “Lanjut mengerjakan” membuka soal pertama; peserta boleh menjawab ulang selama masih ada waktu. Refresh harus tetap memuat keadaan setelah reset.
6. Request save atau submit dari epoch lama ditolak dengan `ANSWER_EPOCH_MISMATCH`. Insiden yang sudah diproses mengembalikan receipt reset yang sama tanpa reset tambahan. Event baru dari epoch kedaluwarsa hanya dicatat sebagai stale dan tidak menghapus jawaban epoch baru.
7. Bila finalisasi/deadline menang dalam urutan transaksi, reset tidak mengubah hasil final. Insiden yang baru diterima setelah deadline/finalisasi dicatat sebagai laporan terlambat untuk review. Karena telemetri berasal dari client, reset server tidak bisa dijamin bila event tidak pernah sampai sebelum finalisasi; tampilkan batas ini dalam dokumentasi operasional.
8. Pengawas melihat jumlah reset, waktu, dan alasan. Penandaan salah deteksi dapat diaudit tetapi tidak otomatis memulihkan jawaban; bila perlu, petugas memberi retake terpisah sesuai FR-11.

**Diterima bila:** setelah 10 jawaban tersimpan lalu satu episode hidden, seluruh 10 jawaban kosong di UI dan server, kembali ke soal pertama, deadline dan urutan soal tetap; save/ACK/cache/refresh lama tidak memulihkan jawaban; satu episode yang juga keluar fullscreen hanya mereset sekali; hidden berikutnya mereset lagi; mode Quiz tidak ikut direset; event terlambat tidak mengubah hasil final.

### FR-09 — Submit dan penilaian

- Submit manual menampilkan jumlah kosong, jawaban belum tersinkron, dan konfirmasi final.
- Bila masih ada jawaban belum tersinkron, tawarkan retry atau konfirmasi eksplisit untuk mengirim hanya jawaban server. Saat offline jangan tampilkan submit berhasil.
- Submit, autosave, reset jawaban, dan job deadline menggunakan kunci transaksi attempt yang sama. Transaksi yang memfinalisasi membuat attempt tidak dapat ditulis atau direset lagi. Submit menyertakan epoch aktif; client memproses insiden reset tertunda sebelum submit dan tidak mengizinkan submit saat masih hidden.
- `POST submit` idempotent; request ganda atau balapan dengan job menghasilkan satu receipt dan satu hasil.
- Sebab finalisasi: `manual`, `deadline`, atau `staff_termination`. Server menentukan sebab yang sah; petugas wajib menulis alasan penghentian.
- Nilai mentah = jumlah bobot pilgan benar + skor esai manual − penalti setiap pilgan salah. Kosong = 0. Nilai akhir = `clamp(100 × raw_score / total_positive_weight, 0, 100)`, dibulatkan 2 desimal. Kelulusan memakai angka yang sudah dibulatkan.
- Pilgan memakai kunci snapshot privat dan pilihan ID stabil. Peserta tidak dapat mengirim nilai. Skor esai hanya diterima dari pengajar berwenang, untuk attempt yang sudah selesai.
- Esai dibatasi 20.000 karakter. Rubrik mengikuti snapshot; skor manual 0–bobot dengan dua desimal, jawaban kosong bernilai nol. Semua esai difinalisasi atomik dan terkunci setelah koreksi. Receipt/waktu submit/jawaban tidak berubah.
- Attempt esai berstatus penilaian pending sampai seluruh skor diterima. Nilai parsial, rubrik, dan komentar tidak dirilis sebelum kebijakan mengizinkan. Detail pada [ESSAY.md](ESSAY.md) dan [EMAIL_PASSWORD.md](EMAIL_PASSWORD.md).

**Diterima bila:** satu submit bersamaan dengan save menghasilkan jawaban final sesuai urutan transaksi; submit ulang mengembalikan receipt sama; contoh 10 soal bobot 1, benar 7, salah 2, kosong 1 menghasilkan 70 tanpa penalti dan 65 bila penalti salah 0,25.

### FR-10 — Hasil, rilis, dan ekspor

- Bukti submit berisi attempt ID, waktu server, sebab finalisasi, dan status penerimaan; tetap tersedia walau nilai belum dirilis.
- Rilis nilai dan rilis pembahasan/kunci adalah dua izin terpisah. Default Exam: keduanya ditahan; Quiz dapat merilis nilai langsung.
- Pembahasan/kunci hanya boleh dirilis setelah jendela ujian dan seluruh perpanjangan peserta selesai; retake memakai versi baru bila kunci sudah terbuka.
- Peserta hanya melihat hasil sendiri. Pengajar melihat rekap, benar/salah/kosong, status kelulusan, dan flag review secara terpisah dari nilai.
- CSV mencakup ID peserta, kelas, ujian, nilai, status, waktu, dan flag. Lindungi cell yang bisa menjadi formula spreadsheet dan audit ekspor.
- Petugas dapat memberi status review/invalidasi dengan alasan tanpa menimpa nilai asli. Regrade massal tidak termasuk MVP.

**Diterima bila:** URL hasil belum terbit tidak membocorkan nilai; endpoint review belum diizinkan tidak membocorkan kunci; ekspor hanya berisi peserta pada ujian yang boleh diakses.

### FR-11 — Monitoring dan intervensi petugas

- Daftar menampilkan belum mulai, aktif, koneksi terputus, selesai manual, selesai deadline, dan dihentikan; flag review tampil terpisah.
- Tampilkan last seen, progres jawaban pada epoch aktif, sisa waktu server, jumlah reset, dan timeline insiden/reset. Setelah reset, progres kembali nol. Jangan tampilkan jawaban benar pada kanal peserta.
- Pembaruan menggunakan polling 10 detik, dengan backoff saat gagal. Dashboard tidak mengirim polling per peserta satu per satu.
- Pengawas dapat menambah waktu untuk attempt yang masih aktif, maksimum awal 60 menit, dengan alasan. Perubahan memperbarui durasi dan batas akhir individual secara atomik; tidak membuka hasil yang sudah final.
- Jika perlu ujian ulang setelah finalisasi, berikan retake terpisah. Riwayat lama dipertahankan.
- Jadwal/aturan tidak dapat dipindah diam-diam saat ujian berjalan. Intervensi tercatat dengan aktor, before/after, alasan, dan timestamp.

**Diterima bila:** pengawas melihat perubahan ≤15 detik dalam kondisi normal; penambahan waktu bersamaan dengan finalisasi mengikuti transaksi, dan attempt yang sudah final menolak penambahan.

## 9. Model status

| Entitas | Status dan aturan |
| --- | --- |
| Ujian | `draft → published → closed → archived`; jendela akses dihitung dari jadwal dan pengecualian individual |
| Attempt | `in_progress → finalized`; sebab finalisasi disimpan terpisah dan tidak dapat dibalik |
| Generasi jawaban | `answer_epoch: 0 → 1 → ...` setiap reset; attempt tetap `in_progress` dan deadline tidak berubah |
| Review integritas | `none → flagged → cleared/confirmed/inconclusive`; terpisah dari attempt dan nilai |
| Rilis hasil | `withheld → score_released → review_released`; petugas boleh langsung rilis keduanya hanya jika syarat waktu terpenuhi |
| Koneksi | `online / stale / offline`; indikator operasional, bukan status attempt |

Menutup ujian menghentikan start baru. Attempt aktif tetap mengikuti deadline tersimpan; pengakhiran massal harus menjadi tindakan eksplisit yang diaudit. Pengarsipan tidak menghapus hasil.

## 10. Struktur halaman

| Area | Halaman |
| --- | --- |
| Akses | `/login`, `/access-pending` |
| Peserta | `/dashboard`, `/exams/[examId]`, `/exams/[examId]/check` |
| Runner | `/attempts/[attemptId]`, `/attempts/[attemptId]/receipt` |
| Hasil peserta | `/results/[attemptId]` |
| Pengajar | `/manage`, `/manage/questions`, `/manage/classes`, `/manage/exams` |
| Editor | `/manage/exams/[examId]/edit`, `/manage/exams/[examId]/participants` |
| Operasional | `/manage/exams/[examId]/monitor`, `/manage/exams/[examId]/results`, `/manage/attempts/[attemptId]` |
| Admin | `/admin/users`, `/admin/settings`, `/admin/audit` |

Path adalah rancangan awal. Menyembunyikan menu tidak menggantikan otorisasi endpoint.

## 11. Pedoman pengalaman pengguna

- Runner tenang, kontras jelas, satu area soal utama, panel nomor soal, timer konsisten, dan tombol submit yang tidak mudah terpencet.
- Status soal dibedakan dengan teks/ikon selain warna: kosong, terjawab, ditandai.
- Timer memberi pengingat pada sisa 5 menit dan 1 menit tanpa mengganggu input.
- Gunakan bahasa spesifik: “Jawaban belum tersinkron. Waktu tetap berjalan.” dan “Ujian diterima pada 10.30 WIB.”
- Quiz menggunakan peringatan “Halaman ujian sempat tidak aktif. Kejadian dicatat untuk ditinjau.” Exam ketat menjelaskan akibat reset sebelum start dan menampilkan pesan reset pada FR-08; jangan menyebut peserta pasti curang.
- Seluruh opsi dan navigasi dapat digunakan dengan keyboard; fokus terlihat, label screen reader, zoom 200%, dan pesan status melalui live region yang tidak berlebihan. Dialog reset diumumkan dan fokus diarahkan ke tombol lanjut, lalu judul soal pertama.
- Target aksesibilitas WCAG 2.2 AA untuk alur utama. Fullscreen dan aturan clipboard menyediakan akomodasi per peserta sebelum start.
- Preflight mengecek kemampuan browser dan koneksi melalui request nyata; hasil pemeriksaan bukan jaminan jaringan akan selalu stabil.

## 12. Arsitektur dan batas kepercayaan

Usulan awal: Next.js App Router + TypeScript, Supabase Auth, PostgreSQL, dan storage privat. Versi stabil/patched, paket UI, penyedia hosting, dan ukuran instance dipilih saat kickoff implementasi. Prinsip keamanan Next.js: DAL server dan pemeriksaan otorisasi per operasi. [Dokumentasi resmi](https://nextjs.org/docs/app/guides/data-security).

Aliran inti: browser → Route Handler → validasi sesi/role/kepemilikan → layanan domain → transaksi database → DTO minimum. Browser menampilkan keadaan; server memutuskan penerimaan jawaban, deadline, dan nilai.

- Kunci jawaban berada pada tabel/schema privat tanpa akses browser, bukan sekadar kolom tersembunyi di UI.
- Server mengirim hanya soal pada snapshot attempt; tidak mengirim seluruh bank soal.
- Konten peserta, hasil, dan response RSC/API bersifat privat dan tidak masuk shared cache; media memakai URL bertanda tangan berumur pendek.
- Dashboard awal dapat memakai Server Components; runner adalah Client Component. Modul penilaian dan akses kunci diberi batas `server-only`.
- Semua mutasi attempt melalui layanan domain yang sama, termasuk reset kebijakan, job finalisasi, dan tindakan petugas. Reset atomik dan epoch dipakai untuk memutus request/cache generasi jawaban lama.
- Scheduler periodik memindai attempt jatuh tempo menggunakan indeks deadline, batch, retry, dan lock. Endpoint ujian tetap menegakkan deadline jika scheduler gagal.
- RLS dan privilege database diterapkan sebagai pertahanan tambahan. Kunci administratif tetap server-only; akses dengan hak bypass tetap memerlukan otorisasi aplikasi. [Dokumentasi Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security).

Fullscreen dan visibility hanya sumber telemetri. Pengguna dapat keluar fullscreen, dan timer latar belakang dapat diperlambat browser. Aturan produk pada FR-06/08 mempertimbangkan keterbatasan tersebut. [Fullscreen API](https://developer.mozilla.org/en-US/docs/Web/API/Fullscreen_API/Guide), [Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API).

## 13. Model data konseptual

| Entitas | Data penting dan invariant |
| --- | --- |
| `profiles` | Auth subject, nama, ID peserta, status; role tidak dapat diubah sendiri |
| `role_assignments` | User, role, lingkup kewenangan |
| `classes`, `class_memberships` | Kelas dan keanggotaan; unik user per kelas |
| `questions`, `question_versions` | Author, konten, opsi ber-ID, versi, media |
| `question_keys` | Kunci privat per versi; hanya layanan server yang berwenang |
| `exams`, `exam_versions` | Jadwal, durasi, preset, scoring, kebijakan rilis, versi terbit immutable |
| `exam_items` | Snapshot konten, bobot, dan referensi kunci privat per versi ujian |
| `exam_enrollments` | Peserta, kuota attempt, akomodasi, perpanjangan; unik exam/user |
| `exam_staff` | Penugasan pengajar/pengawas per ujian |
| `attempts` | User, exam version, nomor attempt, started/deadline, status, session generation, answer epoch, reset count, posisi runner |
| `attempt_items` | Snapshot pilihan soal/opsi dan urutan yang persisten; tanpa kunci pada DTO |
| `attempt_answers` | Attempt item, option ID/null, revision, answer epoch, penanda review, saved_at; hanya pilihan epoch aktif yang dipakai |
| `attempt_operations` | Idempotency key, hash payload, response tanpa isi pilihan lama, answer epoch; unik attempt/key |
| `attempt_sessions` | Session ID, generation, last heartbeat, waktu takeover |
| `integrity_events`, `incidents` | ID event unik, sumber klien/server, client/server timestamp, korelasi insiden |
| `answer_resets` | Attempt, ID insiden unik, epoch asal/baru, alasan, waktu server, jumlah jawaban dikosongkan; tanpa salinan pilihan lama |
| `results` | Satu per attempt, nilai, counts, sebab finalisasi, receipt, status rilis |
| `integrity_reviews`, `audit_logs` | Aktor, alasan, before/after, keputusan, waktu |

Simpan kunci dan snapshot penilaian privat untuk reproduksi hasil. ID opsi selalu merujuk versi yang tepat. Unique constraint `(exam_id, user_id, attempt_number)` dan lock enrollment melindungi kuota; lock attempt melindungi urutan simpan/reset/finalisasi. Reset menghapus pilihan lama dari data jawaban aktif dan cache aplikasi; audit menyimpan metadata reset. Backup mengikuti retensi lembaga dan bukan jalur pemulihan jawaban peserta melalui aplikasi.

## 14. Kontrak API awal

Semua endpoint terautentikasi, memvalidasi input di server, dan tidak menerima user ID sebagai identitas terpercaya dari body.

| Operasi | Endpoint konseptual | Jaminan utama |
| --- | --- | --- |
| Mulai/resume | `POST /api/exams/:id/attempts` | Enrollment, jendela waktu, kuota, idempotent |
| Muat sesi | `GET /api/attempts/:id` | Pemilik, snapshot tanpa kunci, epoch aktif, waktu server |
| Simpan jawaban | `PUT /api/attempts/:id/answers/:itemId` | Sesi aktif, answer epoch, revision, idempotency, deadline |
| Heartbeat | `POST /api/attempts/:id/heartbeat` | Sesi/generasi aktif; tidak menambah waktu |
| Aktivitas/reset | `POST /api/attempts/:id/events` | Insiden hidden diproses prioritas, reset server sesuai snapshot, deduplikasi, receipt/epoch baru; kuota jalur penting dipisah dari event diagnostik |
| Takeover | `POST /api/attempts/:id/takeover` | Kebijakan pengawas, rotasi generation |
| Submit | `POST /api/attempts/:id/submit` | Epoch aktif, transaksi tunggal, receipt yang stabil |
| Hasil | `GET /api/attempts/:id/result` | Kepemilikan dan kebijakan rilis |
| Monitoring | `GET /api/manage/exams/:id/monitor` | Penugasan staf, pagination, DTO terbatas |
| Intervensi | `POST /api/manage/attempts/:id/actions` | Role, status sah, alasan, audit |
| Ekspor | `GET /api/manage/exams/:id/export` | Otorisasi, perlindungan formula CSV, audit |

Respons bermakna: 401 belum login; 403 tidak diizinkan; 404 untuk resource yang tidak boleh diketahui; 409 konflik sesi/revisi/epoch atau attempt final; 422 input salah; 429 terlalu banyak request. Kode domain seperti `DEADLINE_PASSED`, `STALE_SESSION`, `REVISION_CONFLICT`, dan `ANSWER_EPOCH_MISMATCH` membedakan pemulihan UI. ID idempotency dengan payload berbeda ditolak.

## 15. Kebutuhan nonfungsional

### Keamanan aplikasi

- HTTPS, cookie sesi aman sesuai integrasi auth, proteksi CSRF/origin untuk mutasi berbasis cookie, validasi skema, dan sanitasi konten soal.
- Tidak mengandalkan route guard saja. Uji IDOR, role escalation, akses kunci, endpoint admin, ekspor, dan URL media.
- Rate limit per akun/attempt dan batas ukuran batch. Pisahkan kuota autosave, heartbeat, dan event agar spam telemetri tidak menutup jalur jawaban normal.
- Secret tidak memakai awalan environment publik; tidak masuk bundle, log, atau repository.
- Jejak audit tidak dapat diubah oleh peserta/pengajar melalui API biasa. Log aplikasi menyaring token, jawaban lengkap, dan kunci.

### Privasi dan retensi

- Sebelum mulai, jelaskan data yang dikumpulkan, tujuan pemantauan, akses petugas, dan jalur meminta peninjauan insiden.
- MVP tidak mengumpulkan kamera, mikrofon, biometrik, atau rekaman layar.
- Usulan retensi awal: jawaban/hasil 12 bulan, event integritas 90 hari, audit petugas 12 bulan. Lembaga harus menetapkan kebijakan final sebelum peluncuran; ini bukan kesimpulan kepatuhan hukum.
- Penghapusan/anonimisasi dilakukan melalui job terotorisasi, termasuk media dan cache. Retensi backup mengikuti siklus backup dan dijelaskan kepada lembaga.
- Antrean jawaban lokal dihapus setelah reset, finalisasi, atau logout; jika tidak ada kesempatan cleanup, dibatasi kedaluwarsa maksimal 24 jam setelah deadline dan dibersihkan pada pembukaan berikutnya. Metadata insiden reset tertunda dipertahankan terpisah sampai dilaporkan atau masa retensinya berakhir.

### Operasional dan pemulihan

- Backup database harian dan prosedur restore teruji; sasaran awal RPO ≤24 jam, RTO ≤4 jam. Jika kehilangan jawaban sampai 24 jam tidak dapat diterima, aktifkan strategi pemulihan yang lebih rapat sebelum ujian penting.
- Catat latensi save/submit, error per endpoint, konflik sesi, backlog finalisasi, koneksi database, dan lag monitoring.
- Alert saat finalisasi tertunda >60 detik atau error save/submit >1% selama 5 menit. Sediakan prosedur petugas untuk gangguan massal dan keputusan retake.
- Uji restore sebelum pilot. Gangguan infrastruktur tidak boleh diinterpretasikan sebagai kecurangan peserta.

## 16. Validasi dan gate peluncuran

| Area | Skenario wajib |
| --- | --- |
| Penilaian | Shuffle opsi, bobot berbeda, penalti, kosong, clamp, pembulatan, threshold lulus |
| Kerahasiaan | HTML, RSC, API, media, bundle, cache, monitoring tidak mengandung kunci sebelum izin rilis |
| Akses | Peserta A/B, pengajar tanpa penugasan, akun nonaktif, endpoint internal, ekspor |
| Waktu | Jam perangkat berubah, sleep, tab latar, datang terlambat, batas tepat deadline |
| Konsistensi | Start ganda, save terbalik, retry, submit ganda, save vs submit vs scheduler |
| Reset ketat | Satu hidden mengosongkan semua jawaban/penanda di client dan server; epoch bertambah; waktu/urutan tetap; reset vs save/submit/scheduler, retry episode sama, episode kedua, ACK lama, cache/refresh, offline dan laporan terlambat |
| Pemulihan | Offline 30 detik/2 menit, refresh, crash browser, reconnect setelah deadline |
| Sesi | Dua tab, dua perangkat, takeover, antrean sesi lama, heartbeat hilang |
| Pengawasan | Quiz hanya peringatan, Exam reset pada hidden pertama, visibility + fullscreen satu episode hanya satu reset, pengecualian aksesibilitas, review false positive tanpa pemulihan otomatis |
| UX | Keyboard, zoom, screen reader, status simpan, hasil ditahan, browser tidak didukung |
| Operasional | Backup restore, scheduler gagal lalu catch-up, audit, retensi, alert |

Profil beban minimum: 500 peserta, 100 soal, ujian 60 menit, 10 pengawas; 500 start dalam 60 detik; jawaban berubah rata-rata setiap 10 detik; heartbeat 30 detik; dashboard polling 10 detik; burst 500 submit dalam 10 detik; retry terkontrol pada sebagian request. Jalankan pada lingkungan setara produksi dan catat biaya, p95/p99, error, serta saturasi database.

Tambahkan skenario beban reset: 50 peserta dengan jawaban tersimpan mengirim insiden hidden dalam 10 detik bersamaan dengan autosave; retry event yang sama tidak menambah reset. Ukur latensi ACK reset p95 ≤2 detik pada jaringan uji normal, tanpa membocorkan pilihan lama atau mengganggu jawaban peserta lain.

Gate lulus: target pada bagian 4 terpenuhi, error tak terduga <1% (konflik yang disengaja dihitung terpisah), tidak ada hasil ganda, tidak ada kehilangan jawaban yang sudah diakui server selain reset kebijakan yang diaudit, reset tidak dapat dibatalkan oleh antrean/ACK lama, dan tidak ada temuan akses/kebocoran kritis yang belum ditutup. Profil beban ini tidak mewakili semua kondisi jaringan nyata.

## 17. Rencana implementasi indikatif

Estimasi awal 6–8 minggu untuk satu pengembang berpengalaman dengan dukungan review/QA paruh waktu. Ini perkiraan perencanaan, bukan komitmen; jadwal diperbarui setelah keputusan login, hosting, dan kebutuhan pilot.

| Tahap | Perkiraan | Hasil yang dapat didemokan |
| --- | --- | --- |
| 1. Fondasi | Minggu 1 | Auth, role, schema, kelas, batas akses |
| 2. Authoring | Minggu 2 | Bank soal, editor, peserta, publikasi snapshot |
| 3. Mesin ujian | Minggu 3–4 | Start, runner, autosave, resume, sesi tunggal, deadline, reset atomik dan epoch |
| 4. Penilaian dan operasi | Minggu 5 | Submit, hasil, rilis, monitoring, review, ekspor |
| 5. Hardening dan pilot | Minggu 6–8 | Uji akses/race/beban, restore, perbaikan UX, pilot terbatas |

Urutan backlog pertama: identitas/otorisasi → versi soal/ujian → attempt dan deadline → autosave dan epoch → reset ketat → finalisasi/penilaian → runner lengkap → monitoring/review → hasil/ekspor → validasi peluncuran.

## 18. Keputusan yang masih perlu dikonfirmasi

| Keputusan | Default pada PRD | Dampak bila berbeda |
| --- | --- | --- |
| Sasaran lembaga | Satu sekolah/lembaga | SaaS menambah isolasi tenant dan operasi pelanggan |
| Identitas peserta | Google atau email/password + daftar undangan | SSO lembaga lain memerlukan onboarding dan dukungan tambahan |
| Tingkat kepentingan ujian | Quiz dan ujian kelas | Seleksi/sertifikasi mungkin butuh pengawasan perangkat khusus |
| Perangkat | Desktop untuk Exam | Mobile perlu validasi fullscreen, koneksi, dan desain khusus |
| Skala | 500 aktif, 100 soal | Kapasitas lebih tinggi memerlukan profil beban dan anggaran baru |
| Retensi dan pemulihan | Usulan pada bagian 15 | Mempengaruhi biaya dan prosedur operasional |
| Infrastruktur | Next.js + Supabase | Alternatif backend tetap harus menjaga invariant yang sama |

Keputusan reset seluruh jawaban pada mode Exam sudah ditetapkan pengguna dan tidak termasuk pertanyaan konfirmasi di atas. Interpretasi operasional dalam draft ini: reset mulai kejadian pertama, attempt dan sisa waktu tetap, peserta menjawab ulang dari soal pertama.

Dokumen ini siap menjadi dasar desain layar, schema database, dan tiket implementasi setelah asumsi produk ditinjau.

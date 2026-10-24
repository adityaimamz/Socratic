# Socratic — redesign dan validasi

## Identitas

Desain akademik terang memakai taste-skill **Framed Sheet**, seed `24102026`, dengan palet dan font yang dipertahankan dari keputusan merek. Tidak ada redraw. Logo asli dipindahkan ke `public/logo.jpeg` tanpa perubahan byte, warna, maupun rasio 512:382. Nama aksesibel, metadata, halaman sistem, dan footer memakai Socratic. Nama package, URL, environment, session storage, BroadcastChannel, dan IndexedDB tetap kompatibel.

Marun `#650E16` berasal dari warna dominan logo. Putih menjadi ruang membaca, `#F7F7F7` menjadi frame, dan `#171717`/`#606060` menjadi teks. IBM Plex Sans tetap dimuat lokal; IBM Plex Mono hanya untuk kode dan ID. Teks status tetap menjelaskan arti warna. Marun menandai jawaban/pilihan dan aksi utama; warna kesalahan, sukses, dan peringatan mempunyai token terpisah.

Wajah produk adalah logo Socrates asli dan marun pada progres ujian. Elemen khas produk adalah peta soal yang membedakan soal aktif, terjawab, dan ditandai, bersama timer server dan status sinkronisasi. Tidak ada foto, statistik, atau testimoni tambahan. Data pengujian adalah fixture lokal, bukan data lembaga produksi.

## Cakupan layar

| Kelompok | Pertanyaan utama | Cabang yang diperiksa |
| --- | --- | --- |
| Akses | Bagaimana masuk ke ruang ujian? | Login, gagal konfirmasi/login, akun undangan, pulihkan password, password baru, akses tertunda, setup, privasi |
| Peserta | Ujian mana yang perlu dikerjakan? | Dashboard, detail ujian, pemeriksaan koneksi/fullscreen, persetujuan aturan |
| Penyusunan | Apa yang perlu disiapkan sebelum terbit? | Ringkasan pengajar, bank soal, tambah/edit pilgan/esai, kelas, tambah/edit kelas, daftar ujian, buat/detail/edit/preview draft, detail ujian terbit |
| Pelaksanaan | Siapa yang sedang mengerjakan dan perlu ditinjau? | Peserta tambahan, pengawas admin, akomodasi fullscreen, monitoring, cari peserta, tinjau/intervensi, hasil/ekspor, rilis nilai/pembahasan |
| Penilaian | Jawaban mana yang masih perlu dinilai? | Esai kosong/berisi, rubrik, skor/komentar, penilaian selesai |
| Administrasi | Siapa yang dapat mengakses dan apa kebijakannya? | Akun, undangan, role/status pengguna, identitas lembaga, retensi, kesehatan layanan, audit |
| Runner | Apa soal saat ini dan apakah jawabannya tersimpan? | Pilgan, esai, peta soal desktop/ponsel, penanda, status simpan/koneksi, reset menunggu/selesai, dialog submit/batal, konflik sesi |
| Hasil | Apakah ujian diterima dan nilainya tersedia? | Receipt, nilai ditahan, menunggu esai, nilai terbit, komentar esai, pembahasan sesuai izin |
| Sistem | Bagaimana melanjutkan setelah gangguan? | Loading, error dengan retry, 404 |

`/` tetap mengarahkan ke dashboard. Callback autentikasi, API, dan alias receipt mempertahankan redirect/response yang ada; semuanya bukan layar baru.

## Tata letak dan aksesibilitas

- Frame desktop 240px + workspace fleksibel; lembar putih inset 8px, gutter 32px, jarak isi 24px. Rail detail 296px; form panjang mempunyai bagian materi, jadwal, penilaian, dan akses.
- Navigasi berlabel berubah menjadi dialog native di tablet/ponsel. Fokus terkunci di dialog, Escape menutupnya, fokus kembali ke pemicu, dan dialog ditutup ketika berpindah ke desktop.
- Peta soal dapat dibuka/tutup tanpa berpindah halaman atau memulai ulang timer. Kontrol menggunakan label, `aria-expanded`, dan `aria-current`.
- Tabel ponsel menggulir di dalam region yang dapat difokuskan; kolom identitas tetap terlihat. Semua kolom tetap tersedia. Form bertumpuk dan kontrol sentuh berukuran minimal 44px.
- Pada viewport 390px, area tabel 298px membagi kolom tetap 176px dan kolom tindakan 112px, menyisakan 10px ruang. Tombol tindakan bertumpuk agar seluruh label tetap terlihat pada posisi gulir terakhir; ArrowRight dapat menggulir region.
- Tanpa animasi masuk atau shimmer; reduced motion mematikan putaran spinner. Dialog memakai focus management native. Tidak ada perubahan pada logika jawaban, epoch, deadline, atau kewenangan akses.

## Bukti pengujian

Sebelum implementasi direkam 69 screenshot dari 23 halaman pada 1440, 768, dan 390px; tidak ditemukan overflow horizontal. Artefak lokal tersimpan di `.taste-skill/before/coverage.json` dan screenshot terkait.

Pengujian otomatis ada pada `tests/e2e/socratic.spec.ts`, regresi domain tetap pada suite sebelumnya, dan helper inspector dibagi melalui `tests/support/visual.ts`. Snapshot memakai server fixture lokal pada port 3100/54329, tanpa perubahan database produksi.

Pemeriksaan error root memakai render terisolasi dari komponen asli beserta CSS aplikasi. Ini memvalidasi tampilannya, bukan hidrasi tombol retry. Gangguan workspace tetap mengikuti perilaku yang sudah ada: redirect ke akses tertunda. Pengujian fixture juga memeriksa pemulihan setelah gangguan selesai. Endpoint simulasi empty/error/slow hanya berada pada server fixture, tanpa jalur pengujian di aplikasi produksi.

Audit visual menyimpan screenshot dan laporan inspector. Trace tambahan dimatikan untuk file audit visual karena duplikasi snapshot gambar/font menghasilkan arsip besar di OneDrive; suite regresi ujian tetap menyimpan trace saat gagal. Filter `SOCRATIC_AUDIT_ROLES` hanya mempersempit audit ketika melanjutkan pemeriksaan; tanpa filter, semua role diperiksa.

## Hasil akhir

| Pemeriksaan | Hasil |
| --- | --- |
| ESLint dan TypeScript | Lulus |
| Unit test | 29 lulus pada 3 file |
| Run regresi E2E final | 13 lulus, termasuk seluruh 11 regresi ujian dan audit admin |
| Skenario E2E tambahan | Fokus menu, peta soal/persistensi jawaban, serta loading/error/empty lulus pada run terpisah |
| Zoom 200%, reduced motion, teks panjang | Lulus; uji ulang menunggu hidrasi selesai sebelum memodifikasi DOM pengujian |
| Build produksi | Lulus, termasuk kompilasi TypeScript dan seluruh route |
| Inspector taste-skill | **42 tampilan × 3 ukuran = 126 pemeriksaan, 0 FAIL** |
| Pemindaian style source | 46 file, 0 FAIL; 3 WARN dijelaskan di bawah |

Audit diselesaikan melalui beberapa run. Run visual sebelumnya berhenti saat ekspor trace OneDrive, setelah halaman peserta dan pengajar selesai diperiksa; audit admin dilanjutkan dengan trace visual dimatikan. Timeout inspector yang tidak menghasilkan laporan boleh dicoba ulang sekali; temuan desain FAIL tetap menggagalkan tes. Tidak ada aturan inspector yang dinonaktifkan dengan `--allow`.

Ringkasan mesin ada di `.taste-skill/after/validation.json`; setiap tampilan memiliki `report.json`, screenshot desktop/tablet/ponsel, dan lembar halaman di `.taste-skill/inspect-socratic-*/`. Penilaian esai memakai `.taste-skill/inspect-essay-grading/`. Screenshot penuh tersimpan di `.taste-skill/after/`; contact sheet review mencakup layar awal dan bagian halaman di bawahnya. HTML masukan inspector pada `test-results/` bersifat sementara dan dibuat ulang oleh pengujian.

### Kritik visual dan peringatan yang dipertahankan

- **Hierarki pekerjaan:** judul dan tindakan utama jelas; runner mendahulukan soal, waktu, serta status simpan. Form panjang terbagi menurut pekerjaan, tanpa banner promosi.
- **Frame dan keterbacaan:** tepi panel konsisten; kolom bantuan tidak dipaksa memenuhi tinggi form. Login tidak lagi mempunyai panel putih yang memanjang tanpa isi.
- **Identitas:** logo asli terlihat pada desktop dan header ponsel, marun digunakan pada aksi/pilihan, dan warna status tetap membawa arti tersendiri.
- **Data dan angka:** jumlah berasal dari data server, nol tetap nol, nilai belum tersedia memakai tanda pisah, dan timer/nilai memakai angka tabular. Tidak ada grafik atau klaim statistik tambahan.
- **Ponsel:** menu diuji dengan 18 penekanan Tab dan Escape, peta soal dapat dibuka, dan tabel diuji lewat ArrowRight sampai kolom tindakan terlihat tanpa tertutup kolom identitas.
- **Review gambar:** contact sheet ketiga ukuran dan halaman lanjut diperiksa; login, form soal, runner, menu, serta tabel ponsel juga dibuka pada ukuran penuh. Tidak ditemukan clipping yang belum diselesaikan.

Inspector mempertahankan **29 WARN**: `hero-void` (13) berasal dari layar status, preview singkat, atau data kosong; `unused-canvas` (12) berasal dari kolom baca/form yang dibatasi atau pengukuran tepi teks pada kolom bantuan; `panel-void` (4) mendeteksi sisa lembar utama setinggi viewport pada preview satu soal dan daftar kosong. Ruang tersebut dipertahankan agar frame aplikasi stabil, tanpa menambahkan konten palsu atau meregangkan teks. Seluruh laporan per tampilan memuat pesan lengkapnya.

Tiga WARN pemindaian source juga dipertahankan: monospace hanya dipakai untuk kode/ID, bayangan hanya pada dialog mengambang, dan tanda pisah berasal dari teks antarhalaman serta nilai kosong. Semua ini sesuai pengecualian app-screen pada taste-skill.

Validasi ini memakai akun fixture lokal. Login Google diperiksa pada tautan admission yang ada; tidak ada login provider nyata, deployment, atau perubahan data produksi dalam pekerjaan ini.

# Fetch, cache, dan navigasi Socratic

Implementasi 24 Oktober 2026. Target di bawah adalah gate pengujian, bukan jaminan performa hosting yang belum diukur.

## Arsitektur dan kontrak

Halaman workspace merender shell dan skeleton terlebih dahulu. Data menggunakan `GET /api/views/{view}` dengan allowlist di `src/lib/views.ts`. DTO berbeda untuk ringkasan, daftar, detail, editor, preview, monitoring, audit, dan hasil; aplikasi tidak lagi mengambil `/api/workspace` untuk merender halaman. Endpoint workspace lama tetap kompatibel untuk konsumen lama.

Daftar menerima `page` (mulai 1) dan `q` (maksimum 100 karakter); ukuran halaman tetap 50. Daftar memakai urutan waktu pembuatan/ID yang stabil. Audit dan kejadian diurutkan terbaru terlebih dahulu. Pencarian memakai substring literal dan debounce 300 ms. Formulir soal menyimpan ID dan ringkasan soal yang dipilih saat berganti halaman; editor awal hanya memuat soal yang dipilih berdasarkan ID. Pilihan kelas dan pengawas juga dipaginasi. Daftar kelas hanya membawa ringkasan dan jumlah anggota; email anggota dimuat lewat view `class` setelah kelas dibuka. Formulir editor kelas dipasang saat baris dibuka dan dipertahankan setelah ditutup, sehingga daftar tidak memasang 50 editor tersembunyi.

Validasi Auth API dilakukan di Route Handler. Handler memvalidasi `getUser()` satu kali dan memperbarui cookie respons bila perlu. Satu `school_request` service-only menjalankan admission/profil aktif, rate limit, dan operasi. Pengecekan izin database, idempotency, epoch, revision, deadline, dan transaksi ujian dipertahankan. Pencatatan rate limit berada di luar savepoint operasi agar kegagalan bisnis tetap dihitung. Metrik agregat tetap dicatat setelah respons, sehingga ada RPC metrik tambahan di luar jalur kritis.

Baseline struktural jalur API lama: dua panggilan Auth dan tiga RPC bisnis terpisah (admission, limiter, operasi), ditambah metrik asinkron. Jalur API baru untuk sesi valid: satu panggilan Auth dan satu RPC bisnis, ditambah metrik asinkron. Pembaruan token kedaluwarsa dapat memerlukan panggilan refresh tambahan. Render dokumen/RSC memakai `getClaims()` pada proxy; signing key simetris dapat memerlukan validasi jaringan tambahan. Klaim satu Auth berlaku untuk API data, bukan seluruh request dokumen.

Pemeriksaan kesiapan memakai waktu server dan izin fullscreen dari DTO aturan ujian yang sama. Peralihan ke pemeriksaan memuat ulang view tersebut tanpa mengambil workspace atau membuat waterfall permintaan akomodasi.

Media dalam respons attempt ditandatangani sekali melalui `createSignedUrls()` untuk path unik setelah izin attempt diverifikasi. Endpoint unggahan, akses media terpisah, dan impor menggunakan dispatcher yang sama. Ukuran file, pembatasan tipe, whitelist, serta idempotency impor tetap diberlakukan.

## Kebijakan cache

- TanStack Query v5, hanya di memori, dipisahkan menurut pengguna, peran, view, ID, pencarian, dan halaman.
- Pengelolaan: fresh 30 detik, garbage collection lima menit. Data fresh dipakai tanpa fetch ulang; data stale ditampilkan bersama status pembaruan sambil direvalidasi.
- Ujian aktif, dashboard siswa, aturan/status attempt, monitoring, kejadian, penilaian, dan hasil tidak memakai cache pengelolaan. Mutasi ujian tidak dibatalkan saat komponen berubah.
- Satu retry hanya untuk pembacaan dengan gangguan jaringan/5xx. Tidak ada retry otomatis untuk 401/403/409/422/429 atau mutasi.
- Perubahan soal membatalkan bank soal, pilihan soal, editor/preview dan ringkasan; kelas/peserta membatalkan daftar/detail/pilihan kelas dan ujian terkait; ujian membatalkan daftar/detail/editor/peserta/ringkasan; akun membatalkan akun/undangan/pengawas; pengaturan membatalkan pengaturan/aturan; penilaian dan rilis membatalkan hasil/monitoring/penilaian.
- Respons soal lengkap boleh memperbarui detail sebelum invalidasi. Perubahan lain tidak menebak DTO lengkap dari respons parsial.
- Pencarian/paginasi mempertahankan tampilan daftar sebelumnya hanya untuk pengguna, peran, dan view yang sama sambil menampilkan status pembaruan. Input tetap terpasang agar keyboard mobile tidak tertutup saat menunggu respons. Pergantian resource tidak menggunakan placeholder data resource lain.
- Logout menghapus cache dan membatalkan pembacaan; BroadcastChannel menyinkronkan logout dan invalidasi antartab. Respons server menyertakan identitas/peran viewer untuk mendeteksi pergantian akun/peran. Pengecekan identitas dilakukan saat kembali ke aplikasi setelah 30 detik tanpa validasi.
- Shell rute memakai client cache Next.js 30 detik melalui `experimental.staleTimes.dynamic` pada versi Next.js yang dipin proyek. Ini cache segmen halaman di browser, bukan cache profil server; view live tetap dimuat ulang. Opsi ini masih berstatus eksperimental menurut dokumentasi Next.js terpasang dan perlu diuji kembali saat upgrade. Prefetch viewport otomatis dinonaktifkan pada tautan workspace agar puluhan tautan baris tidak menambah pekerjaan saat daftar dirender.
- Prefetch kode/data pengelolaan saat hover/fokus atau menu mobile dibuka, maksimum dua fetch data bersamaan. Mode hemat data menonaktifkan prefetch tambahan.
- Monitoring 10 detik dan kesehatan 30 detik berhenti saat tab tersembunyi. Query yang sama tidak berjalan tumpang tindih; heartbeat mempertahankan interval 30 detik dengan guard in-flight.

`Server-Timing` melaporkan durasi Auth, database, dan penandatanganan media pada API utama. Performance Entries browser (saat tampilan dikomit ke DOM) `socratic:navigation-visual` dan `socratic:navigation-data` mengukur sejak navigasi dipilih. Metrik tidak berisi token, isi jawaban, atau teks pencarian.

## Pengukuran lokal

Benchmark SQL memakai PostgreSQL embedded dengan 10.000 soal, 1.000 kelas, dan 1.000 ujian; 50 sampel per view. Ini bukan latensi jaringan atau hasil beban produksi.

| View | p95 SQL + driver embedded | Respons |
|---|---:|---:|
| Bank soal | 100,0 ms | 10.441 byte |
| Kelas | 7,2 ms | 7.140 byte |
| Ujian | 14,1 ms | 15.194 byte |
| Ringkasan pengajar | 14,9 ms | 1.875 byte |

Workspace lama pada dataset yang sama berukuran 7.786.162 byte. Halaman bank soal mengurangi payload sekitar 99,87%. EXPLAIN ANALYZE pada query daftar terarah menggunakan `questions_owner_page`, `classes_owner_page`, dan `exams_owner_page`; eksekusi query daftar contoh sekitar 0,82 / 0,48 / 0,58 ms. Durasi fungsi view di tabel mencakup hitungan total, izin, dan JSON sehingga lebih besar daripada query daftar saja.

Reproduksi:

```powershell
node scripts/benchmark-scoped-sql.mjs
npx playwright test --config playwright.performance.config.ts
```

Laporan rinci disimpan di `.local/performance/scoped-sql.json` dan `.local/performance/navigation-production.json`. Benchmark browser membangun Next.js production dan menggunakan fixture lokal (tambahan 1.000 soal, 100 kelas, 500 akun, 100 ujian). Throttling: RTT 150 ms, unduh 10 Mbps, unggah 1 Mbps, CPU 4×. Minimum 50 sampel warm tiap alur yang diukur. Sampel pertama per view dilaporkan terpisah, tetapi server sudah berjalan dan login telah dilakukan; ini bukan pengukuran cold start instance hosting. Perbandingan endpoint workspace kompatibel mengukur payload; keduanya memakai pipeline Auth baru, sehingga bukan baseline historis latensi.

Target p95: visual 100 ms, data warm 1.000 ms, read API 700 ms, save 1.000 ms, reset 2.000 ms. Build development tidak dipakai untuk menyatakan target ini tercapai.

### Hasil build produksi lokal

Laporan akhir: `docs/FETCH_PERFORMANCE.json` (24 Oktober 2026). Semua gate lokal lulus untuk alur yang diukur. Angka navigasi berikut memakai 50 sampel per rute dan dihitung per rute, bukan hanya gabungan:

| Rute | p95 tampilan/skeleton | p95 data siap |
|---|---:|---:|
| Bank soal | 83,4 ms | 663,2 ms |
| Kelas | 54,3 ms | 464,5 ms |
| Ujian | 41,3 ms | 888,4 ms |
| Gabungan, 150 navigasi | 58,4 ms | 744,4 ms |

Sembilan view API baca memiliki p95 187,0–237,4 ms (50 sampel per view). P95 save 200,0 ms dan reset 205,1 ms (masing-masing 50 sampel). Ini hanya fixture lokal dengan throttling yang dijelaskan di atas; latensi Auth/database/storage hosted belum terwakili.

Pengukuran awal implementasi sebelum pengurangan pekerjaan render mencatat p95 data navigasi gabungan 1.146,7 ms. Pemisahan editor kelas, pengendalian prefetch, cache shell rute, dan konteks navigasi yang stabil menurunkannya menjadi 744,4 ms pada run akhir. Ini pembandingan iterasi implementasi lokal, bukan baseline historis aplikasi produksi. Stabilitas callback navigasi mencegah perubahan state menu merender ulang seluruh tautan tabel.

## Cakupan validasi

TypeScript dan ESLint lulus. Seluruh 89 tes unit/database lulus, termasuk penerapan semua migrasi pada database terisolasi, pembatasan peran, redaksi kunci, paginasi, deduplikasi, pembatalan, invalidasi, serta rate limit yang tetap tercatat setelah operasi gagal.

Regresi browser dijalankan dalam beberapa run terfokus: cache fresh/stale, pencarian dengan respons ditahan, Back/Forward, navigasi cepat kembali ke halaman awal, logout antartab, akun dinonaktifkan, perubahan peran, detail kelas saat dibuka, penghapusan, impor, publikasi–pemeriksaan perangkat–submit–monitor/CSV, autosave/reset/offline, serta penilaian dan rilis esai. Pemeriksaan counter fixture memastikan satu Auth dan satu RPC bisnis pada satu pembacaan API. Tampilan bank soal, kelas, dan editor diperiksa pada 390, 768, dan 1440 piksel.

Benchmark browser mencakup sembilan view baca (50 sampel tiap view), tiga rute pengelolaan (50 navigasi tiap rute), 50 save, dan 50 reset. Gate navigasi diterapkan per rute, selain ringkasan gabungan. Angka ini tidak menggantikan uji beban concurrent atau pengukuran login, cold start hosting, impor besar, ekspor, dan storage hosted.

## Rilis dan pengukuran hosted

1. Terapkan migrasi tambahan `202610240013_scoped_reads.sql` ke staging, lalu jalankan smoke test aplikasi baru. Jangan mengedit migrasi lama.
2. Deploy aplikasi setelah migrasi tersedia. Rollback aplikasi tetap dapat memakai `school_api` lama; jangan menghapus fungsi/index baru saat rollback.
3. Bandingkan metrik per operasi, payload, error, dan waktu navigasi pada akun staging yang berbeda. Jalankan pembacaan 5 → 50 → 500 peserta melalui `tests/load/navigation.js`, lalu suite ujian/reset/burst submit yang sudah ada pada `tests/load/exam.js`.
4. `CONFIRM_STAGING=yes`, `BASE_URL`, dan `USERS_FILE` wajib. Set `VUS` sesuai tahap; sediakan cookie akun berbeda untuk setiap virtual user. Skrip baca menerima `role` opsional pada fixture pengguna; default peserta. Jangan menyimpan cookie di Git atau menjalankan beban di produksi tanpa persetujuan tersendiri.
5. Setelah target staging terpenuhi, tinjau deployment produksi dan observasi `Server-Timing`, latensi Auth/RPC, error, dan integritas finalisasi.

Metadata Supabase yang dibaca pada 24 Oktober 2026 menunjukkan region `ap-southeast-2`. Region fungsi Vercel belum dapat diverifikasi: checkout tidak terhubung ke proyek Vercel dan `vercel.json` belum menetapkan region. Jangan menyatakan region sudah selaras. Periksa region fungsi sebenarnya sebelum rilis dan siapkan penyelarasan ke region yang dekat database bila diperlukan.

Checkout belum memiliki `.local/load-users.json` dan runtime k6 tidak terdeteksi saat pemeriksaan. Uji beban hosted 5/50/500 serta target latensi Vercel–Supabase masih memerlukan lingkungan staging dan akun pengujian yang sesuai. Tidak ada migrasi database hosted, deployment, atau perubahan infrastruktur yang dijalankan oleh validasi lokal ini.

## Pemulihan situs live — 24 Oktober 2026

Setelah source optimasi terdeploy, halaman live gagal karena database masih mencatat migrasi 1–12. Pemeriksaan read-only mengonfirmasi `public.school_request` dan `private.school_view` belum tersedia. Migrasi tambahan `202610240013_scoped_reads.sql` kemudian diterapkan ke Supabase dan schema cache PostgREST dimuat ulang.

Verifikasi setelah pemulihan: 13 migrasi tercatat; RPC sensitif tetap server-only; RLS, finalizer, retensi, dan bucket privat tetap sesuai. Login akun dummy admin/pengajar/siswa berhasil. Sebanyak 13 pembacaan API lintas tiga peran mendapat HTTP 200; tujuh halaman admin dibuka melalui navigasi browser tanpa error JavaScript. Laporan tanpa kredensial tersedia lokal di `.local/scoped-live-recovery.json`.

`npm run supabase:check` kini gagal dengan exit code 1 bila RPC migrasi 13 belum tersedia, termasuk ketika RPC inti lama masih ada. `vercel.json` menjalankan pemeriksaan ini sebelum build pada deployment berikutnya. Jalankan migrasi yang tertinggal dari lingkungan pengelolaan sebelum deploy; Personal Access Token tetap tidak diperlukan di Vercel. Dua regresi pemeriksaan kesiapan (skema lama ditolak/skema baru diterima) lulus.

Pemulihan ini memvalidasi fungsi situs live. Angka benchmark di atas tetap hasil fixture lokal; uji kapasitas 500 peserta, cold start hosting, dan target p95 hosted belum dilakukan.

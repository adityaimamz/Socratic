# Rencana implementasi Safe Exam Web

## Keputusan

MVP satu lembaga, Bahasa Indonesia, Asia/Jakarta, Next.js App Router, TypeScript strict, Tailwind CSS, Node.js 24, npm, Supabase Auth/PostgreSQL/storage privat. Login Google atau email/password dengan undangan, email terverifikasi, dan role database. Tidak menggunakan database PostgreSQL atau Docker lokal untuk runtime.

Mode Exam mereset seluruh jawaban pada kejadian pertama `visibility_hidden` yang diterima saat attempt aktif. Reset mempertahankan sesi, urutan soal, serta deadline dan kembali ke soal pertama. Episode berikutnya kembali mereset. Keluar fullscreen saja dicatat; mode Quiz tidak mereset jawaban.

## Tahapan dan bukti

| Tahap | Implementasi | Gate |
| --- | --- | --- |
| 1. Setup dan identitas | Next.js, Supabase SSR, Google callback, undangan, role, bootstrap admin | Migrasi dan undangan hosted siap; login Google nyata menunggu provider dikonfigurasi pemilik akun |
| 2. Pembuatan ujian | Kelas, peserta, bank pilgan/esai/media privat, editor, jadwal, preview, publish snapshot immutable | SQL dan UI diuji; perubahan bank tidak mengganti snapshot |
| 3. Mesin ujian | Start/resume, deadline server, urutan persisten, autosave, revision, epoch, idempotency, heartbeat, sesi tunggal | Refresh, penolakan sesi/epoch lama dan batas waktu diuji |
| 4. Reset ketat | Visibility listener, reset transaksional, antrean offline, modal, submit/receipt, grading server | Sepuluh jawaban kosong setelah satu insiden; retry tidak menggandakan reset; nilai ditahan |
| 5. Operasional pengajar | Monitoring, timeline, review, approve takeover, perpanjangan waktu, retake | Otorisasi dan hasil final tidak dapat diubah diuji |
| 6. Hasil/administrasi | Rilis nilai/pembahasan, CSV aman, audit, retensi, pengaturan, akomodasi fullscreen | Kunci hanya tersedia sesuai role dan kebijakan rilis; fungsi database server-only |
| 7. Validasi/pilot | Vitest SQL, Playwright, pemeriksaan hosted dan visual, skenario k6 | Uji 500 peserta, restore, alert eksternal, pilot, dan deployment masih harus dilaksanakan sebelum peluncuran umum |

## Kontrak konsistensi

- Browser peserta melalui Next.js. Server memverifikasi identitas sesi dan status akun, lalu memanggil RPC service-only dengan identitas aktor tersebut.
- Start/save/reset/takeover/submit/finalisasi menggunakan transaksi dan row lock attempt. Save membawa `operation_id`, `expected_revision`, `answer_epoch`, dan `session_id`.
- Reset menghapus jawaban dan penanda review serta riwayat operasi jawaban, menaikkan epoch, dan mencatat metadata insiden dalam satu transaksi. Tidak ada pemulihan jawaban melalui aplikasi.
- Antrean offline dibatasi attempt, sesi, dan epoch. Insiden tertunda diproses sebelum jawaban/submit. ACK lama diabaikan.
- Event duplikat memakai ID yang sama. Event terlambat setelah finalisasi hanya dicatat untuk review.
- Kode domain termasuk `ANSWER_EPOCH_MISMATCH`, `STALE_SESSION`, `REVISION_CONFLICT`, dan `ATTEMPT_FINALIZED` memandu pemuatan ulang/pemulihan UI. Deadline diperiksa pada setiap operasi; attempt kedaluwarsa difinalisasi sebelum perubahan dipertimbangkan.
- Cron finalisasi setiap 10 detik dengan batch terbatas dan `SKIP LOCKED`. Keterlambatan scheduler tidak memberi waktu menjawab tambahan.

## Pengujian dan peluncuran

Gate wajib meliputi akses lintas peserta/pengajar, kerahasiaan kunci, save/reset/submit/deadline, retry/event duplikat/episode kedua, refresh dan offline, sesi paralel, hasil ditahan, CSV, serta akomodasi aksesibilitas.

Profil beban: 500 peserta dan 100 soal, burst reset/submit. Target save API p95 ≤1 detik, ACK reset p95 ≤2 detik, finalisasi deadline ≤60 detik. Skrip k6 disediakan; target belum dinyatakan tercapai sebelum pengukuran staging.

Deployment ditargetkan Vercel dengan Supabase staging/produksi terpisah. Kredensial berada pada environment, tidak di dokumen. Pilot dimulai setelah login nyata dan pemeriksaan akses/konsistensi lulus. Peluncuran umum memerlukan uji beban, restore teruji, serta notifikasi kegagalan save/submit dan backlog finalisasi yang sudah dikonfigurasi.

## Perluasan yang diminta pengguna

Esai sudah mencakup authoring, rubrik privat, autosave teks, reset seluruh jawaban campuran, koreksi manual atomik, status menunggu, dan rilis hasil. Login email/password ditambahkan agar Google tidak menjadi prasyarat penggunaan awal. Lihat [ESSAY.md](ESSAY.md) dan [EMAIL_PASSWORD.md](EMAIL_PASSWORD.md).

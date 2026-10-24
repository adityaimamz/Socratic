export const messages: Record<string, string> = {
  QUESTION_IN_USE: "Soal ini masih dipakai dalam ujian. Lepaskan dari draft terlebih dahulu. Untuk soal yang sudah dipakai ujian terbit, gunakan Arsip agar riwayat tetap tersedia.",
  CLASS_IN_USE: "Kelas ini masih terhubung ke ujian. Lepaskan kelas dari draft atau hapus draft tersebut terlebih dahulu. Kelas yang dipakai ujian terbit harus dipertahankan.",
  DRAFT_ONLY: "Hanya ujian berstatus draft yang dapat dihapus. Ujian yang sudah diterbitkan beserta riwayatnya tetap dipertahankan.",
  EXAM_HAS_ATTEMPTS: "Draft ini memiliki sesi peserta dan tidak dapat dihapus. Hubungi admin untuk memeriksa riwayatnya.",
  ORIGIN_NOT_ALLOWED: "Alamat halaman ini tidak sesuai dengan alamat aplikasi yang diizinkan. Buka tautan resmi dari sekolah atau lembaga. Jika tetap gagal, minta bantuan pengajar.",
  NETWORK_ERROR: "Internet belum tersambung ke sistem ujian. Periksa sambungan, lalu coba lagi.",
  SERVER_ERROR: "Sistem ujian sedang bermasalah. Coba lagi sebentar. Jika tetap gagal, minta bantuan pengajar.",
  INVALID_RESPONSE: "Jawaban dari sistem belum bisa dibaca. Coba lagi sebentar. Jika tetap gagal, minta bantuan pengajar.",
  SETUP_REQUIRED: "Layanan ujian belum siap digunakan. Minta pengajar menghubungi pengelola sekolah atau lembaga.",
  PAYLOAD_TOO_LARGE: "Data yang dikirim terlalu besar. Kurangi ukuran data atau gambar, lalu coba lagi.",
  AUTH_FAILED: "Email atau kata sandi tidak sesuai, atau akun belum terdaftar. Periksa isian dan email pengaktifan akun di kotak masuk atau spam. Jika lupa kata sandi, pilih Lupa kata sandi. Jika tetap gagal, minta bantuan pengajar.",
  RECOVERY_SESSION_EXPIRED: "Tautan untuk mengganti kata sandi sudah tidak berlaku. Pilih Lupa kata sandi di halaman masuk, lalu buka tautan terbaru dari email.",
  UNAUTHORIZED: "Silakan masuk kembali.", FORBIDDEN: "Akun ini tidak diizinkan melakukan tindakan tersebut.", NOT_FOUND: "Data tidak ditemukan atau tidak dapat diakses.",
  INVITATION_REQUIRED: "Akunmu belum terdaftar. Beri tahu pengajar email yang kamu gunakan untuk masuk.", ACCOUNT_DISABLED: "Akun ini dinonaktifkan. Minta pengajar memeriksa akunmu.",
  EXAM_NOT_OPEN: "Ujian belum dibuka atau jadwalnya sudah berakhir. Periksa jadwal ujian.", STALE_SESSION: "Ujian masih terbuka di halaman atau perangkat lain. Buka kembali di sana, atau minta bantuan pengawas untuk pindah perangkat.",
  ANSWER_EPOCH_MISMATCH: "Semua jawaban telah dihapus sesuai aturan ujian. Membuka soal kembali.", REVISION_CONFLICT: "Jawaban yang tersimpan berbeda. Tunggu sampai soal terbuka kembali, lalu periksa dan isi ulang jawabanmu.",
  ATTEMPT_FINALIZED: "Ujian sudah selesai. Jawaban tidak dapat diubah.", DEADLINE_PASSED: "Waktu ujian telah habis.", ATTEMPT_LIMIT: "Kesempatan mengerjakan sudah digunakan. Hubungi pengajar jika perlu mengulang.",
  REVIEW_TOO_EARLY: "Pembahasan hanya dapat dirilis setelah seluruh jendela ujian dan tambahan waktu selesai.",
  EXAM_IMMUTABLE: "Ujian sudah diterbitkan. Isi dan aturan tidak dapat diubah.", INVALID_QUESTION: "Periksa soal, opsi, dan kunci jawaban.",
  INVALID_EXAM: "Ujian membutuhkan 1–100 soal dan jadwal yang masih berlaku.", INVALID_ANSWER: "Pilihan jawaban tidak sesuai dengan soal.",
  REASON_REQUIRED: "Tulis alasan tindakan, minimal 5 karakter.", CANNOT_EDIT_SELF: "Anda tidak dapat mengubah hak akses akun sendiri.",
  RETAKE_NOT_ALLOWED: "Retake memerlukan ujian selesai dan pembahasan belum dirilis.", RATE_LIMITED: "Terlalu banyak permintaan. Tunggu sebentar dan coba lagi.",
  NO_TAKEOVER_REQUEST: "Belum ada permintaan untuk melanjutkan di perangkat atau halaman lain.", IDEMPOTENCY_CONFLICT: "Permintaan ini tidak sesuai dengan perubahan sebelumnya. Tunggu sebentar, lalu coba lagi. Jika tetap gagal saat ujian, minta bantuan pengawas.",
  GRADING_PENDING: "Masih ada esai yang menunggu penilaian. Selesaikan penilaian sebelum menerbitkan hasil.", GRADE_FINALIZED: "Penilaian sudah difinalisasi dan tidak dapat diubah.", INVALID_GRADE: "Lengkapi skor setiap esai antara nol dan bobot soal. Jawaban kosong harus bernilai nol.", ATTEMPT_ACTIVE: "Peserta masih mengerjakan. Penilaian tersedia setelah ujian selesai."
};
export class ApiError extends Error { constructor(public code: string, message?: string, public status = 400) { super(message ?? messages[code] ?? "Permintaan gagal. Silakan coba lagi."); } }
export function scoreAnswers(items: {id: string; weight: number; correctOptionId: string}[], answers: Record<string, {optionId: string | null}>, penalty: number) {
  let raw = 0, total = 0, correct = 0, wrong = 0, empty = 0;
  for (const item of items) { total += item.weight; const option = answers[item.id]?.optionId; if (!option) empty++; else if (option === item.correctOptionId) { correct++; raw += item.weight; } else { wrong++; raw -= penalty; } }
  return { score: Math.round(Math.max(0, Math.min(100, total ? 100 * raw / total : 0)) * 100) / 100, correct, wrong, empty };
}
export function csvCell(value: unknown) { let s = String(value ?? ""); if (/^[\s]*[=+@\-\t\r]/.test(s)) s = "'" + s; return '"' + s.replaceAll('"', '""') + '"'; }
export function formatDate(value: string) { return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(value)); }
export function remaining(deadline: string, serverNow: string) { return Math.max(0, Math.ceil((Date.parse(deadline) - Date.parse(serverNow)) / 1000)); }
export function hasAnswer(answer?: {optionId?: string | null; text?: string | null}) { return Boolean(answer?.optionId || answer?.text?.trim()); }

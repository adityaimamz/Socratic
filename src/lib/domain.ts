export const messages: Record<string, string> = {
  ORIGIN_NOT_ALLOWED: "Alamat halaman ini tidak sesuai dengan alamat aplikasi yang diizinkan. Buka tautan resmi dari lembaga. Jika tetap gagal, minta admin memeriksa pengaturan alamat aplikasi.",
  NETWORK_ERROR: "Tidak dapat terhubung ke layanan. Periksa koneksi internet, lalu coba lagi.",
  SERVER_ERROR: "Layanan sedang mengalami gangguan. Coba lagi beberapa saat. Jika berulang, hubungi admin lembaga.",
  INVALID_RESPONSE: "Respons layanan tidak dapat dibaca. Coba lagi beberapa saat. Jika berulang, hubungi admin lembaga.",
  SETUP_REQUIRED: "Layanan belum siap digunakan. Hubungi admin lembaga untuk menyelesaikan konfigurasi aplikasi.",
  PAYLOAD_TOO_LARGE: "Data yang dikirim terlalu besar. Kurangi ukuran data atau gambar, lalu coba lagi.",
  AUTH_FAILED: "Email atau password tidak sesuai, atau akun belum mendapat akses. Periksa email dan password, verifikasi email melalui kotak masuk atau spam, lalu coba lagi. Gunakan Lupa password jika diperlukan; hubungi admin untuk memastikan undangan akun.",
  RECOVERY_SESSION_EXPIRED: "Sesi pemulihan tidak tersedia atau sudah berakhir. Buka Lupa password di halaman masuk untuk meminta tautan baru, lalu gunakan tautan terbaru dari email.",
  UNAUTHORIZED: "Silakan masuk kembali.", FORBIDDEN: "Anda tidak memiliki akses untuk tindakan ini.", NOT_FOUND: "Data tidak ditemukan atau tidak dapat diakses.",
  INVITATION_REQUIRED: "Akun Anda belum terdaftar. Hubungi admin lembaga menggunakan email akun yang sama.", ACCOUNT_DISABLED: "Akun ini dinonaktifkan. Hubungi admin lembaga untuk memeriksa akses Anda.",
  EXAM_NOT_OPEN: "Ujian belum dibuka atau waktu mulai sudah berakhir.", STALE_SESSION: "Ujian sedang dibuka pada sesi lain. Ajukan perpindahan sesi.",
  ANSWER_EPOCH_MISMATCH: "Jawaban telah direset. Memuat keadaan terbaru.", REVISION_CONFLICT: "Jawaban berubah pada server. Silakan pilih jawaban lagi setelah sinkronisasi.",
  ATTEMPT_FINALIZED: "Ujian sudah selesai. Jawaban tidak dapat diubah.", DEADLINE_PASSED: "Waktu ujian telah habis.", ATTEMPT_LIMIT: "Kesempatan ujian sudah digunakan.",
  REVIEW_TOO_EARLY: "Pembahasan hanya dapat dirilis setelah seluruh jendela ujian dan tambahan waktu selesai.",
  EXAM_IMMUTABLE: "Ujian sudah diterbitkan. Isi dan aturan tidak dapat diubah.", INVALID_QUESTION: "Periksa soal, opsi, dan kunci jawaban.",
  INVALID_EXAM: "Ujian membutuhkan 1–100 soal dan jadwal yang masih berlaku.", INVALID_ANSWER: "Pilihan jawaban tidak sesuai dengan soal.",
  REASON_REQUIRED: "Tulis alasan tindakan, minimal 5 karakter.", CANNOT_EDIT_SELF: "Anda tidak dapat mengubah hak akses akun sendiri.",
  RETAKE_NOT_ALLOWED: "Retake memerlukan ujian selesai dan pembahasan belum dirilis.", RATE_LIMITED: "Terlalu banyak permintaan. Tunggu sebentar dan coba lagi.",
  NO_TAKEOVER_REQUEST: "Belum ada permintaan perpindahan sesi.", IDEMPOTENCY_CONFLICT: "Identitas operasi telah dipakai untuk perubahan lain.",
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

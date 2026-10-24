import Link from "next/link";
import { Brand,Header } from "@/components/ui";
import { ExamRules } from "@/components/exam-rules";
export default function Privacy(){return <main className="setup" id="main">
 <Brand/><Header title="Data pribadi & aturan ujian" description="Baca aturan, aktivitas yang dicatat, dan cara meminta bantuan."/>
 <section className="panel stack">
  <h2>Data apa yang disimpan?</h2>
  <p>Aplikasi menyimpan nama dan email akun, kelas, jawaban, waktu pengerjaan, serta catatan aktivitas ujian. Kamera, mikrofon, dan rekaman layar tidak digunakan.</p>
  <ExamRules mode="exam"/>
  <h2>Bagaimana dengan kuis?</h2>
  <p>Pada kuis, meninggalkan halaman ujian tetap dicatat, tetapi tidak menghapus jawaban secara otomatis. Layar penuh tidak diwajibkan. Ikuti petunjuk pengajar tentang bahan yang boleh dibuka.</p>
  <h2>Siapa yang bisa melihat?</h2>
  <p>Kamu hanya bisa membuka ujian dan hasil milikmu. Pengajar dan pengawas yang ditugaskan serta pengelola sekolah atau lembaga dapat melihat hasil dan catatan aktivitas untuk meninjau pelaksanaan ujian.</p>
  <h2>Berapa lama data disimpan?</h2>
  <p>Lama penyimpanan mengikuti pengaturan sekolah atau lembaga. Jumlah harinya ditampilkan pada pemeriksaan sebelum mulai ujian. Pengaturan awalnya adalah 365 hari untuk hasil, 90 hari untuk catatan aktivitas, dan 365 hari untuk catatan tindakan pengelola.</p>
  <h2>Perlu bantuan tentang data?</h2>
  <p>Hubungi pengajar atau pengelola sekolah jika ingin bertanya tentang data pribadi atau mengajukan peninjauan kejadian selama ujian.</p>
 </section><Link href="/dashboard" className="btn">Kembali ke ujian saya</Link>
</main>}

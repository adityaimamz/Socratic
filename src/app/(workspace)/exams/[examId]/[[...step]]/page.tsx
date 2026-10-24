import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { workspace } from "@/lib/server";
import { formatDate } from "@/lib/domain";
import { Header,Badge,Notice } from "@/components/ui";
import { StartExam } from "@/components/start-exam";
import { ExamRules } from "@/components/exam-rules";
export default async function ExamDetail({params}:{params:Promise<{examId:string;step?:string[]}>}){
 const {examId,step}=await params;const w=await workspace();const e=w.exams.find(e=>e.id===examId);if(!e)notFound();const a=w.attempts.filter(a=>a.exam_id===e.id).at(-1);const active=a?.status==="in_progress"?a:undefined;
 return <>
  <Link className="crumb" href="/dashboard"><ArrowLeft size={14}/>Ujian saya</Link>
  <Header title={e.title} description={`${e.question_count} soal · ${e.duration_minutes} menit · Jadwal dalam WIB`} action={<Badge tone={e.mode==="exam"?"warning":"neutral"}>{e.mode==="exam"?"Ujian ketat":"Kuis"}</Badge>}/>
  <div className="columns"><section className="panel stack">
   <h2>Petunjuk dari pengajar</h2>
   <p style={{whiteSpace:"pre-wrap"}}>{e.instructions||"Baca setiap soal dengan teliti. Untuk pilihan ganda, pilih satu jawaban. Untuk esai, ketik jawabanmu pada kolom yang tersedia."}</p>
   <div className="row-list">{[{label:"Mulai tersedia (WIB)",value:formatDate(e.opens_at)},{label:"Jadwal berakhir (WIB)",value:formatDate(e.closes_at)},{label:"Nilai minimum lulus",value:`${e.passing_score} dari 100`},{label:"Pengurangan per pilihan ganda salah",value:e.penalty>0?`${e.penalty} poin dari jumlah poin yang diperoleh`:"Tidak ada"}].map(x=><div className="row" key={x.label}><span className="muted">{x.label}</span><span className="num">{x.value}</span></div>)}</div>
   <p className="small">Jawaban kosong mendapat 0 poin. Pilihan ganda yang benar mendapat poin sesuai bobot soal. Esai dinilai pengajar. Jumlah poin dibandingkan dengan jumlah bobot seluruh soal untuk menghitung nilai akhir pada skala 0–100.</p>
   <Notice title="Perhatikan batas waktu">Untuk ujian baru, waktu pengerjaan mengikuti durasi ujian atau sisa jadwal, mana yang lebih singkat. Contoh: durasi 60 menit, tetapi jadwal berakhir 20 menit lagi, berarti waktu pengerjaan hanya 20 menit. Jika ujian sudah dimulai, waktu tetap berjalan meskipun kamu menutup halaman.</Notice>
   <ExamRules mode={e.mode}/>
   {a?.status==="finalized"&&<Link className="btn" href={`/results/${a.id}`}>Lihat bukti dan hasil ujian terakhir</Link>}
  </section><aside>{step?.[0]==="check"?<StartExam exam={e} settings={w.settings} activeAttempt={active}/>:<section className="panel stack"><h2>{active?"Lanjutkan ujianmu":"Siap mengerjakan?"}</h2><p>{active?"Waktu ujianmu masih berjalan. Periksa perangkat, lalu lanjutkan dengan sisa waktu yang tersedia.":"Baca petunjuk dan aturan di halaman ini, lalu periksa perangkatmu. Membaca aturan dan memeriksa perangkat belum memulai waktu ujian."}</p><Link className="btn primary" href={`/exams/${e.id}/check`}>{active?"Periksa dan lanjutkan":"Periksa kesiapan"}</Link><Link className="link" href="/privacy">Data pribadi dan aturan ujian</Link></section>}</aside></div>
 </>;
}

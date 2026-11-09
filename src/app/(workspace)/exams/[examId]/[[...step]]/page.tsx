"use client";
import Link from "@/components/navigation-link";

import { ArrowLeft } from "lucide-react";
import {RemoteView} from "@/components/remote-view";
import {use} from "react";
import { formatDate } from "@/lib/domain";
import { Header,Badge,Notice } from "@/components/ui";
import { StartExam } from "@/components/start-exam";
import { ExamRules } from "@/components/exam-rules";
export default function ExamDetail({params}:{params:Promise<{examId:string;step?:string[]}>}){
 const {examId,step}=use(params);return <RemoteView key={step?.[0]??"rules"} view="exam-rules" params={{id:examId}}>{w=>{
 const e=w.exam;
 const attempt=w.attempts.at(-1);
 const now=Date.parse(w.server_now);
 const active=attempt?.status==="in_progress"&&Date.parse(attempt.deadline_at)>now?attempt:undefined;
 const result=attempt&&!active?attempt:undefined;
 const startsLater=e.status==="published"&&!e.review_released&&now<Date.parse(e.opens_at);
 const windowOpen=e.status==="published"&&!e.review_released&&!startsLater&&now<Date.parse(e.closes_at);
 const remaining=w.attempts_remaining??(attempt?0:1);
 const canStart=windowOpen&&remaining>0&&attempt?.status!=="in_progress";
 const canCheck=Boolean(active)||canStart;
 const retake=canStart&&result?.status==="finalized";
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
  </section><aside>
   {canCheck&&step?.[0]==="check"?<StartExam exam={e} settings={w.settings} activeAttempt={active} serverNow={w.server_now} fullscreenExempt={w.fullscreen_exempt} retake={retake}/>:<section className="panel stack">
    <h2>{active?"Lanjutkan ujianmu":retake?"Kesempatan ulang tersedia":canStart?"Siap mengerjakan?":result?"Ujian selesai":startsLater?"Ujian belum dibuka":"Akses mulai ditutup"}</h2>
    {active?<p>Waktu ujianmu masih berjalan. Periksa perangkat, lalu lanjutkan dengan sisa waktu yang tersedia.</p>
     :retake?<p>Pengajar memberi kesempatan untuk mengerjakan kembali. Hasil ujian sebelumnya tetap tersedia.</p>
     :canStart?<p>Baca petunjuk dan periksa perangkatmu. Waktu baru berjalan saat kamu menekan Mulai ujian.</p>
     :result&&windowOpen&&result.status==="finalized"?<p>Jawabanmu sudah dikumpulkan. Jika perlu mengerjakan lagi, minta kesempatan ulang kepada pengajar.</p>
     :startsLater?<p>Ujian bisa dimulai pada {formatDate(e.opens_at)} WIB.</p>:!result&&<p>Peserta sudah tidak dapat memulai ujian ini.</p>}
    {canCheck&&<Link className="btn primary" href={`/exams/${e.id}/check`}>{active?"Periksa dan lanjutkan":"Periksa kesiapan"}</Link>}
    {result&&<Link className={`btn${canCheck?"":" primary"}`} href={`/results/${result.id}`}>Lihat bukti dan hasil ujian terakhir</Link>}
    <Link className="link" href="/privacy">Data pribadi dan aturan ujian</Link>
   </section>}
  </aside></div>
 </>;
}}</RemoteView>;}

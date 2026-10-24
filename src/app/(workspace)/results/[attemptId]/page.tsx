import Link from "next/link";
import {notFound} from "next/navigation";
import {CheckCircle2} from "lucide-react";
import {requireProfile,rpc} from "@/lib/server";
import {formatDate} from "@/lib/domain";
import type {ExamResult} from "@/lib/types";
import {Header,Notice,Stats,statusLabel} from "@/components/ui";

export default async function Result({params}:{params:Promise<{attemptId:string}>}){
 const {attemptId}=await params;const p=await requireProfile();
 const r=await rpc<ExamResult>(p,"attempt.result",{id:attemptId}).catch(()=>null);if(!r)notFound();
 const pending=r.receipt.grading_status==="pending";
 return <>
  <Header title="Ujian telah diterima" description="Bukti penerimaan dari server. Simpan ID ini jika perlu menghubungi pengawas." action={<CheckCircle2 color="var(--positive)" size={26}/>}/>
  <div className="columns result-layout"><div className="stack">
   <section className="panel receipt-panel"><h2>Bukti penerimaan</h2><div className="row-list">
    {[{label:"Nomor bukti",value:r.receipt.receipt_id},{label:"Diterima pada",value:formatDate(r.receipt.finalized_at)},{label:"Penyelesaian",value:statusLabel[r.receipt.reason]},{label:"ID sesi",value:attemptId}].map(x=><div className="row" key={x.label}><span className="muted">{x.label}</span><span className={x.label.includes("ID")||x.label.includes("Nomor")?"mono":"num"} style={{overflowWrap:"anywhere",textAlign:"right"}}>{x.value}</span></div>)}
   </div></section>
   {pending?<Notice tone="warning" title="Menunggu penilaian esai">Jawaban sudah diterima. Pengajar perlu menilai {r.receipt.essay_count} soal esai sebelum nilai akhir tersedia.</Notice>:r.score_released?<section className="panel">
    <div className="panel-header"><h2>Hasil penilaian</h2><span className="badge">{Number(r.receipt.score)>=r.passing_score?"Lulus":"Belum lulus"}</span></div>
    <div className="result-score">{r.receipt.score}<span className="small"> / 100</span></div>
    <Stats items={[{label:"Pilgan benar",value:r.receipt.correct_count??0},{label:"Pilgan salah",value:r.receipt.wrong_count??0},{label:"Soal kosong",value:r.receipt.empty_count??0}]}/>
    {r.receipt.essay_count>0&&<p className="small">Skor esai: {r.receipt.essay_points} poin · {r.receipt.essay_count} soal dinilai</p>}
    <p className="small">Nilai lulus: {r.passing_score}</p>
   </section>:<Notice>Nilai belum diterbitkan pengajar. Bukti penerimaan tetap tersedia.</Notice>}
   {r.score_released&&r.essay_grades.length>0&&<section className="panel stack"><h2>Penilaian esai</h2>{r.essay_grades.map((g,i)=><div key={g.item_id}><h3>{i+1}. {g.prompt}</h3><p className="small" style={{marginTop:8}}>Skor {g.points} / {g.max_points} poin</p><p style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere",marginTop:8}}>{g.feedback||"Tidak ada komentar tambahan."}</p></div>)}</section>}
   {r.review_released&&<section className="panel stack"><h2>Pembahasan jawaban</h2>{r.review.map((q,i)=><div key={q.id}><h3>{i+1}. {q.prompt}</h3>{q.kind==="essay"?<><p className="essay-response">{r.answers[q.id]?.text||"Jawaban kosong."}</p><p style={{whiteSpace:"pre-wrap",marginTop:12}}>Pedoman: {q.rubric||"Tidak ada pedoman tambahan."}</p></>:<><p className="small" style={{marginTop:8}}>Jawaban Anda: {q.options.find(o=>o.id===r.answers[q.id]?.optionId)?.text??"Kosong"}</p><p className="small">Kunci: {q.options.find(o=>o.id===q.correctOptionId)?.text}</p></>}</div>)}</section>}
  </div><aside className="panel stack"><h2>Langkah berikutnya</h2><p>{pending?"Tunggu pengajar menyelesaikan penilaian, lalu buka kembali halaman ini.":"Hubungi pengajar untuk peninjauan aktivitas atau kesempatan ulang. Hasil akhir mengikuti keputusan lembaga."}</p><Link className="btn" href="/dashboard">Kembali ke ujian saya</Link></aside></div>
 </>;
}

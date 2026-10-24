"use client";
import {useRef,useState} from "react";
import {useRouter} from "next/navigation";
import {api} from "@/lib/client";
import {hasAnswer} from "@/lib/domain";
import type {GradingView,EssayGrade} from "@/lib/types";
import {Notice} from "./ui";

export function EssayGrading({data}:{data:GradingView}){
 const router=useRouter();const [busy,setBusy]=useState(false),[error,setError]=useState("");
 const operation=useRef<{id:string;payload:string}|null>(null);
 const complete=data.grading_status==="complete";
 async function submit(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();const form=new FormData(e.currentTarget);
  const grades:EssayGrade[]=data.items.map(item=>({item_id:item.id,points:Number(form.get(`points-${item.id}`)),feedback:String(form.get(`feedback-${item.id}`)??"").trim()}));
  const payload=JSON.stringify(grades);if(operation.current?.payload!==payload)operation.current={id:crypto.randomUUID(),payload};
  if(!window.confirm("Finalisasi seluruh skor esai? Skor tidak dapat diubah setelah diterima server."))return;
  setBusy(true);setError("");try{await api(`manage/attempts/${data.attempt_id}/grading`,{operation_id:operation.current!.id,grades});router.refresh();}catch(e){setError(e instanceof Error?e.message:"Penilaian gagal disimpan. Coba lagi.");}finally{setBusy(false);}
 }
 if(!data.items.length)return <Notice>Ujian ini tidak memiliki soal esai.</Notice>;
 return <form className="stack" onSubmit={e=>void submit(e)}>
  <Notice tone={complete?"success":"warning"} title={complete?"Penilaian esai selesai":"Menunggu penilaian pengajar"}>{complete?`Nilai akhir ${data.score} / 100. Nilai peserta mengikuti kebijakan rilis ujian.`:"Isi skor semua esai dari 0 sampai bobot soal. Jawaban kosong bernilai nol. Finalisasi mengunci seluruh skor sekaligus."}</Notice>
  {data.items.map((item,index)=>{const answer=data.answers[item.id],grade=data.grades.find(g=>g.item_id===item.id),blank=!hasAnswer(answer);return <section className="panel stack" key={item.id}>
   <div className="panel-header" style={{marginBottom:0}}><h2>Esai {index+1}</h2><span className="small num">Skor maksimum {item.weight}</span></div>
   <p className="question-preview">{item.prompt}</p>
   {item.media_path&&<img className="media" src={`/api/media?path=${encodeURIComponent(item.media_path)}`} alt="Ilustrasi soal"/>}
   <div><h3>Jawaban peserta</h3><p className="essay-response">{blank?"Tidak ada jawaban.":answer.text}</p></div>
   <details className="grading-rubric"><summary>Rubrik penilaian</summary><p style={{whiteSpace:"pre-wrap",marginTop:12}}>{item.rubric||"Tidak ada rubrik tambahan. Gunakan bobot soal sebagai skor maksimum."}</p></details>
   <div className="field-grid"><div className="field"><label htmlFor={`points-${item.id}`}>Skor esai {index+1} (0–{item.weight})</label><input id={`points-${item.id}`} name={`points-${item.id}`} type="number" min={0} max={blank?0:item.weight} step="0.01" required defaultValue={grade?.points??(blank?0:"")} readOnly={complete||blank} disabled={busy}/>{blank&&<small>Jawaban kosong: skor 0.</small>}</div><div className="field"><label htmlFor={`feedback-${item.id}`}>Komentar esai {index+1}</label><textarea id={`feedback-${item.id}`} name={`feedback-${item.id}`} maxLength={1000} defaultValue={grade?.feedback??""} readOnly={complete} disabled={busy}/><small>Ditampilkan kepada peserta saat nilainya dirilis.</small></div></div>
  </section>})}
  {error&&<Notice tone="error" title="Penilaian belum tersimpan">{error}</Notice>}
  {!complete&&<div className="actions"><button className="btn primary" disabled={busy}>{busy?"Menyimpan penilaian…":"Finalisasi penilaian esai"}</button><span className="small">Skor dan komentar belum tersimpan sebelum finalisasi.</span></div>}
 </form>;
}

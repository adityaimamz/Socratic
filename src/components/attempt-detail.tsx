"use client";
import type {ReactNode} from "react";
import {useQuery} from "@tanstack/react-query";
import {Notice,Badge} from "./ui";
import {Modal} from "./modal";
import {useViewer,viewOptions} from "./data-provider";

export function AttemptDetail({id,onClose}:{id:string;onClose:()=>void}){
 const query=useQuery({...viewOptions(useViewer(),"attempt-detail",{id}),refetchInterval:15000,refetchIntervalInBackground:false});
 const frame=(title:string,body:ReactNode)=><Modal titleId="attempt-detail-title" onCancel={onClose} className="attempt-modal"><div className="panel-header" style={{marginBottom:0}}><h2 id="attempt-detail-title" style={{margin:0}}>{title}</h2><button className="btn small" onClick={onClose}>Tutup</button></div>{body}</Modal>;
 if(query.error&&!query.data)return frame("Detail jawaban",<Notice tone="error">{query.error.message}</Notice>);
 if(!query.data)return frame("Detail jawaban",<p role="status" style={{margin:"16px 0 0"}}>Memuat detail jawaban…</p>);
 const {name,items,answers}=query.data;
 const mcq=items.filter(i=>i.kind!=="essay"&&i.correctOptionId);
 const correct=mcq.filter(i=>answers[i.id]?.optionId===i.correctOptionId).length,empty=mcq.filter(i=>!answers[i.id]?.optionId).length;
 return frame(`Detail jawaban · ${name}`,<div className="stack" style={{marginTop:16}}>
  <p className="small" style={{margin:0}}>Pilihan ganda: <strong>{correct} benar</strong> · {mcq.length-correct-empty} salah · {empty} kosong. Urutan soal dan huruf pilihan sama seperti yang dilihat peserta.</p>
  <ol className="stack" style={{listStyle:"none",padding:0,margin:0}}>{items.map((item,n)=>{
   const a=answers[item.id],essay=item.kind==="essay",chosen=a?.optionId??null,right=!essay&&chosen===item.correctOptionId;
   return <li key={item.id} className="panel" style={{padding:16}}>
    <div className="actions" style={{justifyContent:"space-between"}}><strong>Soal {n+1}</strong>{essay?<Badge>Esai · dinilai manual</Badge>:!chosen?<Badge>Tidak dijawab</Badge>:right?<Badge tone="positive">Benar</Badge>:<Badge tone="negative">Salah</Badge>}</div>
    <p style={{whiteSpace:"pre-wrap"}}>{item.prompt}</p>
    {essay?<blockquote style={{whiteSpace:"pre-wrap",margin:0}}>{a?.text||<span className="muted">Tidak ada jawaban.</span>}</blockquote>
    :<ul className="stack" style={{listStyle:"none",padding:0,margin:0}}>{item.options.map((o,i)=>{
     const isKey=o.id===item.correctOptionId,isChosen=o.id===chosen;
     return <li key={o.id} className="answer-option" style={{cursor:"default",borderColor:isKey?"var(--positive)":isChosen?"var(--error)":undefined,background:isKey?"var(--success-bg)":isChosen?"var(--error-bg)":undefined}}>
      <span className="answer-letter">{String.fromCharCode(65+i)}</span><span style={{flex:1}}>{o.text}</span>
      {isKey&&<Badge tone="positive">Jawaban benar</Badge>}{isChosen&&<Badge tone={isKey?"positive":"negative"}>{isKey?"Dipilih peserta":"Dipilih peserta (salah)"}</Badge>}
     </li>;})}</ul>}
   </li>;})}</ol>
 </div>);
}

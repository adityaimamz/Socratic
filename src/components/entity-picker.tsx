"use client";
import {useEffect,useId,useState} from "react";
import {useQuery} from "@tanstack/react-query";
import {viewOptions,useViewer} from "./data-provider";
import {Notice} from "./ui";
import type {QuestionSummary,ClassOption} from "@/lib/views";
import type {Profile} from "@/lib/types";
function usePicker(){const [value,setValue]=useState(""),[q,setQ]=useState(""),[page,setPage]=useState(1);useEffect(()=>{const t=setTimeout(()=>{setQ(value);setPage(1);},300);return()=>clearTimeout(t);},[value]);return {value,setValue,q,page,setPage};}
function PickerControls({picker,total,label}:{picker:ReturnType<typeof usePicker>;total:number;label:string}){const id=useId();return <div className="stack picker-controls"><div className="field"><label htmlFor={id}>{label}</label><input id={id} type="search" value={picker.value} onChange={e=>picker.setValue(e.target.value)}/></div><div className="actions"><button className="btn small" type="button" disabled={picker.value!==picker.q||picker.page<=1} onClick={()=>picker.setPage(picker.page-1)}>Sebelumnya</button><span className="small">Halaman {picker.page} · {total} data</span><button className="btn small" type="button" disabled={picker.value!==picker.q||picker.page*50>=total} onClick={()=>picker.setPage(picker.page+1)}>Berikutnya</button></div></div>;}
export function QuestionPicker({selected,onChange,initial}:{selected:string[];onChange:(ids:string[])=>void;initial:QuestionSummary[]}){
 const picker=usePicker(),query=useQuery(viewOptions(useViewer(),"question-selection",{page:picker.page,q:picker.q}));
 const [known,setKnown]=useState(()=>new Map(initial.map(q=>[q.id,q])));
 const rows=query.data?.items??[];
 function select(q:QuestionSummary,checked:boolean){setKnown(previous=>new Map(previous).set(q.id,q));onChange(checked?[...selected,q.id]:selected.filter(id=>id!==q.id));}
 return <div className="stack"><PickerControls picker={picker} total={query.data?.total??0} label="Cari soal atau tag"/>{query.error&&<Notice tone="error">{query.error.message}</Notice>}{query.isPending&&<p role="status">Memuat pilihan soal…</p>}<div className="selection-list">{rows.map(q=><label key={q.id}><input type="checkbox" checked={selected.includes(q.id)} disabled={!selected.includes(q.id)&&selected.length>=100} onChange={e=>select(q,e.target.checked)}/><span>{q.prompt}<small>{q.kind==="essay"?"Esai":"Pilgan"} · {q.tag||"Tanpa tag"} · bobot {q.weight} · versi {q.version}</small></span></label>)}{query.data&&!rows.length&&<p style={{padding:16}}>Tidak ada soal aktif yang cocok.</p>}</div>{selected.length>0&&<details><summary>Soal terpilih · {selected.length}</summary><div className="row-list">{selected.map(id=><div className="row" key={id}><span>{known.get(id)?.prompt??rows.find(q=>q.id===id)?.prompt??"Soal terpilih"}</span><button type="button" className="text-btn" onClick={()=>onChange(selected.filter(q=>q!==id))}>Lepaskan</button></div>)}</div></details>}</div>;
}
export function ClassPicker({initial}:{initial:ClassOption|null}){
 const picker=usePicker(),query=useQuery(viewOptions(useViewer(),"class-options",{page:picker.page,q:picker.q})),[chosen,setChosen]=useState<ClassOption|null>(initial);
 const rows=query.data?.items??[],options=chosen&&!rows.some(c=>c.id===chosen.id)?[chosen,...rows]:rows;
 return <div className="field"><PickerControls picker={picker} total={query.data?.total??0} label="Cari kelas peserta"/><label htmlFor="class_id">Kelas peserta</label><select id="class_id" name="class_id" value={chosen?.id??""} onChange={e=>setChosen(options.find(c=>c.id===e.target.value)??null)}><option value="">Tanpa kelas · email langsung</option>{options.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>{query.error&&<Notice tone="error">{query.error.message}</Notice>}</div>;
}
export function StaffPicker({selected,onChange,initial}:{selected:string[];onChange:(ids:string[])=>void;initial:Pick<Profile,"id"|"name">[]}){
 const picker=usePicker(),query=useQuery(viewOptions(useViewer(),"teachers",{page:picker.page,q:picker.q}));
 const rows=[...initial.filter(p=>!query.data?.items.some(x=>x.id===p.id)),...(query.data?.items??[])];
 return <div className="stack"><PickerControls picker={picker} total={query.data?.total??0} label="Cari pengajar"/>{query.error&&<Notice tone="error">{query.error.message}</Notice>}{rows.map(u=><label className="check" key={u.id}><input type="checkbox" checked={selected.includes(u.id)} onChange={e=>onChange(e.target.checked?[...selected,u.id]:selected.filter(id=>id!==u.id))}/>{u.name}</label>)}</div>;
}

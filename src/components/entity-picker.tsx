"use client";
import {useEffect,useId,useState} from "react";
import {useQuery,useQueryClient} from "@tanstack/react-query";
import {viewOptions,useViewer} from "./data-provider";
import {Notice} from "./ui";
import type {QuestionSummary,ClassOption,QuestionFolder} from "@/lib/views";
import type {Profile} from "@/lib/types";
function usePicker(){const [value,setValue]=useState(""),[q,setQ]=useState(""),[page,setPage]=useState(1);useEffect(()=>{const t=setTimeout(()=>{setQ(value);setPage(1);},300);return()=>clearTimeout(t);},[value]);return {value,setValue,q,page,setPage};}
function PickerControls({picker,total,label}:{picker:ReturnType<typeof usePicker>;total:number;label:string}){const id=useId();return <div className="stack picker-controls"><div className="field"><label htmlFor={id}>{label}</label><input id={id} type="search" value={picker.value} onChange={e=>picker.setValue(e.target.value)}/></div><div className="actions"><button className="btn small" type="button" disabled={picker.value!==picker.q||picker.page<=1} onClick={()=>picker.setPage(picker.page-1)}>Sebelumnya</button><span className="small">Halaman {picker.page} · {total} data</span><button className="btn small" type="button" disabled={picker.value!==picker.q||picker.page*50>=total} onClick={()=>picker.setPage(picker.page+1)}>Berikutnya</button></div></div>;}
export function QuestionPicker({selected,onChange,initial}:{selected:string[];onChange:(ids:string[])=>void;initial:QuestionSummary[]}){
 const picker=usePicker(),query=useQuery(viewOptions(useViewer(),"question-selection",{page:picker.page,q:picker.q}));
 const [known,setKnown]=useState(()=>new Map(initial.map(q=>[q.id,q])));
 const rows=query.data?.items??[];
 function select(q:QuestionSummary,checked:boolean){setKnown(previous=>new Map(previous).set(q.id,q));onChange(checked?[...selected,q.id]:selected.filter(id=>id!==q.id));}
 const remember=(items:QuestionSummary[])=>setKnown(previous=>{const next=new Map(previous);for(const q of items)next.set(q.id,q);return next;});
 return <div className="stack"><TagPicker selected={selected} onChange={onChange} remember={remember}/><details><summary>Pilih soal satu per satu</summary><div className="stack" style={{marginTop:12}}><PickerControls picker={picker} total={query.data?.total??0} label="Cari soal atau tag"/>{query.error&&<Notice tone="error">{query.error.message}</Notice>}{query.isPending&&<p role="status">Memuat pilihan soal…</p>}<div className="selection-list">{rows.map(q=><label key={q.id}><input type="checkbox" checked={selected.includes(q.id)} disabled={!selected.includes(q.id)&&selected.length>=100} onChange={e=>select(q,e.target.checked)}/><span>{q.prompt}<small>{q.kind==="essay"?"Esai":"Pilgan"} · {q.tag||"Tanpa tag"} · bobot {q.weight} · versi {q.version}</small></span></label>)}{query.data&&!rows.length&&<p style={{padding:16}}>Tidak ada soal aktif yang cocok.</p>}</div></div></details>{selected.length>0&&<details><summary>Soal terpilih · {selected.length}</summary><div className="row-list">{selected.map(id=><div className="row" key={id}><span>{known.get(id)?.prompt??rows.find(q=>q.id===id)?.prompt??"Soal terpilih"}</span><button type="button" className="text-btn" onClick={()=>onChange(selected.filter(q=>q!==id))}>Lepaskan</button></div>)}</div></details>}</div>;
}
const noTag="__none__",limit=100;
function TagPicker({selected,onChange,remember}:{selected:string[];onChange:(ids:string[])=>void;remember:(items:QuestionSummary[])=>void}){
 const viewer=useViewer(),client=useQueryClient(),query=useQuery(viewOptions(viewer,"question-folders",{})),[amounts,setAmounts]=useState<Record<string,string>>({}),[busy,setBusy]=useState(""),[error,setError]=useState("");
 async function items(f:QuestionFolder){const d=await client.fetchQuery(viewOptions(viewer,"question-folder-items",{folder:f.key||noTag}));remember(d.items);return d.items;}
 async function add(f:QuestionFolder){
  setBusy(f.key||noTag);setError("");
  try{
   const all=await items(f),fresh=all.filter(q=>!selected.includes(q.id)),want=Math.max(1,Math.min(Number(amounts[f.key||noTag])||f.count,f.count)),have=all.length-fresh.length,take=Math.min(Math.max(0,want-have),fresh.length,limit-selected.length);
   const pool=take<fresh.length?[...fresh].sort(()=>Math.random()-.5):fresh;
   onChange([...selected,...pool.slice(0,take).map(q=>q.id)]);
   if(selected.length+take>=limit&&take<Math.min(want-have,fresh.length))setError(`Maksimal ${limit} soal per ujian.`);
  }catch(e){setError(e instanceof Error?e.message:"Soal belum bisa dimuat.");}finally{setBusy("");}
 }
 async function remove(f:QuestionFolder){setBusy(f.key||noTag);setError("");try{const ids=new Set((await items(f)).map(q=>q.id));onChange(selected.filter(id=>!ids.has(id)));}catch(e){setError(e instanceof Error?e.message:"Soal belum bisa dimuat.");}finally{setBusy("");}}
 if(query.error)return <Notice tone="error">{query.error.message}</Notice>;
 if(!query.data)return <p role="status">Memuat tag soal…</p>;
 if(!query.data.folders.length)return <p className="small">Belum ada soal aktif.</p>;
 return <div className="stack"><p className="small" style={{margin:0}}>Pilih soal per tag. Isi jumlah bila hanya ingin mengambil sebagian soal secara acak dari tag itu.</p>{error&&<Notice tone="error">{error}</Notice>}<ul className="row-list" style={{listStyle:"none",padding:0,margin:0}}>{query.data.folders.map(f=>{const id=f.key||noTag;return <li className="row" key={id}><span><strong>{f.key?f.tag:"Tanpa tag"}</strong><small style={{display:"block"}}>{f.count} soal</small></span><span className="actions"><label className="sr-only" htmlFor={`take-${id}`}>Jumlah soal dari {f.key?f.tag:"Tanpa tag"}</label><input id={`take-${id}`} type="number" min={1} max={Math.min(f.count,limit)} placeholder={String(Math.min(f.count,limit))} value={amounts[id]??""} onChange={e=>setAmounts(prev=>({...prev,[id]:e.target.value}))} style={{width:84}}/><button type="button" className="btn small" disabled={busy===id||selected.length>=limit} onClick={()=>void add(f)}>Tambah</button><button type="button" className="btn small" disabled={busy===id} onClick={()=>void remove(f)}>Lepas semua</button></span></li>;})}</ul></div>;
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

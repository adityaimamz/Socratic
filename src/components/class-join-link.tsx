"use client";
import {useEffect,useId,useState} from "react";
import {api,requestJson} from "@/lib/client";
import {formatDate} from "@/lib/domain";
import type {ClassLinkReply} from "@/lib/class-links";
import {Notice} from "./ui";

export function ClassJoinLink({classId}:{classId:string}){
 const id=useId();
 const [data,setData]=useState<ClassLinkReply|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(""),[copied,setCopied]=useState(false),[revision,setRevision]=useState(0);
 useEffect(()=>{
  const controller=new AbortController();
  void requestJson<ClassLinkReply>("/api/class-links",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({operation:"get",class_id:classId}),signal:controller.signal}).then(setData).catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:"Link belum bisa dimuat.");});
  return ()=>controller.abort();
 },[classId,revision]);
 async function run(input:object){
  setBusy(true);setError("");setCopied(false);
  try{setData(await api<ClassLinkReply>("class-links",{...input,class_id:classId}));}catch(e){setError(e instanceof Error?e.message:"Perubahan belum berhasil.");}finally{setBusy(false);}
 }
 const link=data?.link;
 return <section className="stack class-join-link" aria-labelledby={`${id}-heading`}>
  <div><h3 id={`${id}-heading`}>Link undangan kelas</h3><p className="small">Murid yang membuka link dapat daftar atau masuk, lalu otomatis bergabung sebagai peserta. Bagikan hanya kepada calon anggota kelas.</p></div>
  {error&&<Notice tone="error">{error}</Notice>}
  {!data?<><p role="status">{error?"Data link belum tersedia.":"Memuat link undangan…"}</p>{error&&<button className="btn small" onClick={()=>{setError("");setRevision(v=>v+1);}}>Coba lagi</button>}</>:<>
   {link?<div className="small" role="status">{link.revoked_at?"Link dinonaktifkan":`Berlaku sampai ${formatDate(link.expires_at)}`} · {link.uses} dari {link.max_uses} peserta telah bergabung.</div>:<p className="small">Belum ada link undangan untuk kelas ini.</p>}
   {data.join_url&&<div className="field"><label htmlFor={`${id}-url`}>Link untuk dibagikan</label><input id={`${id}-url`} value={data.join_url} readOnly onFocus={e=>e.currentTarget.select()}/><div className="actions"><button className="btn small" disabled={busy} onClick={async()=>{try{await navigator.clipboard.writeText(data.join_url!);setCopied(true);}catch{setError("Salin link dari kolom di atas secara manual.");}}}>Salin link</button>{copied&&<span className="small" role="status">Link disalin.</span>}</div></div>}
   {link&&!data.join_url&&!link.revoked_at&&<p className="small">Link hanya ditampilkan saat dibuat. Jika belum menyimpannya, buat link baru.</p>}
   <form className="form" onSubmit={e=>{e.preventDefault();if(link&&!link.revoked_at&&!window.confirm("Buat link baru? Link sebelumnya akan langsung tidak berlaku."))return;const f=new FormData(e.currentTarget);void run({operation:"create",days:Number(f.get("days")),limit:Number(f.get("limit"))});}}>
    <div className="form-grid"><div className="field"><label htmlFor={`${id}-days`}>Berlaku selama (hari)</label><input id={`${id}-days`} name="days" type="number" min={1} max={30} defaultValue={7} required disabled={busy}/></div><div className="field"><label htmlFor={`${id}-limit`}>Batas peserta baru</label><input id={`${id}-limit`} name="limit" type="number" min={1} max={1000} defaultValue={40} required disabled={busy}/></div></div>
    <p className="small">Salin link setelah dibuat. Membuat link baru menggantikan link sebelumnya; anggota kelas yang sudah bergabung tetap tersimpan.</p>
    <div className="actions"><button className="btn" disabled={busy}>{busy?"Memproses…":link?"Buat link baru":"Buat link undangan"}</button>{link&&!link.revoked_at&&<button type="button" className="btn danger" disabled={busy} onClick={()=>{if(window.confirm("Nonaktifkan link ini? Anggota kelas yang sudah bergabung tetap tersimpan."))void run({operation:"revoke"});}}>Nonaktifkan link</button>}</div>
   </form>
  </>}
 </section>;
}

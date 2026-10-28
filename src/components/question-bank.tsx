"use client";
import {useSearchParams} from "next/navigation";
import {ArrowLeft,Folder,Plus,Upload} from "lucide-react";
import Link from "@/components/navigation-link";
import {RemoteView,ListControls,useListParams} from "@/components/remote-view";
import {useViewer} from "@/components/data-provider";
import {Header,Empty} from "@/components/ui";
import {ActionButton} from "@/components/forms";
import {DeleteButton} from "@/components/delete-button";
import type {QuestionSummary} from "@/lib/views";

const untagged="__none__";
const folderHref=(key:string,q="")=>`/manage/questions?folder=${encodeURIComponent(key||untagged)}${q?`&q=${encodeURIComponent(q)}`:""}`;

function QuestionTable({items,showFolder}:{items:QuestionSummary[];showFolder:boolean}){
 const profile=useViewer();
 return <><p className="table-hint">Geser tabel untuk melihat kolom lainnya.</p><div className="table-wrap" role="region" aria-label="Tabel data pengelolaan" tabIndex={0}><table><thead><tr><th>Pertanyaan</th>{showFolder&&<th>Mapel</th>}<th className="numeric">Bobot</th><th>Tindakan</th></tr></thead><tbody>{items.map(q=><tr key={q.id}><td className="identity-cell"><Link href={`/manage/questions/${q.id}`} className="row-title">{q.prompt}</Link><small>{q.kind==="essay"?"Esai · penilaian manual":`${q.option_count} pilihan`} · versi {q.version}</small></td>{showFolder&&<td>{q.tag?<Link href={folderHref(q.tag.trim().toLowerCase())}>{q.tag}</Link>:"—"}</td>}<td className="numeric">{q.weight}</td><td><div className="actions"><Link className="btn small" href={`/manage/questions/${q.id}`}>Edit</Link><ActionButton path="questions/archive" payload={{id:q.id}} confirm="Arsipkan soal ini? Versi ujian terbit tetap tersedia.">Arsip</ActionButton>{(profile.role==="admin"||q.owner_id===profile.id)&&<DeleteButton kind="questions" id={q.id} name={q.prompt} small/>}</div></td></tr>)}</tbody></table></div></>;
}

export function QuestionBank(){
 const list=useListParams(),folder=useSearchParams().get("folder")??"";
 const action=<><Link href="/manage/questions/import" className="btn"><Upload size={16}/>Impor soal</Link><Link href="/manage/questions/new" className="btn primary"><Plus size={16}/>Tambah soal</Link></>;
 if(folder)return <RemoteView view="questions" params={{...list,folder}}>{w=><><Link href="/manage/questions" className="crumb"><ArrowLeft size={14}/>Semua mapel</Link><Header title={folder===untagged?"Tanpa mapel":(w.items[0]?.tag||folder)} description="Soal dalam folder ini." action={action}/><ListControls {...w} label="Cari soal di folder ini"/><section className="panel"><div className="panel-header"><h2>{w.total} soal</h2></div>{!w.items.length?<Empty title="Tidak ada soal">{list.q?"Tidak ada soal yang cocok dengan pencarian.":"Folder ini belum berisi soal aktif."}</Empty>:<QuestionTable items={w.items} showFolder={false}/>}</section></>}</RemoteView>;
 if(list.q)return <RemoteView view="questions" params={list}>{w=><><Header title="Bank soal" description="Hasil pencarian di semua folder." action={action}/><ListControls {...w} label="Cari pertanyaan atau mapel"/><section className="panel"><div className="panel-header"><h2>{w.total} soal ditemukan</h2><Link className="text-btn" href="/manage/questions">Kembali ke folder</Link></div>{!w.items.length?<Empty title="Tidak ada soal">Coba kata kunci lain atau kembali ke daftar folder.</Empty>:<QuestionTable items={w.items} showFolder/>}</section></>}</RemoteView>;
 return <RemoteView view="question-folders" params={{}}>{w=><><Header title="Bank soal" description="Soal dikelompokkan per mapel (tag). Buka folder atau cari di semua folder." action={action}/><ListControls total={w.folders.length} page={1} pageSize={Math.max(1,w.folders.length)} label="Cari pertanyaan atau mapel"/><section className="panel"><div className="panel-header"><h2>{w.folders.reduce((n,f)=>n+f.count,0)} soal aktif · {w.folders.length} folder</h2></div>{!w.folders.length?<Empty title="Bank soal masih kosong">Tambahkan pertanyaan pertama untuk mulai menyusun ujian.</Empty>:<ul className="stack" style={{listStyle:"none",padding:0,margin:0}}>{w.folders.map(f=><li key={f.key||untagged}><Link className="btn" style={{width:"100%",justifyContent:"space-between"}} href={folderHref(f.key)}><span><Folder size={16}/> {f.key?f.tag:"Tanpa mapel"}</span><span className="small num">{f.count} soal</span></Link></li>)}</ul>}</section></>}</RemoteView>;
}

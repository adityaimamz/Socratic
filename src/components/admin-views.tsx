"use client";
import {use,useState} from "react";
import {notFound} from "next/navigation";
import {useQuery} from "@tanstack/react-query";
import {formatDate} from "@/lib/domain";
import {Header,Badge,Empty,statusLabel,Notice} from "./ui";
import {InviteForm,SettingsForm,UserControl} from "./forms";
import {HealthPanel} from "./health";
import {RemoteView,ListControls,useListParams} from "./remote-view";
import {viewOptions,useViewer} from "./data-provider";
export default function Admin({params}:{params:Promise<{section:string}>}){
 const {section}=use(params),profile=useViewer(),list=useListParams();if(profile.role!=="admin")notFound();
 if(section==="users")return <RemoteView view="admin-users" params={list}>{w=><>
  <Header title="Akun & undangan" description="Hak akses dikelola lembaga. Login Google tidak memberikan akses secara otomatis."/>
  <ListControls {...w} label="Cari nama atau email"/>
  <div className="columns"><div className="stack"><section className="panel"><h2 style={{marginBottom:20}}>Akun terdaftar · {w.total}</h2><div className="row-list">{w.items.map(p=><div className="row" key={p.id}><div><strong>{p.name}</strong><small>{p.email} · {statusLabel[p.role]}</small></div>{p.id===profile.id?<Badge>Anda</Badge>:<UserControl key={`${p.id}-${p.role}-${p.active}`} id={p.id} role={p.role} active={p.active}/>}</div>)}</div></section><Invitations/></div><aside className="panel"><h2 style={{marginBottom:20}}>Daftarkan akun</h2><InviteForm/></aside></div>
 </>}</RemoteView>;
 if(section==="settings")return <RemoteView view="admin-settings">{w=><><Header title="Pengaturan lembaga" description="Identitas dan kebijakan penyimpanan data."/><div className="columns"><section className="panel"><SettingsForm settings={w.settings}/></section><aside className="stack"><HealthPanel/><section className="panel stack"><h2>Zona waktu</h2><p>Asia/Jakarta (WIB). Jadwal dan hasil memakai zona yang sama.</p><Notice>Konfigurasi OAuth dan secret tetap dikelola pada environment server.</Notice></section></aside></div></>}</RemoteView>;
 if(section==="audit")return <RemoteView view="admin-audit" params={list}>{w=><><Header title="Jejak audit" description="Tindakan petugas dan peristiwa reset terbaru. Jawaban lama tidak disalin ke audit."/><ListControls {...w} label="Cari tindakan"/><section className="panel">{!w.items.length?<Empty title="Belum ada tindakan tercatat">Aktivitas pengelolaan akan muncul setelah digunakan.</Empty>:<><p className="table-hint">Geser tabel untuk melihat kolom lainnya.</p><div className="table-wrap" role="region" aria-label="Tabel jejak audit" tabIndex={0}><table><thead><tr><th>Tindakan</th><th>Pelaku</th><th>Objek</th><th>Waktu (WIB)</th></tr></thead><tbody>{w.items.map(a=><tr key={a.id}><td>{a.action}<small>{JSON.stringify(a.details)}</small></td><td>{a.actor_name??"Sistem"}</td><td className="mono">{a.resource_id?.slice(0,8)??"—"}</td><td>{formatDate(a.created_at)}</td></tr>)}</tbody></table></div></>}</section></>}</RemoteView>;
 notFound();
}
function Invitations(){
 const [page,setPage]=useState(1),query=useQuery(viewOptions(useViewer(),"admin-invitations",{page}));
 return <section className="panel"><h2>Undangan menunggu</h2>{query.error&&<Notice tone="error">{query.error.message}</Notice>}{!query.data?<p role="status">Memuat undangan…</p>:!query.data.total?<Empty title="Tidak ada undangan tertunda">Akun baru akan muncul setelah didaftarkan.</Empty>:<><div className="row-list">{query.data.items.map(i=><div className="row" key={i.email}><div>{i.name||i.email}<small>{i.email}</small></div><Badge>{statusLabel[i.role]}</Badge></div>)}</div><div className="actions"><button className="btn small" disabled={page===1} onClick={()=>setPage(page-1)}>Sebelumnya</button><span className="small">Halaman {page} · {query.data.total} undangan</span><button className="btn small" disabled={page*50>=query.data.total} onClick={()=>setPage(page+1)}>Berikutnya</button></div></>}</section>;
}

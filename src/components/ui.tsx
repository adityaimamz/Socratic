import { ClipboardList, AlertCircle, AlertTriangle, Info, ShieldCheck } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
export function Brand(){return <Link href="/dashboard" className="brand" aria-label="Socratic, beranda"><Image src="/logo.png" alt="Socratic — Question · Reason · Progress" width={512} height={382} sizes="(max-width: 760px) 128px, 192px" loading="eager"/></Link>}
export function Badge({children,tone="neutral"}:{children:React.ReactNode;tone?:string}){return <span className={`badge ${tone}`}><span className="dot"/>{children}</span>}
export function Notice({children,tone="",title,id}:{children:React.ReactNode;tone?:""|"error"|"warning"|"success";title?:string;id?:string}){
 const Icon=tone==="success"?ShieldCheck:tone==="warning"?AlertTriangle:tone==="error"?AlertCircle:Info;
 const heading=title??(tone==="error"?"Tindakan belum berhasil":tone==="warning"?"Perlu diperhatikan":tone==="success"?"Berhasil":undefined);
 return <div id={id} className={`notice ${tone}`} role={tone==="error"?"alert":"status"} aria-atomic="true"><Icon size={18} aria-hidden="true"/><div>{heading&&<strong className="notice-title">{heading}</strong>}<p>{children}</p></div></div>;
}
export function Empty({title,children,action}:{title:string;children:React.ReactNode;action?:React.ReactNode}){return <div className="empty"><ClipboardList size={28}/><h3>{title}</h3><p>{children}</p>{action}</div>}
export function Header({title,description,action}:{title:string;description?:string;action?:React.ReactNode}){return <div className="page-header"><div><h1>{title}</h1>{description&&<p>{description}</p>}</div>{action&&<div className="actions">{action}</div>}</div>}
export function Stats({items}:{items:{label:string;value:string|number}[]}){return <div className="stats">{items.map(i=><div className="stat" key={i.label}><div className="stat-label">{i.label}</div><div className="stat-value">{i.value}</div></div>)}</div>}
export const statusLabel:Record<string,string>={draft:"Draft",published:"Terbit",closed:"Ditutup",archived:"Arsip",in_progress:"Berlangsung",finalized:"Selesai",admin:"Admin",teacher:"Pengajar",student:"Siswa",manual:"Dikirim peserta",deadline:"Waktu habis",staff_termination:"Dihentikan pengawas"};

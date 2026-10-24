"use client";
import { useEffect,useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard,ClipboardList,BookOpen,Users,Settings,FileClock,Menu,X,LogOut,ChevronRight } from "lucide-react";
import type { Profile } from "@/lib/types";
import { Brand,Badge,statusLabel } from "./ui";
import {Modal} from "./modal";

export function Shell({profile,institution,children}:{profile:Profile;institution:string;children:React.ReactNode}){
 const [open,setOpen]=useState(false);const pathname=usePathname();
 const staff=profile.role!=="student";
 useEffect(()=>{const media=matchMedia("(min-width:1101px)");const close=()=>{if(media.matches)setOpen(false);};media.addEventListener("change",close);return()=>media.removeEventListener("change",close);},[]);
 const links=staff?[{href:"/manage",label:"Ringkasan",icon:LayoutDashboard},{href:"/manage/exams",label:"Ujian",icon:ClipboardList},{href:"/manage/questions",label:"Bank soal",icon:BookOpen},{href:"/manage/classes",label:"Kelas & peserta",icon:Users}]:[{href:"/dashboard",label:"Ujian saya",icon:ClipboardList}];
 if(profile.role==="admin")links.push({href:"/admin/users",label:"Akun & undangan",icon:Users},{href:"/admin/settings",label:"Pengaturan",icon:Settings},{href:"/admin/audit",label:"Jejak audit",icon:FileClock});
 const navigation=<><Brand/><nav className="nav" aria-label="Navigasi utama"><div className="nav-title">Ruang {staff?"pengajar":"siswa"}</div>{links.map(l=>{const active=pathname===l.href||l.href!=="/manage"&&pathname.startsWith(l.href+"/");return <Link key={l.href} href={l.href} onClick={()=>setOpen(false)} className={active?"active":""} aria-current={active?"page":undefined}><l.icon size={17}/>{l.label}</Link>;})}</nav><div className="sidebar-bottom"><div className="account"><span className="avatar" aria-hidden="true">{profile.name.slice(0,2).toUpperCase()}</span><div><strong>{profile.name}</strong><small style={{display:"block"}}>{statusLabel[profile.role]}</small></div></div><form action="/auth/logout" method="post" onSubmit={()=>{sessionStorage.removeItem("safe-exam-session");indexedDB.deleteDatabase("safe-exam-pending");}}><button className="text-btn actions"><LogOut size={14}/>Keluar</button></form></div></>;
 return <div className="shell"><aside className="sidebar">{navigation}</aside>{open&&<Modal titleId="navigation-title" className="navigation-modal" onCancel={()=>setOpen(false)}><div className="sidebar-content"><h2 className="sr-only" id="navigation-title">Navigasi Socratic</h2><button className="btn navigation-close" onClick={()=>setOpen(false)} aria-label="Tutup navigasi"><X size={18}/></button>{navigation}</div></Modal>}<div className="workspace"><header className="topbar"><div className="actions"><button className="btn small mobile-menu" onClick={()=>setOpen(true)} aria-label="Buka navigasi" aria-expanded={open} aria-haspopup="dialog"><Menu size={18}/></button><div className="mobile-brand"><Brand/></div><span>{institution}</span><ChevronRight size={13}/><span className="small">{staff?"Pengelolaan ujian":"Ruang siswa"}</span></div><Badge>WIB · Asia/Jakarta</Badge></header><main className="sheet" id="main">{children}</main></div></div>;
}

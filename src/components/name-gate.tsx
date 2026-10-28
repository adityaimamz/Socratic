"use client";
import {useState} from "react";
import {useRouter} from "next/navigation";
import {api} from "@/lib/client";
import type {Profile} from "@/lib/types";
import {Header,Notice} from "./ui";

export function NameGate({profile}:{profile:Profile}){
 const router=useRouter();
 const [name,setName]=useState(profile.name===profile.email?"":profile.name),[error,setError]=useState(""),[busy,setBusy]=useState(false);
 async function save(event:React.FormEvent){
  event.preventDefault();setError("");setBusy(true);
  try{await api("profile/name",{name});router.refresh();}
  catch(e){setError(e instanceof Error?e.message:"Nama belum tersimpan.");setBusy(false);}
 }
 return <form className="panel stack" onSubmit={save} style={{maxWidth:520,margin:"48px auto"}}>
  <Header title="Isi nama lengkap" description="Nama ini dipakai pengajar untuk mencatat hasil ujianmu. Isi sesuai nama di absen sebelum mulai mengerjakan."/>
  {error&&<Notice tone="error" title="Belum tersimpan">{error}</Notice>}
  <div className="field"><label htmlFor="full-name">Nama lengkap</label><input id="full-name" value={name} onChange={e=>setName(e.target.value)} minLength={3} maxLength={100} required autoFocus autoComplete="name"/></div>
  <button className="btn primary" disabled={busy||name.trim().length<3}>{busy?"Menyimpan…":"Simpan dan lanjutkan"}</button>
 </form>;
}

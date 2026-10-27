"use client";
import {useEffect,useRef,useState} from "react";
import {useRouter} from "next/navigation";
import Link from "next/link";
import {api} from "@/lib/client";
import {Notice} from "./ui";

export function JoinClass({token}:{token:string}){
 const router=useRouter(),started=useRef(false);
 const [error,setError]=useState(""),[busy,setBusy]=useState(true);
 async function join(){
  setError("");setBusy(true);
  try{await api("class-links",{operation:"join",token});router.replace("/dashboard");router.refresh();}
  catch(e){setError(e instanceof Error?e.message:"Belum berhasil bergabung.");setBusy(false);}
 }
 useEffect(()=>{if(!started.current){started.current=true;void join();}},[]);
 return <div className="stack">{busy?<p role="status">Memasukkan akunmu ke kelas…</p>:<><Notice tone="error" title="Belum bisa bergabung">{error}</Notice><button className="btn primary" onClick={()=>void join()}>Coba bergabung lagi</button><Link className="btn" href="/login">Gunakan akun lain</Link><Link className="link" href="/dashboard">Kembali ke ruang ujian</Link></>}</div>;
}

"use client";
import { useEffect,useState } from "react";
import { useRouter } from "next/navigation";
import { Play,CheckCircle2 } from "lucide-react";
import { api,claimSession } from "@/lib/client";
import type { Attempt,AttemptSummary,Settings } from "@/lib/types";
import type {StudentExam} from "@/lib/views";
import { Notice } from "./ui";
export function StartExam({exam,settings,activeAttempt,serverNow,fullscreenExempt}:{exam:StudentExam;settings:Settings;activeAttempt?:AttemptSummary;serverNow:string;fullscreenExempt:boolean}){
 const [accepted,setAccepted]=useState(false),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(""),[fullscreen,setFullscreen]=useState(false),[remaining,setRemaining]=useState<number|null>(null);const [exempt,setExempt]=useState(false);const router=useRouter();
 useEffect(()=>{setFullscreen(document.fullscreenEnabled);setExempt(fullscreenExempt);sessionStorage.setItem(`safe-exam-fullscreen-exempt:${exam.id}`,String(fullscreenExempt));setReady(true);const available=(Date.parse(activeAttempt?.deadline_at??exam.closes_at)-Date.parse(serverNow))/60000;setRemaining(Math.max(0,activeAttempt?available:Math.min(exam.duration_minutes,available)));},[exam.id,exam.closes_at,exam.duration_minutes,activeAttempt?.deadline_at,serverNow,fullscreenExempt]);
 async function start(){setBusy(true);setError("");try{if(exam.mode==="exam"&&!exempt){if(!fullscreen)throw new Error("Perangkat ini belum bisa membuka layar penuh. Gunakan komputer atau minta bantuan pengawas.");try{await document.documentElement.requestFullscreen();}catch{throw new Error("Layar penuh belum bisa dibuka. Tekan tombol mulai atau lanjutkan sekali lagi. Jika tetap gagal, minta bantuan pengawas.");}}const a=await api<Attempt>(`exams/${exam.id}/attempts`,{session_id:await claimSession()});router.push(a.status==="finalized"?`/results/${a.id}`:`/attempts/${a.id}`);}catch(e){setError(e instanceof Error?e.message:"Ujian belum dapat dimulai.");if(document.fullscreenElement)await document.exitFullscreen().catch(()=>{});setBusy(false);}}
 return <div className="panel stack">
  <h2>{activeAttempt?"Sebelum melanjutkan":"Pemeriksaan sebelum mulai"}</h2>
  <p>{activeAttempt?"Waktu ujianmu sudah berjalan. Melanjutkan ujian tidak mengulang waktu dari awal.":"Waktu mulai berjalan saat ujian dibuka. Tekan Mulai ujian hanya jika kamu sudah siap."}</p>
  <div className="row-list">
   <div className="row"><span>Sambungan ke sistem ujian</span><span className="actions small">{ready&&<CheckCircle2 size={16}/>} {ready?"Terhubung":error?"Belum terhubung":"Memeriksa…"}</span></div>
   <div className="row"><span>Layar penuh</span><span className="small">{exam.mode==="quiz"?"Tidak wajib":exempt?"Tidak diwajibkan pengawas":fullscreen?"Bisa digunakan":"Belum bisa digunakan"}</span></div>
   <div className="row"><span>{activeAttempt?"Perkiraan sisa waktu":"Perkiraan waktu pengerjaan"}</span><span className="num">{remaining===null?"Memeriksa…":remaining<=0?"Waktu habis":remaining<1?"Kurang dari 1 menit":`Sekitar ${Math.floor(remaining)} menit`}</span></div>
  </div>
  {exam.mode==="exam"&&<Notice tone="warning" title="Keluar halaman, jawaban dihapus">Termasuk jawaban yang sudah tersimpan. Waktu tetap berjalan. Baca aturan ujian ketat di halaman ini sebelum melanjutkan.</Notice>}
  {exam.mode==="exam"&&exempt&&<Notice title="Izin tanpa layar penuh">Pengawas mengizinkanmu mengerjakan tanpa layar penuh. Aturan penghapusan jawaban saat meninggalkan halaman ujian tetap berlaku.</Notice>}
  <p className="small">Nama, email, jawaban, waktu, dan aktivitas ujian dicatat. Hasil disimpan {settings.result_retention_days} hari, catatan aktivitas {settings.event_retention_days} hari, dan catatan tindakan pengelola {settings.audit_retention_days} hari sesuai pengaturan sekolah atau lembaga. Kamera, mikrofon, dan rekaman layar tidak digunakan.</p>
  <p className="small">Perkiraan ini dihitung saat halaman dibuka. Waktu yang tersedia bisa berkurang jika kamu menunggu sebelum mulai.</p>
  <label className="check"><input type="checkbox" checked={accepted} onChange={e=>setAccepted(e.target.checked)}/>Saya sudah membaca aturan, memahami aktivitas yang dicatat{exam.mode==="exam"?", aturan penghapusan jawaban,":","} dan batas waktu ujian.</label>
  {error&&<Notice tone="error" title="Ujian belum dapat dibuka">{error} {!ready&&<button type="button" className="text-btn" onClick={()=>window.location.reload()}>Periksa ulang</button>}</Notice>}
  <button className="btn primary" onClick={()=>void start()} disabled={!ready||!accepted||busy}><Play size={16}/>{busy?"Membuka ujian…":activeAttempt?"Lanjutkan ujian":"Mulai ujian"}</button>
 </div>;
}

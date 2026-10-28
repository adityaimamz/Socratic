import {Notice} from "./ui";

export function ScoreFormula(){
 return <details className="panel" style={{padding:16}}><summary>Cara menghitung nilai</summary><div className="stack" style={{marginTop:12}}>
  <p className="small" style={{margin:0}}><strong>Nilai asli</strong> = 100 × (poin soal benar + poin esai) ÷ total bobot semua soal. Penalti belum diperhitungkan.</p>
  <p className="small" style={{margin:0}}><strong>Potongan</strong> = jumlah jawaban pilihan ganda yang salah × nilai penalti ujian. Jawaban kosong tidak kena penalti dan tidak mendapat poin. Esai tidak terkena penalti.</p>
  <p className="small" style={{margin:0}}><strong>Nilai setelah penalti</strong> = 100 × (poin soal benar − potongan + poin esai) ÷ total bobot, lalu dibatasi antara 0 dan 100. Inilah nilai yang tercatat.</p>
  <Notice>Contoh: 23 benar dan 7 salah dari 30 soal berbobot 1, penalti 0,25. Nilai asli = 100 × 23 ÷ 30 = 76,67. Potongan = 7 × 0,25 = 1,75 poin. Nilai setelah penalti = 100 × (23 − 1,75) ÷ 30 = 70,83.</Notice>
 </div></details>;
}

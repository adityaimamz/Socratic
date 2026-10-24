import {createHash} from 'node:crypto';

export const DATASET='socratic-demo-v1';
export const DOMAIN='socratic-demo.test';
export function demoId(key){
 const bytes=createHash('sha256').update(`${DATASET}:${key}`).digest().subarray(0,16);
 bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
 const hex=bytes.toString('hex');return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
export function buildDemoData(){
 const account=(key,name,role,extra={})=>({key,id:demoId(`user:${key}`),email:`${key}@${DOMAIN}`,name:`[DEMO] ${name}`,role,active:true,confirmed:true,...extra});
 const students=['Alya Putri','Bima Pratama','Citra Lestari','Dimas Saputra','Eka Wulandari','Fajar Nugraha','Gita Permata','Hadi Wijaya','Intan Sari','Joko Santoso'].map((name,i)=>account(`peserta${String(i+1).padStart(2,'0')}`,name,'student'));
 const accounts=[account('admin','Admin Pengujian','admin'),account('pengajar','Ratih — Matematika','teacher'),account('pengawas','Arif — IPA dan Pengawas','teacher'),...students,account('nonaktif','Akun Dinonaktifkan','student',{active:false}),account('tanpa-kelas','Peserta Tanpa Penugasan','student'),account('belum-verifikasi','Email Belum Diverifikasi','student',{confirmed:false})];
 const users=Object.fromEntries(accounts.map(u=>[u.key,u]));
 const classes=[{key:'math',name:'XII A · Matematika',owner:'pengajar',emails:students.slice(0,6).map(u=>u.email)},{key:'science',name:'XII B · IPA',owner:'pengawas',emails:students.slice(6).map(u=>u.email)},{key:'empty',name:'Kelas Kosong',owner:'pengajar',emails:[]}].map(c=>({...c,id:demoId(`class:${c.key}`),name:`[DEMO] ${c.name}`}));
 const mcq=(key,prompt,options,subject='Matematika',extra={})=>({key,kind:'mcq',prompt,options,correct:0,weight:1,subject,owner:subject==='IPA'?'pengawas':'pengajar',...extra});
 const sampleAnswers={
  'math-essay':'[DEMO] Luas segitiga = 1/2 × alas × tinggi. Dengan alas 8 cm dan tinggi 6 cm, luasnya 1/2 × 8 × 6 = 24 cm².',
  'science-essay':'[DEMO] Klorofil menangkap energi cahaya. Tumbuhan menggunakan air dan karbon dioksida untuk menghasilkan glukosa sebagai makanan serta melepaskan oksigen.',
  'water-essay':'[DEMO] Saya menutup keran ketika menggosok gigi agar air tidak terus mengalir. Saya juga segera memperbaiki keran bocor untuk menghindari pemborosan air bersih setiap hari.',
  reflection:'[DEMO] Saya memeriksa soal yang ditandai, menghitung ulang jawaban, dan memastikan tidak ada soal terlewat. Sebelum mengirim, saya menunggu semua perubahan berstatus Tersimpan.',
  'archived-essay':'[DEMO] Contoh jawaban dari materi versi lama.'
 };
 const essay=(key,prompt,rubric,subject='Matematika')=>({key,kind:'essay',prompt,rubric,sampleAnswer:sampleAnswers[key],options:[],weight:4,subject,owner:subject==='IPA'?'pengawas':'pengajar'});
 const questions=[
  mcq('sum','Berapakah hasil 12 + 18?',['30','24','28','36']),
  mcq('percent','Berapakah 25% dari 200?',['50','25','75','100']),
  mcq('algebra','Jika f(x) = 2x + 3, berapakah f(4)?',['11','8','10','14']),
  mcq('perimeter','Keliling persegi dengan sisi 5 cm adalah …',['20 cm','10 cm','25 cm','15 cm']),
  mcq('average','Rata-rata dari 6, 8, dan 10 adalah …',['8','6','10']),
  mcq('fraction','Nilai 1/2 + 1/4 adalah …',['3/4','2/6','1/8','1/4']),
  mcq('photosynthesis','Tumbuhan memerlukan cahaya untuk fotosintesis.',['Benar','Salah'],'IPA'),
  mcq('water','Pada tekanan normal, air mendidih pada suhu …',['100°C','0°C','50°C','200°C'],'IPA'),
  mcq('planet','Planet tempat manusia hidup adalah …',['Bumi','Mars','Venus','Jupiter','Saturnus','Neptunus'],'IPA'),
  mcq('heart','Organ yang memompa darah ke seluruh tubuh adalah …',['Jantung','Paru-paru','Ginjal','Lambung'],'IPA'),
  mcq('force','Satuan gaya dalam SI adalah …',['Newton','Joule','Watt','Pascal','Volt'],'IPA'),
  mcq('image','Apa nama aplikasi pada logo di gambar soal?',['Socratic','Perpustakaan','Kalender','Laboratorium'],'Umum',{image:true}),
  essay('math-essay','Jelaskan cara menghitung luas segitiga dengan alas 8 cm dan tinggi 6 cm.','Rumus luas 1/2 × alas × tinggi (2 poin), perhitungan 24 cm² (2 poin).'),
  essay('science-essay','Jelaskan proses fotosintesis dan sebutkan bahan serta hasilnya.','Cahaya dan klorofil (1), air dan karbon dioksida (1), glukosa (1), oksigen (1).','IPA'),
  essay('water-essay','Tuliskan dua cara menghemat air di rumah dan alasan manfaatnya.','Dua tindakan konkret (2), dua alasan yang sesuai (2).','IPA'),
  essay('reflection','Jelaskan bagaimana Anda memeriksa kembali jawaban sebelum mengirim ujian.','Langkah pemeriksaan (2), alasan dan contoh penerapan (2).'),
  mcq('archived-mcq','Soal lama: berapakah 2 × 5?',['10','7','12','15'],'Matematika',{archived:true}),
  {...essay('archived-essay','Soal esai lama yang telah diarsipkan.','Pedoman versi lama untuk pengujian arsip.'),archived:true}
 ].map(q=>({...q,id:demoId(`question:${q.key}`),prompt:`[DEMO] ${q.prompt}`,options:q.options.map((text,i)=>({id:demoId(`option:${q.key}:${i}`),text})),correct_option_id:q.kind==='essay'?null:demoId(`option:${q.key}:0`),tag:`Demo · ${q.subject}`,rubric:q.rubric??''}));
 const math=['sum','percent','algebra','perimeter','math-essay','image'];
 const mcqs=['sum','percent','algebra','perimeter','average','fraction'];
 const exams=[
  {key:'strict',title:'Exam Ketat · Siap Dikerjakan',questions:math},
  {key:'quiz',title:'Quiz Otomatis · Siap Dikerjakan',mode:'quiz',questions:mcqs},
  {key:'scheduled',title:'Ujian Besok · Belum Dibuka',questions:math,scheduled:true},
  {key:'draft',title:'Draft Campuran · Bisa Diedit',questions:math,draft:true},
  {key:'draft-empty',title:'Draft Kosong · Tambah Soal',questions:[],draft:true},
  {key:'closed',title:'Ujian Ditutup · Akses Mulai Ditolak',questions:mcqs,closed:true},
  {key:'archived',title:'Arsip Ujian Lama',questions:mcqs,archived:true},
  {key:'grading',title:'Esai · Menunggu Penilaian',questions:math,history:true},
  {key:'withheld',title:'Hasil Selesai · Nilai Ditahan',questions:math,history:true},
  {key:'scores',title:'Nilai Terbit · Pembahasan Ditahan',questions:math,history:true,release:'score'},
  {key:'review',title:'Nilai dan Pembahasan Terbit',questions:math,history:true,release:'review'},
  {key:'retake',title:'Kesempatan Ulang · Retake Tersedia',questions:mcqs},
  {key:'deadline',title:'Ujian Selesai · Waktu Habis',questions:mcqs,history:true,release:'score'},
  {key:'terminated',title:'Ujian Dihentikan Pengawas',questions:math,history:true,release:'score'},
  {key:'empty-monitor',title:'Monitoring Kosong · Belum Ada Sesi',questions:mcqs},
  {key:'science',title:'Quiz IPA · Kelas XII B',mode:'quiz',owner:'pengawas',class:'science',questions:['photosynthesis','water','planet','heart','force','science-essay','water-essay']}
 ].map(e=>({...e,id:demoId(`exam:${e.key}`),title:`[DEMO] ${e.title}`,owner:e.owner??'pengajar',class:e.class??'math',mode:e.mode??'exam',duration_minutes:480,penalty:e.key==='quiz'?0.25:0}));
 const attempts=[
  {exam:'strict',student:'peserta02',state:'reset',quality:'partial'},
  {exam:'strict',student:'peserta03',state:'takeover',quality:'partial'},
  {exam:'strict',student:'peserta04',state:'offline',quality:'partial'},
  {exam:'strict',student:'peserta05',state:'extend',quality:'partial'},
  {exam:'quiz',student:'peserta06',state:'active',quality:'partial'},
  {exam:'quiz',student:'peserta01',state:'submit',quality:'good'},
  {exam:'grading',student:'peserta01',state:'submit',quality:'good'},
  {exam:'grading',student:'peserta06',state:'submit',quality:'blank-essay'},
  {exam:'withheld',student:'peserta01',state:'graded',quality:'good'},
  {exam:'withheld',student:'peserta02',state:'graded',quality:'weak'},
  {exam:'scores',student:'peserta01',state:'graded',quality:'good'},
  {exam:'scores',student:'peserta03',state:'graded',quality:'weak'},
  {exam:'review',student:'peserta01',state:'graded',quality:'good'},
  {exam:'review',student:'peserta04',state:'graded',quality:'weak'},
  {exam:'retake',student:'peserta01',state:'retake',quality:'weak'},
  {exam:'deadline',student:'peserta01',state:'deadline',quality:'partial'},
  {exam:'terminated',student:'peserta01',state:'terminate',quality:'partial'},
  {exam:'science',student:'peserta07',state:'active',quality:'partial'},
  {exam:'science',student:'peserta08',state:'graded',quality:'good'}
 ].map(a=>({...a,key:`${a.exam}:${a.student}`,session:demoId(`session:${a.exam}:${a.student}`)}));
 const invitations=['undangan-peserta1','undangan-peserta2','undangan-pengajar'].map((key,i)=>({email:`${key}@${DOMAIN}`,name:`[DEMO] Undangan ${i+1} Belum Diterima`,role:i===2?'teacher':'student'}));
 return {dataset:DATASET,accounts,users,classes,questions,exams,attempts,invitations,mediaPath:`${users.pengajar.id}/${demoId('media:logo')}.jpeg`};
}

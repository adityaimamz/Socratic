import { z } from "zod";
const uuid = z.uuid();
const email = z.email().max(254).transform(s => s.toLowerCase().trim());
const id = { id: uuid };
const session = { ...id, session_id: uuid };
const epoch = { ...session, answer_epoch: z.number().int().min(0) };
const option = z.object({ id: uuid, text: z.string().trim().min(1).max(2000) });
const schemas = {
  workspace: z.object({}),
  "admin.health": z.object({}),
  "admin.invite": z.object({ email, name: z.string().trim().min(2).max(100), role: z.enum(["admin", "teacher", "student"]) }),
  "admin.user": z.object({ ...id, role: z.enum(["admin", "teacher", "student"]), active: z.boolean() }),
  "admin.settings": z.object({ institution: z.string().trim().min(2).max(100), result_retention_days: z.number().int().min(30).max(3650), event_retention_days: z.number().int().min(7).max(365), audit_retention_days: z.number().int().min(30).max(3650) }),
  "classes.save": z.object({ id: uuid.optional(), name: z.string().trim().min(2).max(100), emails: z.array(email).max(1000) }),
  "questions.save": z.object({ id: uuid.optional(), kind: z.enum(["mcq","essay"]).default("mcq"), prompt: z.string().trim().min(3).max(10000), options: z.array(option).max(6).default([]), correct_option_id: uuid.nullable().default(null), rubric: z.string().trim().max(10000).default(""), weight: z.number().positive().max(1000), tag: z.string().max(100), media_path: z.string().regex(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(png|jpeg|webp)$/).nullable().optional() }).refine(q => q.kind === "essay" ? q.options.length === 0 && q.correct_option_id === null : q.options.length >= 2 && new Set(q.options.map(o => o.id)).size === q.options.length && q.options.some(o => o.id === q.correct_option_id), "Esai tidak memiliki opsi/kunci pilihan. Pilgan memerlukan 2–6 opsi unik dan satu kunci."),
  "questions.archive": z.object(id),
  "exams.save": z.object({ id: uuid.optional(), title: z.string().trim().min(3).max(150), instructions: z.string().max(10000), class_id: uuid.nullable(), mode: z.enum(["quiz", "exam"]), opens_at: z.iso.datetime(), closes_at: z.iso.datetime(), duration_minutes: z.number().int().min(1).max(480), passing_score: z.number().min(0).max(100), penalty: z.number().min(0).max(1000), shuffle_questions: z.boolean(), shuffle_options: z.boolean(), question_ids: z.array(uuid).max(100), participant_emails: z.array(email).max(1000) }).refine(e => Date.parse(e.closes_at) > Date.parse(e.opens_at), "Waktu tutup harus setelah waktu buka.").refine(e => new Set(e.question_ids).size === e.question_ids.length, "Soal tidak boleh berulang."),
  "exams.publish": z.object(id), "exams.close": z.object(id),
  "exams.staff": z.object({ ...id, staff_ids: z.array(uuid).max(20) }),
  "exams.participants": z.object({ ...id, participant_emails: z.array(email).max(1000) }),
  "exams.accommodation.get": z.object(id),
  "exams.accommodation.set": z.object({...id,email,fullscreen_exempt:z.boolean(),reason:z.string().trim().min(5).max(1000)}),
  "attempt.start": z.object(session), "attempt.get": z.object(session), "attempt.result": z.object(id), "attempt.takeover": z.object(session),
  "attempt.heartbeat": z.object(session), "attempt.submit": z.object(epoch),
  "attempt.save": z.object({ ...epoch, item_id: uuid, option_id: uuid.nullable().default(null), text: z.string().max(20000).nullable().optional(), expected_revision: z.number().int().min(0), operation_id: uuid, marked: z.boolean(), current_question: z.number().int().min(0).max(99) }),
  "attempt.events": z.object({ ...epoch, event_id: uuid, type: z.enum(["visibility_hidden", "visibility_visible", "fullscreen_exit", "fullscreen_enter", "connection_lost", "connection_restored"]), client_at: z.iso.datetime().optional() }),
  "manage.monitor": z.object(id), "manage.export": z.object(id), "manage.release": z.object({ ...id, review: z.boolean() }),
  "manage.grading": z.object(id),
  "manage.grade": z.object({...id,operation_id:uuid,grades:z.array(z.object({item_id:uuid,points:z.number().min(0).max(1000).multipleOf(0.01),feedback:z.string().trim().max(1000).default("")})).min(1).max(100)}).refine(v=>new Set(v.grades.map(g=>g.item_id)).size===v.grades.length,"Soal esai tidak boleh berulang."),
  "manage.action": z.object({ ...id, action: z.enum(["extend", "terminate", "approve_takeover", "retake", "review"]), reason: z.string().trim().min(5).max(1000), minutes: z.number().int().min(1).max(60).optional(), decision: z.enum(["flagged", "cleared", "confirmed", "inconclusive", "invalidated"]).optional() }).refine(v => v.action !== "extend" || v.minutes !== undefined, "Isi tambahan menit.").refine(v => v.action !== "review" || v.decision !== undefined, "Pilih keputusan review.")
};
export type Action = keyof typeof schemas;
export function parseAction(action: string, input: unknown) {
  if (!(action in schemas)) throw new Error("NOT_FOUND");
  return schemas[action as Action].parse(input,{error:z.locales.id().localeError});
}
export function validationMessage(error:z.ZodError){
 const labels:Record<string,string>={email:"Email",emails:"Email peserta",name:"Nama",role:"Hak akses",active:"Status akun",institution:"Nama lembaga",result_retention_days:"Retensi hasil",event_retention_days:"Retensi aktivitas",audit_retention_days:"Retensi audit",kind:"Jenis soal",prompt:"Pertanyaan",options:"Pilihan jawaban",correct_option_id:"Kunci jawaban",rubric:"Rubrik penilaian",weight:"Bobot nilai",tag:"Tag",media_path:"Gambar soal",title:"Judul ujian",instructions:"Instruksi",class_id:"Kelas",mode:"Mode ujian",opens_at:"Waktu buka",closes_at:"Waktu tutup",duration_minutes:"Durasi",passing_score:"Nilai lulus",penalty:"Penalti",shuffle_questions:"Pengacakan soal",shuffle_options:"Pengacakan pilihan",question_ids:"Daftar soal",participant_emails:"Email peserta",staff_ids:"Daftar pengawas",fullscreen_exempt:"Akomodasi fullscreen",reason:"Alasan",minutes:"Tambahan menit",decision:"Keputusan review",grades:"Skor esai",text:"Jawaban esai",action:"Tindakan petugas"};
 const details=[...new Set(error.issues.map(issue=>{
  if(issue.code==="custom")return issue.message;
  const field=String(issue.path[0]??"");
  if(!labels[field])return "Data sesi tidak sesuai. Muat ulang halaman atau hubungi pengawas jika sedang ujian.";
  const row=typeof issue.path[1]==="number"?` ke-${issue.path[1]+1}`:"";
  return `${labels[field]}${row}: ${issue.message}`;
 }))];
 return `Periksa isian berikut. ${details.slice(0,3).join("; ")}${details.length>3?"; periksa juga isian lainnya.":""}`;
}

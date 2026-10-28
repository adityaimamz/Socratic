import { PGlite } from "@electric-sql/pglite";
import { readFileSync,readdirSync } from "node:fs";
import { beforeAll,afterAll,expect,it } from "vitest";
const admin="00000000-0000-4000-8000-000000000001",student="00000000-0000-4000-8000-000000000002",teacher="00000000-0000-4000-8000-000000000004",other="00000000-0000-4000-8000-000000000005";
let db:PGlite;
async function call(actor:string,action:string,data:unknown={}){return (await db.query<{r:any}>("select public.school_api($1::uuid,$2::text,$3::jsonb) r",[actor,action,JSON.stringify(data)])).rows[0].r;}
async function update(actor:string,id:string,data:object){return (await db.query<{r:any}>("select public.school_exam_update($1::uuid,$2::uuid,$3::jsonb) r",[actor,id,JSON.stringify(data)])).rows[0].r;}
async function question(prompt:string){const a=crypto.randomUUID(),b=crypto.randomUUID();return (await call(teacher,"questions.save",{prompt,options:[{id:a,text:"A"},{id:b,text:"B"}],correct_option_id:a,weight:1,tag:"Uji"})).id as string;}
const body=(ids:string[],extra:object={})=>({title:"Ujian edit",instructions:"Baca",mode:"exam",class_id:null,opens_at:new Date(Date.now()-60000).toISOString(),closes_at:new Date(Date.now()+3600000).toISOString(),duration_minutes:30,passing_score:70,penalty:0,shuffle_questions:false,shuffle_options:false,question_ids:ids,participant_emails:["peserta@school.test"],...extra});
async function published(ids:string[]){const e=await call(teacher,"exams.save",body(ids));await call(teacher,"exams.publish",{id:e.id});return e.id as string;}
beforeAll(async()=>{
 db=new PGlite();await db.exec("create role service_role; create role authenticated; create role anon; alter default privileges in schema public grant execute on functions to anon,authenticated;");
 for(const name of readdirSync("supabase/migrations").filter(n=>n.endsWith(".sql")&&!n.includes("storage_cron")).sort())await db.exec(readFileSync(`supabase/migrations/${name}`,"utf8"));
 await db.exec(`insert into private.profiles(id,email,name,role) values('${admin}','admin@school.test','Admin','admin'),('${student}','peserta@school.test','Siswa','student'),('${teacher}','guru@school.test','Guru','teacher'),('${other}','lain@school.test','Guru Lain','teacher')`);
},30000);
afterAll(async()=>{await db?.close();});
it("replaces questions and settings of a published exam nobody has started",async()=>{
 const q1=await question("Soal satu"),q2=await question("Soal dua"),id=await published([q1]);
 const r=await update(teacher,id,body([q2,q1],{title:"Judul baru",duration_minutes:45,mode:"quiz",penalty:0.5}));
 expect(r.title).toBe("Judul baru");expect(r.question_ids).toEqual([q2,q1]);expect(r.duration_minutes).toBe(45);expect(r).not.toHaveProperty("items");
 const items=(await db.query<{items:{id:string}[]}>("select items from private.exams where id=$1",[id])).rows[0].items;expect(items.map(i=>i.id)).toEqual([q2,q1]);
 const a=await call(student,"attempt.start",{id,session_id:crypto.randomUUID()});expect(a.items).toHaveLength(2);expect(a.mode).toBe("quiz");
});
it("after someone started, edits apply only to participants who start later",async()=>{
 const q1=await question("Soal tiga"),q2=await question("Soal empat"),id=await published([q1]);
 const first=await call(student,"attempt.start",{id,session_id:crypto.randomUUID()});
 const closes=new Date(Date.now()+7200000).toISOString();
 const r=await update(teacher,id,body([q1,q2],{title:"Diperpanjang",closes_at:closes,passing_score:60,duration_minutes:50,shuffle_options:true,participant_emails:["peserta@school.test","baru@school.test"]}));
 expect(r.title).toBe("Diperpanjang");expect(r.question_ids).toEqual([q1,q2]);expect(r.duration_minutes).toBe(50);expect(r.participant_emails).toHaveLength(2);
 const still=await call(student,"attempt.get",{id:first.id,session_id:(await db.query<{s:string}>("select session_id::text s from private.attempts where id=$1",[first.id])).rows[0].s});expect(still.items).toHaveLength(1);
 await expect(update(teacher,id,body([q1],{closes_at:new Date(Date.now()-1000).toISOString()}))).rejects.toThrow("INVALID_EXAM");
});
it("rejects drafts, closed exams and staff without access",async()=>{
 const q=await question("Soal lima"),draft=await call(teacher,"exams.save",body([q]));
 await expect(update(teacher,draft.id,body([q]))).rejects.toThrow("EXAM_IMMUTABLE");
 const id=await published([q]);await expect(update(other,id,body([q]))).rejects.toThrow("NOT_FOUND");await expect(update(student,id,body([q]))).rejects.toThrow("FORBIDDEN");
 await call(teacher,"exams.close",{id});await expect(update(teacher,id,body([q]))).rejects.toThrow("EXAM_IMMUTABLE");
});
it("browser roles cannot call the update function",async()=>{
 await db.exec("set role authenticated");try{await expect(db.query("select public.school_exam_update($1::uuid,$2::uuid,'{}')",[teacher,crypto.randomUUID()])).rejects.toThrow("permission denied");}finally{await db.exec("reset role");}
});

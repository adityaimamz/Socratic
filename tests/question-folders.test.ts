import { PGlite } from "@electric-sql/pglite";
import { readFileSync,readdirSync } from "node:fs";
import { beforeAll,afterAll,expect,it } from "vitest";
const admin="00000000-0000-4000-8000-000000000001",teacher="00000000-0000-4000-8000-000000000004",student="00000000-0000-4000-8000-000000000002";
let db:PGlite;
const view=async(actor:string,name:string,input:object={})=>(await db.query<{v:any}>("select private.school_view($1::uuid,$2::text,$3::jsonb) v",[actor,name,JSON.stringify(input)])).rows[0].v;
async function save(actor:string,prompt:string,tag:string){const a=crypto.randomUUID(),b=crypto.randomUUID();await db.query("select public.school_api($1::uuid,'questions.save',$2::jsonb)",[actor,JSON.stringify({prompt,options:[{id:a,text:"A"},{id:b,text:"B"}],correct_option_id:a,weight:1,tag})]);}
beforeAll(async()=>{
 db=new PGlite();await db.exec("create role service_role; create role authenticated; create role anon; alter default privileges in schema public grant execute on functions to anon,authenticated;");
 for(const name of readdirSync("supabase/migrations").filter(n=>n.endsWith(".sql")&&!n.includes("storage_cron")).sort())await db.exec(readFileSync(`supabase/migrations/${name}`,"utf8"));
 await db.exec(`insert into private.profiles(id,email,name,role) values('${admin}','admin@school.test','Admin','admin'),('${student}','s@school.test','Siswa','student'),('${teacher}','guru@school.test','Guru','teacher')`);
 await save(teacher,"Soal aljabar","Matematika");await save(teacher,"Soal geometri","matematika ");await save(teacher,"Soal tanpa tag","");await save(admin,"Soal milik admin","Fisika");
},30000);
afterAll(async()=>{await db?.close();});
it("groups visible questions into folders ignoring case and spaces, untagged last",async()=>{
 const t=await view(teacher,"question-folders");expect(t.folders.map((f:{key:string;count:number})=>[f.key,f.count])).toEqual([["matematika",2],["",1]]);
 const a=await view(admin,"question-folders");expect(a.folders.map((f:{key:string})=>f.key)).toEqual(["fisika","matematika",""]);
 expect((await view(student,"question-folders")).folders).toEqual([]);
});
it("filters questions by folder and search within it",async()=>{
 const m=await view(teacher,"questions",{folder:"Matematika"});expect(m.total).toBe(2);
 expect((await view(teacher,"questions",{folder:"matematika",q:"geometri"})).total).toBe(1);
 expect((await view(teacher,"questions",{folder:"__none__"})).items.map((i:{prompt:string})=>i.prompt)).toEqual(["Soal tanpa tag"]);
 expect((await view(teacher,"questions",{folder:"Fisika"})).total).toBe(0);
 expect((await view(teacher,"questions",{})).total).toBe(3);
});
it("counts correct, wrong and empty multiple-choice answers",async()=>{
 const r=await db.query<{c:{correct:number;wrong:number;empty:number}}>("select private.attempt_counts($1::jsonb,$2::jsonb) c",[JSON.stringify({items:[{id:"1",correctOptionId:"a"},{id:"2",correctOptionId:"a"},{id:"3",correctOptionId:"a"},{id:"4"}]}),JSON.stringify({"1":{optionId:"a"},"2":{optionId:"b"}})]);
 expect(r.rows[0].c).toMatchObject({correct:1,wrong:1,empty:1});
});
it("lists a whole tag folder for building exams by tag",async()=>{
 const m=await view(teacher,"question-folder-items",{folder:"Matematika"});expect(m.items.map((i:{prompt:string})=>i.prompt).sort()).toEqual(["Soal aljabar","Soal geometri"]);
 expect((await view(teacher,"question-folder-items",{folder:"__none__"})).items).toHaveLength(1);
 expect((await view(teacher,"question-folder-items",{folder:"Fisika"})).items).toEqual([]);
 expect((await view(student,"question-folder-items",{folder:"Matematika"})).items).toEqual([]);
});

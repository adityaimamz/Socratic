import {beforeAll,afterAll,describe,it,expect} from "vitest";
import {PGlite} from "@electric-sql/pglite";
import {readFileSync,readdirSync} from "node:fs";
import {createHash,randomBytes} from "node:crypto";
import {classLinkInput,joinDestination} from "../src/lib/class-links";
let db:PGlite;
const teacher=crypto.randomUUID(),other=crypto.randomUUID(),admin=crypto.randomUUID();
const hash=()=>createHash("sha256").update(randomBytes(32)).digest("hex");
async function manage(actor:string,id:string,op:string,h:string|null=null,days=7,limit=2){return (await db.query<{v:{link:{uses:number;max_uses:number;revoked_at:string|null}}}>("select public.school_class_link_manage($1,$2,$3,$4,$5,$6) v",[actor,id,op,h,days,limit])).rows[0].v;}
async function join(id:string,email:string,h:string){return (await db.query<{v:{already_joined:boolean}}>("select public.school_class_link_join($1,$2,'Peserta Baru',$3) v",[id,email,h])).rows[0].v;}
async function setup(limit=2){const id=crypto.randomUUID(),h=hash();await db.query("insert into private.classes(id,name,owner_id) values($1,'XII IPA',$2)",[id,teacher]);await manage(teacher,id,"create",h,7,limit);return {id,h};}
beforeAll(async()=>{db=new PGlite();await db.exec("create role service_role;create role anon;create role authenticated;");for(const f of readdirSync("supabase/migrations").filter(f=>f.endsWith(".sql")&&!f.includes("storage_cron")).sort())await db.exec(readFileSync(`supabase/migrations/${f}`,"utf8"));for(const [id,role] of [[teacher,"teacher"],[other,"teacher"],[admin,"admin"]])await db.query("insert into private.profiles(id,email,name,role) values($1,$2,'Pengajar',$3)",[id,`${id}@school.test`,role]);},60000);
afterAll(async()=>{await db?.close();});
describe("class join link admission",()=>{
 it("admits a verified identity as student without an email invitation and makes class exams visible",async()=>{
  const {id,h}=await setup(),student=crypto.randomUUID(),email=`${student}@school.test`;
  expect(await join(student,email,h)).toMatchObject({already_joined:false});
  expect((await db.query<{role:string}>("select role from private.profiles where id=$1",[student])).rows[0].role).toBe("student");
  expect((await db.query("select * from private.memberships where class_id=$1 and email=$2",[id,email])).rows).toHaveLength(1);
  const exam=crypto.randomUUID();await db.query("insert into private.exams(id,owner_id,title,class_id,mode,status,opens_at,closes_at,duration_minutes) values($1,$2,'Ujian kelas',$3,'quiz','published',now(),now()+interval '1 day',60)",[exam,teacher,id]);
  expect((await db.query<{ok:boolean}>("select private.assigned($1,e) ok from private.exams e where id=$2",[student,exam])).rows[0].ok).toBe(true);
  expect((await manage(teacher,id,"get")).link.uses).toBe(1);
  expect(JSON.stringify(await manage(teacher,id,"get"))).not.toContain(h);
 });
 it("does not consume another place on retry and rejects new members when full",async()=>{
  const {id,h}=await setup(1),student=crypto.randomUUID(),email=`${student}@school.test`;
  await join(student,email,h);expect((await join(student,email,h)).already_joined).toBe(true);
  const next=crypto.randomUUID();await expect(join(next,`${next}@school.test`,h)).rejects.toThrow("JOIN_LINK_FULL");
  expect((await db.query("select * from private.profiles where id=$1",[next])).rows).toHaveLength(0);
  expect((await manage(teacher,id,"get")).link.uses).toBe(1);
 });
 it("allows only the owner or admin to manage links",async()=>{
  const {id}=await setup();await expect(manage(other,id,"get")).rejects.toThrow("NOT_FOUND");
  const student=crypto.randomUUID();await db.query("insert into private.profiles(id,email,name,role) values($1,$2,'Murid','student')",[student,`${student}@school.test`]);
  await expect(manage(student,id,"create",hash())).rejects.toThrow("FORBIDDEN");expect((await manage(admin,id,"get")).link).toBeTruthy();
  await expect(manage(teacher,id,"create",hash(),0)).rejects.toThrow("INVALID_INPUT");
 });
 it("rejects expired, revoked and replaced links while preserving members",async()=>{
  const {id,h}=await setup(),student=crypto.randomUUID();await join(student,`${student}@school.test`,h);
  await db.query("update private.class_join_links set expires_at=now()-interval '1 second' where class_id=$1",[id]);
  expect((await db.query<{v:unknown}>("select public.school_class_link_preview($1) v",[h])).rows[0].v).toBeNull();
  await expect(join(crypto.randomUUID(),"expired@school.test",h)).rejects.toThrow("JOIN_LINK_UNAVAILABLE");
  const fresh=hash();await manage(teacher,id,"create",fresh);await expect(join(crypto.randomUUID(),"old@school.test",h)).rejects.toThrow("JOIN_LINK_UNAVAILABLE");
  await manage(teacher,id,"revoke");await expect(join(crypto.randomUUID(),"revoked@school.test",fresh)).rejects.toThrow("JOIN_LINK_UNAVAILABLE");
  expect((await db.query("select * from private.memberships where class_id=$1",[id])).rows).toHaveLength(1);
 });
 it("rejects inactive accounts, staff identities and pending staff invitations without changing roles",async()=>{
  const {h}=await setup(),disabled=crypto.randomUUID();await db.query("insert into private.profiles(id,email,name,role,active) values($1,'disabled@school.test','Nonaktif','student',false)",[disabled]);
  await expect(join(disabled,"disabled@school.test",h)).rejects.toThrow("ACCOUNT_DISABLED");
  await expect(join(teacher,`${teacher}@school.test`,h)).rejects.toThrow("FORBIDDEN");
  await db.query("insert into private.invitations(email,name,role) values('future-teacher@school.test','Pengajar Baru','teacher')");
  await expect(join(crypto.randomUUID(),"future-teacher@school.test",h)).rejects.toThrow("FORBIDDEN");
  const student=crypto.randomUUID();await db.query("insert into private.invitations(email,name,role) values('invited@school.test','Murid Baru','student')");await join(student,"invited@school.test",h);
  expect((await db.query<{accepted_by:string}>("select accepted_by from private.invitations where email='invited@school.test'")).rows[0].accepted_by).toBe(student);
 });
 it("rejects identity email changes and disables links when the teacher is inactive",async()=>{
  const {h}=await setup(),student=crypto.randomUUID();await join(student,`${student}@school.test`,h);
  await expect(join(student,"someone-else@school.test",h)).rejects.toThrow("FORBIDDEN");
  await db.query("update private.profiles set active=false where id=$1",[teacher]);
  try{await expect(join(crypto.randomUUID(),"blocked-owner@school.test",h)).rejects.toThrow("JOIN_LINK_UNAVAILABLE");}finally{await db.query("update private.profiles set active=true where id=$1",[teacher]);}
 });
 it("prevents browser database roles from invoking admission or reading hashes",async()=>{
  for(const role of ["anon","authenticated"]){await db.exec(`set role ${role}`);try{
   await expect(db.query("select public.school_class_link_preview($1)",[hash()])).rejects.toThrow("permission denied");
   await expect(db.query("select public.school_class_link_join($1,'test@school.test','Test',$2)",[crypto.randomUUID(),hash()])).rejects.toThrow("permission denied");
   await expect(db.query("select * from private.class_join_links")).rejects.toThrow("permission denied");
  }finally{await db.exec("reset role");}}
 });
 it("only accepts fixed local join destinations and bounded form inputs",()=>{
  const token="a".repeat(64);expect(joinDestination(`/join/${token}`)).toBe(`/join/${token}`);
  for(const next of ["https://evil.test","//evil.test","/dashboard",`/join/${token}?next=//evil.test`,`/join/${token}/..`])expect(joinDestination(next)).toBeNull();
  expect(classLinkInput.safeParse({operation:"create",class_id:crypto.randomUUID(),days:31,limit:1001}).success).toBe(false);
 });
});

import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import {readFileSync,readdirSync} from 'node:fs';
import {buildDemoData,demoId} from '../scripts/demo/data.mjs';
import {buildDemoSql,buildCleanupSql,demoReportSql} from '../scripts/demo/sql.mjs';

const d=buildDemoData();let db:PGlite;
async function call(actor:string,action:string,payload:object={}){
 const r=await db.query<{v:Record<string,unknown>}>('select public.school_api($1,$2,$3::jsonb) v',[actor,action,JSON.stringify(payload)]);return r.rows[0].v;
}
beforeAll(async()=>{
 db=new PGlite();await db.exec('create role service_role;create role authenticated;create role anon;');
 for(const file of readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')&&!f.includes('storage_cron')).sort())await db.exec(readFileSync(`supabase/migrations/${file}`,'utf8'));
},60000);
afterAll(async()=>{await db?.close();});

describe('complete demo dataset',()=>{
 it('seeds actual exam transitions, grades and all intended scenarios',async()=>{
  await db.exec(buildDemoSql(d));
  const summary=(await db.query<{summary:Record<string,number>}>(demoReportSql(d))).rows[0].summary;
  expect(summary).toMatchObject({profiles:15,classes:3,questions:18,exams:16,attempts:19,active_attempts:6,results:13,pending_grading:2,reviews:5,accommodations:1,invitations:19});
  const strict=d.exams.find(e=>e.key==='strict')!;
  const rows=await db.query<{reset_count:number;answer_epoch:number;answers:object}>('select reset_count,answer_epoch,answers from private.attempts where exam_id=$1 and user_id=$2',[strict.id,d.users.peserta02.id]);
  expect(rows.rows[0].reset_count).toBe(1);expect(rows.rows[0].answer_epoch).toBe(1);expect(Object.keys(rows.rows[0].answers)).toHaveLength(2);
  const result=(await db.query<{score:number|null;grading_status:string}>('select score,grading_status from private.results where grading_status=$1',['pending'])).rows;
  expect(result).toHaveLength(2);expect(result.every(r=>r.score===null)).toBe(true);
  const states=(await db.query<{status:string}>('select distinct status from private.exams')).rows.map(r=>r.status);
  expect(states.sort()).toEqual(['archived','closed','draft','published']);
  const reasons=(await db.query<{reason:string}>('select distinct reason from private.results')).rows.map(r=>r.reason);
  expect(reasons.sort()).toEqual(['deadline','manual','staff_termination']);
 });
 it('preserves changes when run again and maintains role/result privacy',async()=>{
  const before=(await db.query<{summary:object}>(demoReportSql(d))).rows[0].summary;
  await db.query('update private.questions set prompt=$1 where id=$2',['[DEMO] Edited while testing',d.questions[0].id]);
  await db.exec(buildDemoSql(d));
  expect((await db.query<{summary:object}>(demoReportSql(d))).rows[0].summary).toEqual(before);
  expect((await db.query<{prompt:string}>('select prompt from private.questions where id=$1',[d.questions[0].id])).rows[0].prompt).toBe('[DEMO] Edited while testing');
  const workspace=await call(d.users['tanpa-kelas'].id,'workspace');expect(workspace.exams).toEqual([]);
  await expect(call(d.users.nonaktif.id,'workspace')).rejects.toThrow('UNAUTHORIZED');
  const attempt=(await db.query<{id:string}>('select id from private.attempts where user_id=$1 and exam_id=$2',[d.users.peserta01.id,d.exams.find(e=>e.key==='withheld')!.id])).rows[0];
  const withheld=await call(d.users.peserta01.id,'attempt.result',{id:attempt.id});expect(withheld.score_released).toBe(false);expect(withheld.receipt).not.toHaveProperty('score');
  const published=(await db.query<{id:string}>('select id from private.attempts where user_id=$1 and exam_id=$2',[d.users.peserta01.id,d.exams.find(e=>e.key==='review')!.id])).rows[0];
  const released=await call(d.users.peserta01.id,'attempt.result',{id:published.id});expect(released.review_released).toBe(true);expect(released.essay_grades).toHaveLength(1);expect(released.receipt).toHaveProperty('score');
 });
 it('cleans only demo-owned data, retaining unrelated profiles, classes and settings',async()=>{
  const real=demoId('unrelated-user'),realClass=demoId('unrelated-class');
  await db.query("insert into private.profiles(id,email,name,role) values($1,'real@example.org','Real teacher','teacher')",[real]);
  await db.query("insert into private.classes(id,name,owner_id) values($1,'Real class',$2)",[realClass,real]);
  const settings=(await db.query('select * from private.settings')).rows;
  await db.exec(buildCleanupSql(d));
  expect((await db.query<{n:number}>('select count(*)::integer n from private.profiles')).rows[0].n).toBe(1);
  expect((await db.query<{name:string}>('select name from private.classes')).rows).toEqual([{name:'Real class'}]);
  expect((await db.query('select * from private.settings')).rows).toEqual(settings);
  expect((await db.query<{summary:Record<string,number>}>(demoReportSql(d))).rows[0].summary.exams).toBe(0);
 });
});

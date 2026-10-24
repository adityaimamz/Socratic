import {PGlite} from '@electric-sql/pglite';
import {readFileSync,readdirSync,mkdirSync,writeFileSync} from 'node:fs';
const db=new PGlite(),actor='00000000-0000-4000-8000-000000000001';
try{
 await db.exec('create role service_role;create role anon;create role authenticated;');
 for(const file of readdirSync('supabase/migrations').filter(n=>n.endsWith('.sql')&&!n.includes('storage_cron')).sort())await db.exec(readFileSync(`supabase/migrations/${file}`,'utf8'));
 await db.query("insert into private.profiles(id,email,name,role) values($1,'bench@school.test','SQL benchmark','teacher')",[actor]);
 await db.query("insert into private.questions(owner_id,kind,prompt,options,correct_option_id,rubric,weight) select $1,'essay','Soal benchmark '||n,'[]',null,repeat('pedoman ',50),1 from generate_series(1,10000) n",[actor]);
 await db.query("insert into private.classes(owner_id,name) select $1,'Kelas benchmark '||n from generate_series(1,1000) n",[actor]);
 await db.query("insert into private.exams(owner_id,title,mode,opens_at,closes_at,duration_minutes) select $1,'Ujian benchmark '||n,'quiz',now(),now()+interval '1 day',60 from generate_series(1,1000) n",[actor]);
 await db.exec('analyze private.questions;analyze private.classes;analyze private.exams;');
 const report={environment:'embedded PostgreSQL; SQL/index and payload evidence only',dataset:{questions:10000,classes:1000,exams:1000},views:{},plans:{}};
 for(const view of ['questions','classes','exams','teacher-overview']){
  const times=[];let bytes=0;
  for(let i=0;i<50;i++){const start=performance.now();const response=await db.query('select private.school_view($1,$2,\'{}\') data',[actor,view]);times.push(performance.now()-start);bytes=Buffer.byteLength(JSON.stringify(response.rows[0].data));}
  times.sort((a,b)=>a-b);report.views[view]={samples:50,p50:times[24],p95:times[47],max:times.at(-1),bytes};
 }
 const legacy=await db.query("select public.school_api($1,'workspace','{}') data",[actor]);report.legacyWorkspaceBytes=Buffer.byteLength(JSON.stringify(legacy.rows[0].data));report.questionsPayloadReduction=1-report.views.questions.bytes/report.legacyWorkspaceBytes;
 const queries={questions:'select id,prompt from private.questions where owner_id=$1 and not archived order by created_at desc,id desc limit 50',classes:'select id,name from private.classes where owner_id=$1 order by created_at desc,id desc limit 50',exams:'select id,title from private.exams where owner_id=$1 order by created_at desc,id desc limit 50'};
 for(const [name,sql] of Object.entries(queries)){const response=await db.query(`explain (analyze,buffers,format json) ${sql}`,[actor]);const plan=response.rows[0]['QUERY PLAN'][0];report.plans[name]=plan;}
 mkdirSync('.local/performance',{recursive:true});writeFileSync('.local/performance/scoped-sql.json',JSON.stringify(report,null,2));console.log(JSON.stringify({views:report.views,legacyWorkspaceBytes:report.legacyWorkspaceBytes,questionsPayloadReduction:report.questionsPayloadReduction}));
}finally{await db.close();}

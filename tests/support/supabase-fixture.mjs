// Test-only HTTP fixture. No application code imports this file or enables an auth bypass.
import { createServer } from 'node:http';
import { readFileSync,readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
const db=new PGlite();
await db.exec('create role service_role; create role authenticated; create role anon;');
for(const name of readdirSync('supabase/migrations').filter(n=>n.endsWith('.sql')&&!n.includes('storage_cron')).sort())await db.exec(readFileSync(`supabase/migrations/${name}`,'utf8'));
export const ids={admin:'10000000-0000-4000-8000-000000000001',teacher:'10000000-0000-4000-8000-000000000002',student:'10000000-0000-4000-8000-000000000003',other:'10000000-0000-4000-8000-000000000004'};
const profiles=Object.entries(ids).map(([role,id])=>({id,email:`${role}@school.test`,name:({admin:'Admin Sekolah',teacher:'Ratih Pramesti',student:'Nadia Putri',other:'Bima Pratama'})[role],role:role==='other'?'student':role}));
for(const p of profiles)await db.query('insert into private.profiles(id,email,name,role) values($1,$2,$3,$4)',[p.id,p.email,p.name,p.role]);
async function call(actor,action,payload={}){const r=await db.query('select public.school_api($1,$2,$3::jsonb) result',[actor,action,JSON.stringify(payload)]);return r.rows[0].result;}
const c=await call(ids.teacher,'classes.save',{name:'XII IPA · Matematika',emails:['student@school.test','other@school.test']});
const idsQuestions=[];for(let i=0;i<10;i++){const correct=crypto.randomUUID();const q=await call(ids.teacher,'questions.save',{prompt:['Jika f(x) = 2x + 3, berapakah nilai f(4)?','Hasil dari 12 × 8 adalah …','Nilai akar kuadrat dari 144 adalah …','Berapakah 25% dari 200?','Hasil dari 3² + 4² adalah …','Keliling persegi dengan sisi 5 cm adalah …','Berapakah hasil 7 × 9?','Nilai dari 2³ adalah …','Hasil pembagian 81 : 9 adalah …','Berapakah jumlah sudut dalam segitiga?'][i],options:[{id:correct,text:['11','96','12','50','25','20 cm','63','8','9','180°'][i]},{id:crypto.randomUUID(),text:'Pilihan alternatif satu'},{id:crypto.randomUUID(),text:'Pilihan alternatif dua'},{id:crypto.randomUUID(),text:'Pilihan alternatif tiga'}],correct_option_id:correct,weight:1,tag:'Matematika'});idsQuestions.push(q.id);}
for(const [title,mode] of [['Penilaian Matematika · Bab 1','exam'],['Latihan mandiri · Aljabar','quiz']]){const e=await call(ids.teacher,'exams.save',{title,instructions:'Kerjakan secara mandiri. Pilih satu jawaban paling tepat untuk setiap soal.',class_id:c.id,mode,opens_at:new Date(Date.now()-3600000).toISOString(),closes_at:new Date(Date.now()+86400000).toISOString(),duration_minutes:60,passing_score:70,penalty:0,shuffle_questions:true,shuffle_options:true,question_ids:idsQuestions,participant_emails:[]});await call(ids.teacher,'exams.publish',{id:e.id});}
if(process.env.PERFORMANCE_FIXTURE==='1'){
 await db.query("insert into private.questions(owner_id,kind,prompt,options,correct_option_id,rubric,weight,tag) select $1,'essay','Soal performa '||n||' '||repeat('materi ',40),'[]',null,repeat('pedoman ',50),1,'Kinerja' from generate_series(1,1000) n",[ids.teacher]);
 await db.query("insert into private.classes(owner_id,name) select $1,'Kelas performa '||n from generate_series(1,100) n",[ids.teacher]);
 await db.exec("insert into private.profiles(id,email,name,role) select gen_random_uuid(),'performance-'||n||'@school.test','Peserta pengujian '||n,'student' from generate_series(1,500) n");
 await db.query("insert into private.memberships(class_id,email) select $1,email from private.profiles where email like 'performance-%'",[c.id]);
 await db.query("insert into private.exams(owner_id,title,mode,opens_at,closes_at,duration_minutes) select $1,'Draft performa '||n,'quiz',now(),now()+interval '1 day',60 from generate_series(1,100) n",[ids.teacher]);
}
function user(id){const p=profiles.find(p=>p.id===id);if(!p)return null;return {id:p.id,email:p.email,aud:'authenticated',role:'authenticated',email_confirmed_at:'2026-01-01T00:00:00Z',confirmed_at:'2026-01-01T00:00:00Z',created_at:'2026-01-01T00:00:00Z',app_metadata:{provider:'email',providers:['email']},user_metadata:{full_name:p.name},identities:[{id:p.id,user_id:p.id,provider:'email',identity_data:{email:p.email}}]};}
// Explicit controls exist only in this loopback test server, never in the application.
const workspaceStates=new Map();
const counters={auth:0,rpc:{},bytes:0};
const server=createServer(async(req,res)=>{res.setHeader('Content-Type','application/json');try{
 if(req.url==='/test/metrics'&&req.headers['x-fixture-control']==='visual-test'){res.end(JSON.stringify(counters));return;}
 if(req.url==='/test/workspace'&&req.method==='POST'){
  if(req.headers['x-fixture-control']!=='visual-test'){res.statusCode=403;res.end('{}');return;}
  let body='';for await(const chunk of req)body+=chunk;const {actor,state}=JSON.parse(body);
  if(!Object.values(ids).includes(actor)||!['normal','empty','error','slow'].includes(state)){res.statusCode=400;res.end('{}');return;}
  workspaceStates.set(actor,state);res.end('{"ok":true}');return;
 }
 if(req.url==='/health'){res.end('{"ok":true}');return;}
 if(req.url?.startsWith('/auth/v1/token')&&req.method==='POST'){let body='';for await(const chunk of req)body+=chunk;const p=JSON.parse(body);const profile=profiles.find(x=>x.email===p.email);if(!profile||p.password!=='Valid-test-password-2026'){res.statusCode=400;res.end(JSON.stringify({error:'invalid_grant',error_description:'Invalid login credentials'}));return;}const u=user(profile.id);const token=[{alg:'HS256',typ:'JWT'},{sub:u.id,aud:'authenticated',role:'authenticated',exp:Math.floor(Date.now()/1000)+86400}].map(x=>Buffer.from(JSON.stringify(x)).toString('base64url')).join('.')+'.fixture';res.end(JSON.stringify({access_token:token,refresh_token:'fixture-refresh',token_type:'bearer',expires_in:86400,user:u}));return;}
 if(req.url?.startsWith('/auth/v1/signup')){res.end(JSON.stringify({id:crypto.randomUUID(),email_confirmed_at:null,identities:[]}));return;}
 if(req.url?.startsWith('/auth/v1/recover')||req.url?.startsWith('/auth/v1/logout')){res.end('{}');return;}
 if(req.url?.startsWith('/auth/v1/user')){counters.auth++;const token=req.headers.authorization?.replace('Bearer ','');let id;try{id=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString()).sub;}catch{}const u=user(id);res.statusCode=u?200:401;res.end(JSON.stringify(u??{message:'invalid test identity'}));return;}
 if(req.url?.startsWith('/rest/v1/rpc/')){if(req.headers.apikey!=='fixture-server-secret'){res.statusCode=403;res.end('{"message":"Forbidden"}');return;}let body='';for await(const chunk of req)body+=chunk;const p=JSON.parse(body||'{}');const name=req.url.split('/').at(-1);counters.rpc[name]=(counters.rpc[name]??0)+1;let result;
 if(name==='school_auth_allowed'){result=(await db.query('select public.school_auth_allowed($1) result',[p.p_email])).rows[0].result;}
 else if(name==='school_api'){
  const state=p.p_action==='workspace'?workspaceStates.get(p.p_actor):'normal';
  if(state==='error')throw new Error('SERVER_ERROR');
  if(state==='slow')await new Promise(resolve=>setTimeout(resolve,10000));
  result=await call(p.p_actor,p.p_action,p.p_data);
  if(state==='empty')for(const key of ['exams','questions','classes','attempts','users','invitations','audit'])result[key]=[];
 }
 else if(name==='school_request'){const state=p.p_action.startsWith('view.')?workspaceStates.get(p.p_actor):'normal';if(state==='error')throw new Error('SERVER_ERROR');if(state==='slow')await new Promise(resolve=>setTimeout(resolve,10000));result=(await db.query('select public.school_request($1,$2,$3,$4,$5::jsonb) result',[p.p_actor,p.p_email,p.p_name,p.p_action,JSON.stringify(p.p_data)])).rows[0].result;if(state==='empty'&&result.ok&&result.data){for(const key of Object.keys(result.data)){if(Array.isArray(result.data[key]))result.data[key]=[];else if(typeof result.data[key]==='number')result.data[key]=key==='page'||key==='pageSize'?result.data[key]:0;}}}
 else if(name==='school_accept'){const r=await db.query('select public.school_accept($1,$2,$3) result',[p.p_actor,p.p_email,p.p_name]);result=r.rows[0].result;}
 else if(name==='school_import_questions'){result=(await db.query('select public.school_import_questions($1,$2,$3::jsonb) result',[p.p_actor,p.p_operation,JSON.stringify(p.p_questions)])).rows[0].result;}
 else if(name==='school_rate_limit'){const r=await db.query('select public.school_rate_limit($1,$2) result',[p.p_actor,p.p_lane]);result=r.rows[0].result;}
 else if(name==='school_media_allowed')result=false;
 else if(name==='school_record_metric'){await db.query('select public.school_record_metric($1,$2,$3)',[p.p_operation,p.p_elapsed,p.p_failed]);result=null;}
 else if(name==='school_health'){result=(await db.query('select public.school_health($1) result',[p.p_actor])).rows[0].result;}
 else if(name==='school_accommodation_get'){result=(await db.query('select public.school_accommodation_get($1,$2) result',[p.p_actor,p.p_exam])).rows[0].result;}
 else if(name==='school_accommodation_set'){result=(await db.query('select public.school_accommodation_set($1,$2,$3,$4,$5) result',[p.p_actor,p.p_exam,p.p_email,p.p_exempt,p.p_reason])).rows[0].result;}
 else throw new Error('Unsupported test RPC');res.end(JSON.stringify(result));return;}
 res.statusCode=404;res.end('{"message":"Not found"}');
 }catch(e){res.statusCode=400;res.end(JSON.stringify({code:'P0001',message:e.message,details:null,hint:null}));}});
server.listen(54329,'127.0.0.1',()=>console.log('Test fixture ready on 127.0.0.1:54329 (seed data is test-only)'));
process.on('SIGTERM',()=>server.close(()=>{void db.close().then(()=>process.exit(0));}));

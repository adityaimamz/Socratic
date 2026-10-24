import {test,expect,type Page,type BrowserContext} from "@playwright/test";
import {mkdirSync,writeFileSync} from "node:fs";
const headers={Origin:"http://127.0.0.1:3100"};
type Sample={ms:number;bytes:number;timing:string;status:number};
function summarize(samples:Sample[]){const ms=samples.map(s=>s.ms).sort((a,b)=>a-b);return {samples:samples.length,p50:ms[Math.ceil(ms.length*.50)-1],p95:ms[Math.ceil(ms.length*.95)-1],max:ms.at(-1),bytes:samples.reduce((sum,s)=>sum+s.bytes,0)/samples.length};}
async function signIn(context:BrowserContext,role:string){expect((await context.request.post("/auth/password",{headers,data:{mode:"login",email:`${role}@school.test`,password:"Valid-test-password-2026"}})).ok()).toBe(true);}
async function sample(page:Page,url:string,body?:unknown,method="POST"):Promise<Sample>{return page.evaluate(async({url,body,method})=>{const start=performance.now(),response=await fetch(url,{cache:"no-store",method:body===undefined?"GET":method,headers:body===undefined?{}:{"Content-Type":"application/json"},body:body===undefined?undefined:JSON.stringify(body)}),text=await response.text();return {ms:performance.now()-start,bytes:new TextEncoder().encode(text).length,timing:response.headers.get("server-timing")??"",status:response.status};},{url,body,method});}
test("production-build performance report with explicit local-fixture limits",async({browser})=>{
 const report:{[key:string]:unknown}={environment:"production Next.js build + local embedded PostgreSQL fixture; not hosted Supabase or Vercel",coldDefinition:"First measured request for each view after server startup and login; not a hosting instance cold start.",profile:{rttMs:150,downloadMbps:10,uploadMbps:1,cpuSlowdown:4},dataset:{extraQuestions:1000,extraClasses:100,extraAccounts:500,extraExams:100},targets:{visualP95:100,warmDataP95:1000,readP95:700,saveP95:1000,resetP95:2000},cold:[],reads:{},writes:{},navigation:{},violations:[]};
 const reads=report.reads as Record<string,unknown>,writes=report.writes as Record<string,unknown>,cold=report.cold as unknown[],violations=report.violations as string[];
 async function environment(role:string){const context=await browser.newContext({baseURL:"http://127.0.0.1:3100",viewport:{width:390,height:844}});await signIn(context,role);const page=await context.newPage();await page.goto("/login");const cdp=await context.newCDPSession(page);await cdp.send("Network.enable");await cdp.send("Network.emulateNetworkConditions",{offline:false,latency:150,downloadThroughput:10*1024*1024/8,uploadThroughput:1024*1024/8});await cdp.send("Emulation.setCPUThrottlingRate",{rate:4});return {context,page};}
 for(const role of ["teacher","admin"]){const {context,page}=await environment(role);
  const views=role==="teacher"?["teacher-overview","questions","classes","exams"]:["admin-users","admin-settings","admin-audit"];
  for(const view of views){const url=`/api/views/${view}`,first=await sample(page,url);cold.push({view,...first});expect(first.status).toBe(200);const samples:Sample[]=[];for(let n=0;n<50;n++){const value=await sample(page,url);expect(value.status).toBe(200);samples.push(value);}const summary=summarize(samples);reads[view]={...summary,exampleServerTiming:samples.at(-1)?.timing};if(summary.p95>700)violations.push(`${view}: read p95 ${summary.p95.toFixed(1)} ms`);}
  if(role==="teacher"){
   const legacy=await sample(page,"/api/workspace");report.payloadComparison={legacyWorkspaceBytes:legacy.bytes,questionsPageBytes:(reads.questions as {bytes:number}).bytes,note:"Both endpoints use the new Auth/RPC pipeline; this is a payload comparison, not a historical latency baseline."};
   const cases=[{path:"/manage/questions",view:"questions",label:"Bank soal"},{path:"/manage/classes",view:"classes",label:"Kelas & peserta"},{path:"/manage/exams",view:"exams",label:"Ujian"}];
   for(const row of cases){await page.goto(row.path);await expect(page.locator(`[data-view-ready="${row.view}"]`)).toBeVisible();}
   for(let n=0;n<50;n++)for(const row of cases){await page.getByRole("button",{name:"Buka navigasi"}).click();await page.getByRole("link",{name:row.label,exact:true}).click();await expect(page).toHaveURL(row.path);await expect(page.locator(`[data-view-ready="${row.view}"]`)).toBeVisible();}
   const marks=await page.evaluate(()=>({visual:performance.getEntriesByName("socratic:navigation-visual").map(e=>({ms:e.duration,path:(e as PerformanceMeasure).detail?.path})),data:performance.getEntriesByName("socratic:navigation-data").map(e=>({ms:e.duration,path:(e as PerformanceMeasure).detail?.path}))}));
   const visual=summarize(marks.visual.map(({ms})=>({ms,bytes:0,status:200,timing:""}))),data=summarize(marks.data.map(({ms})=>({ms,bytes:0,status:200,timing:""})));const byRoute=Object.fromEntries(cases.map(({path})=>[path,{visual:summarize(marks.visual.filter(e=>e.path===path).map(({ms})=>({ms,bytes:0,status:200,timing:""}))),data:summarize(marks.data.filter(e=>e.path===path).map(({ms})=>({ms,bytes:0,status:200,timing:""})))}]));report.navigation={visual,data,byRoute};for(const [path,value] of Object.entries(byRoute)){if(value.visual.p95>100)violations.push(`${path}: visual p95 ${value.visual.p95.toFixed(1)} ms`);if(value.data.p95>1000)violations.push(`${path}: data p95 ${value.data.p95.toFixed(1)} ms`);}if(visual.p95>100)violations.push(`navigation visual p95 ${visual.p95.toFixed(1)} ms`);if(data.p95>1000)violations.push(`navigation data p95 ${data.p95.toFixed(1)} ms`);
   expect(marks.visual.length).toBeGreaterThanOrEqual(150);expect(marks.data.length).toBeGreaterThanOrEqual(150);
   await page.goBack();await expect(page).toHaveURL("/manage/classes");await expect(page.locator('[data-view-ready="classes"]')).toBeVisible();
   await page.goForward();await expect(page).toHaveURL("/manage/exams");await expect(page.locator('[data-view-ready="exams"]')).toBeVisible();
   mkdirSync(".local/performance/screens",{recursive:true});
   for(const width of [390,768,1440]){
    await page.setViewportSize({width,height:844});
    for(const [path,ready,name] of [["/manage/questions","questions","questions"],["/manage/classes","classes","classes"],["/manage/exams/new","exam-editor","exam-editor"]]){
     await page.goto(path);await expect(page.locator(`[data-view-ready="${ready}"]`)).toBeVisible();await page.evaluate(()=>document.fonts.ready);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`.local/performance/screens/${name}-${width}.png`});
    }
   }
  }
  await context.close();
 }
 const {context,page}=await environment("student");const workspace=await (await context.request.get("/api/workspace")).json();const exam=workspace.exams.find((e:{mode:string})=>e.mode==="exam");
 for(const view of ["student-dashboard",`exam-rules?id=${exam.id}`]){const first=await sample(page,`/api/views/${view}`);cold.push({view,...first});const samples:Sample[]=[];for(let n=0;n<50;n++){const value=await sample(page,`/api/views/${view}`);expect(value.status).toBe(200);samples.push(value);}const summary=summarize(samples);reads[view]={...summary,exampleServerTiming:samples.at(-1)?.timing};if(summary.p95>700)violations.push(`${view}: read p95 ${summary.p95.toFixed(1)} ms`);}
 const session=crypto.randomUUID(),attempt=await (await context.request.post(`/api/exams/${exam.id}/attempts`,{headers,data:{session_id:session}})).json();expect(attempt.id).toBeTruthy();
 const saves:Sample[]=[],resets:Sample[]=[];
 for(let n=0;n<50;n++){const value=await sample(page,`/api/attempts/${attempt.id}/answers/${attempt.items[0].id}`,{session_id:session,answer_epoch:0,expected_revision:n,operation_id:crypto.randomUUID(),option_id:attempt.items[0].options[0].id,marked:false,current_question:0},"PUT");expect(value.status).toBe(200);saves.push(value);}
 for(let n=0;n<50;n++){const value=await sample(page,`/api/attempts/${attempt.id}/events`,{session_id:session,answer_epoch:n,event_id:crypto.randomUUID(),type:"visibility_hidden"});expect(value.status).toBe(200);resets.push(value);}
 writes.save=summarize(saves);writes.reset=summarize(resets);if(summarize(saves).p95>1000)violations.push("save p95 exceeded 1000 ms");if(summarize(resets).p95>2000)violations.push("reset p95 exceeded 2000 ms");
 await context.close();report.completedAt=new Date().toISOString();mkdirSync(".local/performance",{recursive:true});writeFileSync(".local/performance/navigation-production.json",JSON.stringify(report,null,2));
 expect(violations,JSON.stringify(report)).toEqual([]);
});

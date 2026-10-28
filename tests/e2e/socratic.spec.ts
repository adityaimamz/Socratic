import {test,expect,type BrowserContext,type Page} from "@playwright/test";
import {mkdirSync,writeFileSync} from "node:fs";
import {inspectScreen,renderErrorPreview} from "../support/visual";

// Visual audits already retain every screenshot and inspector report. Avoid duplicating
// their embedded font/image snapshots into a very large trace archive on OneDrive.
test.use({trace:"off"});

async function signIn(context:BrowserContext,role:"student"|"teacher"|"admin"){
 const response=await context.request.post("/auth/password",{headers:{Origin:"http://127.0.0.1:3100"},data:{mode:"login",email:`${role}@school.test`,password:"Valid-test-password-2026"}});
 expect(response.ok()).toBe(true);
}

test("Socratic covers public and role pages at three widths",async({browser})=>{
 test.setTimeout(1800000);
 const coverage:{role:string;route:string;name:string;width:number}[]=[];
 mkdirSync(".taste-skill/after",{recursive:true});
 async function audit(page:Page,role:string,route:string,name:string){
  await page.setViewportSize({width:1440,height:900});await page.goto(route);await expect(page.locator("h1")).toHaveCount(1);
  await expect(page).toHaveTitle(/Socratic/);
  const logo=page.getByRole("link",{name:"Socratic, beranda"}).first().locator("img");
  await expect(logo).toBeVisible();await expect(logo).toHaveAttribute("width","512");await expect(logo).toHaveAttribute("height","382");
  await expect.poll(()=>logo.evaluate((img:HTMLImageElement)=>img.complete&&img.naturalWidth>0)).toBe(true);
  await expect(page.locator("body")).not.toContainText("Safe Exam");
  for(const width of [1440,768,390]){
   await page.setViewportSize({width,height:900});await page.evaluate(()=>document.fonts.ready);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${name} overflows at ${width}`).toBe(true);
   await page.screenshot({path:`.taste-skill/after/${name}-${width}.png`,fullPage:true});
   coverage.push({role,route,name,width});
  }
  await page.setViewportSize({width:1440,height:900});
  await inspectScreen(page,`socratic-${name}`);
 }
 // A role filter allows an interrupted visual audit to resume without repeating completed roles.
 const requested=process.env.SOCRATIC_AUDIT_ROLES?.split(",");
 for(const role of ["public","student","teacher","admin"] as const){
  if(requested&&!requested.includes(role))continue;
  const context=await browser.newContext({baseURL:"http://127.0.0.1:3100"});
  if(role!=="public")await signIn(context,role);
  const page=await context.newPage();
  if(role==="public"){
   for(const route of ["/login","/privacy","/setup","/access-pending","/not-a-page"])await audit(page,role,route,route==="/not-a-page"?"not-found":route.slice(1));
   await audit(page,role,"/login?error=confirmation","login-error");
   await page.getByRole("button",{name:"Daftar dengan email",exact:true}).click();await inspectScreen(page,"socratic-register");
   await page.getByRole("button",{name:"Kembali ke halaman masuk",exact:true}).click();await page.getByRole("button",{name:"Lupa kata sandi?",exact:true}).click();await inspectScreen(page,"socratic-recover");
  }else{
   const w=await(await context.request.get("/api/workspace")).json();
   const exam=w.exams.find((e:{title:string})=>e.title==="Penilaian Matematika · Bab 1");
   if(role==="student"){
    for(const [route,name] of [["/dashboard","student-dashboard"],[`/exams/${exam.id}`,"exam-detail"],[`/exams/${exam.id}/check`,"preflight"],["/auth/reset-password","reset-password"]])await audit(page,role,route,name);
   }else if(role==="teacher"){
    for(const [route,name] of [["/manage","teacher-dashboard"],["/manage/questions","questions"],["/manage/questions/new","question-new"],[`/manage/questions/${w.questions[0].id}`,"question-edit"],["/manage/classes","classes"],["/manage/exams","exams"],["/manage/exams/new","exam-new"],[`/manage/exams/${exam.id}`,"staff-exam-detail"],[`/manage/exams/${exam.id}/participants`,"participants"],[`/manage/exams/${exam.id}/monitor`,"monitor"],[`/manage/exams/${exam.id}/results`,"staff-results"]])await audit(page,role,route,name);
    await page.goto("/manage/exams/new");await page.getByLabel("Judul ujian",{exact:true}).fill("Draft pemeriksaan desain");await page.getByText("Pilih soal satu per satu").click();await page.locator(".selection-list input").first().check();await page.getByRole("button",{name:"Simpan draft ujian"}).click();await expect(page).toHaveURL(/\/manage\/exams\/[\da-f-]+$/);const draft=page.url().split("/").at(-1);
    for(const [suffix,name] of [["","draft-detail"],["/edit","draft-edit"],["/preview","draft-preview"]])await audit(page,role,`/manage/exams/${draft}${suffix}`,name);
   }else{
    await audit(page,role,`/manage/exams/${exam.id}/participants`,"admin-participants");
    for(const route of ["/manage","/admin/users","/admin/settings","/admin/audit"])await audit(page,role,route,route==="/manage"?"admin-dashboard":route.slice(1).replace("/","-"));
   }
  }
  await context.close();
 }
 writeFileSync(`.taste-skill/after/routes-${requested?requested.join("-"):"all"}.json`,JSON.stringify(coverage,null,2));
});

test("mobile navigation traps focus, closes with Escape, and returns focus",async({page,context})=>{
 await signIn(context,"admin");await page.setViewportSize({width:390,height:844});await page.goto("/manage");
 const menu=page.getByRole("button",{name:"Buka navigasi"});await menu.focus();await page.keyboard.press("Enter");
 const dialog=page.getByRole("dialog",{name:"Navigasi Socratic"});await expect(dialog).toBeVisible();
 for(let i=0;i<18;i++){await page.keyboard.press("Tab");expect(await dialog.evaluate(el=>el.contains(document.activeElement))).toBe(true);}
 await page.keyboard.press("Escape");await expect(dialog).toHaveCount(0);await expect(menu).toBeFocused();
 await menu.click();await page.getByRole("link",{name:"Bank soal",exact:true}).click();await expect(page.getByRole("heading",{name:"Bank soal",exact:true})).toBeVisible();
 await menu.click();await page.setViewportSize({width:1440,height:900});await expect(dialog).toHaveCount(0);
});

test("phone question map stays usable while answers and time remain intact",async({page,context})=>{
 test.setTimeout(240000);
 await signIn(context,"admin");
 const w=await(await context.request.get("/api/workspace")).json();
 const created=await context.request.post("/api/exams/save",{headers:{Origin:"http://127.0.0.1:3100"},data:{title:"Quiz peta soal",mode:"quiz",instructions:"Uji navigasi soal.",class_id:null,opens_at:new Date(Date.now()-60000).toISOString(),closes_at:new Date(Date.now()+86400000).toISOString(),duration_minutes:60,passing_score:70,penalty:0,shuffle_questions:false,shuffle_options:false,question_ids:w.questions.filter((q:{kind:string})=>q.kind==="mcq").slice(0,2).map((q:{id:string})=>q.id),participant_emails:["student@school.test"]}});
 expect(created.ok()).toBe(true);const exam=await created.json();expect((await context.request.post(`/api/exams/${exam.id}/publish`,{headers:{Origin:"http://127.0.0.1:3100"},data:{}})).ok()).toBe(true);
 await signIn(context,"student");await page.goto("/dashboard");
 const attempt=await page.evaluate(async id=>{const session_id=crypto.randomUUID();sessionStorage.setItem("safe-exam-session",session_id);return(await fetch(`/api/exams/${id}/attempts`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({session_id})})).json();},exam.id);
 await page.setViewportSize({width:390,height:844});await page.goto(`/attempts/${attempt.id}`);await expect(page.getByRole("radio").first()).toBeVisible();await page.getByRole("radio").first().check();await expect(page.getByRole("status").filter({hasText:"Tersimpan"})).toBeVisible();
 const map=page.getByRole("button",{name:"Buka peta soal"});await map.click();await expect(page.getByRole("navigation",{name:"Navigasi soal"})).toBeVisible();await page.getByRole("button",{name:"Soal 2",exact:true}).click();await expect(page.getByText("Soal 2 dari 2",{exact:true})).toBeVisible();await page.getByRole("button",{name:"Soal 1, terjawab",exact:true}).click();await expect(page.getByRole("radio").first()).toBeChecked();
 await page.getByRole("button",{name:"Tutup peta soal"}).click();await expect(page.getByRole("navigation",{name:"Navigasi soal"})).toBeHidden();await expect(page.getByLabel("Sisa waktu ujian")).not.toHaveText("00:00");
 await inspectScreen(page,"socratic-runner");
 await page.getByRole("button",{name:"Kirim ujian",exact:true}).click();await expect(page.getByRole("dialog")).toBeVisible();await page.keyboard.press("Escape");await expect(page.getByRole("dialog")).toHaveCount(0);
 await page.getByRole("button",{name:"Kirim ujian",exact:true}).click();await page.getByRole("button",{name:"Ya, kirim ujian"}).click();await expect(page.getByRole("heading",{name:"Ujian telah diterima"})).toBeVisible();await inspectScreen(page,"socratic-result");
});

test("zoom and reduced motion preserve access to the primary controls",async({page,context})=>{
 await signIn(context,"admin");await page.emulateMedia({reducedMotion:"reduce"});await page.setViewportSize({width:1440,height:900});await page.goto("/admin/settings");
 await expect(page.getByText("Finalisasi tertunda",{exact:true})).toBeVisible();
 await page.evaluate(()=>document.documentElement.style.zoom="2");
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await expect(page.getByRole("button",{name:"Simpan pengaturan"})).toBeVisible();
 await page.getByLabel("Nama lembaga").focus();await expect(page.getByLabel("Nama lembaga")).toBeFocused();
 expect(await page.evaluate(()=>getComputedStyle(document.activeElement!).outlineStyle)).not.toBe("none");
 await page.locator("h1").evaluate(el=>el.textContent="Pengaturan lembaga "+"IdentitasLembaga".repeat(15));
 await page.getByLabel("Nama lembaga").fill("Lembaga pendidikan "+"Nama sangat panjang ".repeat(12));
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test("system loading, retry and empty states keep the Socratic frame",async({page,context})=>{
 test.setTimeout(300000);await signIn(context,"admin");
 async function state(value:string){const r=await context.request.post("http://127.0.0.1:54329/test/workspace",{headers:{"x-fixture-control":"visual-test"},data:{actor:"10000000-0000-4000-8000-000000000001",state:value}});expect(r.ok()).toBe(true);}
 try{
  await state("empty");
  for(const [route,name] of [["/manage","overview"],["/manage/questions","questions"],["/manage/classes","classes"],["/manage/exams","exams"],["/admin/users","users"],["/admin/audit","audit"]]){
   await page.goto(route);await expect(page.locator(".empty").first()).toBeVisible();await inspectScreen(page,`socratic-empty-${name}`);
  }
  await state("slow");await page.goto("/manage",{waitUntil:"commit"});await expect(page.getByRole("heading",{name:"Menyiapkan ruang ujian",exact:true})).toBeVisible();await inspectScreen(page,"socratic-loading");
  // Workspace failures retain the existing admission redirect. Render the root error component
  // separately so its appearance is verified without changing that authorization contract.
  await state("error");await page.goto("/manage");await expect(page).toHaveURL(/\/access-pending$/);
  await state("normal");await page.goto("/manage");await expect(page.getByRole("heading",{name:"Ruang pengajar",exact:true})).toBeVisible();
  const head=(await page.locator("head").innerHTML()).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,"");
  const html=`<!doctype html><html lang="id"><head>${head}</head><body>${renderErrorPreview()}</body></html>`;
  await page.route("**/system-error-preview",route=>route.fulfill({contentType:"text/html",body:html}));
  await page.goto("/system-error-preview");await expect(page.getByRole("heading",{name:"Halaman belum dapat dimuat",exact:true})).toBeVisible();await inspectScreen(page,"socratic-error");
 }finally{await state("normal");}
});

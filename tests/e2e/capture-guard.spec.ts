import {test,expect,type BrowserContext,type Page} from "@playwright/test";

async function login(context:BrowserContext,role:"teacher"|"student"){
 const id=role==="teacher"?"10000000-0000-4000-8000-000000000002":"10000000-0000-4000-8000-000000000003";
 const token=[{alg:"HS256",typ:"JWT"},{sub:id,aud:"authenticated",role:"authenticated",exp:Math.floor(Date.now()/1000)+86400,iat:Math.floor(Date.now()/1000)}].map(o=>Buffer.from(JSON.stringify(o)).toString("base64url")).join(".")+".fixture";
 const session={access_token:token,refresh_token:"fixture-refresh",token_type:"bearer",expires_in:86400,expires_at:Math.floor(Date.now()/1000)+86400,user:{id,email:`${role}@school.test`}};
 await context.addCookies([{name:"sb-127-auth-token",value:"base64-"+Buffer.from(JSON.stringify(session)).toString("base64url"),domain:"127.0.0.1",path:"/",httpOnly:false,sameSite:"Lax"}]);
}
async function start(page:Page,context:BrowserContext,mode:"exam"|"quiz"){
 await login(context,"teacher");
 const workspace=await(await context.request.get("/api/workspace")).json();
 const headers={Origin:"http://127.0.0.1:3100"};
 const saved=await context.request.post("/api/exams/save",{headers,data:{title:`Capture guard ${mode}`,mode,class_id:null,instructions:"Kerjakan sendiri dan ikuti arahan pengawas.",opens_at:new Date(Date.now()-60000).toISOString(),closes_at:new Date(Date.now()+3600000).toISOString(),duration_minutes:30,passing_score:70,penalty:0,shuffle_questions:false,shuffle_options:false,question_ids:workspace.questions.filter((q:{archived:boolean})=>!q.archived).slice(0,2).map((q:{id:string})=>q.id),participant_emails:["student@school.test"]}});
 expect(saved.ok()).toBe(true);const exam=await saved.json();
 expect((await context.request.post(`/api/exams/${exam.id}/publish`,{headers,data:{}})).ok()).toBe(true);
 await login(context,"student");await page.goto("/dashboard");
 const attempt=await page.evaluate(async id=>{
  const sid=crypto.randomUUID();sessionStorage.setItem("safe-exam-session",sid);
  return(await fetch(`/api/exams/${id}/attempts`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({session_id:sid})})).json();
 },exam.id);
 await page.goto(`/attempts/${attempt.id}`);await expect(page.getByRole("radio").first()).toBeVisible();
 return attempt;
}

test("capture shield conceals questions without resetting answers, protects print, and preserves strict reset",async({page,context})=>{
 test.setTimeout(120000);
 const attempt=await start(page,context,"exam");
 await page.getByRole("radio").first().check();
 await expect(page.getByRole("status").filter({hasText:"Tersimpan di sistem"})).toBeVisible();
 const read=()=>page.evaluate(async id=>(await fetch(`/api/attempts/${id}?session_id=${sessionStorage.getItem("safe-exam-session")}`)).json(),attempt.id);
 const before=await read();
 // Synthetic events verify the page response, not actual OS screenshot prevention.
 for(const event of [
  {type:"keydown",key:"PrintScreen",code:"PrintScreen"},
  {type:"keyup",key:"PrintScreen",code:"PrintScreen"},
  {type:"keydown",key:"S",code:"KeyS",metaKey:true,shiftKey:true},
  {type:"keydown",key:"$",code:"Digit4",metaKey:true,shiftKey:true},
  {type:"keydown",key:"s",ctrlKey:true,shiftKey:true},
  {type:"keydown",key:"p",ctrlKey:true}
 ]){
  const prevented=await page.evaluate(({type,...init})=>!window.dispatchEvent(new KeyboardEvent(type,{...init,cancelable:true,bubbles:true})),event);
  expect(prevented).toBe(true);
  await expect(page.getByRole("heading",{name:"Soal ditutup sementara"})).toBeVisible();
  await expect(page.locator("#question-heading")).toBeHidden();
  await page.keyboard.press("Escape");await expect(page.locator("#question-heading")).toBeHidden();
  await page.getByRole("button",{name:"Lanjut mengerjakan"}).click();
  await expect(page.getByRole("radio").first()).toBeChecked();
 }
 const after=await read();expect(after.answers).toEqual(before.answers);expect(after.answer_epoch).toBe(before.answer_epoch);expect(after.deadline_at).toBe(before.deadline_at);
 await page.emulateMedia({media:"print"});await expect(page.locator(".runner")).toBeHidden();await page.emulateMedia({media:"screen"});
 // A browser print menu must conceal content too, without relying on a shortcut.
 await page.evaluate(()=>window.dispatchEvent(new Event("beforeprint")));
 await expect(page.locator("#question-heading")).toBeHidden();await page.getByRole("button",{name:"Lanjut mengerjakan"}).click();
 // A capture shortcut over an existing dialog must hide that dialog as well.
 await page.getByRole("button",{name:"Kirim ujian",exact:true}).click();
 await page.evaluate(()=>window.dispatchEvent(new Event("blur")));
 await expect(page.getByRole("heading",{name:"Kirim ujian sekarang?"})).toBeHidden();
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:900});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:`test-results/capture-shield-${width}.png`,fullPage:true});
 }
 // Hidden-page reset still runs underneath the shield, then presents its own dialog.
 await page.evaluate(()=>{Object.defineProperty(document,"hidden",{configurable:true,get:()=>true});document.dispatchEvent(new Event("visibilitychange"));});
 await expect.poll(async()=>(await read()).answer_epoch).toBe(before.answer_epoch+1);
 await page.evaluate(()=>{Object.defineProperty(document,"hidden",{configurable:true,get:()=>false});document.dispatchEvent(new Event("visibilitychange"));});
 await page.getByRole("button",{name:"Lanjut mengerjakan"}).click();
 await expect(page.getByRole("heading",{name:"Semua jawaban dihapus",exact:true})).toBeVisible();
 await page.getByRole("button",{name:"Lanjut mengerjakan"}).click();
 await expect(page.getByRole("radio").first()).not.toBeChecked();
 await page.getByRole("button",{name:"Kirim ujian",exact:true}).click();await page.getByRole("button",{name:"Ya, kirim ujian"}).click();
 await expect(page.getByRole("heading",{name:"Ujian telah diterima"})).toBeVisible();
 await page.evaluate(()=>window.dispatchEvent(new KeyboardEvent("keyup",{key:"PrintScreen"})));
 await expect(page.getByRole("heading",{name:"Soal ditutup sementara"})).toHaveCount(0);
});

test("quiz stays interactive for capture keys and focus changes",async({page,context})=>{
 await start(page,context,"quiz");
 await page.getByRole("radio").first().check();
 await page.evaluate(()=>{window.dispatchEvent(new KeyboardEvent("keyup",{key:"PrintScreen"}));window.dispatchEvent(new Event("blur"));});
 await expect(page.getByRole("radio").first()).toBeVisible();await expect(page.getByRole("radio").first()).toBeChecked();
 await expect(page.getByRole("heading",{name:"Soal ditutup sementara"})).toHaveCount(0);
 await page.emulateMedia({media:"print"});await expect(page.locator(".runner")).toBeVisible();
});



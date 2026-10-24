import {test,expect,type BrowserContext,type Page} from "@playwright/test";
import {mkdirSync} from "node:fs";
import {inspectScreen} from "../support/visual";

const headers={Origin:"http://127.0.0.1:3100"};
async function signIn(context:BrowserContext,role:"student"|"teacher"){
 const response=await context.request.post("/auth/password",{headers,data:{mode:"login",email:`${role}@school.test`,password:"Valid-test-password-2026"}});
 expect(response.ok()).toBe(true);
}
async function makeExam(context:BrowserContext,mode:"exam"|"quiz"){
 await signIn(context,"teacher");
 const workspace=await (await context.request.get("/api/workspace")).json();
 const saved=await context.request.post("/api/exams/save",{headers,data:{title:mode==="exam"?"Ujian Bahasa Indonesia":"Kuis Bahasa Indonesia",instructions:"Baca soal dengan teliti. Kerjakan sendiri tanpa membuka buku atau aplikasi lain.",mode,class_id:null,opens_at:new Date(Date.now()-60000).toISOString(),closes_at:new Date(Date.now()+7200000).toISOString(),duration_minutes:30,passing_score:70,penalty:2,shuffle_questions:false,shuffle_options:false,question_ids:workspace.questions.filter((q:{archived:boolean})=>!q.archived).slice(0,2).map((q:{id:string})=>q.id),participant_emails:["student@school.test"]}});
 expect(saved.ok()).toBe(true);const exam=await saved.json();
 expect((await context.request.post(`/api/exams/${exam.id}/publish`,{headers,data:{}})).ok()).toBe(true);
 return exam;
}
const jargon=/\b(fullscreen|server|reset|sinkron\w*|tersinkron\w*|retensi|event|audit|database|konfigurasi|browser|password|offline|online|sesi|attempt|epoch)\b/i;
async function readable(page:Page,name:string){
 await page.evaluate(()=>document.fonts.ready);
 expect(await page.getByRole("main").innerText()).not.toMatch(jargon);
 mkdirSync(".taste-skill/copywriting",{recursive:true});
 for(const width of [1440,768,390]){
  await page.setViewportSize({width,height:900});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:`.taste-skill/copywriting/${name}-${width}.png`,fullPage:true});
 }
}

test("student instructions distinguish strict exams, quizzes and activity evidence before starting",async({page,context})=>{
 test.setTimeout(300000);
 await page.goto("/login");await readable(page,"login");
 await page.getByRole("button",{name:"Daftar dengan email",exact:true}).click();await readable(page,"register");
 await page.getByRole("button",{name:"Kembali ke halaman masuk"}).click();await page.getByRole("button",{name:"Lupa kata sandi?"}).click();await readable(page,"recover");
 await page.goto("/privacy");await readable(page,"privacy");
 const strict=await makeExam(context,"exam"),quiz=await makeExam(context,"quiz");
 await signIn(context,"student");await page.goto("/dashboard");await readable(page,"dashboard");
 for(const exam of [strict,quiz]){
  await page.goto(`/exams/${exam.id}`);await expect(page.getByRole("heading",{name:exam.mode==="exam"?"Aturan ujian ketat":"Aturan kuis",exact:true})).toBeVisible();await readable(page,`detail-${exam.mode}`);
  await page.getByRole("link",{name:"Periksa kesiapan"}).click();
  await expect(page.getByText("Terhubung",{exact:true})).toBeVisible();
  const start=page.getByRole("button",{name:"Mulai ujian",exact:true});await expect(start).toBeDisabled();
  await expect(page.getByText("tidak otomatis membuktikan kecurangan",{exact:false})).toBeVisible();
  if(exam.mode==="exam"){
   await expect(page.getByText("termasuk yang sudah tersimpan",{exact:false}).first()).toBeVisible();
   await expect(page.getByText("Membuka halaman lain, berpindah aplikasi",{exact:false})).toBeVisible();
  }else{
   await expect(page.getByText("Tidak wajib",{exact:true})).toBeVisible();
   await expect(page.getByText("tidak menghapus jawaban secara otomatis",{exact:false})).toBeVisible();
   await expect(page.getByText("Keluar halaman, jawaban dihapus",{exact:true})).toHaveCount(0);
  }
  await page.getByRole("checkbox").check();await expect(start).toBeEnabled();
  await readable(page,`preflight-${exam.mode}`);await inspectScreen(page,`copywriting-${exam.mode}`);
 }
});

test("strict copy matches deletion, fullscreen exception, offline saving and resumed time",async({page,context})=>{
 test.setTimeout(180000);const exam=await makeExam(context,"exam");
 expect((await context.request.post(`/api/exams/${exam.id}/accommodation`,{headers,data:{email:"student@school.test",fullscreen_exempt:true,reason:"Perangkat membutuhkan izin tanpa layar penuh"}})).ok()).toBe(true);
 await signIn(context,"student");await page.goto(`/exams/${exam.id}/check`);
 await expect(page.getByText("Izin tanpa layar penuh",{exact:true})).toBeVisible();
 await page.getByRole("checkbox").check();await page.getByRole("button",{name:"Mulai ujian",exact:true}).click();
 await expect(page.getByRole("radio").first()).toBeVisible();const attemptId=page.url().split("/").at(-1)!;
 await page.getByRole("radio").first().check();await expect(page.getByRole("status").filter({hasText:"Tersimpan di sistem"})).toBeVisible();
 const before=await (await context.request.get(`/api/attempts/${attemptId}?session_id=${await page.evaluate(()=>sessionStorage.getItem("safe-exam-session"))}`)).json();
 await page.evaluate(()=>document.dispatchEvent(new Event("fullscreenchange")));
 await expect(page.getByRole("radio").first()).toBeChecked();await readable(page,"runner");
 await context.setOffline(true);await expect(page.getByText("Internet terputus",{exact:true}).last()).toBeVisible();await readable(page,"offline");
 await page.evaluate(()=>{Object.defineProperty(document,"hidden",{configurable:true,get:()=>true});document.dispatchEvent(new Event("visibilitychange"));});
 await expect(page.getByRole("heading",{name:"Menghapus semua jawaban"})).toBeVisible();
 await expect(page.getByRole("radio").first()).toBeDisabled();
 await page.evaluate(()=>{Object.defineProperty(document,"hidden",{configurable:true,get:()=>false});document.dispatchEvent(new Event("visibilitychange"));});
 await context.setOffline(false);await expect(page.getByRole("heading",{name:"Semua jawaban dihapus",exact:true})).toBeVisible();await readable(page,"deleted");
 await page.getByRole("button",{name:"Lanjut mengerjakan"}).click();await expect(page.getByRole("radio").first()).not.toBeChecked();
 const after=await (await context.request.get(`/api/attempts/${attemptId}?session_id=${await page.evaluate(()=>sessionStorage.getItem("safe-exam-session"))}`)).json();
 expect(after.answers).toEqual({});expect(after.deadline_at).toBe(before.deadline_at);expect(after.reset_count).toBe(1);
 await signIn(context,"teacher");expect((await context.request.post(`/api/manage/attempts/${attemptId}/actions`,{headers,data:{action:"extend",minutes:10,reason:"Tambahan waktu untuk memeriksa perangkat"}})).ok()).toBe(true);
 await signIn(context,"student");await page.goto(`/exams/${exam.id}/check`);
 await expect(page.getByText("Sebelum melanjutkan",{exact:true})).toBeVisible();
 await expect(page.getByText(/Sekitar 3[89] menit/)).toBeVisible();await readable(page,"resume");
 await page.getByRole("checkbox").check();await page.getByRole("button",{name:"Lanjutkan ujian",exact:true}).click();
 await page.getByRole("radio").first().check();await expect(page.getByRole("status").filter({hasText:"Tersimpan di sistem"})).toBeVisible();
 await page.getByRole("button",{name:"Kirim ujian",exact:true}).click();await readable(page,"submit");
 await page.getByRole("button",{name:"Ya, kirim ujian"}).click();await expect(page.getByRole("heading",{name:"Ujian telah diterima"})).toBeVisible();await readable(page,"result");
});

test("quiz activity warning preserves saved answers",async({page,context})=>{
 const exam=await makeExam(context,"quiz");await signIn(context,"student");await page.goto(`/exams/${exam.id}/check`);
 await expect(page.getByText("Terhubung",{exact:true})).toBeVisible();await page.getByRole("checkbox").check();await page.getByRole("button",{name:"Mulai ujian",exact:true}).click();
 await page.getByRole("radio").first().check();await expect(page.getByRole("status").filter({hasText:"Tersimpan di sistem"})).toBeVisible();
 await page.evaluate(()=>{Object.defineProperty(document,"hidden",{configurable:true,get:()=>true});document.dispatchEvent(new Event("visibilitychange"));});
 await expect(page.getByText("Jawabanmu tidak dihapus.",{exact:false})).toBeVisible();await expect(page.getByRole("radio").first()).toBeChecked();
 await page.evaluate(()=>{Object.defineProperty(document,"hidden",{configurable:true,get:()=>false});document.dispatchEvent(new Event("visibilitychange"));});
 await page.reload();await expect(page.getByRole("radio").first()).toBeChecked();
});

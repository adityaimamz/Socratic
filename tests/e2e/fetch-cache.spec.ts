import {test,expect,type BrowserContext} from "@playwright/test";
const origin="http://127.0.0.1:3100",headers={Origin:origin};
async function login(context:BrowserContext,role="teacher"){expect((await context.request.post("/auth/password",{headers,data:{mode:"login",email:`${role}@school.test`,password:"Valid-test-password-2026"}})).ok()).toBe(true);}
async function metrics(context:BrowserContext){return (await context.request.get("http://127.0.0.1:54329/test/metrics",{headers:{"x-fixture-control":"visual-test"}})).json();}
test("a data API request validates Auth once and uses one business RPC",async({context})=>{
 await login(context);const before=await metrics(context);const response=await context.request.get("/api/views/questions");expect(response.ok()).toBe(true);const after=await metrics(context);
 expect(after.auth-before.auth).toBe(1);expect(after.rpc.school_request-(before.rpc.school_request??0)).toBe(1);expect((after.rpc.school_accept??0)-(before.rpc.school_accept??0)).toBe(0);expect((after.rpc.school_rate_limit??0)-(before.rpc.school_rate_limit??0)).toBe(0);
 expect(response.headers()["server-timing"]).toMatch(/auth;dur=.*db;dur=/);const body=await response.json();expect(body).toHaveProperty("items");expect(body).not.toHaveProperty("exams");expect(JSON.stringify(body)).not.toContain("correct_option_id");
});
test("a fresh management cache is reused and an archive invalidates it",async({page,context})=>{
 await login(context);await page.addInitScript(()=>Object.defineProperty(navigator,"connection",{configurable:true,value:{saveData:true}}));
 const requests:string[]=[];page.on("request",r=>{if(r.url().includes("/api/"))requests.push(r.url());});
 await page.goto("/manage/questions");await expect(page.locator('[data-view-ready="questions"]')).toBeVisible();
 const initialReads=requests.filter(url=>url.includes("/api/views/questions?")).length;
 const prompt=await page.locator("tbody .row-title").first().textContent();
 await page.getByRole("link",{name:"Kelas & peserta",exact:true}).click();await expect(page.locator('[data-view-ready="classes"]')).toBeVisible();
 await page.getByRole("link",{name:"Bank soal",exact:true}).click();await expect(page.locator('[data-view-ready="questions"]')).toBeVisible();
 expect(requests.filter(url=>url.includes("/api/views/questions?"))).toHaveLength(initialReads);expect(requests.some(url=>url.includes("/api/workspace"))).toBe(false);
 page.on("dialog",d=>d.accept());await page.locator("tbody tr").filter({hasText:prompt!}).getByRole("button",{name:"Arsip",exact:true}).click();
 await expect(page.getByRole("link",{name:prompt!,exact:true})).toHaveCount(0);
 expect(requests.filter(url=>url.includes("/api/views/questions?"))).toHaveLength(initialReads+1);
});

test("class editors mount on demand and preserve unsaved edits when collapsed",async({page,context})=>{
 await login(context);await page.goto("/manage/classes");await expect(page.locator('[data-view-ready="classes"]')).toBeVisible();
 const row=page.locator(".class-editor").first();await expect(row.locator("form")).toHaveCount(0);
 await row.locator("summary").click();await row.getByLabel("Nama kelas",{exact:true}).fill("Perubahan belum disimpan");
 await row.locator("summary").click();await row.locator("summary").click();
 await expect(row.getByLabel("Nama kelas",{exact:true})).toHaveValue("Perubahan belum disimpan");
});

test("exam preflight refreshes scoped rules without a workspace or accommodation waterfall",async({page,context})=>{
 await login(context,"student");const dashboard=await (await context.request.get("/api/views/student-dashboard")).json();
 const id=dashboard.exams[0].id,requests:string[]=[];page.on("request",request=>{if(request.url().includes("/api/"))requests.push(request.url());});
 await page.goto(`/exams/${id}`);await expect(page.locator('[data-view-ready="exam-rules"]')).toBeVisible();
 const before=requests.filter(url=>url.includes("/api/views/exam-rules?")).length;
 await page.getByRole("link",{name:"Periksa kesiapan",exact:true}).click();await expect(page.getByText("Terhubung",{exact:true})).toBeVisible();
 expect(requests.filter(url=>url.includes("/api/views/exam-rules?")).length).toBeGreaterThan(before);
 expect(requests.some(url=>url.includes("/api/workspace")||url.includes("/accommodation"))).toBe(false);
});
test("prefetch is bounded to two and mobile navigation can return to its starting page",async({page,context})=>{
 await login(context);await page.setViewportSize({width:390,height:844});await page.goto("/manage");await expect(page.locator('[data-view-ready="teacher-overview"]')).toBeVisible();
 let release!:()=>void;const held=new Promise<void>(r=>release=r);let pending=0;
 await page.route("**/api/views/**",async route=>{pending++;await held;await route.continue().catch(()=>{});});
 try{await page.getByRole("button",{name:"Buka navigasi"}).click();await expect.poll(()=>pending).toBe(2);await page.waitForTimeout(350);expect(pending).toBe(2);
  await page.getByRole("link",{name:"Bank soal",exact:true}).click();await expect(page.getByRole("heading",{name:"Bank soal",exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Buka navigasi"}).click();await page.getByRole("link",{name:"Ringkasan",exact:true}).click();
 }finally{release();}
 await expect(page).toHaveURL(/\/manage$/);await expect(page.locator('[data-view-ready="teacher-overview"]')).toBeVisible();await expect(page.locator(".page-skeleton")).toHaveCount(0);
});
test("paginated search returns bounded rows and an editor keeps selections across pages",async({context,page})=>{
 await login(context);const imported=await context.request.post("/api/questions/import/commit",{headers,data:{operation_id:crypto.randomUUID(),questions:Array.from({length:55},(_,i)=>({kind:"essay",prompt:`Soal paginasi ${String(i).padStart(2,"0")}`,options:[],correct_option_id:null,rubric:"Pedoman",weight:1,tag:"Pagination"}))}});expect(imported.ok()).toBe(true);
 const response=await context.request.get("/api/views/questions?q=paginasi&page=1"),body=await response.json();expect(body.total).toBe(55);expect(body.items).toHaveLength(50);
 await page.goto("/manage/exams/new");await page.getByLabel("Cari soal atau tag").fill("paginasi");await expect(page.locator(".picker-controls").filter({has:page.getByLabel("Cari soal atau tag")})).toContainText("55 data");await expect(page.locator(".selection-list label")).toHaveCount(50);
 const first=page.locator(".selection-list label").first();const label=await first.textContent();await first.getByRole("checkbox").check();
 const picker=page.locator(".picker-controls").filter({has:page.getByLabel("Cari soal atau tag")});await picker.getByRole("button",{name:"Berikutnya"}).click();await expect(page.locator(".selection-list label")).toHaveCount(5);
 await page.getByText("Soal terpilih · 1",{exact:true}).click();await expect(page.locator("details").filter({hasText:"Soal terpilih"})).toContainText(label!.split("Esai")[0]);
 await picker.getByRole("button",{name:"Sebelumnya"}).click();await expect(page.locator(".selection-list label").first().getByRole("checkbox")).toBeChecked();
});
test("stale cached content stays visible when its background refresh fails",async({page,context})=>{
 await login(context);await page.goto("/manage/classes");await expect(page.locator('[data-view-ready="classes"]')).toBeVisible();
 let status=503;await page.route("**/api/views/classes?**",route=>route.fulfill({status,contentType:"application/json",body:JSON.stringify({code:status===404?"NOT_FOUND":"SERVER_ERROR"})}));
 await page.evaluate(()=>{const now=Date.now.bind(Date);Date.now=()=>now()+31000;Object.defineProperty(document,"visibilityState",{configurable:true,get:()=>"hidden"});document.dispatchEvent(new Event("visibilitychange",{bubbles:true}));Object.defineProperty(document,"visibilityState",{configurable:true,get:()=>"visible"});document.dispatchEvent(new Event("visibilitychange",{bubbles:true}));});
 await expect(page.locator(".notice[role=alert]")).toContainText("Data terakhir tetap ditampilkan");await expect(page.getByRole("heading",{name:"Kelas & peserta",exact:true})).toBeVisible();
 status=404;await page.getByRole("button",{name:"Coba lagi",exact:true}).click();await expect(page.getByText("Halaman belum berhasil dimuat",{exact:true})).toBeVisible();await expect(page.locator(".class-editor")).toHaveCount(0);
});

test("search keeps the mobile input mounted while waiting and Back/Forward restores its query",async({page,context})=>{
 await login(context);await page.setViewportSize({width:390,height:844});await page.goto("/manage/classes");await expect(page.locator('[data-view-ready="classes"]')).toBeVisible();
 let release!:()=>void;const gate=new Promise<void>(resolve=>release=resolve);let waiting=false;
 await page.route("**/api/views/classes?**",async route=>{if(new URL(route.request().url()).searchParams.get("q")==="pencarian-tidak-ada"){waiting=true;await gate;}await route.continue().catch(()=>{});});
 try{await page.getByLabel("Cari kelas",{exact:true}).fill("pencarian-tidak-ada");await expect.poll(()=>waiting).toBe(true);await expect(page.getByLabel("Cari kelas",{exact:true})).toBeFocused();await expect(page.getByText("Memperbarui data…",{exact:true})).toBeVisible();}finally{release();}
 await expect(page.locator(".class-editor")).toHaveCount(0);await expect(page.getByLabel("Cari kelas",{exact:true})).toBeFocused();
 await page.getByRole("button",{name:"Buka navigasi"}).click();await page.getByRole("link",{name:"Bank soal",exact:true}).click();await expect(page.locator('[data-view-ready="questions"]')).toBeVisible();
 await page.goBack();await expect(page.getByLabel("Cari kelas",{exact:true})).toHaveValue("pencarian-tidak-ada");await expect(page.locator(".class-editor")).toHaveCount(0);
 await page.goForward();await expect(page.locator('[data-view-ready="questions"]')).toBeVisible();
});

for(const change of ["disabled","role"] as const)test(`a ${change} account response clears an already fresh management cache`,async({page,context,browser})=>{
 await login(context);const profile=await (await context.request.get("/api/views/session")).json();const administrator=await browser.newContext({baseURL:origin});await login(administrator,"admin");
 try{
  await page.goto("/manage/classes");await expect(page.locator('[data-view-ready="classes"]')).toBeVisible();
  expect((await administrator.request.post("/api/admin/user",{headers,data:{id:profile.id,role:change==="role"?"student":"teacher",active:change!=="disabled"}})).ok()).toBe(true);
  await page.evaluate(()=>{const now=Date.now.bind(Date);Date.now=()=>now()+31000;window.dispatchEvent(new Event("focus"));});
  await expect(page).toHaveURL(change==="disabled"?/\/access-pending$/:/\/dashboard$/);await expect(page.locator('[data-view-ready="classes"]')).toHaveCount(0);
 }finally{expect((await administrator.request.post("/api/admin/user",{headers,data:{id:profile.id,role:"teacher",active:true}})).ok()).toBe(true);await administrator.close();}
});
test("logout clears cached pages in another tab",async({context,page})=>{
 await login(context);const second=await context.newPage();await page.goto("/manage/questions");await second.goto("/manage/classes");await expect(second.locator('[data-view-ready="classes"]')).toBeVisible();await page.getByRole("button",{name:"Keluar",exact:true}).click();await expect(page).toHaveURL(/\/login$/);await expect(second).toHaveURL(/\/login$/);await second.close();
});

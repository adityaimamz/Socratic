import {test,expect,type BrowserContext} from "@playwright/test";
import {mkdirSync} from "node:fs";
import {inspectScreen} from "../support/visual";
// Visual snapshots embed fonts; keep screenshots/reports without a duplicate OneDrive trace archive.
test.use({trace:"off"});
const headers={Origin:"http://127.0.0.1:3100"};
async function signIn(context:BrowserContext,role="teacher"){
 const r=await context.request.post("/auth/password",{headers,data:{mode:"login",email:`${role}@school.test`,password:"Valid-test-password-2026"}});expect(r.ok()).toBe(true);
}
async function makeLink(context:BrowserContext,limit=40){
 const name=`Kelas undangan ${crypto.randomUUID().slice(0,8)}`;
 const c=await context.request.post("/api/classes/save",{headers,data:{name,emails:[]}});expect(c.ok()).toBe(true);const {id}=await c.json();
 const r=await context.request.post("/api/class-links",{headers,data:{operation:"create",class_id:id,days:7,limit}});expect(r.ok()).toBe(true);
 const {join_url}=await r.json();return {id,name,url:join_url as string,token:new URL(join_url).pathname.split("/").at(-1)!};
}
test("teacher creates and copies a link from class controls; revoke and replace preserve members",async({page,context,browser})=>{
 test.setTimeout(240000);await signIn(context);
 const {id,name}=await makeLink(context);await page.goto("/manage/classes");
 const details=page.locator("details").filter({hasText:name});await details.locator("summary").click();
 await expect(details.getByRole("button",{name:"Buat link baru",exact:true})).toBeVisible();
 page.once("dialog",d=>d.accept());await details.getByRole("button",{name:"Buat link baru",exact:true}).click();
 const field=details.getByLabel("Link untuk dibagikan");await expect(field).toHaveValue(/\/join\/[0-9a-f]{64}$/);
 await context.grantPermissions(["clipboard-read","clipboard-write"]);
 await details.getByRole("button",{name:"Salin link",exact:true}).click();await expect(details.getByText("Link disalin.")).toBeVisible();
 const url=await field.inputValue();expect(await page.evaluate(()=>navigator.clipboard.readText())).toBe(url);
 const student=await browser.newContext();await signIn(student,"student");
 const joined=await student.request.post("/api/class-links",{headers,data:{operation:"join",token:url.split("/").at(-1)}});expect(joined.ok()).toBe(true);
 await page.reload();const reloaded=page.locator("details").filter({hasText:name});await reloaded.locator("summary").click();await expect(reloaded).toContainText("1 dari 40 peserta");
 page.once("dialog",d=>d.accept());await reloaded.getByRole("button",{name:"Nonaktifkan link",exact:true}).click();await expect(reloaded).toContainText("Link dinonaktifkan");
 const c=await context.request.get(`/api/views/class?id=${id}`);expect((await c.json()).class.emails).toContain("student@school.test");
 await page.goto(url);await expect(page.getByText("Link tidak berlaku",{exact:true})).toBeVisible();await student.close();
});
test("uninvited student registers from the link, confirms email and automatically joins",async({context,browser})=>{
 await signIn(context);const {url,id,token}=await makeLink(context);
 const student=await browser.newContext(),p=await student.newPage(),email=`baru-${crypto.randomUUID()}@school.test`;
 await p.goto(url);await p.getByRole("button",{name:"Daftar dengan email",exact:true}).click();
 await p.getByLabel("Nama",{exact:true}).fill("Nadia Peserta Baru");await p.getByLabel("Email",{exact:true}).fill(email);await p.getByLabel("Kata sandi",{exact:true}).fill("Valid-test-password-2026");await p.getByLabel("Ulangi kata sandi",{exact:true}).fill("Valid-test-password-2026");
 await p.getByRole("button",{name:"Buat akun",exact:true}).click();await expect(p.getByText("Periksa email pengaktifan akun",{exact:true})).toBeVisible();
 expect((await student.request.post("/api/class-links",{headers,data:{operation:"join",token}})).status()).toBe(401);
 const c=await context.request.get(`/api/views/class?id=${id}`);expect((await c.json()).class.emails).not.toContain(email);
 const confirmation=await student.request.post("http://127.0.0.1:54329/test/confirmation",{headers:{"x-fixture-control":"visual-test"},data:{email}});expect(confirmation.ok()).toBe(true);
 const confirmationUrl=(await confirmation.json()).url;expect(confirmationUrl).toContain(encodeURIComponent(`/join/${token}`));
 await p.goto(confirmationUrl);await expect(p).toHaveURL(/\/dashboard$/);
 const after=await context.request.get(`/api/views/class?id=${id}`);expect((await after.json()).class.emails).toContain(email);
 const session=await student.request.get("/api/views/session");expect((await session.json()).role).toBe("student");await student.close();
});
test("Google callback preserves the class link for a new verified identity",async({context,browser})=>{
 await signIn(context);const {url,id}=await makeLink(context);const student=await browser.newContext(),p=await student.newPage();
 await p.goto(url);await p.getByRole("link",{name:"Lanjutkan dengan Google"}).click();await expect(p).toHaveURL(/\/dashboard$/);
 const detail=await context.request.get(`/api/views/class?id=${id}`);expect((await detail.json()).class.emails[0]).toMatch(/^google-/);await student.close();
});
test("existing student logs in from a link and joins without an email invitation",async({context,browser})=>{
 await signIn(context);const {url,id}=await makeLink(context);const student=await browser.newContext(),p=await student.newPage();
 await p.goto(url);await p.getByLabel("Email",{exact:true}).fill("other@school.test");await p.getByLabel("Kata sandi",{exact:true}).fill("Valid-test-password-2026");await p.getByRole("button",{name:"Masuk dengan email",exact:true}).click();await expect(p).toHaveURL(/\/dashboard$/);
 const detail=await context.request.get(`/api/views/class?id=${id}`);expect((await detail.json()).class.emails).toEqual(["other@school.test"]);await student.close();
});
test("endpoint enforces authentication, role, same-origin, capacity and bounded inputs",async({context,browser})=>{
 await signIn(context);const {id,token}=await makeLink(context,1);const anonymous=await browser.newContext();
 expect((await anonymous.request.post("/api/class-links",{headers,data:{operation:"create",class_id:id,days:7,limit:40}})).status()).toBe(401);
 const student=await browser.newContext();await signIn(student,"student");
 expect((await student.request.post("/api/class-links",{headers,data:{operation:"create",class_id:id,days:7,limit:40}})).status()).toBe(403);
 expect((await context.request.post("/api/class-links",{headers:{Origin:"https://outside.test"},data:{operation:"revoke",class_id:id}})).status()).toBe(403);
 expect((await context.request.post("/api/class-links",{headers,data:{operation:"create",class_id:id,days:31,limit:1001}})).status()).toBe(422);
 for(let i=0;i<2;i++)expect((await student.request.post("/api/class-links",{headers,data:{operation:"join",token}})).ok()).toBe(true);
 await signIn(anonymous,"other");const full=await anonymous.request.post("/api/class-links",{headers,data:{operation:"join",token}});expect(full.status()).toBe(409);expect((await full.json()).code).toBe("JOIN_LINK_FULL");
 await student.close();await anonymous.close();
});
test("ordinary registration stays invitation-gated and failed callbacks retain only safe class destinations",async({page,context,browser})=>{
 await signIn(context);const {url,token}=await makeLink(context);const guest=await browser.newContext(),p=await guest.newPage();
 const email=`not-invited-${crypto.randomUUID()}@school.test`;
 expect((await guest.request.post("/auth/password",{headers,data:{mode:"register",email,name:"Peserta Tanpa Undangan",password:"Valid-test-password-2026"}})).ok()).toBe(true);
 const confirmation=await guest.request.post("http://127.0.0.1:54329/test/confirmation",{headers:{"x-fixture-control":"visual-test"},data:{email}});expect(confirmation.status()).toBe(404);
 await p.goto(`/auth/callback?next=${encodeURIComponent(`/join/${token}`)}`);await expect(p).toHaveURL(`${url}?error=oauth`);await expect(p.getByText("Belum berhasil masuk",{exact:true})).toBeVisible();
 await p.goto(`/auth/confirm?next=${encodeURIComponent(`/join/${token}`)}`);await expect(p).toHaveURL(`${url}?error=confirmation`);
 await page.goto("/auth/callback?next=https://outside.test");await expect(page).toHaveURL(/\/login\?error=oauth$/);await guest.close();
});
test("join form and class controls remain usable at desktop, tablet and phone widths",async({page,context,browser})=>{
 test.setTimeout(240000);await signIn(context);const {url,name}=await makeLink(context);const guest=await browser.newContext(),p=await guest.newPage();mkdirSync("test-results/class-links",{recursive:true});
 for(const width of [1440,768,390]){
  await p.setViewportSize({width,height:1000});await p.goto(url);await expect(p.getByRole("heading",{name:"Bergabung ke kelas"})).toBeVisible();
  expect(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await p.screenshot({path:`test-results/class-links/join-${width}.png`,fullPage:true});
 }
 await inspectScreen(p,"class-join");
 await page.goto("/manage/classes");await page.locator("details").filter({hasText:name}).locator("summary").click();await expect(page.getByRole("heading",{name:"Link undangan kelas"})).toBeVisible();
 await inspectScreen(page,"class-links-manage");
 for(const width of [1440,768,390]){await page.setViewportSize({width,height:1000});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`test-results/class-links/manage-${width}.png`,fullPage:true});}
 await guest.close();
});

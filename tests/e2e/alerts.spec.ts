import {test,expect,type Page} from "@playwright/test";
import {mkdirSync} from "node:fs";
import {messages} from "../../src/lib/domain";
import {inspectScreen} from "../support/visual";

async function fillLogin(page:Page){
 await page.goto("/login");
 await page.getByLabel("Email",{exact:true}).fill("teacher@school.test");
 await page.getByLabel("Password",{exact:true}).fill("wrong-password");
}

test("origin rejection explains the address problem while keeping the guard",async({page,request})=>{
 const response=await request.post("/auth/password",{headers:{Origin:"http://127.0.0.1:3001"},data:{mode:"login",email:"teacher@school.test",password:"wrong-password"}});
 expect(response.status()).toBe(403);expect(await response.json()).toEqual({code:"ORIGIN_NOT_ALLOWED",message:messages.ORIGIN_NOT_ALLOWED});
 await page.route("**/auth/password",route=>route.fulfill({status:403,json:{code:"ORIGIN_NOT_ALLOWED",message:messages.ORIGIN_NOT_ALLOWED}}));
 await fillLogin(page);await page.getByRole("button",{name:"Masuk dengan email"}).click();
 const alert=page.getByRole("main").getByRole("alert");await expect(alert).toContainText("Alamat aplikasi tidak sesuai");await expect(alert).toContainText("tautan resmi");
 await expect(page.locator(".form-feedback")).toBeFocused();await expect(page.getByLabel("Email",{exact:true})).toHaveValue("teacher@school.test");
 mkdirSync(".taste-skill/after",{recursive:true});
 for(const width of [1440,768,390]){
  await page.setViewportSize({width,height:900});await page.evaluate(()=>document.fonts.ready);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await alert.screenshot({path:`.taste-skill/after/alert-origin-${width}.png`});
  await page.screenshot({path:`.taste-skill/after/alerts-login-${width}.png`,fullPage:true});
 }
});

test("login errors can be retried, then successful login still works",async({page})=>{
 await fillLogin(page);await page.getByRole("button",{name:"Masuk dengan email"}).click();
 await expect(page.getByRole("main").getByRole("alert")).toContainText("Login belum berhasil");
 await expect(page.getByRole("main").getByRole("alert")).toContainText("Email atau password tidak sesuai");
 await page.getByLabel("Password",{exact:true}).fill("Valid-test-password-2026");await page.getByRole("button",{name:"Masuk dengan email"}).click();
 await expect(page).toHaveURL(/\/(dashboard|manage)$/);
});

test("network and non-JSON failures remain readable and retryable",async({page})=>{
 await page.route("**/auth/password",route=>route.abort("internetdisconnected"));
 await fillLogin(page);await page.getByRole("button",{name:"Masuk dengan email"}).click();
 await expect(page.getByRole("main").getByRole("alert")).toContainText("Koneksi belum tersedia");await expect(page.getByRole("main").getByRole("alert")).not.toContainText("Failed to fetch");
 await page.unroute("**/auth/password");
 await page.route("**/auth/password",route=>route.fulfill({status:502,contentType:"text/html",body:"<html>Bad gateway</html>"}));
 await page.getByRole("button",{name:"Masuk dengan email"}).click();await expect(page.getByRole("main").getByRole("alert")).toContainText("Layanan sedang bermasalah");
 await expect(page.getByRole("main").getByRole("alert")).not.toContainText("JSON");await expect(page.getByRole("button",{name:"Masuk dengan email"})).toBeEnabled();
});

test("rate limits give a next step and switching mode clears stale errors",async({page})=>{
 await page.route("**/auth/password",route=>route.fulfill({status:429,json:{code:"RATE_LIMITED",message:"Terlalu banyak percobaan. Tunggu satu menit, lalu coba lagi."}}));
 await fillLogin(page);await page.getByRole("button",{name:"Masuk dengan email"}).click();
 await expect(page.getByRole("main").getByRole("alert")).toContainText("Tunggu satu menit");
 await page.getByRole("button",{name:"Lupa password?"}).click();await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
});

test("registration and recovery do not promise delivery or disclose invitations",async({page,request})=>{
 const register={mode:"register",email:"unknown@school.test",name:"Peserta Baru",password:"Valid-test-password-2026"};
 const headers={Origin:"http://127.0.0.1:3100"};
 const unknown=await request.post("/auth/password",{headers,data:register});
 const invited=await request.post("/auth/password",{headers,data:{...register,email:"teacher@school.test"}});
 expect(unknown.status()).toBe(200);expect(await unknown.json()).toEqual(await invited.json());
 await page.goto("/login");await page.getByRole("button",{name:"Buat akun undangan",exact:true}).click();
 await page.getByLabel("Nama",{exact:true}).fill(register.name);await page.getByLabel("Email",{exact:true}).fill(register.email);await page.getByLabel("Password",{exact:true}).fill(register.password);await page.getByLabel("Konfirmasi password",{exact:true}).fill(register.password);
 await page.getByRole("button",{name:"Buat akun",exact:true}).click();
 await expect(page.getByRole("status")).toContainText("hanya dapat dikirim jika alamat Anda sudah diundang");
 await expect(page.locator(".notice.success")).toHaveCount(0);await expect(page.getByLabel("Password",{exact:true})).toBeFocused();
 await page.getByRole("button",{name:"Lupa password?"}).click();await page.getByLabel("Email",{exact:true}).fill(register.email);await page.getByRole("button",{name:"Kirim tautan pemulihan"}).click();
 await expect(page.getByRole("status")).toContainText("layanan email tersedia");
});

test("confirmation errors retain layout and accessible status across viewports",async({page})=>{
 test.setTimeout(240000);await page.goto("/login?error=confirmation");
 await expect(page.getByRole("main").getByRole("alert")).toContainText("Buka tautan terbaru");
 await inspectScreen(page,"alerts-confirmation");
});

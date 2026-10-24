import { test, expect, type Page } from "@playwright/test";
import { readFileSync, mkdirSync } from "node:fs";
import { QUESTION_TEMPLATE } from "../../src/lib/question-import";
import { questionPdf } from "../support/question-pdf.mjs";
import { inspectScreen } from "../support/visual";
const headers = { Origin: "http://127.0.0.1:3100" };
async function signIn(page: Page, role = "teacher") {
  await page.goto("/login"); await page.getByLabel("Email", { exact: true }).fill(`${role}@school.test`);
  await page.getByLabel("Password", { exact: true }).fill("Valid-test-password-2026");
  await page.getByRole("button", { name: "Masuk dengan email" }).click();
  await expect(page).toHaveURL(/\/(manage|dashboard)$/);
}
async function bankCount(page: Page) {
  const response = await page.request.get("/api/workspace"); expect(response.ok()).toBe(true);
  return (await response.json()).questions.length as number;
}
test("upload, correct, select and commit questions; a lost response can be retried without duplication", async ({ page }) => {
  await signIn(page); const before = await bankCount(page);
  await page.goto("/manage/questions"); await page.getByRole("link", { name: "Impor soal", exact: true }).click();
  const source = QUESTION_TEMPLATE.replace("Kunci: B", "Kunci: Z");
  await page.getByLabel("Pilih dokumen", { exact: true }).setInputFiles({ name: "soal.txt", mimeType: "text/plain", buffer: Buffer.from(source) });
  await expect(page.getByText("2 terbaca · 1 perlu diperbaiki", { exact: true })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "Pilih soal 1", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Simpan 1 soal", exact: true })).toBeEnabled();
  await page.getByLabel("Teks soal yang akan dibaca").fill(QUESTION_TEMPLATE);
  await expect(page.getByRole("button", { name: "Simpan 1 soal", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Perbarui pratinjau" }).click();
  await expect(page.getByText("2 terbaca · 0 perlu diperbaiki", { exact: true })).toBeVisible();
  // First request commits in PostgreSQL, then its HTTP response is lost.
  await page.route("**/api/questions/import/commit", async route => { const response = await route.fetch(); expect(response.ok()).toBe(true); await route.abort("internetdisconnected"); }, { times: 1 });
  await page.getByRole("button", { name: "Simpan 2 soal", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Pilihan dikunci");
  await expect(page.getByLabel("Teks soal yang akan dibaca")).toBeDisabled();
  await page.getByRole("button", { name: "Coba simpan lagi", exact: true }).click();
  await expect(page.getByText("2 soal berhasil ditambahkan ke bank soal.", { exact: true })).toBeVisible();
  expect(await bankCount(page)).toBe(before + 2);
  await page.getByRole("link", { name: "Buka bank soal" }).click();
  await expect(page.getByRole("link", { name: "Berapakah hasil 2 + 2?", exact: true })).toBeVisible();
});
test("MD and real PDF previews work; malformed, scan and oversized uploads explain how to recover", async ({ page }) => {
  await signIn(page); await page.goto("/manage/questions/import");
  await page.getByLabel("Pilih dokumen", { exact: true }).setInputFiles("public/templates/soal.md");
  await expect(page.getByText("2 terbaca · 0 perlu diperbaiki", { exact: true })).toBeVisible();
  const pdf = questionPdf(QUESTION_TEMPLATE.trim().split("\n\n").map(part => part.split("\n")));
  await page.getByLabel("Pilih dokumen", { exact: true }).setInputFiles({ name: "soal.pdf", mimeType: "application/pdf", buffer: pdf });
  await expect(page.getByText("2 terbaca · 0 perlu diperbaiki · 2 halaman PDF", { exact: true })).toBeVisible();
  await page.getByLabel("Pilih dokumen", { exact: true }).setInputFiles({ name: "scan.pdf", mimeType: "application/pdf", buffer: questionPdf([[]]) });
  await expect(page.getByRole("main").getByRole("alert")).toContainText("OCR");
  await page.getByLabel("Pilih dokumen", { exact: true }).setInputFiles({ name: "big.txt", mimeType: "text/plain", buffer: Buffer.alloc(2 * 1024 * 1024 + 1) });
  await expect(page.getByRole("main").getByRole("alert")).toContainText("2 MB");
  await page.getByLabel("Pilih dokumen", { exact: true }).setInputFiles({ name: "unnumbered.txt", mimeType: "text/plain", buffer: Buffer.from("Pertanyaan belum bernomor") });
  await expect(page.getByLabel("Teks soal yang akan dibaca")).toHaveValue("Pertanyaan belum bernomor");
  await expect(page.getByText(/Belum menemukan soal/)).toBeVisible();
  await page.getByRole("button", { name: "Gunakan contoh", exact: true }).click();
  await page.getByRole("checkbox", { name: "Pilih soal 2", exact: true }).uncheck();
  await expect(page.getByRole("button", { name: "Simpan 1 soal", exact: true })).toBeEnabled();
});
test("import endpoints enforce origin, authentication, teacher role and server validation", async ({ page, request }) => {
  const file = { name: "soal.txt", mimeType: "text/plain", buffer: readFileSync("public/templates/soal.txt") };
  expect((await request.post("/api/questions/import", { headers, multipart: { file } })).status()).toBe(401);
  await signIn(page, "student");
  expect((await page.request.post("/api/questions/import", { headers, multipart: { file } })).status()).toBe(403);
  expect((await page.request.post("/api/questions/import/commit", { headers, data: { operation_id: crypto.randomUUID(), questions: [] } })).status()).toBe(403);
  await signIn(page, "teacher");
  expect((await page.request.post("/api/questions/import", { headers: { Origin: "https://evil.invalid" }, multipart: { file } })).status()).toBe(403);
  expect((await page.request.post("/api/questions/import/commit", { headers, data: { operation_id: crypto.randomUUID(), questions: [] } })).status()).toBe(422);
  expect((await page.request.post("/api/questions/import", { headers, multipart: { file: { ...file, name: "bad.txt", buffer: Buffer.alloc(2 * 1024 * 1024 + 1) } } })).status()).toBe(413);
});
test("import preview remains readable at desktop, tablet and phone widths", async ({ page }) => {
  test.setTimeout(300000); await signIn(page); await page.goto("/manage/questions/import");
  await page.getByRole("button", { name: "Gunakan contoh", exact: true }).click();
  mkdirSync(".local/import-preview", { recursive: true });
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 900 }); await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => window.scrollTo(0, 0));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.getByRole("button", { name: "Simpan 2 soal", exact: true })).toBeEnabled();
    await page.screenshot({ path: `.local/import-preview/${width}.png`, fullPage: true });
  }
  await inspectScreen(page, "question-import");
});

import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { inspectScreen } from "../support/visual";
const headers = { Origin: "http://127.0.0.1:3100" };
async function signIn(context: BrowserContext, role = "teacher") {
  expect((await context.request.post("/auth/password", { headers, data: { mode: "login", email: `${role}@school.test`, password: "Valid-test-password-2026" } })).ok()).toBe(true);
}
async function post(context: BrowserContext, path: string, data: unknown) {
  const response = await context.request.post(`/api/${path}`, { headers, data }); expect(response.ok()).toBe(true); return response.json();
}
async function seed(context: BrowserContext) {
  const suffix = crypto.randomUUID().slice(0, 8);
  const q = await post(context, "questions/save", { kind: "essay", prompt: `Soal hapus ${suffix}`, options: [], correct_option_id: null, rubric: "Pedoman", weight: 1, tag: "Uji hapus" });
  const c = await post(context, "classes/save", { name: `Kelas hapus ${suffix}`, emails: ["student@school.test"] });
  return { q, c };
}
async function makeExam(context: BrowserContext, q: { id: string }, c: { id: string }) {
  return post(context, "exams/save", { title: `Draft hapus ${crypto.randomUUID().slice(0, 8)}`, instructions: "Uji hapus", class_id: c.id, mode: "quiz", opens_at: new Date(Date.now() - 60000).toISOString(), closes_at: new Date(Date.now() + 3600000).toISOString(), duration_minutes: 30, passing_score: 70, penalty: 0, shuffle_questions: false, shuffle_options: false, question_ids: [q.id], participant_emails: [] });
}
async function openDelete(page: Page, label: string) {
  await page.getByRole("button", { name: label, exact: true }).click();
  return page.getByRole("alertdialog");
}
test("question delete requires confirmation; cancellation and response-loss retry are safe", async ({ page, context }) => {
  await signIn(context); const { q } = await seed(context); await page.goto(`/manage/questions?q=${encodeURIComponent(q.prompt)}`);
  const label = `Hapus soal: ${q.prompt}`;
  let modal = await openDelete(page, label);
  await expect(modal).toContainText("permanen"); await expect(modal.getByRole("button", { name: "Batal", exact: true })).toBeFocused();
  await modal.getByRole("button", { name: "Batal", exact: true }).click();
  await expect(page.getByRole("button", { name: label, exact: true })).toBeFocused();
  await expect(page.getByRole("link", { name: q.prompt, exact: true })).toBeVisible();
  modal = await openDelete(page, label); await page.keyboard.press("Escape"); await expect(modal).toHaveCount(0);
  modal = await openDelete(page, label);
  await page.route("**/api/questions/delete", async route => { const response = await route.fetch(); expect(response.ok()).toBe(true); await route.abort("internetdisconnected"); }, { times: 1 });
  await modal.getByRole("button", { name: "Hapus permanen", exact: true }).click();
  await expect(modal.getByRole("alert")).toContainText("Internet belum tersambung");
  await modal.getByRole("button", { name: "Hapus permanen", exact: true }).click();
  await expect(modal).toHaveCount(0); await expect(page.getByRole("link", { name: q.prompt, exact: true })).toHaveCount(0);
});
test("referenced question/class cannot be deleted; deleting a draft releases their links", async ({ page, context }) => {
  await signIn(context); const { q, c } = await seed(context), e = await makeExam(context, q, c);
  await page.goto(`/manage/questions?q=${encodeURIComponent(q.prompt)}`); let modal = await openDelete(page, `Hapus soal: ${q.prompt}`);
  await modal.getByRole("button", { name: "Hapus permanen", exact: true }).click(); await expect(modal.getByRole("alert")).toContainText("masih dipakai");
  await modal.getByRole("button", { name: "Batal", exact: true }).click();
  await page.goto("/manage/classes"); await page.locator("summary").filter({ hasText: c.name }).click();
  modal = await openDelete(page, `Hapus kelas: ${c.name}`); await modal.getByRole("button", { name: "Hapus permanen", exact: true }).click();
  await expect(modal.getByRole("alert")).toContainText("masih terhubung"); await modal.getByRole("button", { name: "Batal", exact: true }).click();
  await page.goto(`/manage/exams/${e.id}`); modal = await openDelete(page, `Hapus draft ujian: ${e.title}`);
  await modal.getByRole("button", { name: "Hapus permanen", exact: true }).click(); await expect(page).toHaveURL(/\/manage\/exams$/);
  await expect(page.getByRole("link", { name: e.title, exact: true })).toHaveCount(0);
  await page.goto("/manage/classes"); await page.locator("summary").filter({ hasText: c.name }).click();
  modal = await openDelete(page, `Hapus kelas: ${c.name}`); await modal.getByRole("button", { name: "Hapus permanen", exact: true }).click();
  await expect(page.locator("summary").filter({ hasText: c.name })).toHaveCount(0);
  await page.goto(`/manage/questions?q=${encodeURIComponent(q.prompt)}`); modal = await openDelete(page, `Hapus soal: ${q.prompt}`);
  await modal.getByRole("button", { name: "Hapus permanen", exact: true }).click(); await expect(page.getByRole("link", { name: q.prompt, exact: true })).toHaveCount(0);
});
test("published exams have no delete control; API blocks deletion and untrusted requests", async ({ page, context, request }) => {
  const data = { id: crypto.randomUUID(), operation_id: crypto.randomUUID() };
  expect((await request.post("/api/questions/delete", { headers, data })).status()).toBe(401);
  await signIn(context, "student"); expect((await context.request.post("/api/classes/delete", { headers, data })).status()).toBe(403);
  await signIn(context); const { q, c } = await seed(context), e = await makeExam(context, q, c); await post(context, `exams/${e.id}/publish`, {});
  await page.goto(`/manage/exams/${e.id}`); await expect(page.getByRole("button", { name: /^Hapus draft ujian:/ })).toHaveCount(0);
  const response = await context.request.post("/api/exams/delete", { headers, data: { ...data, id: e.id } }); expect(response.status()).toBe(409); expect((await response.json()).code).toBe("DRAFT_ONLY");
  expect((await context.request.post("/api/questions/delete", { headers: { Origin: "https://evil.invalid" }, data })).status()).toBe(403);
  expect((await context.request.post("/api/questions/delete", { headers, data: { id: q.id } })).status()).toBe(422);
});
test("delete confirmation is readable on desktop, tablet and phone", async ({ page, context }) => {
  test.setTimeout(300000); await signIn(context); const { q } = await seed(context); await page.goto(`/manage/questions?q=${encodeURIComponent(q.prompt)}`);
  const modal = await openDelete(page, `Hapus soal: ${q.prompt}`); mkdirSync(".local/delete-preview", { recursive: true });
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 900 }); await page.evaluate(() => document.fonts.ready);
    await expect(modal.getByRole("button", { name: "Hapus permanen", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `.local/delete-preview/${width}.png`, fullPage: true });
  }
  await modal.getByRole("button", { name: "Batal", exact: true }).click();
  await inspectScreen(page, "delete-question-bank");
});

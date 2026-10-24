import { test, expect } from "@playwright/test";

test("mobile navigation shows the destination skeleton before its data arrives", async ({ page, context }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const response = await context.request.post("/auth/password", {
    headers: { Origin: "http://127.0.0.1:3100" },
    data: { mode: "login", email: "teacher@school.test", password: "Valid-test-password-2026" },
  });
  expect(response.ok()).toBe(true);
  await page.goto("/manage/classes");
  await expect(page.getByRole("heading", { name: "Kelas & peserta", exact: true })).toBeVisible();

  let releaseRequest!: () => void;
  const heldRequest = new Promise<void>(resolve => { releaseRequest = resolve; });
  await page.route("**/manage/questions?**", async route => {
    await heldRequest;
    await route.continue();
  });
  try {
    await page.getByRole("button", { name: "Buka navigasi" }).click();
    await page.getByRole("link", { name: "Bank soal", exact: true }).click();
    await expect(page.locator(".page-skeleton")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Bank soal", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Kelas & peserta", exact: true })).not.toBeVisible();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`skeleton-${width}.png`) });
    }
  } finally {
    releaseRequest();
  }
  await expect(page).toHaveURL(/\/manage\/questions$/);
  await expect(page.getByRole("heading", { name: "Bank soal", exact: true })).toBeVisible();
  await expect(page.locator(".page-skeleton")).not.toBeVisible();
  await expect(page.locator("#main")).toHaveAttribute("aria-busy", "false");

  // Content links use the same immediate feedback as the menu.
  let releaseForm!: () => void;
  const heldForm = new Promise<void>(resolve => { releaseForm = resolve; });
  await page.route("**/manage/questions/new?**", async route => {
    await heldForm;
    await route.continue();
  });
  try {
    await page.getByRole("link", { name: "Tambah soal", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Menyiapkan formulir", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Bank soal", exact: true })).not.toBeVisible();
  } finally {
    releaseForm();
  }
  await expect(page).toHaveURL(/\/manage\/questions\/new$/);
  await expect(page.getByRole("heading", { name: "Tambahkan soal", exact: true })).toBeVisible();
  await expect(page.locator(".page-skeleton")).not.toBeVisible();
});

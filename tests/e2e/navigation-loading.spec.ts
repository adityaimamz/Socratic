import { test, expect } from "@playwright/test";

test("mobile navigation responds while the next page request is pending", async ({ page, context }) => {
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
    await expect(page.locator(".navigation-loading")).toBeVisible();
    await expect(page.getByRole("dialog")).not.toBeVisible();
  } finally {
    releaseRequest();
  }
  await expect(page).toHaveURL(/\/manage\/questions$/);
  await expect(page.getByRole("heading", { name: "Bank soal", exact: true })).toBeVisible();
  await expect(page.locator(".navigation-loading")).not.toBeVisible();
  await expect(page.locator("#main")).toHaveAttribute("aria-busy", "false");
});

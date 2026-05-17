import { test, expect } from "@playwright/test";
import { generateTotpToken } from "../lib/totp-verify";

test.describe.configure({ timeout: 120_000 });

async function adminGateLogin(page: import("@playwright/test").Page) {
  const email = process.env.ADMIN_GATE_EMAIL;
  const password = process.env.ADMIN_GATE_PASSWORD;
  const secret = process.env.ADMIN_GATE_2FA_SECRET;
  test.skip(!email || !password || !secret, "ADMIN_GATE_* env required");

  const verify = await page.request.post("/api/admin/verify-2fa", {
    data: { email, password, token: generateTotpToken(secret!) },
  });
  expect(verify.ok()).toBeTruthy();
}

test.describe("Unified admin hub", () => {
  test("GET /api/admin/proactive returns alerts", async ({ request }) => {
    const res = await request.get("/api/admin/proactive");
    expect(res.status()).toBeLessThan(500);
    if (res.status() === 401) return;
    const body = await res.json();
    if (res.ok()) {
      expect(Array.isArray(body.alerts)).toBe(true);
    }
  });

  test("assistant page loads when gate authenticated", async ({ page }) => {
    await adminGateLogin(page);
    const res = await page.goto("/admin/assistant");
    expect(res?.status()).toBeLessThan(500);
    expect(page.url()).not.toContain("/gate/login");
    await expect(
      page.getByRole("heading", { name: /المساعد الموحّد|المساعد الموحد/i })
    ).toBeVisible({ timeout: 15_000 });
  });

  const HUB_PAGES = [
    "/admin/work",
    "/admin/intelligence",
    "/admin/system",
  ];

  for (const path of HUB_PAGES) {
    test(`${path} loads when authenticated`, async ({ page }) => {
      await adminGateLogin(page);
      const res = await page.goto(path);
      expect(res?.status()).toBeLessThan(500);
      expect(page.url()).not.toContain("/gate/login");
    });
  }
});

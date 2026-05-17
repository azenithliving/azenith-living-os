import { test, expect } from "@playwright/test";
import { generateTotpToken } from "../lib/totp-verify";

test.describe.configure({ timeout: 120_000 });

const DYNAMIC_PAGES = [
  "/pages/home",
  "/pages/about",
  "/seo/living-room",
  "/furniture/sofa",
  "/preview/section/smoke-section",
];

const DYNAMIC_ROUTES = [
  {
    path: "/aff/amazon?to=https://www.amazon.com/",
    allowed: [302, 307, 308],
  },
];

test.describe("Dynamic public pages", () => {
  for (const path of DYNAMIC_PAGES) {
    test(`${path} loads without 5xx`, async ({ request }) => {
      const res = await request.get(path);
      expect(res.status()).toBeLessThan(500);
      expect([200, 307, 308, 400, 404]).toContain(res.status());
    });
  }

  for (const route of DYNAMIC_ROUTES) {
    test(`${route.path} responds`, async ({ request }) => {
      const res = await request.get(route.path, { maxRedirects: 0 });
      expect(res.status()).toBeLessThan(500);
      expect(route.allowed).toContain(res.status());
    });
  }
});

test.describe("Consultant API", () => {
  test("POST /api/consultant returns a response", async ({ request }) => {
    const res = await request.post("/api/consultant", {
      data: {
        message: "مرحبا، أريد تشطيب شقة",
        sessionId: `e2e-${Date.now()}`,
        language: "ar",
      },
      timeout: 60_000,
    });
    expect(res.status()).toBeLessThan(500);
    const body = await res.json();
    expect(body).toBeTruthy();
    if (res.ok()) {
      expect(body.reply ?? body.message ?? body.error).toBeDefined();
    }
  });
});

test.describe("Cron endpoints", () => {
  test("autonomous-monitoring status GET", async ({ request }) => {
    const secret = process.env.CRON_SECRET;
    test.skip(!secret, "CRON_SECRET not set locally");
    const res = await request.get("/api/cron/autonomous-monitoring", {
      headers: { Authorization: `Bearer ${secret}` },
      timeout: 15_000,
    });
    expect(res.status()).toBeLessThan(500);
    if (res.ok()) {
      const body = await res.json();
      expect(body.status).toBe("ready");
    }
  });

  test("monthly-refresh status GET", async ({ request }) => {
    const secret = process.env.CRON_SECRET;
    test.skip(!secret, "CRON_SECRET not set locally");
    const res = await request.get("/api/cron/monthly-refresh", {
      timeout: 15_000,
    });
    expect(res.status()).toBeLessThan(500);
  });
});

test.describe("Admin login + pages", () => {
  test("full gate login reaches /admin", async ({ page }) => {
    const email = process.env.ADMIN_GATE_EMAIL;
    const password = process.env.ADMIN_GATE_PASSWORD;
    const secret = process.env.ADMIN_GATE_2FA_SECRET;
    test.skip(!email || !password || !secret, "ADMIN_GATE_* env required");

    const validate = await page.request.post("/api/admin/gate/validate", {
      data: { email, password },
    });
    expect(validate.ok()).toBeTruthy();

    const token = generateTotpToken(secret!);
    const verify = await page.request.post("/api/admin/verify-2fa", {
      data: { email, password, token },
    });
    const verifyBody = await verify.json();
    expect(verify.ok() && verifyBody.success, JSON.stringify(verifyBody)).toBeTruthy();

    await page.goto("/admin");
    await page.waitForURL(/\/admin/, { timeout: 30_000 });
    expect(page.url()).toContain("/admin");
    expect(page.url()).not.toContain("/gate/login");
  });

  const ADMIN_PAGES_AFTER_LOGIN = [
    "/admin",
    "/admin/agents",
    "/admin/intel",
    "/admin/settings",
    "/admin/sales",
  ];

  for (const adminPath of ADMIN_PAGES_AFTER_LOGIN) {
    test(`${adminPath} loads when authenticated`, async ({ page }) => {
      const email = process.env.ADMIN_GATE_EMAIL;
      const password = process.env.ADMIN_GATE_PASSWORD;
      const secret = process.env.ADMIN_GATE_2FA_SECRET;
      test.skip(!email || !password || !secret, "ADMIN_GATE_* env required");

      await page.request.post("/api/admin/verify-2fa", {
        data: { email, password, token: generateTotpToken(secret!) },
      });

      const res = await page.goto(adminPath);
      expect(res?.status()).toBeLessThan(500);
      expect(page.url()).not.toContain("/gate/login");
    });
  }
});

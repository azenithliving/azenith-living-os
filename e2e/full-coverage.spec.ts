import { test, expect } from "@playwright/test";
import {
  VALID_ROOM_SLUG_LIST,
  ROOM_ALIAS_SLUG_LIST,
} from "../lib/rooms-catalog";

test.describe.configure({ timeout: 120_000 });

const PUBLIC_PAGES = [
  "/",
  "/about",
  "/rooms",
  "/furniture",
  "/bookings",
  "/request",
  "/start",
  "/privacy",
  "/terms",
  "/elite",
  "/elite-brief",
  "/elite-intelligence",
  "/elite/login",
  "/dashboard",
  "/gate/login",
];

const ADMIN_PAGES = [
  "/admin",
  "/admin/agents",
  "/admin/browser",
  "/admin/computer",
  "/admin/database",
  "/admin/fate",
  "/admin/intel",
  "/admin/manufacturing",
  "/admin/owner-dashboard",
  "/admin/phone",
  "/admin/sales",
  "/admin/sandbox",
  "/admin/settings",
  "/admin/whatsapp",
];

const PUBLIC_GET_APIS = [
  "/api/config",
  "/api/system-health",
  "/api/navigation",
  "/api/pexels?query=living+room&per_page=1",
  "/api/test-search?q=interior",
  "/api/test-harvest",
  "/api/cms/public-config",
  "/api/theme",
  "/api/translations",
  "/api/curated-images",
  "/api/curated-pages",
  "/api/consultant/faq",
  "/api/room-sections",
  "/api/growth-insights",
  "/api/reality/check",
  "/api/admin/gate/health",
];

const PROTECTED_ADMIN_GET_APIS = [
  "/api/admin/2fa/status",
  "/api/admin/settings",
  "/api/admin/keys/stats",
  "/api/admin/intel/relations/health",
  "/api/admin/mastermind/stats",
];

test.describe("Public pages HTTP", () => {
  for (const path of PUBLIC_PAGES) {
    test(`${path} responds`, async ({ request }) => {
      const response = await request.get(path);
      expect(response.status()).toBeLessThan(500);
      expect([200, 307, 308]).toContain(response.status());
    });
  }
});

test.describe("All room slugs", () => {
  for (const slug of VALID_ROOM_SLUG_LIST) {
    test(`/rooms/${slug}`, async ({ request }) => {
      const response = await request.get(`/rooms/${slug}`);
      expect(response.status()).toBe(200);
    });
  }

  for (const alias of ROOM_ALIAS_SLUG_LIST) {
    test(`/rooms/${alias} alias`, async ({ request }) => {
      const response = await request.get(`/rooms/${alias}`);
      expect(response.status()).toBe(200);
    });
  }

  test("invalid slug is 404", async ({ request }) => {
    expect((await request.get("/rooms/invalid-slug-xyz")).status()).toBe(404);
  });
});

test.describe("Admin pages redirect without session", () => {
  for (const path of ADMIN_PAGES) {
    test(`${path} → gate`, async ({ request }) => {
      const response = await request.get(path, { maxRedirects: 0 });
      expect([307, 308]).toContain(response.status());
      expect(response.headers().location || "").toMatch(/gate\/login/);
    });
  }
});

test.describe("Public APIs", () => {
  for (const path of PUBLIC_GET_APIS) {
    test(`GET ${path}`, async ({ request }) => {
      const response = await request.get(path);
      expect(response.status()).toBeLessThan(500);
      expect([200, 400, 401, 405]).toContain(response.status());
    });
  }
});

test.describe("Protected admin APIs", () => {
  for (const path of PROTECTED_ADMIN_GET_APIS) {
    test(`GET ${path} requires auth`, async ({ request }) => {
      const response = await request.get(path);
      expect([401, 403, 405]).toContain(response.status());
    });
  }
});

test.describe("Gate security", () => {
  test("login HTML has no hardcoded password", async ({ request }) => {
    const html = await (await request.get("/gate/login")).text();
    expect(html).not.toMatch(/3laa92aziz/i);
  });

  test("gate validate rejects bad credentials", async ({ request }) => {
    const res = await request.post("/api/admin/gate/validate", {
      data: { email: "bad@example.com", password: "wrong" },
    });
    expect(res.status()).toBe(401);
  });
});

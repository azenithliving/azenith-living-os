import { test, expect } from "@playwright/test";

test.describe.configure({ timeout: 90_000 });

test.describe("Public site", () => {
  test("home page loads", async ({ page }) => {
    const response = await page.goto("/", { waitUntil: "domcontentloaded" });
    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle(/Azenith|أزينث/i);
  });

  test("about page loads", async ({ request }) => {
    const response = await request.get("/about");
    expect(response.status()).toBe(200);
    const html = await response.text();
    expect(html.length).toBeGreaterThan(1000);
  });

  test("rooms listing loads", async ({ request }) => {
    const response = await request.get("/rooms");
    expect(response.status()).toBe(200);
  });

  test("valid room detail loads", async ({ request }) => {
    const response = await request.get("/rooms/living-room");
    expect(response.status()).toBe(200);
  });

  test("invalid room slug returns 404", async ({ request }) => {
    const response = await request.get("/rooms/invalid-slug-xyz");
    expect(response.status()).toBe(404);
  });

  test("bedroom alias resolves", async ({ request }) => {
    const response = await request.get("/rooms/bedroom");
    expect(response.status()).toBe(200);
  });
});

test.describe("Admin gate", () => {
  test("admin redirects to gate login", async ({ request }) => {
    const response = await request.get("/admin", { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(response.headers().location).toContain("/gate/login");
  });

  test("gate login page renders without exposed credentials", async ({ request }) => {
    const response = await request.get("/gate/login");
    expect(response.status()).toBe(200);
    const html = await response.text();
    expect(html).not.toMatch(/alaa92aziz/);
    expect(html).toMatch(/gate\/login\/page|AZENITH/i);
  });
});

test.describe("Public APIs", () => {
  test("config and health endpoints", async ({ request }) => {
    const config = await request.get("/api/config");
    expect(config.ok()).toBeTruthy();
    const health = await request.get("/api/system-health");
    expect(health.ok()).toBeTruthy();
    const body = await health.json();
    expect(body.ok).toBe(true);
  });

  test("pexels returns photos", async ({ request }) => {
    const res = await request.get("/api/pexels?query=living+room&per_page=2");
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(Array.isArray(data.photos)).toBe(true);
  });

  test("navigation without tenantId", async ({ request }) => {
    const res = await request.get("/api/navigation");
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(Array.isArray(data.items)).toBe(true);
  });
});

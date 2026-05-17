import { test, expect } from "@playwright/test";

/**
 * Requires AACA running: npm run aaca:start (port 3100)
 * Or set PLAYWRIGHT_AACA_URL=http://127.0.0.1:3100
 */
const aacaBase = process.env.PLAYWRIGHT_AACA_URL || "http://127.0.0.1:3100";

test.describe.configure({ timeout: 30_000 });

test.describe("AACA service", () => {
  test("root reports operational", async ({ request }) => {
    const res = await request.get(`${aacaBase}/`);
    if (res.status() === 0) {
      test.skip(true, "AACA not running — start with: npm run aaca:start");
    }
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.status).toBe("operational");
    expect(body.name).toContain("AACA");
  });

  test("health endpoint returns agents", async ({ request }) => {
    const res = await request.get(`${aacaBase}/api/v1/health`);
    if (!res.ok()) {
      test.skip(true, "AACA not running — start with: npm run aaca:start");
    }
    const body = await res.json();
    expect(body.status).toMatch(/healthy|degraded/);
    expect(body.queues).toBeInstanceOf(Array);
  });
});

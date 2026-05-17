import { test, expect } from "@playwright/test";
import {
  discoverApiRoutes,
  SLOW_OR_SPECIAL_API_PATHS,
  postBodyForPath,
  headersForPath,
} from "./helpers/discover-api-routes";

test.describe.configure({ timeout: 300_000 });

const ACCEPTABLE = new Set([200, 201, 204, 400, 401, 403, 404, 405, 409, 422, 429]);

test("all API routes respond without 5xx (GET)", async ({ request }) => {
  const routes = discoverApiRoutes().filter(
    (r) => r.methods.includes("GET") && !SLOW_OR_SPECIAL_API_PATHS.has(r.path)
  );
  const failures: string[] = [];

  for (const route of routes) {
    try {
      const res = await request.get(route.path, {
        headers: headersForPath(route.path),
        timeout: 15_000,
      });
      if (!ACCEPTABLE.has(res.status()) && res.status() >= 500) {
        failures.push(`GET ${route.path} → ${res.status()}`);
      }
    } catch (error) {
      failures.push(`GET ${route.path} → ${error instanceof Error ? error.message : "error"}`);
    }
    await new Promise((r) => setTimeout(r, 20));
  }

  expect(failures, failures.slice(0, 20).join("\n")).toEqual([]);
});

test("POST-only public routes accept body without 5xx", async ({ request }) => {
  const postRoutes = [
    "/api/analytics/session",
    "/api/leads",
  ];

  for (const apiPath of postRoutes) {
    const res = await request.post(apiPath, {
      data: postBodyForPath(apiPath),
      headers: headersForPath(apiPath),
      timeout: 15_000,
    });
    expect(res.status()).toBeLessThan(500);
  }
});

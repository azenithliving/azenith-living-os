import fs from "fs";
import path from "path";

const PLACEHOLDERS: Record<string, string> = {
  id: "00000000-0000-0000-0000-000000000001",
  slug: "home",
  type: "sofa",
  partner: "smoke-partner",
  catchall: "smoke/test",
};

function segmentToUrl(segment: string): string {
  if (segment.startsWith("[...")) return PLACEHOLDERS.catchall;
  const key = segment.replace(/[\[\]]/g, "");
  return PLACEHOLDERS[key] ?? "smoke";
}

export type ApiRouteSpec = {
  path: string;
  methods: ("GET" | "POST" | "PUT" | "DELETE" | "PATCH")[];
};

export function discoverApiRoutes(): ApiRouteSpec[] {
  const apiRoot = path.join(process.cwd(), "app", "api");
  const routes: ApiRouteSpec[] = [];

  function walk(dir: string, urlPath: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full, `${urlPath}/${segmentToUrl(entry.name)}`);
        continue;
      }
      if (entry.name !== "route.ts") continue;

      const content = fs.readFileSync(full, "utf8");
      const methods: ApiRouteSpec["methods"] = [];
      if (/export\s+async\s+function\s+GET/.test(content)) methods.push("GET");
      if (/export\s+async\s+function\s+POST/.test(content)) methods.push("POST");
      if (/export\s+async\s+function\s+PUT/.test(content)) methods.push("PUT");
      if (/export\s+async\s+function\s+DELETE/.test(content)) methods.push("DELETE");
      if (/export\s+async\s+function\s+PATCH/.test(content)) methods.push("PATCH");
      if (methods.length === 0) methods.push("GET");
      routes.push({ path: urlPath, methods });
    }
  }

  walk(apiRoot, "/api");
  return routes.sort((a, b) => a.path.localeCompare(b.path));
}

/** Routes that may hang or need special bodies — handled in dedicated tests */
export const SLOW_OR_SPECIAL_API_PATHS = new Set([
  "/api/consultant",
  "/api/admin/mastermind/chat",
  "/api/content-generator",
  "/api/enhance-image",
  "/api/curate-images",
  "/api/admin/command",
  "/api/omnipotent",
  "/api/admin/agent/ultimate",
  "/api/admin/eternal/genesis",
  "/api/cron/autonomous-monitoring",
  "/api/cron/monthly-refresh",
  "/api/admin/verify-2fa",
  "/api/admin/gate/validate",
]);

export function postBodyForPath(apiPath: string): Record<string, unknown> {
  if (apiPath.includes("/consultant")) {
    return { message: "مرحبا", sessionId: "e2e-smoke-session" };
  }
  if (apiPath.includes("/analytics/session")) {
    return { sessionId: "e2e-smoke-session", data: { page: "/" } };
  }
  if (apiPath.includes("/bookings")) {
    return { name: "E2E", email: "e2e@test.com", phone: "01000000000" };
  }
  if (apiPath.includes("/leads")) {
    return { name: "E2E", email: "e2e@test.com", message: "test" };
  }
  if (apiPath.includes("/gate/validate") || apiPath.includes("/verify-2fa")) {
    return { email: "e2e@test.com", password: "x", token: "000000" };
  }
  return {};
}

export function headersForPath(apiPath: string): Record<string, string> {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && apiPath.startsWith("/api/cron/")) {
    return { Authorization: `Bearer ${cronSecret}` };
  }
  return {};
}

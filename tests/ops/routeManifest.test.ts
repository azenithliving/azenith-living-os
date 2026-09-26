// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { readdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";

/**
 * Outside Next's own runtime `next/server` carries no working `NextResponse`, and
 * the redirect itself is Next's code — the part that can be wrong is the URL this
 * handler hands it, so that is what the stub captures.
 */
vi.mock("next/server", () => ({
  NextResponse: {
    redirect: (url: URL, status = 302) => ({ status, location: url.toString() }),
  },
  NextRequest: class {},
}));

import { GET, POST } from "@/app/api/admin/qayyim/[[...legacy]]/route";

function routes(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((e) =>
    statSync(join(dir, e)).isDirectory() ? routes(join(dir, e)) : join(dir, e).endsWith("route.ts") ? [join(dir, e)] : []
  );
}

describe("the ops API surface", () => {
  it("owns every admin route the swarm exposes", () => {
    const moved = routes("app/api/admin/ops");
    expect(moved.length).toBeGreaterThanOrEqual(20);
    expect(moved.some((f) => f.includes("qayyim"))).toBe(false);
  });

  it("keeps exactly one compatibility shim on the retired path", () => {
    const shim = join("app", "api", "admin", "qayyim", "[[...legacy]]", "route.ts");
    expect(existsSync(shim)).toBe(true);
    expect(routes("app/api/admin/qayyim").filter((f) => !f.includes("[[...legacy]]"))).toEqual([]);
  });

  /**
   * `/api/admin/qayyim?action=list_drafts` is the retired facade's busiest call and
   * it carries no segment after the directory. A plain `[...legacy]` would let it
   * 404, so the shim's segment must be optional.
   */
  it("answers the retired facade's own path, not only its children", () => {
    const shimSegments = readdirSync(join("app", "api", "admin", "qayyim")).filter((e) =>
      e.startsWith("[")
    );
    expect(shimSegments).toEqual(["[[...legacy]]"]);
  });
});

/**
 * Production cannot show this redirect from the shell — the gate answers 401 to an
 * unauthenticated probe before routing — so the mapping is proven here on both
 * shapes of the retired URL. Only `nextUrl` is read, and a `NextRequest` built
 * outside Next's own runtime does not carry one, so the request is stood in for.
 */
function requestAt(pathAndQuery: string): NextRequest {
  return { nextUrl: new URL(`http://localhost:3000${pathAndQuery}`) } as unknown as NextRequest;
}

describe("the retired path keeps its callers", () => {
  it("moves a child route and keeps its query string", async () => {
    const res = await GET(requestAt("/api/admin/qayyim/self?days=7"));
    expect(res.status).toBe(308);
    expect(res.location).toBe("http://localhost:3000/api/admin/ops/self?days=7");
  });

  it("moves the facade itself, which carries no child segment", async () => {
    const res = await GET(requestAt("/api/admin/qayyim?action=list_drafts"));
    expect(res.status).toBe(308);
    expect(res.location).toBe("http://localhost:3000/api/admin/ops?action=list_drafts");
  });

  it("answers a write the same way it answers a read", () => {
    expect(POST).toBe(GET);
  });
});

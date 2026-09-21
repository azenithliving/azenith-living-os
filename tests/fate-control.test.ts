import { describe, expect, test, vi, beforeEach } from "vitest";
import { GET as fateGet, POST as fatePost, PATCH as fatePatch } from "@/app/api/admin/fate/route";
import { requireAdminApi } from "@/lib/admin-api-guard";
import { NextRequest, NextResponse } from "next/server";

// ── Admin API guard mock ──────────
vi.mock("@/lib/admin-api-guard", () => ({
  requireAdminApi: vi.fn().mockResolvedValue({
    user: { id: "test-admin", email: "admin@test.local" },
    unauthorized: null,
  }),
}));

function makeRequest(url: string, body?: object): NextRequest {
  const req = new NextRequest(url) as NextRequest;
  const headers = new Headers({ "content-type": "application/json" });
  Object.defineProperty(req, "headers", { value: headers, writable: true, configurable: true });
  if (body !== undefined) {
    Object.defineProperty(req, "json", {
      value: vi.fn().mockResolvedValue(body),
      writable: true,
      configurable: true,
    });
  }
  return req;
}

describe("Fate Control API (Retired/Decommissioned)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("1. GET returns retired status and empty mutations/sessions list", async () => {
    const res = await fateGet();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.retired).toBe(true);
    expect(data.mutations).toEqual([]);
    expect(data.sessions).toEqual([]);
    expect(data.message).toBeDefined();
  });

  test("2. POST returns 410 Gone indicating manipulation tools are retired", async () => {
    const res = await fatePost(makeRequest("http://localhost:3000/api/admin/fate", { sessionId: "s1", action: "THUNDER" }));
    const data = await res.json();

    expect(res.status).toBe(410);
    expect(data.success).toBe(false);
    expect(data.retired).toBe(true);
    expect(data.error).toContain("تم إيقاف أدوات التأثير");
  });

  test("3. PATCH returns 410 Gone indicating mutation updates are retired", async () => {
    const res = await fatePatch(makeRequest("http://localhost:3000/api/admin/fate", { id: "m1" }));
    const data = await res.json();

    expect(res.status).toBe(410);
    expect(data.success).toBe(false);
    expect(data.retired).toBe(true);
    expect(data.error).toContain("تم إيقاف أدوات التأثير");
  });

  test("4. Guard blocks unauthorized access on GET", async () => {
    vi.mocked(requireAdminApi).mockResolvedValueOnce({
      user: null,
      unauthorized: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) as any,
    });

    const res = await fateGet();
    expect(res.status).toBe(401);
  });

  test("5. Guard blocks unauthorized access on POST", async () => {
    vi.mocked(requireAdminApi).mockResolvedValueOnce({
      user: null,
      unauthorized: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) as any,
    });

    const res = await fatePost(makeRequest("http://localhost:3000/api/admin/fate", {}));
    expect(res.status).toBe(401);
  });

  test("6. Guard blocks unauthorized access on PATCH", async () => {
    vi.mocked(requireAdminApi).mockResolvedValueOnce({
      user: null,
      unauthorized: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) as any,
    });

    const res = await fatePatch(makeRequest("http://localhost:3000/api/admin/fate", {}));
    expect(res.status).toBe(401);
  });
});


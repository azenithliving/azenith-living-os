// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The owner's key list: what is enrolled on his account, in the words he gave each key.
 *
 * Two things this door must never do: hand a browser key's empty answer off as «nothing enrolled»
 * (measured 2026-11-06 — a locked drawer and an empty drawer answer identically), and put a machine
 * identifier on his screen. The credential id stays in the record; the label is his.
 */
const world = vi.hoisted(() => ({
  allow: true,
  rows: [] as any[],
  error: null as any,
  clientUsed: false,
}));

vi.mock("@/lib/admin-api-guard", () => ({
  requireAdminApi: async () =>
    world.allow
      ? { user: { id: "u-owner", email: "azenithliving@gmail.com" }, unauthorized: null }
      : { user: null, unauthorized: Response.json({ error: "ممنوع" }, { status: 401 }) },
}));

vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdminClient: () => {
    world.clientUsed = true;
    return {
      from: () => ({
        select: () => ({
          eq: () => Promise.resolve({ data: world.rows, error: world.error }),
        }),
      }),
    };
  },
}));

const listRoute = await import("@/app/api/admin/passkeys/list/route");

beforeEach(() => {
  world.allow = true;
  world.clientUsed = false;
  world.error = null;
  world.rows = [
    { label: "تليفوني", created_at: "2026-11-06T10:00:00Z", device_type: "multiDevice", backed_up: true, credential_id: "cred-secret-ish" },
    { label: "اللابتوب", created_at: "2026-11-06T11:00:00Z", device_type: "singleDevice", backed_up: false, credential_id: "cred-other" },
  ];
});

describe("the owner's key list", () => {
  it("reads with the store's credential and answers in his words only", async () => {
    const res = await listRoute.GET();
    const body = await res.json();

    expect(world.clientUsed).toBe(true);
    expect(res.status).toBe(200);
    expect(body.keys).toEqual([
      { label: "تليفوني", enrolledAt: "2026-11-06T10:00:00Z", multiDevice: true, backedUp: true },
      { label: "اللابتوب", enrolledAt: "2026-11-06T11:00:00Z", multiDevice: false, backedUp: false },
    ]);
    expect(JSON.stringify(body)).not.toContain("cred-secret-ish");
  });

  it("says nothing was enrolled only when the record really answered empty", async () => {
    world.rows = [];

    const body = await (await listRoute.GET()).json();

    expect(body.keys).toEqual([]);
    expect(body.measured).toBe(true);
  });

  it("names a refused read instead of returning an empty list", async () => {
    world.error = { code: "42501", message: "permission denied" };

    const res = await listRoute.GET();
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.measured).toBe(false);
    expect(String(body.error)).toContain("ما اتقارش");
    expect(body.keys ?? null).toBeNull();
  });

  it("refuses an anonymous caller without reading", async () => {
    world.allow = false;

    const res = await listRoute.GET();

    expect(res.status).toBe(401);
    expect(world.clientUsed).toBe(false);
  });
});

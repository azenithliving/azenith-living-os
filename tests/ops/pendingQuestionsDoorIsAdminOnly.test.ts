// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

/**
 * A public door into the consultant's private ledger.
 *
 * Measured on the published site before this test existed: an unauthenticated request to
 * `/api/consultant/pending-questions` answered 200 with a real customer question and his
 * session key, and the same address accepted PATCH and DELETE from anyone — with the
 * service client, which walks past row policies. The door is the admin desk's, so the
 * admin gate is now asked first, and nothing is read or written before it answers.
 */
const world = vi.hoisted(() => {
  const state = { queries: [] as string[], allow: false };
  const chain = (table: string) => {
    const q: any = {
      eq: () => q,
      select: () => {
        state.queries.push(`select ${table}`);
        return q;
      },
      order: () => q,
      delete: () => {
        state.queries.push(`delete ${table}`);
        return q;
      },
      update: () => {
        state.queries.push(`update ${table}`);
        return q;
      },
      insert: () => {
        state.queries.push(`insert ${table}`);
        return q;
      },
      single: () => Promise.resolve({ data: null, error: null }),
      then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
        Promise.resolve({ data: [], error: null }).then(res, rej),
    };
    return q;
  };
  return { state, client: { from: (t: string) => chain(t) } };
});

vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdminClient: () => world.client as never }));
vi.mock("@/lib/admin-api-guard", () => ({
  requireAdminApi: async () =>
    world.state.allow
      ? { user: { id: "admin-1" }, unauthorized: null }
      : { user: null, unauthorized: NextResponse.json({ error: "ممنوع" }, { status: 401 }) },
}));

const call = async (method: "GET" | "PATCH" | "DELETE" | "POST", url: string) => {
  const route = await import("@/app/api/consultant/pending-questions/route");
  const req = { url, json: async () => ({ question: "س", answered_reply: "ج" }) } as never;
  const fn = route[method] as never as (r: never) => Promise<Response>;
  const res = await fn(req);
  return { status: res.status, body: await res.json().catch(() => ({})) };
};

beforeEach(() => {
  world.state.queries.length = 0;
  world.state.allow = false;
});

describe("the pending-questions door answers to the admin gate first", () => {
  it.each(["GET", "PATCH", "DELETE", "POST"] as const)("%s refuses an anonymous caller without touching the ledger", async (method) => {
    const url =
      method === "GET"
        ? "http://x/api/consultant/pending-questions"
        : "http://x/api/consultant/pending-questions?id=1";
    const res = await call(method, url);
    expect(res.status).toBe(401);
    expect(world.state.queries).toEqual([]);
  });

  it("lets the admin desk through", async () => {
    world.state.allow = true;
    const res = await call("GET", "http://x/api/consultant/pending-questions");
    expect(res.status).toBe(200);
    expect(world.state.queries.join(" ")).toContain("select consultant_pending_questions");
  });
});

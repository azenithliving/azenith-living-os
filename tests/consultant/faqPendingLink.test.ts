// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The signature desk can answer a customer's waiting question with the same stroke that saves the
 * sentence — and that second write was asking the record for `answered_at`, a column the measured
 * record has never had (docs/ledger/record-columns.json, 2026-11-05). PostgREST returns the refusal
 * as a value, the route only logged it, and the caller got `success: true`: the FAQ row existed, the
 * customer's question stayed `pending`, and nothing said the answer never arrived.
 *
 * Measured 2026-11-05: no shipped screen sends `originalPendingQuestionId` — the desk answers through
 * the pending-questions PATCH instead — so this is a door branch any signed caller can take, not a
 * path the owner walks today. It gets fixed rather than deleted because the door still promises it.
 *
 * The door's own ledger says what a written answer looks like: `status` and `answered_reply`, and the
 * customer's reply check reads `answered_reply` back. Anything else leaves the answer signed and
 * undelivered.
 */
const world = vi.hoisted(() => {
  const state = {
    allow: true,
    log: [] as { table: string; op: string; arg?: any }[],
    pending: { data: [{ id: "q-1", status: "answered" }] as unknown, error: null as unknown },
  };
  const client = {
    from: (table: string) => {
      const builder: any = {
        select: (arg?: string) => {
          state.log.push({ table, op: "select", arg });
          return builder;
        },
        insert: (arg: unknown) => {
          state.log.push({ table, op: "insert", arg });
          return builder;
        },
        update: (arg: unknown) => {
          state.log.push({ table, op: "update", arg });
          return builder;
        },
        delete: () => {
          state.log.push({ table, op: "delete" });
          return builder;
        },
        eq: (col: string, val: string) => {
          state.log.push({ table, op: "eq", arg: { col, val } });
          return builder;
        },
        order: () => builder,
        single: () => Promise.resolve({ data: { id: "faq-9" }, error: null }),
        then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
          Promise.resolve(table === "consultant_pending_questions" ? state.pending : { data: [], error: null }).then(res, rej),
      };
      return builder;
    },
  };
  return { state, client };
});

vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdminClient: () => world.client as never }));
vi.mock("@/lib/admin-api-guard", () => ({
  requireAdminApi: async () =>
    world.state.allow
      ? { user: { email: "owner@azenith.eg" }, unauthorized: null }
      : { user: null, unauthorized: Response.json({ error: "ممنوع" }, { status: 401 }) },
}));

const post = async (body: Record<string, unknown>) => {
  const route = await import("@/app/api/consultant/faq/route");
  const res = await route.POST({ json: async () => body } as never);
  return { status: res.status, body: await res.json() };
};

const updateOfPending = () => world.state.log.find((c) => c.table === "consultant_pending_questions" && c.op === "update");

beforeEach(() => {
  world.state.log.length = 0;
  world.state.allow = true;
  world.state.pending = { data: [{ id: "q-1", status: "answered" }], error: null };
});

describe("signing an answer that also clears a customer's waiting question", () => {
  it("writes the columns the record answers with, and hands the customer the answer itself", async () => {
    const measured = JSON.parse(readFileSync(join(process.cwd(), "docs/ledger/record-columns.json"), "utf8"));
    const res = await post({ question: "مواعيد المعرض؟", answer: "  من ١٠ لـ ٨  ", originalPendingQuestionId: "q-1" });

    const update = updateOfPending();
    expect(update).toBeDefined();
    expect(Object.keys(update!.arg).sort()).toEqual(["answered_reply", "status"]);
    expect(update!.arg.answered_reply).toBe("من ١٠ لـ ٨");
    expect(Object.keys(update!.arg).every((column) => measured.tables.consultant_pending_questions.includes(column))).toBe(true);
    expect(res.status).toBe(200);
    expect(res.body.pending.saved).toBe(true);
  });

  it("says the link failed instead of reporting a clean save", async () => {
    world.state.pending = { data: null, error: { code: "42703", message: "column \"answered_at\" of relation \"consultant_pending_questions\" does not exist" } };
    const res = await post({ question: "س", answer: "ج", originalPendingQuestionId: "q-1" });

    expect(res.body.faq.id).toBe("faq-9");
    expect(res.body.pending.saved).toBe(false);
    expect(res.body.pending.note).toContain("فضل معلّق");
  });

  it("names a link that matched no waiting question instead of going quiet", async () => {
    world.state.pending = { data: [], error: null };
    const res = await post({ question: "س", answer: "ج", originalPendingQuestionId: "q-gone" });

    expect(res.body.faq.id).toBe("faq-9");
    expect(res.body.pending.saved).toBe(false);
    expect(res.body.pending.note).toContain("مفيش سؤال معلّق");
  });

  it("leaves the waiting ledger alone when the sentence was signed on its own", async () => {
    const res = await post({ question: "س", answer: "ج" });

    expect(world.state.log.some((c) => c.table === "consultant_pending_questions")).toBe(false);
    expect(res.body.pending ?? null).toBeNull();
    expect(res.body.faq.id).toBe("faq-9");
  });
});

import { readFileSync } from "fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildInboxes } from "@/lib/ops/inboxes";
import { arNum } from "@/lib/ops/metricLabels";

/**
 * The nine unread badges the owner's cockpit carries used to cost nine round trips, each behind a
 * function that may be cold. Measured on the published site 2026-10-03: the canvas painted
 * instantly and every card sat on «بستنى رد السيرفر…» until the slowest of the nine answered.
 *
 * These tests hold the two rules that replace that: one door answers every inbox, and while it is
 * in flight the screen says one honest thing instead of nine server words.
 */
const LEAD = "ops-lead";
const DEV = "ops-dev";
const QA = "ops-qa";

/** A table that behaves like the record: it counts its own reads, so a loop of nine is visible. */
const world = vi.hoisted(() => {
  const state = { queries: 0, refuse: false };
  const client = () => {
    const chain = (read: () => any) => {
      const self: any = {
        select: () => self,
        in: () => self,
        eq: () => self,
        or: () => self,
        order: () => self,
        limit: () => self,
        then: (resolve: any) => Promise.resolve(resolve(read())),
      };
      return self;
    };
    return {
      from(table: string) {
        state.queries += 1;
        if (table === "agent_conversations")
          return chain(() => ({
            data: [
              { id: "c-lead", title: null, participants: [LEAD], created_at: "2026-01-01T00:00:00Z" },
              { id: "c-dev", title: `محادثة ${DEV}`, participants: [], created_at: "2026-02-01T00:00:00Z" },
            ],
            error: state.refuse ? { code: "42P01", message: "gone" } : null,
          }));
        if (table === "agent_messages")
          return chain(() => ({
            data: [{ conversation_id: "c-lead", sender_type: "agent", content: "خلصت", created_at: "2026-03-01T00:00:00Z" }],
            error: null,
          }));
        return chain(() => ({ data: [], error: null }));
      },
    };
  };
  return { state, client };
});

vi.mock("@/lib/dal/unified-supabase", () => ({
  get supabaseServer() {
    return world.client();
  },
}));
vi.mock("@/lib/admin-company", () => ({ resolveAdminCompanyId: async () => "company-1" }));
vi.mock("@/lib/admin-env-resolver", () => ({ resolveMasterCompanyId: async () => "company-1" }));

const { GET } = await import("@/app/api/admin/agents/inboxes/route");

const conversations = [
  { id: "c-lead", title: null, participants: [LEAD], created_at: "2026-01-01T00:00:00Z" },
  { id: "c-lead-old", title: null, participants: [LEAD], created_at: "2025-01-01T00:00:00Z" },
  { id: "c-dev", title: `محادثة ${DEV}`, participants: [], created_at: "2026-02-01T00:00:00Z" },
];

describe("one answer for every inbox", () => {
  it("finds each employee's own conversation, the newest one when he has several", () => {
    const boxes = buildInboxes({
      keys: [LEAD, DEV, QA],
      conversations,
      unreadRows: [
        { conversation_id: "c-lead", sender_type: "agent" },
        { conversation_id: "c-lead", sender_type: "agent" },
        { conversation_id: "c-dev", sender_type: "agent" },
      ],
      lastRows: [
        { conversation_id: "c-lead", sender_type: "agent", content: "خلصت فحص المخزون" },
        { conversation_id: "c-dev", sender_type: "agent", content: "| ملف | حالة |\nنظفت الجدول" },
      ],
      saturated: false,
    });
    expect(boxes[LEAD]?.unread).toBe(2);
    expect(boxes[DEV]?.unread).toBe(1);
    expect(boxes[QA]?.unread).toBe(0);
  });

  it("shows the newest sentence, not the table the agent also wrote", () => {
    const boxes = buildInboxes({
      keys: [DEV],
      conversations,
      unreadRows: [],
      lastRows: [{ conversation_id: "c-dev", sender_type: "agent", content: "| ملف | حالة |\nنظفت الجدول فعلاً" }],
      saturated: false,
    });
    expect(boxes[DEV]?.teaser).toBe("نظفت الجدول فعلاً");
  });

  it("leaves a teaser null rather than inventing a line for a silent employee", () => {
    const boxes = buildInboxes({ keys: [QA], conversations, unreadRows: [], lastRows: [], saturated: false });
    expect(boxes[QA]).toEqual({ unread: 0, teaser: null, exact: true });
  });

  it("counts from the record when the page is full, not from the page", () => {
    // The cap this store has been burned by before: a read that stops at 1,000 rows and a badge
    // that then reports 1,000 as if it were the truth.
    const rows = Array.from({ length: 1000 }, () => ({ conversation_id: "c-lead", sender_type: "agent" }));
    const boxes = buildInboxes({
      keys: [LEAD],
      conversations,
      unreadRows: rows,
      lastRows: [],
      saturated: true,
      exactCounts: { "c-lead": 1436 },
    });
    expect(boxes[LEAD]?.unread).toBe(1436);
    expect(boxes[LEAD]?.exact).toBe(true);
  });

  it("folds a retired key to the live one instead of answering nothing", () => {
    const boxes = buildInboxes({
      keys: ["qayyim-core"],
      conversations,
      unreadRows: [{ conversation_id: "c-lead", sender_type: "agent" }],
      lastRows: [],
      saturated: false,
    });
    expect(boxes[LEAD]?.unread).toBe(1);
  });
});

describe("the inboxes door", () => {
  const ask = (keys: string) =>
    GET({ url: `http://localhost/api/admin/agents/inboxes?keys=${keys}` } as never) as unknown as Promise<Response>;

  beforeEach(() => {
    world.state.queries = 0;
    world.state.refuse = false;
  });

  it("answers every employee in one call instead of one call each", async () => {
    const body = await (await ask([LEAD, DEV, QA].join(","))).json();
    expect(body.success).toBe(true);
    expect(Object.keys(body.inboxes).sort()).toEqual([DEV, LEAD, QA].sort());
    expect(body.inboxes[LEAD].unread).toBe(1);
    expect(world.state.queries).toBeLessThanOrEqual(4);
  });

  it("never leaves the owner with a failed card: a missing table answers zeros", async () => {
    world.state.refuse = true;
    const res = await ask(LEAD);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.inboxes[LEAD]).toEqual({ unread: 0, teaser: null, exact: true });
  });

  it("refuses a request that names nobody", async () => {
    expect((await ask("")).status).toBe(400);
  });

  it("answers the sales manager too — he is on the canvas but not a swarm member", async () => {
    const body = await (await ask(`${LEAD},vanguard`)).json();
    expect(Object.keys(body.inboxes).sort()).toEqual(["ops-lead", "vanguard"]);
  });

  it("refuses a request that names nobody of this swarm, and does not echo the word", async () => {
    const res = await ask("drop-table--1");
    expect(res.status).toBe(400);
    expect(await res.text()).not.toContain("drop-table--1");
  });
});

describe("the cockpit asks once and says one honest thing while it waits", () => {
  const canvas = readFileSync("components/admin/v2/CommandCanvas.tsx", "utf8");

  it("opens one door for all nine badges", () => {
    expect(canvas).toContain("/api/admin/agents/inboxes");
    expect(canvas).not.toContain("agent_key=${key}&unread=true");
  });

  it("keeps the word «server» off the owner's screen", () => {
    expect(canvas).not.toMatch(/السيرفر/);
    expect(canvas).toContain("data-inboxes-loading");
  });

  it("counts what has landed in his digits while the rest is still coming", () => {
    expect(canvas).toContain("arNum(landed)");
    expect(arNum(9)).toContain(String.fromCodePoint(0x669));
  });
});

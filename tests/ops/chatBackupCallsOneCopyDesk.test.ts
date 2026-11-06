// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The chat's «نسخ احتياطي» was a second copy desk. Measured 2026-11-05 it read four tables by name,
 * one of them (`user_public_keys`) not in the record at all, kept only what answered — `if (!error &&
 * data)` — and then reported «النسخة الاحتياطية اتعملت من ٣ جدول», a number of what arrived presented
 * as the whole job. Meanwhile the store's real desk copies 23 measured tables, reads each file back
 * from the bucket, and stamps the day.
 *
 * One fact, one owner: the command now calls that desk and answers with its report, so the sentence
 * cannot disagree with the copy.
 */
const world = vi.hoisted(() => ({
  outcome: {
    day: "2026-11-05",
    tables: 23,
    rows: 14846,
    bytes: 5505024,
    failures: [] as string[],
    writes: [{ table: "agent_messages", path: "2026-11-05/agent_messages.jsonl.gz", storedRows: 306, storedBytes: 1024 }],
  } as any,
  snapshotCalls: 0,
  asked: [] as string[],
}));

vi.mock("@/lib/ops/nightly-snapshot", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ops/nightly-snapshot")>("@/lib/ops/nightly-snapshot");
  return {
    ...actual,
    runNightlySnapshot: async () => {
      world.snapshotCalls += 1;
      return world.outcome;
    },
  };
});

const { backupDb } = await import("@/lib/command-executor");
const { snapshotReport } = await import("@/lib/ops/nightly-snapshot");

const context = {
  supabase: {
    from: (table: string) => {
      world.asked.push(table);
      return { select: () => Promise.resolve({ data: [], error: null }), insert: () => Promise.resolve({ error: null }) };
    },
  },
  userId: "u-owner",
  userEmail: "azenithliving@gmail.com",
  bypassRls: true,
} as never;

beforeEach(() => {
  world.snapshotCalls = 0;
  world.asked.length = 0;
  world.outcome = {
    day: "2026-11-05",
    tables: 23,
    rows: 14846,
    bytes: 5505024,
    failures: [],
    writes: [{ table: "agent_messages", path: "2026-11-05/agent_messages.jsonl.gz", storedRows: 306, storedBytes: 1024 }],
  };
});

describe("the chat's backup command and the store's one copy desk", () => {
  it("calls the measured desk instead of reading four tables of which one does not exist", async () => {
    const res = await backupDb([], context);

    expect(world.snapshotCalls).toBe(1);
    expect(world.asked).toEqual([]);
    expect(res.success).toBe(true);
    expect(res.data.tables).toBe(23);
    expect(res.data.objects).toEqual(["2026-11-05/agent_messages.jsonl.gz"]);
  });

  it("answers with the desk's own sentence, not a number it counted itself", async () => {
    const res = await backupDb([], context);

    expect(res.message).toBe(snapshotReport(world.outcome).message);
  });

  it("says the copy stopped, with the desk's reason, when the desk reports a failure", async () => {
    world.outcome.failures = ["رفع agent_messages: الدرج مقفول"];
    world.outcome.rows = 0;

    const res = await backupDb([], context);

    expect(res.success).toBe(false);
    expect(res.message).toContain("وقفت");
    expect(res.message).toContain("الدرج مقفول");
  });
});

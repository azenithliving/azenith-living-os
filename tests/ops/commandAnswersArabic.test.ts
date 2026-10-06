// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

/**
 * What the owner's chat reads back when he asks the swarm for a number.
 *
 * Measured before this file: «show_stats» answered «Statistics for last 7 days» and kept the actual
 * counts in a `data` object the chat never paints — so the one command he asks for a read-out
 * returned a headline with no news in it, and a failing read printed a Postgres sentence in the
 * middle of his Arabic.
 */
const world = vi.hoisted(() => ({
  rows: [] as Array<{ status: string; executed_at: string }>,
  readError: null as { message: string } | null,
  delivered: true,
  inserts: [] as any[],
}));

vi.mock("@/lib/telegram-notify", () => ({
  sendSecurityAlert: async () => world.delivered,
}));

const { showStats, sendNotification, addKey, removeKey, restartService } = await import("@/lib/command-executor");

const context = {
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          gte: async () => ({ data: world.rows, error: world.readError }),
        }),
      }),
      insert: async (row: any) => {
        world.inserts.push(row);
        return { error: null };
      },
    }),
  },
  userId: "u-1",
  userEmail: "azenithliving@gmail.com",
} as never;

const call = (args: string[]) => showStats(args, context);

beforeEach(() => {
  world.rows = [];
  world.readError = null;
  world.delivered = true;
  world.inserts = [];
});

const latin = (text: string) => text.match(/[A-Za-z]/g) ?? [];
const western = (text: string) => text.match(/[0-9]/g) ?? [];

describe("the statistics read-out is his sentence", () => {
  it("says the counts, in his words and his numerals", async () => {
    world.rows = [
      { status: "executed", executed_at: "2026-10-05T10:00:00Z" },
      { status: "executed", executed_at: "2026-10-05T11:00:00Z" },
      { status: "executed", executed_at: "2026-10-05T12:00:00Z" },
      { status: "failed", executed_at: "2026-10-05T13:00:00Z" },
    ];
    const res = await call(["7"]);
    expect(res.success).toBe(true);
    expect(res.message).toContain("٤");
    expect(res.message).toContain("٧");
    expect(res.message).toContain("٧٥٫٠");
    expect(latin(res.message)).toEqual([]);
    expect(western(res.message)).toEqual([]);
  });

  it("says there is nothing to report, instead of reporting a zero-rate", async () => {
    const res = await call(["7"]);
    expect(res.message).toContain("مفيش أمر متسجّل");
    expect(res.message).not.toContain("٪");
  });

  it("keeps a failed read in Arabic and out of his screen", async () => {
    world.readError = { message: 'relation "immutable_command_log" does not exist' };
    const res = await call(["7"]);
    expect(res.success).toBe(false);
    expect(res.message).toContain("السجل ما ردّش");
    expect(latin(res.message)).toEqual([]);
    expect(res.message).not.toContain("relation");
  });

  it("does not let a nonsense number of days reach the store", async () => {
    const res = await call(["كل"]);
    expect(res.success).toBe(true);
    expect(res.data.period).toBe("7 days");
  });

  it("caps a wild window instead of scanning forever", async () => {
    const res = await call(["99999"]);
    expect(res.data.period).toBe("7 days");
  });
});

describe("a command that could not run says so in Arabic", () => {
  it("an unreadable log is his sentence, not a driver message", async () => {
    const res = await call(["3"]);
    expect(res.message).toMatch(/\p{Script=Arabic}/u);
  });

  it("the notification command admits when nothing was delivered", async () => {
    world.delivered = false;
    const res = await sendNotification(["مرحبا"], context);
    expect(res.success).toBe(false);
    expect(latin(res.message)).toEqual([]);
  });

  it("the notification command claims delivery only when a chat was told", async () => {
    const res = await sendNotification(["مرحبا"], context);
    expect(res.success).toBe(true);
    expect(res.message).toContain("وصل");
    expect(latin(res.message)).toEqual([]);
  });

  it("a missing argument is answered with what he needs to type, in Arabic", async () => {
    for (const res of [await addKey([], context), await removeKey([], context), await restartService([], context)]) {
      expect(res.success).toBe(false);
      expect(latin(res.message)).toEqual([]);
      expect(res.message).toMatch(/\p{Script=Arabic}/u);
    }
  });
});

describe("the English prompt shape stays retired", () => {
  const source = readFileSync("lib/command-executor.ts", "utf8");

  it("no command hands the chat an English sentence — quoted or built", () => {
    // The first version of this guard matched only `message: "…"` and went green while seventeen
    // template literals (`Message: ${x}`) were still English. Match both shapes.
    const english = source.match(/message: [`"][A-Za-z][^`"]*/g) ?? [];
    expect(english).toEqual([]);
  });

  it("no command hands the chat a raw driver error", () => {
    expect(source).not.toMatch(/message: error instanceof Error \? error\.message/);
    expect(source).not.toContain("Failed to fetch stats");
  });
});

/**
 * Two commands used to answer in English *and* claim something that never happened:
 * `restart_service` ran a console.log and said «restarted successfully», `clear_cache` pushed two
 * strings into an array and said «Cache cleared». Translating them would have kept the promise true
 * only in another language, so the promise went too.
 */
describe("a command that cannot do the thing says so", () => {
  it("restart_service points at the lever that really updates a service", async () => {
    const res = await restartService(["mastermind"], context);
    expect(res.success).toBe(false);
    expect(res.message).toContain("انشر");
    expect(latin(res.message)).toEqual([]);
  });

  it("clear_cache does not claim a cleanup it never performs", async () => {
    const { clearCache } = await import("@/lib/command-executor");
    const res = await clearCache(["all"], context);
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/\p{Script=Arabic}/u);
    expect(res.message).not.toMatch(/cleared|success/i);
    expect(latin(res.message)).toEqual([]);
  });
});

/**
 * The audit desk itself. Measured 2026-10-06: `no_update_allowed` was a table-level `CHECK (false)`,
 * which an INSERT must also satisfy — so the table had never held a row, every command's audit write
 * failed in production, and the statistics command could only ever answer «مفيش أمر متسجّل».
 */
describe("the audit row can actually be written", () => {
  const sql = readFileSync("supabase/migrations/20261006_c_command_log_writable.sql", "utf8");

  it("drops the impossible check and nothing that protects the rows", () => {
    expect(sql).toContain("drop constraint if exists no_update_allowed");
    expect(sql).not.toMatch(/drop policy/i);
    expect(sql).not.toMatch(/delete from/i);
  });

  it("does not send a synthetic user id the foreign key would reject", async () => {
    const { executeCommand } = await import("@/lib/command-executor");
    const synthetic = { ...context, userId: "00000000-0000-0000-0000-000000000000" } as never;
    await executeCommand("show_stats 7", synthetic);
    const row = world.inserts.at(-1);
    expect(row).toBeTruthy();
    expect(row.user_id).toBeNull();
    expect(row.status).toBe("executed");
  });

  it("keeps a real admin's id on the row", async () => {
    const { executeCommand } = await import("@/lib/command-executor");
    await executeCommand("show_stats 7", context);
    expect(world.inserts.at(-1).user_id).toBe("u-1");
  });
});

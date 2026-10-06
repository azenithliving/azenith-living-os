import { readFileSync } from "fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The third heat proof: the customer came back to his pictures.
 *
 * The architecture counts three signals that a visitor is ready to be called — he raised his paper,
 * he handed the link to a second person, or «رجع يتفرج على الصور أكثر من ٣ مرات». The first two are
 * measurable today; the third had no counter anywhere, so the votes desk was passing a literal zero
 * and a browser-only lead could burn for a week without the owner hearing about it.
 *
 * A return is not a page load. Six phones on one link polling every twenty seconds, and a customer
 * who refreshes a dozen times looking for a picture, would both invent interest that is not there.
 * So the rule counts one visit per device per gap, keyed by a private label the phone keeps for
 * itself — and the store never learns who, only that the same pair of eyes came back.
 */
const world = vi.hoisted(() => ({
  rows: [] as { sketch_id: number; device_key: string; visit_count: number; last_seen_at: string }[],
  rpcError: null as { message: string } | null,
  seenArgs: [] as any[],
}));

function fakeClient() {
  return {
    from(table: string) {
      if (table === "sheet_visits") {
        return {
          select: () => ({
            eq: (_: string, id: number) => ({
              limit: async () => ({
                data: world.rows.filter((r) => r.sketch_id === id).map((r) => ({ visit_count: r.visit_count })),
                error: null,
              }),
            }),
          }),
        };
      }
      return {};
    },
    rpc: async (name: string, args: any) => {
      if (world.rpcError) return { data: null, error: world.rpcError };
      world.seenArgs.push(args);
      const at = world.rows.findIndex((r) => r.sketch_id === args.p_sketch && r.device_key === args.p_device);
      const gapMs = Number(args.p_gap_minutes) * 60_000;
      if (at < 0) {
        world.rows.push({ sketch_id: args.p_sketch, device_key: args.p_device, visit_count: 1, last_seen_at: "2026-10-06T12:00:00Z" });
        return { data: 1, error: null };
      }
      const stale = Date.parse("2026-10-06T12:00:00Z") - Date.parse(world.rows[at].last_seen_at) >= gapMs;
      if (stale) {
        world.rows[at] = { ...world.rows[at], visit_count: world.rows[at].visit_count + 1, last_seen_at: "2026-10-06T12:00:00Z" };
      }
      return { data: world.rows[at].visit_count, error: null };
    },
  } as never;
}

vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdminClient: () => fakeClient() }));

const { cleanDeviceKey, newDeviceKey, returnsFromRows, RETURN_GAP_MINUTES } = await import(
  "@/lib/cad/visit-keys"
);
const { recordVisit, countReturns } = await import("@/lib/cad/sheet-visits");

const KEY = "m7x2qk4v9m1t8r3p";

beforeEach(() => {
  world.rows = [];
  world.rpcError = null;
  world.seenArgs = [];
});

/**
 * The gap itself is applied inside the store, in one statement, so two phones opening the sheet in
 * the same second cannot both claim one return. The code's half is to name the window and pass it.
 */
describe("the gap is one number with one home", () => {
  it("is half an hour, and it is the number the store is asked to apply", async () => {
    expect(RETURN_GAP_MINUTES).toBe(30);
    await recordVisit(7, KEY);
    expect(world.seenArgs[0].p_gap_minutes).toBe(RETURN_GAP_MINUTES);
  });
});

describe("the device label is private, shaped and never a person", () => {
  it("accepts the key a phone generates for itself", () => {
    expect(cleanDeviceKey(KEY)).toBe(KEY);
  });

  it("rejects a stranger's junk instead of storing it", () => {
    expect(cleanDeviceKey(null)).toBeNull();
    expect(cleanDeviceKey("")).toBeNull();
    expect(cleanDeviceKey("short")).toBeNull();
    expect(cleanDeviceKey("a".repeat(80))).toBeNull();
    expect(cleanDeviceKey("has space")).toBeNull();
    expect(cleanDeviceKey('"><script>')).toBeNull();
  });

  it("generates a different label every time, of the shape it accepts", () => {
    const one = newDeviceKey();
    expect(one).not.toBe(newDeviceKey());
    expect(cleanDeviceKey(one)).toBe(one);
  });
});

describe("the returns a sheet has collected", () => {
  it("subtracts each device's first open", () => {
    expect(returnsFromRows([{ visit_count: 3 }, { visit_count: 1 }, { visit_count: 2 }])).toBe(3);
  });

  it("never goes negative on a row that read back as zero", () => {
    expect(returnsFromRows([{ visit_count: 0 }])).toBe(0);
    expect(returnsFromRows([])).toBe(0);
  });
});

describe("the counter writes to the store and reads the number back", () => {
  it("records the first open of a device on a sheet", async () => {
    expect(await recordVisit(7, KEY)).toBe(1);
    expect(world.seenArgs[0]).toMatchObject({ p_sketch: 7, p_device: KEY, p_gap_minutes: RETURN_GAP_MINUTES });
  });

  it("keeps a device opening twice inside the gap at one visit", async () => {
    await recordVisit(7, KEY);
    expect(await recordVisit(7, KEY)).toBe(1);
    expect(world.rows).toHaveLength(1);
  });

  it("counts a second visit once the gap has passed", async () => {
    await recordVisit(7, KEY);
    world.rows[0].last_seen_at = "2026-10-06T09:00:00Z";
    expect(await recordVisit(7, KEY)).toBe(2);
  });

  it("writes nothing when the label is not shaped like a label", async () => {
    expect(await recordVisit(7, "no")).toBe(null);
    expect(world.seenArgs).toEqual([]);
  });

  it("says nothing happened when the store refuses, without throwing at the page", async () => {
    world.rpcError = { message: "relation does not exist" };
    expect(await recordVisit(7, KEY)).toBe(null);
  });

  it("reads the sheet's returns from the rows the store actually holds", async () => {
    await recordVisit(7, KEY);
    await recordVisit(7, KEY);
    world.rows[0].last_seen_at = "2026-10-06T09:00:00Z";
    await recordVisit(7, KEY);
    await recordVisit(7, "zzzzzzzzzzzzzzzz");
    expect(await countReturns(7)).toBe(1);
  });

  it("reads zero returns when the store will not answer — a failed read is not interest", async () => {
    world.rpcError = { message: "gone" };
    expect(await countReturns(7)).toBe(0);
  });
});

describe("the table and the customer's page are wired the same way", () => {
  const sql = readFileSync("supabase/migrations/20261006_b_sheet_visits.sql", "utf8");
  const page = readFileSync("app/passport/[token]/page.tsx", "utf8");
  const door = readFileSync("app/api/passport/[token]/route.ts", "utf8");

  it("keeps one row per sheet and device, behind row level security", () => {
    expect(sql).toContain("primary key (sketch_id, device_key)");
    expect(sql).toContain("references public.room_sketches");
    expect(sql).toContain("enable row level security");
  });

  it("applies the gap inside the store, so two tabs cannot double-count one return", () => {
    expect(sql).toContain("on conflict (sketch_id, device_key) do update");
    expect(sql).toContain("last_seen_at < now()");
  });

  it("sends the phone's own label with the sheet read, and keeps it after a reload", () => {
    expect(page).toContain("azenith-visit-key");
    expect(page).toContain("x-visit-key");
  });

  it("records the open on the sheet's own address, not on the vote poll", () => {
    expect(door).toContain("recordVisit");
    expect(door).toContain("x-visit-key");
  });

  it("keeps the database out of the bundle the customer's phone runs", () => {
    expect(page).toContain("from '@/lib/cad/visit-keys'");
    expect(page).not.toContain("cad/sheet-visits");
    expect(readFileSync("lib/cad/visit-keys.ts", "utf8")).not.toMatch(/^import[^\n]*supabase/m);
  });
});

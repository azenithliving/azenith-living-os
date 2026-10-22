// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

/**
 * The nightly copy of the rows that cannot be re-made.
 *
 * These guards exist because of a measured loss, not a hypothetical one: on 2026-10-19 an instrument
 * of mine deleted 306 rows of the owner's real chat history and there was nowhere to read them back
 * from. So the bar here is not "a file was written" — it is "the file's own row count was read back
 * from the bucket and equals the record", and a copy that cannot prove that is reported as a failure.
 *
 * Two brakes are held as tests, not as intentions: the step never deletes or rotates anything (an old
 * snapshot is the owner's data, and retiring it is his word), and the picture bank stays out of the
 * daily scope (measured 2026-10-19: 5,789,320 bytes against the copied tables of that day).
 */
const STAMP = "nightly_snapshot_last";

let rowsByTable: Record<string, Record<string, unknown>[]> = {};
let objects: Map<string, Buffer> = new Map();
let stamped: unknown = null;
let calls: { uploads: number; downloads: number; removes: number; deletes: number; createBuckets: number };
let failUploadFor: string | null = null;
let truncateDownloadFor: string | null = null;
let alertMessages: string[] = [];

const sendSecurityAlert = vi.fn(async (message: string) => {
  alertMessages.push(message);
  return true;
});

vi.mock("@/lib/telegram-notify", () => ({ sendSecurityAlert: (m: string) => sendSecurityAlert(m) }));

function client() {
  return {
    from(name: string) {
      return {
        select(_cols: string) {
          return {
            order(_key: string, _opts: unknown) {
              return {
                range(from: number, to: number) {
                  const all = rowsByTable[name] ?? [];
                  return { data: all.slice(from, to + 1), error: null };
                },
              };
            },
            eq(_key: string, value: string) {
              return {
                maybeSingle: async () =>
                  name === "site_settings" && value === STAMP
                    ? { data: { value: stamped }, error: null }
                    : { data: null, error: null },
              };
            },
          };
        },
        upsert: async (row: { value: unknown }) => {
          stamped = row.value;
          return { error: null, data: null };
        },
        delete: async () => {
          calls.deletes += 1;
          return { error: null };
        },
      };
    },
    storage: {
      getBucket: async () => ({ data: { name: "snapshots" }, error: null }),
      createBucket: async () => {
        calls.createBuckets += 1;
        return { data: null, error: null };
      },
      from(_bucket: string) {
        return {
          upload: async (path: string, body: Uint8Array) => {
            if (failUploadFor && path.includes(failUploadFor)) return { data: null, error: { message: "الدرج مقفول" } };
            calls.uploads += 1;
            objects.set(path, Buffer.from(body));
            return { data: { path }, error: null };
          },
          download: async (path: string) => {
            const body = objects.get(path);
            if (!body) return { data: null, error: { message: "مفيش ملف" } };
            calls.downloads += 1;
            const bytes = truncateDownloadFor && path.includes(truncateDownloadFor) ? body.subarray(0, 4) : body;
            return { data: { arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) } };
          },
          remove: async () => {
            calls.removes += 1;
            return { data: [], error: null };
          },
        };
      },
    },
  };
}

vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdminClient: () => client() }));

const { runNightlySnapshot, SNAPSHOT_TARGETS, snapshotObjectPath, snapshotIsFresh, SNAPSHOT_BUCKET } = await import(
  "@/lib/ops/nightly-snapshot"
);

function rows(table: string, count: number) {
  return Array.from({ length: count }, (_unused, i) => ({ id: `${table}-${i}`, content: `سطر ${i} من ${table}` }));
}

function seed() {
  rowsByTable = {};
  for (const target of SNAPSHOT_TARGETS) rowsByTable[target.table] = rows(target.table, target.table === "agent_messages" ? 7 : 2);
  rowsByTable.customer_memory = [];
  objects = new Map();
  stamped = null;
  calls = { uploads: 0, downloads: 0, removes: 0, deletes: 0, createBuckets: 0 };
  failUploadFor = null;
  truncateDownloadFor = null;
  alertMessages = [];
}

describe("the nightly copy of the owner's record", () => {
  beforeEach(seed);

  it("copies every row of every table in scope and reads the count back from the object", async () => {
    const out = await runNightlySnapshot();

    expect(out.failures).toEqual([]);
    expect(out.tables).toBe(SNAPSHOT_TARGETS.length);
    const expected = SNAPSHOT_TARGETS.reduce(
      (sum, t) => sum + (t.table === "customer_memory" ? 0 : t.table === "agent_messages" ? 7 : 2),
      0
    );
    expect(out.rows).toBe(expected);
    expect(calls.uploads).toBe(SNAPSHOT_TARGETS.length);
    expect(calls.downloads).toBe(SNAPSHOT_TARGETS.length);

    const first = out.writes.find((w) => w.table === "agent_messages");
    expect(first?.storedRows).toBe(7);
    const body = gunzipSync(objects.get(snapshotObjectPath(out.day, "agent_messages")) as Buffer).toString("utf8");
    expect(body.split("\n").filter(Boolean)).toHaveLength(7);
    expect(JSON.parse(body.split("\n")[0]).content).toBe("سطر 0 من agent_messages");
  });

  it("an empty table is copied as zero rows, and that is not a failure", async () => {
    const out = await runNightlySnapshot();
    const empty = out.writes.find((w) => w.table === "customer_memory");
    expect(empty?.rows).toBe(0);
    expect(empty?.storedRows).toBe(0);
    expect(empty?.error).toBeUndefined();
  });

  it("an object that comes back short is reported as a failure, never as a backup", async () => {
    truncateDownloadFor = "agent_messages";
    const out = await runNightlySnapshot();
    expect(out.failures.length).toBeGreaterThan(0);
    expect(out.failures.join(" ")).toContain("agent_messages");
    expect(alertMessages.join(" ")).toContain("النسخة الاحتياطية الليلية وقفت");
  });

  it("a refused upload is named, and the owner is alerted instead of the round going quiet", async () => {
    failUploadFor = "agent_tasks";
    const out = await runNightlySnapshot();
    expect(out.writes.find((w) => w.table === "agent_tasks")?.error).toContain("رفع agent_tasks");
    expect(alertMessages.length).toBe(1);
  });

  it("the copy stamps the settings row and reads the stamp back", async () => {
    const out = await runNightlySnapshot();
    expect(stamped).toMatchObject({ tables: SNAPSHOT_TARGETS.length, rows: out.rows, failures: [] });
    expect(out.failures).toEqual([]);
  });

  it("nothing is deleted or rotated — an old snapshot is the owner's data and retiring it is his word", async () => {
    await runNightlySnapshot();
    expect(calls.removes).toBe(0);
    expect(calls.deletes).toBe(0);
    const src = readFileSync("lib/ops/nightly-snapshot.ts", "utf8");
    for (const banned of [".remove(", ".delete(", ".drop(", "destroy"]) {
      expect(src.includes(banned), `the copy must never call ${banned}`).toBe(false);
    }
  });

  it("the picture bank and any credential table stay out of the daily scope", () => {
    const names = SNAPSHOT_TARGETS.map((t) => t.table);
    expect(names).not.toContain("curated_images");
    expect(names.some((n) => /session_token|sovereign_sessions|api_keys|vault/.test(n))).toBe(false);
    expect(names).toContain("agent_messages");
    expect(names).toContain("site_settings");
    // Measured 2026-10-23: the manager's own memory sat outside the store's only backup — the rules he
    // was taught and the customer questions waiting for him were the two tables nobody copied.
    expect(names).toContain("consultant_learnings");
    expect(names).toContain("consultant_pending_questions");
    expect(SNAPSHOT_BUCKET).toBe("snapshots");
  });

  it("every table is paged by a stable key, so paging cannot skip a row or count one twice", () => {
    expect(SNAPSHOT_TARGETS.every((t) => /^[a-z_]+$/.test(t.table) && /^[a-z_]+$/.test(t.order))).toBe(true);
    expect(SNAPSHOT_TARGETS.find((t) => t.table === "site_settings")?.order).toBe("key");
  });

  it("freshness is read from the stamp, and a copy from yesterday is not fresh", () => {
    const today = new Date("2026-10-19T05:00:00.000Z");
    expect(snapshotIsFresh({ day: "2026-10-19" }, today)).toBe(true);
    expect(snapshotIsFresh({ day: "2026-10-18" }, today)).toBe(false);
    expect(snapshotIsFresh(null, today)).toBe(false);
  });
});

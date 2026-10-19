// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { arNum } from "@/lib/ops/metricLabels";

/**
 * One owner of the store's copy.
 *
 * Measured 2026-10-19: the chat already had a `backup_create` tool, but it was a phantom — it named
 * six tables and four of them do not exist in the record (`site_sections`, `general_suggestions`,
 * `agent_executions`, and the `backup_snapshots` row it tried to insert), it capped every read at
 * 10,000 rows without saying so, it claimed `integrity_verified: true` without verifying anything,
 * it never copied `agent_messages` — the one table that actually lost 306 rows — and its upload asked
 * Vercel Blob for a **public** URL over the owner's own record.
 *
 * So the tool and the nightly round now call the same measured module, and the restore door says what
 * exists instead of claiming nothing does. These guards hold that no second owner creeps back in.
 */
const snapshotCalls = vi.fn();
const runNightlySnapshot = vi.fn(async () => {
  snapshotCalls();
  return {
    day: "2026-10-19",
    tables: 9,
    rows: 2112,
    bytes: 782057,
    failures: [],
    writes: [{ table: "agent_messages", path: "2026-10-19/agent_messages.jsonl.gz" }],
  };
});

vi.mock("@/lib/ops/nightly-snapshot", async () => {
  const actual = await vi.importActual<{ SNAPSHOT_BUCKET: string }>("@/lib/ops/nightly-snapshot");
  return { SNAPSHOT_BUCKET: actual.SNAPSHOT_BUCKET, runNightlySnapshot };
});
vi.mock("@/lib/supabase-server", () => ({ createClient: () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }) }));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => null }));
vi.mock("@vercel/blob", () => ({ put: vi.fn(async () => { throw new Error("Blob upload must not be reached"); }) }));
vi.mock("@/lib/seo-analyzer", () => ({ analyzeSEO: vi.fn() }));
vi.mock("@/lib/architect-tools", () => ({ getSystemHealth: vi.fn(), getAnalyticsReport: vi.fn() }));

const { executeBackupCreate, executeBackupList } = await import("@/lib/agent-tools/tool-handlers");

const context = { executionId: "test-exec", companyId: "test-company", actorUserId: "owner" } as never;

describe("the chat's backup tools and the nightly round share one implementation", () => {
  beforeEach(() => {
    snapshotCalls.mockClear();
    runNightlySnapshot.mockClear();
  });

  it("«اعمل نسخة احتياطية» runs the measured copy and answers with its real counts", async () => {
    const out = await executeBackupCreate({}, context);
    expect(snapshotCalls).toHaveBeenCalledTimes(1);
    expect(out.success).toBe(true);
    expect(out.message).toContain("النسخة الاحتياطية اتعملت");
    expect(out.message).toContain(`${arNum(9)} جداول`);
    expect(out.message).toContain(`${arNum(2112)} سطراً`);
    expect((out.data as { objects: string[] }).objects).toEqual(["2026-10-19/agent_messages.jsonl.gz"]);
  });

  it("a copy that stopped is reported as stopped, not as a success", async () => {
    runNightlySnapshot.mockResolvedValueOnce({
      day: "2026-10-19",
      tables: 9,
      rows: 0,
      bytes: 0,
      failures: ["رفع agent_messages: الدرج مقفول"],
      writes: [],
    } as never);
    const out = await executeBackupCreate({}, context);
    expect(out.success).toBe(false);
    expect(out.message).toContain("وقفت");
    expect(out.message).toContain("الدرج مقفول");
  });

  it("listing reads the real bucket, not a table that does not exist", async () => {
    const list = readFileSync("lib/agent-tools/tool-handlers.ts", "utf8");
    const body = list.slice(list.indexOf("export async function executeBackupList("));
    expect(body.slice(0, 1500)).toContain("SNAPSHOT_BUCKET");
    expect(body.slice(0, 1500)).not.toContain("backup_snapshots");
  });

  it("no backup path asks for a public URL over the owner's record", () => {
    const body = readFileSync("lib/agent-tools/tool-handlers.ts", "utf8");
    const create = body.slice(body.indexOf("export async function executeBackupCreate("), body.indexOf("// Settings Handlers"));
    expect(create).not.toContain("access: \"public\"");
    expect(create).not.toContain("blob");
    expect(create).not.toContain("backup_snapshots");
    expect(create).not.toContain("integrity_verified");
  });

  it("the health panel's backup age reads the stamp the copy writes", () => {
    const body = readFileSync("lib/agent-tools/tool-handlers.ts", "utf8");
    expect(body).toContain("nightly_snapshot_last");
    expect(body.match(/from\("backup_snapshots"\)/g) ?? []).toHaveLength(0);
  });

  it("the restore door names the copies it found instead of claiming there are none", () => {
    const restore = readFileSync("lib/admin-extended-handlers.ts", "utf8");
    const block = restore.slice(restore.indexOf("if (snapErr || !snapshot)"), restore.indexOf("const backup = await loadBackupJson"));
    expect(block).toContain("SNAPSHOT_BUCKET");
    expect(block).toContain("النسخ موجودة في الدرج الخاص");
    expect(block).toContain("كلمة المالك");
    expect(block).not.toContain("لم أجد نسخة احتياطية");
  });

  it("the tool advertises no knob the copy ignores", () => {
    // The scope of the store's copy has one owner. A caller asking for a table list it happens to
    // name — or a retention window that deletes nothing — would be promised something that does not exist.
    const registry = readFileSync("lib/agent-tools/tool-registry.ts", "utf8");
    const schema = registry.slice(registry.indexOf("const BackupCreateSchema"), registry.indexOf("required: [\"name\"]"));
    expect(schema).not.toMatch(/tables:|retentionDays:|includeFiles:/);
    const bridge = readFileSync("lib/admin-tool-bridge.ts", "utf8");
    expect(bridge).not.toMatch(/toolName: "backup_create",\s*\n\s*params: \{[^}]*tables/);
  });

  it("the tool door cannot report success when the approval row was never written", () => {
    // Measured live 2026-10-19: the approval branch answered `success: true, requiresApproval: true`
    // even when creating the request threw, so a failed approval looked like a pending decision.
    const door = readFileSync("app/api/admin/agent/tools/execute/route.ts", "utf8");
    const branch = door.slice(door.indexOf("if (approvalResult.requiresApproval)"), door.indexOf("// Create execution record"));
    expect(branch).toContain("approvalResult.success");
    expect(branch).toMatch(/status: 500/);
    expect(branch).toContain("طلب الموافقة ما اتسجلش");
  });
});

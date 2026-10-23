// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * One owner for the owner's alerts.
 *
 * Measured on the live record 2026-10-23: `agent_events` holds 8 columns and 4 rows, every row
 * written by a demo seed on 2026-08-10, and the columns the strip read and wrote — `severity`,
 * `acknowledged_at` — are not among them (each attempt answered 42703). So the old strip could
 * only repeat four invented alerts and fail to mark any of them read.
 *
 * The store's alerts already have one owner: the ledger read through `lib/ops/alerts.ts`. Both
 * surfaces — the cockpit's red strip and the old house's notification panel — go through it here,
 * so a count cannot exist twice.
 */

import { acknowledgeAlerts, alertWindowPhrase, readOpenAlerts } from "@/lib/ops/alerts";

const COMPANY = "11111111-1111-4111-8111-111111111111";

/** A table stub: every chaining method returns itself, and awaiting yields the next scripted reply. */
function fakeTable(reply: { data: unknown; error: unknown }, onInsert?: (rows: unknown) => void) {
  const self: any = new Proxy(
    {},
    {
      get(_target, prop: string) {
        if (prop === "then") return (resolve: (value: unknown) => void) => resolve(reply);
        if (prop === "insert") return (rows: unknown) => (onInsert?.(rows), self);
        return () => self;
      },
    },
  );
  return self;
}

function fakeClient(replies: Array<{ data: unknown; error: unknown }>, onInsert?: (rows: unknown) => void) {
  let index = 0;
  return {
    from: () => fakeTable(replies[index++] ?? { data: [], error: null }, onInsert),
  } as any;
}

function alertRow(id: number, event_type: string, source_agent: string, payload: Record<string, unknown>) {
  return { id, event_type, source_agent, payload, created_at: "2026-10-23T09:00:00.000Z" };
}

describe("the one reading rule over the store's alerts", () => {
  it("keeps the alerts the owner has not looked at and drops the ones he closed", async () => {
    const client = fakeClient([
      {
        data: [
          alertRow(1, "tool:failed", "OPS-QA", { summary: "أداة فشلت في التجربة" }),
          alertRow(2, "anomaly_detected", "OPS-LEAD", { digest: "• يوم 2026-10-22: ٣٤ حدث" }),
        ],
        error: null,
      },
      { data: [{ payload: { alert_id: 1 } }], error: null },
    ]);

    const read = await readOpenAlerts(client, COMPANY);
    expect(read.ok).toBe(true);
    const alerts = (read as any).alerts;
    expect(alerts.map((a: any) => a.id)).toEqual([2]);
  });

  it("reports a ledger that never answered instead of an empty list", async () => {
    const client = fakeClient([
      { data: null, error: { code: "42P01", message: "relation not found" } },
      { data: [], error: null },
    ]);

    const read = await readOpenAlerts(client, COMPANY);
    expect(read.ok).toBe(false);
    expect((read as any).error).toBe("الدفتر ما ردّش");
  });

  it("prints an alert in his Arabic and never as a machine key", async () => {
    const client = fakeClient([
      {
        data: [
          alertRow(7, "tool:failed", "OPS-QA", {}),
          alertRow(8, "some_unlisted_type", "OPS-QA", {}),
        ],
        error: null,
      },
      { data: [], error: null },
    ]);

    const read = await readOpenAlerts(client, COMPANY);
    const alerts = (read as any).alerts;
    expect(alerts[0].label).toBe("أداة فشلت في التنفيذ");
    // An unlisted event type gets no invented sentence — and no raw key either.
    expect(alerts[1].label).toBe("");
  });

  it("drops a note that is not his language and keeps the one that is", async () => {
    const client = fakeClient([
      {
        data: [
          alertRow(9, "workflow:failed", "OPS-QA", { summary: "Page crashed with TypeError" }),
          alertRow(10, "workflow:failed", "OPS-QA", { summary: "مسار العمل توقف عند باب الصور" }),
        ],
        error: null,
      },
      { data: [], error: null },
    ]);

    const alerts = ((await readOpenAlerts(client, COMPANY)) as any).alerts;
    expect(alerts[0].note).toBe("");
    expect(alerts[1].note).toBe("مسار العمل توقف عند باب الصور");
  });

  it("leaves a name out when the writer is not a seated employee", async () => {
    const client = fakeClient([
      { data: [alertRow(11, "task:failed", "owner", { summary: "تنبيه" })], error: null },
      { data: [], error: null },
    ]);

    const alerts = ((await readOpenAlerts(client, COMPANY)) as any).alerts;
    expect(alerts[0].who).toBe("");
  });

  it("writes one receipt per alert and only calls it saved when the ledger gives them back", async () => {
    const inserted: any[] = [];
    const ok = await acknowledgeAlerts(
      fakeClient([{ data: [{ id: 1 }, { id: 2 }], error: null }], (rows) => inserted.push(rows)),
      COMPANY,
      [41, 42],
    );
    expect(ok).toEqual({ ok: true, acked: 2 });
    const rows = inserted[0];
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      company_id: COMPANY,
      event_type: "owner_alert_acknowledged",
      source_agent: "owner",
      payload: { alert_id: 41 },
    });

    const short = await acknowledgeAlerts(fakeClient([{ data: [{ id: 1 }], error: null }]), COMPANY, [41, 42]);
    expect(short.ok).toBe(false);

    const refused = await acknowledgeAlerts(
      fakeClient([{ data: null, error: { code: "42501", message: "permission denied" } }]),
      COMPANY,
      [41],
    );
    expect(refused.ok).toBe(false);
    expect((refused as any).error).toBe("الدفتر رفض التسجيل");
  });

  it("says how long back the strip looks, in his digits", () => {
    expect(alertWindowPhrase()).toMatch(/آخر [\u0660-\u0669]+ دقيقة/);
  });
});

/** Source guards: the shape of the repair, so a second reader cannot come back. */
describe("the surfaces that read his alerts", () => {
  const notificationsDoor = "app/api/admin/notifications/route.ts";
  const cockpitDoor = "app/api/admin/agents/alerts/route.ts";
  const oldPanel = "components/admin/NotificationsPanel.tsx";

  it("builds no query against the dead table in the notification door", () => {
    const door = readFileSync(notificationsDoor, "utf8");
    // The header comment is allowed to name the table it no longer reads; a query is not.
    expect(door).not.toMatch(/from\(\s*["'`]agent_events/);
    expect(door).toContain("readOpenAlerts");
    expect(door).toContain("acknowledgeAlerts");
  });

  it("keeps the cockpit door off the raw ledger so the rule stays in one place", () => {
    const door = readFileSync(cockpitDoor, "utf8");
    expect(door).not.toContain("ops_sync_events");
    expect(door).toContain("readOpenAlerts");
  });

  it("keeps a severity the store never measured off the strip", () => {
    const panel = readFileSync(oldPanel, "utf8");
    expect(panel).not.toMatch(/severity/);
    expect(panel).toContain("arNum(");
    expect(panel).toContain("restingLine");
  });

  it("holds the alert window in one module only", () => {
    const files: string[] = [];
    for (const dir of ["app", "components", "lib", "services"]) {
      const walk = (p: string) => {
        for (const entry of readdirSync(p)) {
          const full = join(p, entry);
          if (statSync(full).isDirectory()) walk(full);
          else if (/\.tsx?$/.test(full)) files.push(full.replace(/\\/g, "/"));
        }
      };
      walk(dir);
    }
    const holders = files.filter((f) => readFileSync(f, "utf8").includes("ALERT_WINDOW_MS"));
    expect(holders).toEqual(["lib/ops/alerts.ts"]);
  });

  it("still refuses the strip to a caller with no admin session", () => {
    expect(readFileSync(notificationsDoor, "utf8")).toContain("requireAdminApiAccess");
  });
});

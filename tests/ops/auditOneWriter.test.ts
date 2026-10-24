// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * One writer for the store's audit trail.
 *
 * Measured on the live record 2026-10-24: `audit_log` answers to nine columns and held zero rows,
 * while six doors were writing to it. The desk sent four names the record has never had
 * (company_id, actor_user_id, approval_request_id, command_log_id), and when the record refused it
 * listened only for 42703 — the code a missing *read* column gives. A payload name the record does
 * not have comes back as PGRST204 instead (scratch/measure-audit-write.out), so the retry never
 * fired, the refusal was dropped, and every audit event vanished without a sound.
 *
 * The links are not lost: they ride inside `details`, a column the record does have.
 */

import { AUDIT_WRITE_COLUMNS } from "@/lib/ops/audit-record";

function codeOf(path: string) {
  return readFileSync(path, "utf8");
}

function files(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return files(full);
    return /\.(ts|tsx)$/.test(full) ? [full] : [];
  });
}

function writesAuditTable() {
  return ["lib", "app", "components"]
    .flatMap((root) => files(root))
    .filter((file) => /from\("audit_log"\)[\s\S]{0,120}?\.(insert|update|delete)\(/.test(codeOf(file)));
}

function fakeClient(reply: { data: unknown; error: unknown }) {
  const calls: unknown[] = [];
  const self: any = new Proxy(
    {},
    {
      get(_target, prop: string) {
        if (prop === "then") return (resolve: (value: unknown) => void) => resolve(reply);
        if (prop === "insert") return (rows: unknown) => (calls.push(rows), self);
        return () => self;
      },
    },
  );
  return { client: self as any, calls };
}

async function loadWriter(client: unknown) {
  vi.resetModules();
  vi.doMock("@/lib/supabase-admin", () => ({ getSupabaseAdminClient: () => client }));
  return await import("@/lib/ops/audit-record");
}

const event = {
  kind: "agent_command",
  action: "شغّل تقرير",
  actor: "admin-test",
  details: { type: "command" },
  outcome: "success" as const,
};

describe("the one audit writer", () => {
  it("sends only the columns the record answers to, and hands back the row it stored", async () => {
    const { client, calls } = fakeClient({ data: [{ id: "a7f1" }], error: null });
    const writer = await loadWriter(client);

    const wrote = await writer.recordAuditEvent(event);

    expect(wrote).toEqual({ ok: true, id: "a7f1" });
    const sent = Object.keys(calls[0] as Record<string, unknown>).sort();
    expect(sent).toEqual([...AUDIT_WRITE_COLUMNS].sort());
  });

  it("keeps the relation links inside the payload column the record has", async () => {
    const { client, calls } = fakeClient({ data: [{ id: "1" }], error: null });
    const writer = await loadWriter(client);

    await writer.recordAuditEvent({
      ...event,
      relation: { companyId: "c-1", actorUserId: "u-1", approvalRequestId: "", commandLogId: undefined },
    });

    const sent = calls[0] as { details: Record<string, unknown> };
    expect(sent.details).toEqual({
      type: "command",
      relation: { companyId: "c-1", actorUserId: "u-1" },
    });
    expect(sent).not.toHaveProperty("company_id");
    expect(sent).not.toHaveProperty("actor_user_id");
  });

  it("writes no relation block when there is nothing to link", async () => {
    const { client, calls } = fakeClient({ data: [{ id: "1" }], error: null });
    const writer = await loadWriter(client);

    await writer.recordAuditEvent({ ...event, relation: { companyId: "  ", actorUserId: undefined } });

    expect((calls[0] as { details: Record<string, unknown> }).details).toEqual({ type: "command" });
  });

  it("refuses an event with no kind, no action, no actor or an unknown result — before the record is touched", async () => {
    const { client, calls } = fakeClient({ data: [{ id: "1" }], error: null });
    const writer = await loadWriter(client);

    expect((await writer.recordAuditEvent({ ...event, kind: "  " })).ok).toBe(false);
    expect((await writer.recordAuditEvent({ ...event, action: "   " })).ok).toBe(false);
    expect((await writer.recordAuditEvent({ ...event, actor: "" })).ok).toBe(false);
    expect((await writer.recordAuditEvent({ ...event, outcome: "maybe" as never })).ok).toBe(false);
    expect(calls).toEqual([]);
  });

  it("admits the record's refusal instead of reporting a row that was never stored", async () => {
    const { client } = fakeClient({ data: null, error: { code: "PGRST204", message: "no such column" } });
    const writer = await loadWriter(client);

    const wrote = await writer.recordAuditEvent(event);

    expect(wrote).toEqual({ ok: false, error: "سجل الأحداث رفض السطر" });
  });

  it("says the row did not land when the record hands back no id", async () => {
    const { client } = fakeClient({ data: [], error: null });
    const writer = await loadWriter(client);

    const wrote = await writer.recordAuditEvent(event);

    expect(wrote.ok).toBe(false);
    if (!wrote.ok) expect(wrote.error).toContain("ما رجّعتش رقم السطر");
  });

  it("admits when the store's own credential is missing", async () => {
    const writer = await loadWriter(null);

    const wrote = await writer.recordAuditEvent(event);

    expect(wrote.ok).toBe(false);
    if (!wrote.ok) expect(wrote.error).toContain("مش متصل");
  });
});

describe("the audit desk has one door", () => {
  it("is the only file that writes the audit table", () => {
    const writing = writesAuditTable().filter(
      (file) => !file.replaceAll("\\", "/").includes("lib/ops/audit-record.ts"),
    );

    expect(writing, writing.join(", ")).toEqual([]);
  });

  it("no longer guesses which refusal means which missing name", () => {
    const desk = codeOf("lib/ultimate-agent/security-manager.ts");

    expect(desk).not.toMatch(/42703/);
    expect(desk).not.toMatch(/legacyPayload/);
    expect(desk).toContain("recordAuditEvent");
  });

  it("the relations door asks the audit table about the columns the writer sends", () => {
    const door = codeOf("app/api/admin/intel/relations/health/route.ts");

    expect(door).toContain("AUDIT_WRITE_COLUMNS");
    expect(door).not.toMatch(/"approval_request_id"/);
  });
});

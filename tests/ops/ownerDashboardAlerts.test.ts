// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * The owner dashboard's alert block.
 *
 * Measured on the live record 2026-10-23: it queried `agent_events` with `severity in (…)` and
 * `acknowledged = false` — neither column exists — so the read failed on every load, the failure
 * was swallowed into an empty list, and the card said «جميع الأنظمة مستقرة». The "delayed" tile
 * counted alerts by that same missing severity, and the connected-devices figure was a hard-coded
 * null. Alerts now come from the ledger through the one reading rule, asked for today's span.
 */

import { readOpenAlerts } from "@/lib/ops/alerts";

const COMPANY = "11111111-1111-4111-8111-111111111111";

/** A stub that records every filter it was given, so the span and the cap are provable. */
function recordingClient(reply: { data: unknown; error: unknown }) {
  const calls: Array<[string, unknown[]]> = [];
  const make = (): any =>
    new Proxy(
      {},
      {
        get(_target, prop: string) {
          if (prop === "then") return (resolve: (value: unknown) => void) => resolve(reply);
          return (...args: unknown[]) => (calls.push([prop, args]), make());
        },
      },
    );
  return { client: make() as any, calls };
}

function filterValues(calls: Array<[string, unknown[]]>, name: string) {
  return calls.filter(([prop]) => prop === name).map(([, args]) => args);
}

describe("the reading rule asked for a longer span", () => {
  it("queries from the instant the surface supplied, not from its own hour", async () => {
    const sinceIso = "2026-10-23T00:00:00.000Z";
    const { client, calls } = recordingClient({ data: [], error: null });
    const read = await readOpenAlerts(client, COMPANY, { sinceIso, limit: 100 });

    expect(read.ok).toBe(true);
    const gte = filterValues(calls, "gte");
    expect(gte).toContainEqual(["created_at", sinceIso]);
    expect(filterValues(calls, "limit")).toContainEqual([100]);
  });

  it("keeps its own default window when a surface asks for none", async () => {
    const { client, calls } = recordingClient({ data: [], error: null });
    await readOpenAlerts(client, COMPANY);
    const gte = filterValues(calls, "gte");
    expect(gte.length).toBeGreaterThan(0);
    const since = new Date(String(gte[0][1]));
    const minutes = (Date.now() - since.getTime()) / 60000;
    expect(minutes).toBeGreaterThanOrEqual(58);
    expect(minutes).toBeLessThanOrEqual(62);
  });
});

/** Source guards: the shape of the repair. */
describe("the owner dashboard reads what exists", () => {
  const door = "app/api/admin/owner/dashboard/route.ts";
  const page = "app/admin/owner-dashboard/page.tsx";

  function codeOf(file: string): string {
    return readFileSync(file, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
  }

  it("builds no query against the dead table", () => {
    const source = codeOf(door);
    expect(source).not.toMatch(/from\(\s*["'`]agent_events/);
    expect(source).toContain("readOpenAlerts");
    expect(source).not.toMatch(/severity|acknowledged/);
  });

  it("dropped the payload nobody read and the field that could never exist", () => {
    const source = codeOf(door);
    expect(source).not.toContain("quick_stats");
    expect(source).not.toMatch(/active_devices:\s*null/);
    expect(source).toContain("countConnectedDevices");
    expect(source).toContain("countOverduePapers");
  });

  it("keeps the retired stamp and the machine words off his screen", () => {
    const source = readFileSync(page, "utf8");
    expect(source).not.toMatch(/VANGUARD AI|ACTIVE DEVICES/);
    expect(source).toContain("مدير المبيعات");
    expect(source).toContain("أجهزة متصلة");
  });

  it("says the calm in measured words, never as a promise", () => {
    const source = readFileSync(page, "utf8");
    expect(source).not.toContain("جميع الأنظمة مستقرة");
    expect(source).toContain("مفيش تنبيه مفتوح النهاردة في دفتر المتجر");
    expect(source).toContain("alerts_error");
    expect(source).not.toMatch(/alert\.severity/);
  });

  it("counts in his digits, and admits what was never measured", () => {
    const source = readFileSync(page, "utf8");
    expect(source).toContain("arNum(");
    expect(source).toContain("ما اتقستش");
    expect(source).toContain("ورقة مستنية من امبارح");
  });

  it("leaves the reassuring calm nowhere in the owner's screens", () => {
    const files: string[] = [];
    for (const dir of ["app", "components"]) {
      const walk = (p: string) => {
        if (!existsSync(p)) return;
        for (const entry of readdirSync(p)) {
          const full = join(p, entry);
          if (statSync(full).isDirectory()) walk(full);
          else if (/\.tsx?$/.test(full) && codeOf(full).includes("جميع الأنظمة مستقرة")) {
            files.push(full.replace(/\\/g, "/"));
          }
        }
      };
      walk(dir);
    }
    expect(files).toEqual([]);
  });
});

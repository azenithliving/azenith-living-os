// @vitest-environment node
import { describe, it, expect } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { findPhantoms, formatRefusalLine, fromSiteCensus, refsFromSource, splitByReachability } from "@/lib/build/phantom-names";
import { exportedSymbolAt } from "@/lib/build/reachability";

/**
 * «استعلام مرفوض = صفر مطمئن» is the disease this store keeps dying of: the code asks the record for
 * a column the record never had, PostgREST refuses, supabase-js returns the error as a *value*, and
 * the caller renders an empty number. Measured before this phase existed: the audit trail wrote zero
 * rows forever, and a company filter read a column that was never created.
 *
 * The scan compares names in the code against what the record answered. It is deliberately
 * conservative — it only flags a name it can read as a plain literal, so an embedded resource or a
 * computed alias never becomes a false finding.
 */
const columns: Record<string, string[]> = {
  agent_tasks: ["id", "title", "status", "created_at"],
  companies: ["id", "name", "created_at"],
  sales_orders: ["id", "total_egp", "created_at"],
};

const refs = (file: string, source: string) => refsFromSource(file, source);

const SCAN_SCRIPT = resolve(fileURLToPath(new URL("../../scripts/instruments/refusal-scan.mjs", import.meta.url)));

/**
 * Runs the real scanner against a fixture workspace whose answer is known by hand, so the numbers it
 * prints are checked against a measured truth instead of against itself. Returns the emitted report.
 */
function runScan(files: Record<string, string>): { out: any; stdout: string; status: number | null } {
  const dir = mkdtempSync(join(tmpdir(), "refusal-scan-"));
  try {
    mkdirSync(join(dir, "docs/ledger"), { recursive: true });
    writeFileSync(
      join(dir, "docs/ledger/record-columns.json"),
      JSON.stringify({
        measuredAt: new Date().toISOString(),
        tables: { agent_tasks: ["id", "title"], companies: ["id", "name"] },
      }),
      "utf8",
    );
    for (const [path, source] of Object.entries(files)) {
      mkdirSync(join(dir, path.split("/").slice(0, -1).join("/")), { recursive: true });
      writeFileSync(join(dir, path), source, "utf8");
    }
    const child = spawnSync(process.execPath, [SCAN_SCRIPT], { cwd: dir, encoding: "utf8" });
    const out = JSON.parse(readFileSync(join(dir, "docs/ledger/refusal-scan.json"), "utf8"));
    return { out, stdout: `${child.stdout ?? ""}${child.stderr ?? ""}`, status: child.status };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("the phantom-name scan", () => {
  it("flags a selected column the record does not have", () => {
    const found = findPhantoms(
      refs("lib/x.ts", `supabase.from("agent_tasks").select("id, last_run_at")`),
      columns,
    );
    expect(found).toHaveLength(1);
    expect(found[0].column).toBe("last_run_at");
    expect(found[0].kind).toBe("select");
  });

  it("does not invent findings out of stars, embeds, casts and aliases", () => {
    const source = `
      supabase.from("agent_tasks").select("*");
      supabase.from("companies").select("id, agent_tasks(title)");
      supabase.from("sales_orders").select("total:total_egp::numeric, count()");
    `;
    expect(findPhantoms(refs("lib/y.ts", source), columns)).toEqual([]);
  });

  it("flags a filter column the record does not have", () => {
    const found = findPhantoms(
      refs("lib/z.ts", `supabase.from("companies").select("id").eq("company_slug", slug)`),
      columns,
    );
    expect(found.map((f) => f.column)).toEqual(["company_slug"]);
    expect(found[0].kind).toBe("filter");
  });

  it("flags an inserted key the record does not have", () => {
    const found = findPhantoms(
      refs("lib/w.ts", `supabase.from("sales_orders").insert({ id, total_egp, scheduled_start })`),
      columns,
    );
    expect(found.map((f) => f.column)).toEqual(["scheduled_start"]);
    expect(found[0].kind).toBe("insert");
  });

  it("names a whole table the record does not have", () => {
    const found = findPhantoms(refs("lib/v.ts", `supabase.from("reality_mutations").select("id")`), columns);
    expect(found).toHaveLength(1);
    expect(found[0].kind).toBe("missing-table");
    expect(found[0].table).toBe("reality_mutations");
  });

  it("keeps a real column quiet", () => {
    expect(
      findPhantoms(refs("lib/u.ts", `supabase.from("agent_tasks").select("id, status").eq("status", "open")`), columns),
    ).toEqual([]);
  });

  it("prints the count in his digits, and says what is not measured", () => {
    const line = formatRefusalLine({ total: 7, distinct: 5, byKind: { select: 3, filter: 2, insert: 1, "missing-table": 1 } });
    expect(line).toContain("رفض صامت");
    // 203 findings are not 203 names: the same name asked in two files is two places to fix.
    expect(line).toContain("اسم مختلف");
    expect(/[0-9]/.test(line)).toBe(false);
    // Measured on the published card 2026-11-05: brackets around an Arabic-Indic number inside the
    // RTL line flip to the wrong side, so the owner reads «مختلف) ١٣٩ اسم(». The line is his screen.
    expect(line).not.toMatch(/[()]/);

    expect(formatRefusalLine({ total: 0, distinct: 0, byKind: {} })).toContain("صفر");
    expect(formatRefusalLine(null)).toContain("ما اتقارش");
    expect(formatRefusalLine(null)).not.toMatch(/صفر/);
  });

  it("names the query places whose table it could not resolve", () => {
    // A `.from(` whose table is a variable the scan cannot follow is unread, not answered — counted
    // here so the headline never reads as full coverage of every query in the code.
    const source = [
      'const TABLE = "companies";',
      'supabase.from(TABLE).select("id");',
      'supabase.from(whichTable).select("id");',
      'supabase.from("agent_tasks").select("id");',
      'supabase.from(process.env.TOKEN).insert({ id });',
    ].join("\n");
    expect(fromSiteCensus(source)).toEqual({ sites: 4, resolved: 2, blind: 2 });
  });

  it("splits a refusal by whether any owner surface reaches the file that asks it", () => {
    // A phantom inside a door nobody calls is not a silent refusal the owner lives with — it is a
    // retirement candidate. Mixing the two is how a phase gets sized by its dead weight.
    const found = [
      { file: "app/api/admin/work/route.ts", table: "users", column: "role", kind: "filter" as const },
      { file: "app/api/omnipotent/ai/synthesize/route.ts", table: "users", column: "is_admin", kind: "filter" as const },
    ];
    const split = splitByReachability(found, ["app/api/omnipotent/ai/synthesize/route.ts"]);
    expect(split.live.map((p) => p.column)).toEqual(["role"]);
    expect(split.deadCode.map((p) => p.column)).toEqual(["is_admin"]);
  });

  it("resolves a table named by a constant in the same file", () => {
    // Measured 2026-11-05: the alert watcher writes through ALERTS_TABLE, and the first scan blamed
    // the previous literal table for its columns — nine false findings, one of them a "missing table".
    const source = `
      const ALERTS_TABLE = "system_alerts";
      supabase.from(ALERTS_TABLE).insert({ dedupe_key, status, muted_until });
      supabase.from(ALERTS_TABLE).select("status").eq("dedupe_key", key);
    `;
    const found = findPhantoms(refs("lib/sentinel.ts", source), { system_alerts: ["id", "dedupe_key", "status"] });
    expect(found.map((f) => f.column).sort()).toEqual(["muted_until"]);
    expect(found[0].table).toBe("system_alerts");
  });

  it("refuses to guess a table it cannot resolve", () => {
    // An unresolved variable is silence, never a finding attributed to whatever table came before.
    const source = `
      supabase.from("api_keys").select("provider");
      supabase.from(whichTable).insert({ dedupe_key });
    `;
    const found = findPhantoms(refs("lib/x.ts", source), { api_keys: ["provider"] });
    expect(found).toEqual([]);
  });

  it("carries the position of the query, so the scan can name the function it sits in", () => {
    // A file being reachable says nothing about the code inside it: measured 2026-11-05, a quarter of
    // the «live» refusals sat in exported functions no route ever imports.
    const source = [
      'export async function readCompany() { return supabase.from("companies").select("company_slug"); }',
      'export async function readTask() { return supabase.from("agent_tasks").select("last_run_at"); }',
    ].join("\n");
    const found = findPhantoms(refs("lib/pos.ts", source), columns);
    expect(found.map((f) => f.at)).toEqual([
      source.indexOf('.from("companies")'),
      source.indexOf('.from("agent_tasks")'),
    ]);
    expect(found.map((f) => exportedSymbolAt(source, f.at))).toEqual(["readCompany", "readTask"]);
  });

  it("counts a name once but keeps every place it was asked", () => {
    // The count is distinct names; the judgement needs each place, or a dormant first caller
    // decides for a live one.
    const source = [
      'function idle() { return supabase.from("companies").select("company_slug"); }',
      'export function live() { return supabase.from("companies").select("company_slug"); }',
      'export function again() { return supabase.from("companies").select("company_slug"); }',
    ].join("\n");
    const found = findPhantoms(refs("lib/sites.ts", source), columns);
    expect(found).toHaveLength(1);
    expect(found[0].sites).toHaveLength(3);
    expect(found[0].sites.map((at: number) => exportedSymbolAt(source, at))).toEqual(["idle", "live", "again"]);
  });

  it("keeps a file the census never counted on the live side", () => {
    // Unknown means unproven, and an unproven name must be looked at, not filed as dead.
    const split = splitByReachability(
      [{ file: "lib/newly-added.ts", table: "users", column: "role", kind: "filter" as const, at: 0 }],
      ["app/api/x/route.ts"],
    );
    expect(split.live).toHaveLength(1);
    expect(split.deadCode).toEqual([]);
  });

  it("counts every refused name in the headline, with the static read as a breakdown beside it", () => {
    // Measured 2026-11-05: the scan printed 72 while 204 names had no answer, because the headline
    // counted only the findings its own import graph could prove. A breakdown may not shrink the total.
    const { out, status } = runScan({
      "app/api/x/route.ts": `supabase.from("agent_tasks").select("last_run_at");`,
      "lib/orphan.ts": `supabase.from("companies").select("company_slug");`,
    });
    expect(status).toBe(0);
    expect(out.total).toBe(2);
    expect(out.phantoms.map((p: { file: string }) => p.file).sort()).toEqual(["app/api/x/route.ts", "lib/orphan.ts"]);
    expect(out.classification).toEqual({ live: 1, uncalled: 1, unreached: 0, unknown: 0 });
    expect(Object.values(out.classification).reduce((a: number, b: number) => a + b, 0)).toBe(out.total);
  });

  it("judges a name asked in two functions by the function that is actually reached", () => {
    // The dedup keeps one finding per name, so it must keep every place that name is asked: proving the
    // first site is dormant says nothing about the second one a live door imports.
    const { out } = runScan({
      "lib/two.ts": [
        `async function dormant() { return supabase.from("agent_tasks").select("last_run_at"); }`,
        `export async function used() { return supabase.from("agent_tasks").select("last_run_at"); }`,
      ].join("\n"),
      "app/api/y/route.ts": `import { used } from "../../../lib/two"; supabase.from("companies").select("name");`,
    });
    expect(out.total).toBe(1);
    expect(out.classification).toEqual({ live: 1, uncalled: 0, unreached: 0, unknown: 0 });
    // The place printed beside a verdict must be the place that earned it, not the first one seen.
    const [finding] = out.phantoms;
    expect(finding.symbol).toBe("used");
    expect(finding.at).toBe(finding.sites[1]);
  });
});

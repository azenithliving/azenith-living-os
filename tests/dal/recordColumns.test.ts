// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * The data layer may only name columns the record answers to.
 *
 * Measured 2026-11-04 (scratch/measure-dal-columns.mjs): the unified layer filtered or wrote six
 * names the record has never had — `companies.slug`, `production_jobs.scheduled_start`,
 * `users.auth_user_id`, `sales_orders.final_payment_paid`, `approval_requests.decided_by` /
 * `.decided_at`, and a whole insert into `inventory_movements`, a table that does not exist.
 * Every one of them reads like working code and is actually a refused query: a filter on a missing
 * column answers 42703, a payload with one answers PGRST204, and the caller sees an empty result.
 *
 * The snapshot is generated from the live record by the same script, never written by hand.
 */

const source = readFileSync("lib/dal/unified-supabase.ts", "utf8");
const snapshot = JSON.parse(readFileSync("lib/dal/record-schema.json", "utf8")) as {
  measuredAt: string;
  tables: Record<string, string[]>;
};

const lines = source.split(/\r?\n/);
const FROM = /\.from\(\s*['"]([A-Za-z_][A-Za-z0-9_]*)['"]/;
const FILTER = /\.(eq|neq|gt|gte|lt|lte|like|ilike|in|order|not|is|contains|containedBy)\(\s*['"]([A-Za-z_][A-Za-z0-9_]*)['"]/g;
const WRITE = /\.(insert|update|upsert)\(\s*\{/;
const KEY = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:/g;

type Pair = { table: string; column: string; line: number; kind: "filter" | "write" };

function tableAbove(index: number): string | null {
  for (let i = index; i >= 0 && i > index - 20; i--) {
    const m = FROM.exec(lines[i]);
    if (m) return m[1];
  }
  return null;
}

const pairs: Pair[] = [];
let current: string | null = null;

lines.forEach((raw, index) => {
  const from = FROM.exec(raw);
  if (from) current = from[1];

  let m: RegExpExecArray | null;
  FILTER.lastIndex = 0;
  while ((m = FILTER.exec(raw))) {
    const table = current ?? tableAbove(index);
    if (table) pairs.push({ table, column: m[2], line: index + 1, kind: "filter" });
  }

  if (WRITE.test(raw)) {
    const table = tableAbove(index) ?? current;
    const keys: string[] = [];
    for (let j = index; j < Math.min(index + 16, lines.length); j++) {
      let km: RegExpExecArray | null;
      KEY.lastIndex = 0;
      while ((km = KEY.exec(lines[j]))) keys.push(km[1]);
      if (lines[j].includes("}")) break;
    }
    if (table) for (const column of keys) pairs.push({ table, column, line: index + 1, kind: "write" });
  }
});

describe("the layer names only what the record answers to", () => {
  it("the snapshot is the record's, not a hand-written list", () => {
    const tables = Object.keys(snapshot.tables);
    expect(tables.length).toBeGreaterThanOrEqual(10);
    expect(snapshot.measuredAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(tables.every((t) => snapshot.tables[t].length > 0)).toBe(true);
  });

  it("every filter and write column is in the record", () => {
    const offenders = pairs.filter((p) => !snapshot.tables[p.table]?.includes(p.column));
    expect(
      offenders.map((o) => `${o.table}.${o.column} (${o.kind}, line ${o.line})`),
      `columns the record has never had: ${offenders.length}`
    ).toEqual([]);
  });

  it("every table the layer reaches for is in the record", () => {
    const used = [...new Set(pairs.map((p) => p.table))];
    const missing = used.filter((t) => !snapshot.tables[t]);
    expect(missing, `tables with no relation: ${missing.join(", ")}`).toEqual([]);
  });

  it("the six phantom names stay out of the layer", () => {
    // Comments may explain which name was removed; code may not send it again.
    const code = source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    for (const banned of [
      "'slug'",
      "scheduled_start",
      "auth_user_id",
      "final_payment_paid",
      "decided_by",
      "decided_at",
      "inventory_movements",
    ]) {
      expect(code, banned).not.toContain(banned);
    }
  });

  it("a promise the record cannot keep is said, not paid for", () => {
    // getByAuthId and recordMovement have no storage to answer from; they must return the reason.
    expect(source).toContain("DAL_NO_AUTH_LINK");
    expect(source).toContain("DAL_NO_TABLE");
    expect(source).toMatch(/ما فيهوش جدول حركة المخزون/);
  });

  it("the company resolver asks the column the record actually keys on", () => {
    expect(source).toContain("async getByDomain(domain: string)");
    expect(source).toMatch(/from\('companies'\)[\s\S]{0,120}\.eq\('domain', domain\)/);
  });
});

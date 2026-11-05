// @vitest-environment node
import { describe, it, expect } from "vitest";

import { findPhantoms, formatRefusalLine, refsFromSource, splitByReachability } from "@/lib/build/phantom-names";

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
    const line = formatRefusalLine({ total: 7, byKind: { select: 3, filter: 2, insert: 1, "missing-table": 1 } });
    expect(line).toContain("رفض صامت");
    expect(/[0-9]/.test(line)).toBe(false);

    expect(formatRefusalLine({ total: 0, byKind: {} })).toContain("صفر");
    expect(formatRefusalLine(null)).toContain("ما اتقارش");
    expect(formatRefusalLine(null)).not.toMatch(/صفر/);
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

  it("keeps a file the census never counted on the live side", () => {
    // Unknown means unproven, and an unproven name must be looked at, not filed as dead.
    const split = splitByReachability(
      [{ file: "lib/newly-added.ts", table: "users", column: "role", kind: "filter" as const }],
      ["app/api/x/route.ts"],
    );
    expect(split.live).toHaveLength(1);
    expect(split.deadCode).toEqual([]);
  });
});

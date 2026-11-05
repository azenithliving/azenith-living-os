// @vitest-environment node
import { describe, it, expect } from "vitest";

import {
  buildGraphFromSources,
  classifyBySymbol,
  exportedSymbolAt,
  formatReachabilityLine,
  symbolReachability,
  type ModuleGraph,
} from "@/lib/build/reachability";

/**
 * The first scan called a name «live» because the file it sits in was reachable. Measured
 * 2026-11-05 that was wrong twice over: the alert-watcher's columns were charged to the wrong table,
 * and the whole progress desk — a panel no route imports — was counted as owner-visible. Whether a
 * query is reachable is decided per exported symbol by reading who imports what. This is a static
 * read of the source: a visible import path is not proof the code ran, and the line says so.
 */
const source = `
import { x } from "./other";

export async function storeUserPreference(p: unknown) {
  return supabase.from("user_preferences").insert({ key: p });
}

export async function getUserPreferences() {
  return supabase.from("user_preferences").select("id");
}

function helper() {
  return supabase.from("agent_goals").select("steps");
}
`;

describe("per-symbol reachability", () => {
  it("names the exported symbol a query sits inside", () => {
    expect(exportedSymbolAt(source, source.indexOf("insert("))).toBe("storeUserPreference");
    expect(exportedSymbolAt(source, source.indexOf('select("id")'))).toBe("getUserPreferences");
    expect(exportedSymbolAt(source, source.indexOf('select("steps")'))).toBe("helper");
  });

  it("calls a symbol live when a route imports it", () => {
    const graph: ModuleGraph = {
      "lib/ultimate-agent/memory-store.ts": { exports: ["storeUserPreference", "getUserPreferences"], imports: [] },
      "app/api/consultant/route.ts": { exports: [], imports: [{ from: "lib/ultimate-agent/memory-store", names: ["storeUserPreference"] }] },
    };
    expect(symbolReachability("lib/ultimate-agent/memory-store.ts", "storeUserPreference", graph, ["app/api/consultant/route.ts"])).toBe("live");
    expect(symbolReachability("lib/ultimate-agent/memory-store.ts", "getUserPreferences", graph, ["app/api/consultant/route.ts"])).toBe("uncalled");
  });

  it("follows the chain: a symbol reached only through an unreached file is not live", () => {
    const graph: ModuleGraph = {
      "app/actions/progress-actions.ts": { exports: ["updateRequestProgress"], imports: [] },
      "components/progress/admin-progress-panel.tsx": {
        exports: ["AdminProgressPanel"],
        imports: [{ from: "app/actions/progress-actions", names: ["updateRequestProgress"] }],
      },
    };
    expect(symbolReachability("app/actions/progress-actions.ts", "updateRequestProgress", graph, [])).toBe("unreached");
  });

  it("reads exports and imports out of the sources it is given", () => {
    const graph = buildGraphFromSources({
      "app/actions/progress-actions.ts": `
        "use server";
        export async function updateRequestProgress(id: string) { return id; }
        export type RequestRecord = { id: string };
      `,
      "components/progress/admin-progress-panel.tsx": `
        "use client";
        import { updateRequestProgress } from "@/app/actions/progress-actions";
        export function AdminProgressPanel() { return null; }
      `,
      "app/admin/progress/page.tsx": `
        import { AdminProgressPanel } from "@/components/progress/admin-progress-panel";
        export default function Page() { return null; }
      `,
    });
    expect(graph["app/actions/progress-actions.ts"].exports).toContain("updateRequestProgress");
    expect(graph["components/progress/admin-progress-panel.tsx"].imports[0]).toEqual({
      from: "@/app/actions/progress-actions",
      names: ["updateRequestProgress"],
    });

    const entries = ["app/admin/progress/page.tsx"];
    expect(symbolReachability("app/actions/progress-actions.ts", "updateRequestProgress", graph, entries)).toBe("live");
  });

  it("treats a side-effect import as reaching the whole module", () => {
    const graph = buildGraphFromSources({
      "lib/init.ts": "export function boot() {}",
      "app/api/x/route.ts": 'import "@/lib/init";\nexport async function GET() { return null; }',
    });
    expect(symbolReachability("lib/init.ts", "boot", graph, ["app/api/x/route.ts"])).toBe("live");
  });

  it("follows a relative import that carries its own extension", () => {
    const graph = buildGraphFromSources({
      "lib/build/ruler-view.ts": 'import { arDigits } from "../ops/metricLabels.ts";\nexport function view() { return arDigits(1); }',
      "lib/ops/metricLabels.ts": "export const arDigits = (n: number) => String(n);",
      "app/api/admin/ruler/route.ts": 'import { view } from "../../../../lib/build/ruler-view.ts";\nexport async function GET() { return view(); }',
    });
    expect(graph["app/api/admin/ruler/route.ts"].imports[0].from).toBe("../../../../lib/build/ruler-view.ts");
    expect(symbolReachability("lib/ops/metricLabels.ts", "arDigits", graph, ["app/api/admin/ruler/route.ts"])).toBe("live");
  });

  it("splits a refusal list by whether an owner surface can reach the function that asks it", () => {
    const sources = {
      "app/api/admin/orders/route.ts": [
        'import { tally } from "@/lib/orders/tally.ts";',
        "export async function GET() { return tally(); }",
      ].join("\n"),
      "lib/orders/tally.ts": 'export function tally() { return supabase.from("sales_orders").select("total_egp"); }',
      "lib/orders/legacy-tally.ts": 'export function legacyTally() { return supabase.from("sales_orders").select("paid_at"); }',
      "components/progress/panel.tsx": [
        'import { deskCount } from "@/lib/progress/desk.ts";',
        "export function Panel() { return deskCount(); }",
      ].join("\n"),
      "lib/progress/desk.ts": 'export function deskCount() { return supabase.from("agent_tasks").select("last_run_at"); }',
    };
    const phantoms = [
      { file: "lib/orders/tally.ts", table: "sales_orders", column: "total_egp", kind: "select" as const, at: sources["lib/orders/tally.ts"].indexOf(".from(") },
      { file: "lib/orders/legacy-tally.ts", table: "sales_orders", column: "paid_at", kind: "select" as const, at: sources["lib/orders/legacy-tally.ts"].indexOf(".from(") },
      { file: "lib/progress/desk.ts", table: "agent_tasks", column: "last_run_at", kind: "select" as const, at: sources["lib/progress/desk.ts"].indexOf(".from(") },
    ];

    const split = classifyBySymbol(phantoms, sources);
    expect(split.live.map((p) => p.column)).toEqual(["total_egp"]);
    expect(split.live[0].symbol).toBe("tally");
    expect(split.uncalled.map((p) => p.column)).toEqual(["paid_at"]);
    expect(split.unreached.map((p) => p.column)).toEqual(["last_run_at"]);
    expect(split.tally).toEqual({ live: 1, uncalled: 1, unreached: 1, unknown: 0 });
  });

  it("follows a barrel's re-export as an edge, not just as a name it owns", () => {
    const graph = buildGraphFromSources({
      "lib/store.ts": "export function readPreferences() {}\nexport function writePreferences() {}",
      "lib/index.ts": 'export { readPreferences } from "./store.ts";',
      "app/api/x/route.ts": 'import { readPreferences } from "@/lib/index.ts";\nexport async function GET() { return readPreferences(); }',
    });
    expect(graph["lib/index.ts"].imports).toContainEqual({ from: "./store.ts", names: ["readPreferences"] });
    expect(symbolReachability("lib/store.ts", "readPreferences", graph, ["app/api/x/route.ts"])).toBe("live");
    expect(symbolReachability("lib/store.ts", "writePreferences", graph, ["app/api/x/route.ts"])).toBe("uncalled");
  });

  it("charges a dynamic import only to the names it pulls out", () => {
    // Measured 2026-11-05: two files do `const { storeMemory } = await import("./memory-store")`, and
    // the first pass charged every symbol in that module to them — eleven false «live» refusals.
    const graph = buildGraphFromSources({
      "lib/ultimate-agent/memory-store.ts": "export function storeMemory() {}\nexport function storeUserPreference() {}",
      "lib/sovereign-kernel.ts": 'export async function run() { const { storeMemory } = await import("./ultimate-agent/memory-store.ts"); return storeMemory(); }',
      "app/api/admin/command/route.ts": 'import { run } from "@/lib/sovereign-kernel.ts";\nexport async function POST() { return run(); }',
    });
    expect(symbolReachability("lib/ultimate-agent/memory-store.ts", "storeMemory", graph, ["app/api/admin/command/route.ts"])).toBe("live");
    expect(symbolReachability("lib/ultimate-agent/memory-store.ts", "storeUserPreference", graph, ["app/api/admin/command/route.ts"])).toBe("uncalled");
  });

  it("counts an ancestor module as reached through any name it is imported by", () => {
    // The ancestor's first export being unused must not hide the chain that really loads it.
    const graph = buildGraphFromSources({
      "lib/inner.ts": "export function unusedFirst() {}\nexport function usedSecond() {}",
      "lib/outer.ts": 'import { usedSecond } from "./inner.ts";\nexport function neverCalled() { return usedSecond(); }\nexport function called() { return 1; }',
      "app/x/page.tsx": 'import { called } from "@/lib/outer.ts";\nexport default function Page() { return called(); }',
    });
    expect(symbolReachability("lib/inner.ts", "usedSecond", graph, ["app/x/page.tsx"])).toBe("live");
  });

  it("ignores imports inside comments, strings and type-only clauses", () => {
    const graph = buildGraphFromSources({
      "lib/store.ts": "export function read() {}",
      "app/api/x/route.ts": [
        '// import { read } from "@/lib/store";',
        'const example = `import { read } from "@/lib/store"`;',
        'import type { read } from "@/lib/store";',
        'import { type read as Shape } from "@/lib/store";',
        'export function GET() { return example; }',
      ].join("\n"),
    });
    expect(symbolReachability("lib/store.ts", "read", graph, ["app/api/x/route.ts"])).toBe("uncalled");
  });

  it("resolves default, namespace and mixed imports independently of local names", () => {
    const graph = buildGraphFromSources({
      "lib/store.ts": "export default function actual() {}\nexport function named() {}",
      "app/api/x/route.ts": 'import renamed, { named as alias } from "@/lib/store"; export function GET() { return renamed() + alias(); }',
      "app/api/y/route.ts": 'import * as store from "@/lib/store"; export function GET() { return store.named(); }',
    });
    expect(symbolReachability("lib/store.ts", "actual", graph, ["app/api/x/route.ts"])).toBe("live");
    expect(symbolReachability("lib/store.ts", "named", graph, ["app/api/x/route.ts"])).toBe("live");
    expect(symbolReachability("lib/store.ts", "named", graph, ["app/api/y/route.ts"])).toBe("live");
  });

  it("does not promote unused barrel exports through a different imported name", () => {
    const graph = buildGraphFromSources({
      "lib/store.ts": "export function read() {}\nexport function unused() {}",
      "lib/index.ts": 'export { read as renamed, unused } from "./store";',
      "app/api/x/route.ts": 'import { renamed } from "@/lib"; export function GET() { return renamed(); }',
    });
    expect(symbolReachability("lib/store.ts", "read", graph, ["app/api/x/route.ts"])).toBe("live");
    expect(symbolReachability("lib/store.ts", "unused", graph, ["app/api/x/route.ts"])).toBe("unreached");
  });

  it("keeps private helpers in reachable modules uncertain instead of calling them unused", () => {
    const graph = buildGraphFromSources({
      "lib/store.ts": "function helper() {}\nexport function read() { return helper(); }",
      "app/api/x/route.ts": 'import { read } from "@/lib/store"; export function GET() { return read(); }',
    });
    expect(symbolReachability("lib/store.ts", "helper", graph, ["app/api/x/route.ts"])).toBe("unknown");
  });

  it("locates indented, default and module-level query positions by syntax boundaries", () => {
    const source = '  export default function Page() { return db.from("inside"); }\ndb.from("outside");';
    expect(exportedSymbolAt(source, source.indexOf('.from("inside")'))).toBe("Page");
    expect(exportedSymbolAt(source, source.indexOf('.from("outside")'))).toBe("module");
  });

  it("keeps missing sources explicitly unknown", () => {
    const split = classifyBySymbol([{ file: "lib/missing.ts", at: 0 }], {});
    expect(split.unknown).toHaveLength(1);
    expect(split.tally.unknown).toBe(1);
    expect(split.unreached).toEqual([]);
  });

  it("counts a route's own queries as live without any importer", () => {
    const graph: ModuleGraph = { "app/api/admin/ruler/route.ts": { exports: ["GET"], imports: [] } };
    expect(symbolReachability("app/api/admin/ruler/route.ts", "GET", graph, ["app/api/admin/ruler/route.ts"])).toBe("live");
  });

  it("calls an import cycle uncertain instead of claiming it proved no path", () => {
    // Cutting the recursion is the scan's own limit. Saying «unreached» would read as a measured
    // verdict about the code, when what happened is that the scan stopped looking.
    const graph = buildGraphFromSources({
      "lib/a.ts": 'import { b } from "./b"; export function a() { return b(); }',
      "lib/b.ts": 'import { a } from "./a"; export function b() { return a(); }',
    });
    expect(symbolReachability("lib/a.ts", "a", graph, [])).toBe("unknown");
  });

  it("prints the four numbers, and refuses to call the unknown ones dead", () => {
    const line = formatReachabilityLine({ live: 41, uncalled: 96, unreached: 67, unknown: 3 });
    expect(line).toContain("مش إثبات تشغيل");
    expect(line).toContain("ما اتقارش");
    expect(/[0-9]/.test(line)).toBe(false);
    expect(formatReachabilityLine(null)).toContain("ما اتقارش");
  });
});

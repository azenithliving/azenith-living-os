// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { TOOL_CATALOG } from "@/lib/agents/intent-router";

const bridge = readFileSync("lib/admin-tool-bridge.ts", "utf8");
const vercel = JSON.parse(readFileSync("vercel.json", "utf8"));

/** The six ids P7-M2 rewrote inside stored rows. Code must say what the data says. */
const SWARM_TOOLS = [
  "ops_self",
  "ops_world",
  "ops_rivals",
  "ops_forecast",
  "ops_luxury_score",
  "ops_goals_risk",
];

/** The relations the swarm owns, by the names P7-M5 gave them. */
const SWARM_TABLES = [
  "ops_drafts", "ops_swarm_learnings", "ops_sync_events", "ops_experiments",
  "ops_benchmark_runs", "ops_rivals", "ops_goals", "ops_task_metrics",
  "ops_locks", "ops_semantic_memory", "ops_suggestions", "ops_telemetry_events",
  "ops_learning_applications", "ops_experiment_events", "ops_rival_snapshots",
];

function sources(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((e) => {
    const full = join(dir, e);
    if (statSync(full).isDirectory()) return sources(full);
    return /\.(ts|tsx)$/.test(full) && !full.includes(".test.") ? [full] : [];
  });
}

describe("tool ids carry no retired brand", () => {
  it("renames the six swarm tools", () => {
    const names = TOOL_CATALOG.map((t) => t.name);
    expect(names).toEqual(expect.arrayContaining(SWARM_TOOLS));
    expect(names.filter((n) => /qayyim/i.test(n))).toEqual([]);
  });

  it("the bridge dispatches on the same names", () => {
    for (const n of SWARM_TOOLS) {
      expect(bridge, n).toContain(`"${n}"`);
    }
    expect(bridge).not.toMatch(/toolName === "qayyim/);
  });

  /**
   * `qayyim_rivals` used to name both a tool and a table, and the tool moved two
   * milestones before the table did — that split is why a sweep had to be careful
   * here. After P7-M5 both answer to `ops_rivals`, so the guard is inverted: code
   * that still read the retired relation would work only through the alias view,
   * and an alias is a migration window, not a place to live.
   */
  it("reads the rivals table by its live name", () => {
    const rivals = readFileSync("lib/ops/rivals.ts", "utf8");
    expect(rivals).toContain('from("ops_rivals")');
    expect(rivals).not.toContain('from("qayyim_rivals")');
  });

  it("names no table by the retired word anywhere in shipped code", () => {
    const hits = [...sources("lib"), ...sources("app"), ...sources("components")]
      .filter((f) =>
        /(from|into|update)\(\s*['"]qayyim_|(?:FROM|UPDATE|INTO)\s+public\.qayyim_/i.test(
          readFileSync(f, "utf8")
        )
      )
      .map((f) => f.replace(/\\/g, "/"));
    expect(hits, hits.join("\n")).toEqual([]);
  });

  /**
   * The retired brand also survived in capability lists — tools the swarm offers
   * itself. The live database was scanned column by column and holds none of these
   * tokens, so that half of the rename needed no migration behind it.
   */
  it("leaves no retired tool token in the swarm's own lists", () => {
    const files = [
      "lib/ops/QayyimCoreAgent.ts", "lib/ops/QayyimContentAgent.ts",
      "lib/ops/QayyimVisualAgent.ts", "lib/ops/QayyimSeoAgent.ts",
      "lib/ops/QayyimUxAgent.ts", "lib/ops/QayyimAnalyticsAgent.ts",
      "lib/ops/QayyimDevAgent.ts", "lib/ops/QayyimQaAgent.ts",
      "lib/agents/intent-router.ts", "lib/admin-tool-bridge.ts", "lib/ops/palette.ts",
    ];
    const hits = files.flatMap((file) =>
      [...readFileSync(file, "utf8").matchAll(/q[a-z]*yim_[a-z0-9_]+/g)]
        .map((m) => m[0])
        .map((token) => `${file}: ${token}`)
    );
    expect(hits, hits.join("\n")).toEqual([]);
  });

  /** Written out rather than derived, so a table disappearing is noticed here. */
  it("keeps the fifteen relations the swarm owns", () => {
    expect(SWARM_TABLES).toHaveLength(15);
    expect(SWARM_TABLES.every((t) => t.startsWith("ops_"))).toBe(true);
  });
});

describe("the owner's surfaces and the clock", () => {
  it("serves the studio under /admin/v2/ops", () => {
    expect(existsSync("app/admin/v2/ops/page.tsx")).toBe(true);
  });

  /**
   * Inverted in batch four. The retired addresses still answer — a bookmark on the
   * owner's phone and every Telegram message he already sent carry them — but they
   * are answered by one table at the outer gate, not by pages living inside the new
   * house. A forwarder room in `/admin/v2` was the new house remembering the old.
   */
  it("answers the retired addresses at the gate, with no page left behind", () => {
    const table = readFileSync("lib/ops/legacy-address-table.ts", "utf8");
    expect(table).toContain('"/admin/v2/qayyim"');
    expect(table).toContain('"/admin/v2/agents/qayyim"');
    expect(table).toContain('"/admin/qayyim"');
    expect(readFileSync("proxy.ts", "utf8")).toContain("legacyAddressRedirect");
    expect(existsSync("app/admin/v2/qayyim/page.tsx")).toBe(false);
    expect(existsSync("app/admin/v2/agents/qayyim/page.tsx")).toBe(false);
    expect(existsSync("app/admin/qayyim/page.tsx")).toBe(false);
  });

  it("moves the cron routes and the schedule that calls them", () => {
    expect(existsSync("app/api/cron/ops-daily/route.ts")).toBe(true);
    expect(existsSync("app/api/cron/ops-proactive/route.ts")).toBe(true);
    expect(existsSync("app/api/cron/qayyim-daily/route.ts")).toBe(false);
    const paths = vercel.crons.map((c: { path: string }) => c.path);
    expect(paths).toContain("/api/cron/ops-daily");
    expect(paths.filter((p: string) => /qayyim/.test(p))).toEqual([]);
  });
});

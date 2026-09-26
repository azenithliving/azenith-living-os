// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
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

/** Relations that keep their name until P7-M5 moves them; a tool id has no excuse. */
const STILL_LIVE_TABLES = new Set([
  "qayyim_drafts", "qayyim_swarm_learnings", "qayyim_sync_events", "qayyim_experiments",
  "qayyim_benchmark_runs", "qayyim_rivals", "qayyim_goals", "qayyim_task_metrics",
  "qayyim_locks", "qayyim_semantic_memory", "qayyim_suggestions", "qayyim_telemetry_events",
  "qayyim_learning_applications", "qayyim_experiment_events", "qayyim_rival_snapshots",
]);

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
   * `qayyim_rivals` names both a tool and a table. The tool moved in P7-M2's data
   * migration; the table does not move until P7-M5 — so the sweep must not carry
   * the table reference with it, or the rivals tool reads a relation that does not
   * exist and answers 42P01 in the middle of a sentence to the owner.
   */
  it("keeps naming the rivals table by the name it still has", () => {
    const rivals = readFileSync("lib/ops/rivals.ts", "utf8");
    expect(rivals).toContain('from("qayyim_rivals")');
    expect(rivals).not.toContain('from("ops_rivals")');
  });

  /**
   * The retired brand also survived in capability lists — tools the swarm offers
   * itself. The live database was scanned column by column and holds none of these
   * tokens, so this half of the rename needs no migration behind it.
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
      [...readFileSync(file, "utf8").matchAll(/qayyim_([a-z0-9_]+)/g)]
        .map((m) => m[0])
        .filter((token) => !STILL_LIVE_TABLES.has(token))
        .map((token) => `${file}: ${token}`)
    );
    expect(hits, hits.join("\n")).toEqual([]);
  });
});

describe("the owner's surfaces and the clock", () => {
  it("serves the studio under /admin/v2/ops", () => {
    expect(existsSync("app/admin/v2/ops/page.tsx")).toBe(true);
  });

  /**
   * The retired addresses stay, but only as forwarders: a bookmark and the morning
   * story both carry a query (`?highlight=`, `?agent=`, `?proposal=`), and a second
   * studio rendering the same panels would let the two surfaces drift apart.
   */
  it("keeps the retired addresses forwarding, with their query", () => {
    const studio = readFileSync("app/admin/v2/qayyim/page.tsx", "utf8");
    expect(studio).toContain("/admin/v2/ops");
    expect(studio).toContain("window.location.search");
    const chat = readFileSync("app/admin/v2/agents/qayyim/page.tsx", "utf8");
    expect(chat).toContain("/admin/v2/agents/ops");
    expect(readFileSync("app/admin/qayyim/page.tsx", "utf8")).toContain("/admin/v2/ops");
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

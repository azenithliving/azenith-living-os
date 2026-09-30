// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { legacyAddressRedirect } from "@/lib/ops/legacy-address-table";

/**
 * The workshop is not the store's trade.
 *
 * The owner ruled it twice — first the orders and the money, then the factory, the
 * warehouse and the margin outright. What was left of that layer was a phantom: seven
 * doors no screen called, seven interface components no screen mounted, and a scenario
 * button that wrote invented customers into the real lead and order ledgers.
 *
 * This fence guards the structure, not the wording: the factory cannot come back as a
 * door, a component, or a page — and the old address still lands somewhere honest.
 */
const GONE = [
  "app/api/admin/manufacturing/bom/calculate/route.ts",
  "app/api/admin/manufacturing/designs/route.ts",
  "app/api/admin/manufacturing/inventory/route.ts",
  "app/api/admin/manufacturing/metrics/route.ts",
  "app/api/admin/manufacturing/orders/route.ts",
  "app/api/admin/manufacturing/price/calculate/route.ts",
  "app/api/admin/manufacturing/schedule/route.ts",
  "app/api/admin/agents/simulate-scenario/route.ts",
  "app/admin/manufacturing/page.tsx",
  "components/admin/agents/EnterpriseScenarioModal.tsx",
  "components/admin/agents/BOMTable.tsx",
  "components/admin/agents/InventoryManager.tsx",
  "components/admin/agents/ManufacturingDashboard.tsx",
  "components/admin/agents/OrderPipeline.tsx",
  "components/admin/agents/ProjectGantt.tsx",
  "components/admin/agents/EnterprisePipelineBar.tsx",
];

describe("the factory layer is gone and stays gone", () => {
  it("ships no production door, page or component", () => {
    for (const path of GONE) expect(existsSync(path), `${path} came back`).toBe(false);
    expect(existsSync("app/api/admin/manufacturing"), "the production folder came back").toBe(false);
  });

  it("answers the old workshop address at the gate instead of a dead door", () => {
    expect(legacyAddressRedirect("/admin/manufacturing", "")).toBe("/admin/agents");
    expect(legacyAddressRedirect("/admin/manufacturing/", "?highlight=1")).toBe("/admin/agents?highlight=1");
  });

  it("keeps an old manufacturing bookmark landing on the swarm centre", () => {
    const agents = readFileSync("app/admin/agents/page.tsx", "utf8");
    expect(agents).toContain("'manufacturing'");
    expect(agents).toContain("setActiveTab('teams')");
  });
});

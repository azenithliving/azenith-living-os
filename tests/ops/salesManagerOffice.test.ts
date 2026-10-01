// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { OFFICES, EXPLICIT } from "@/lib/ops/migration-map";
import { LEGACY_NAV, V2_NAV } from "@/lib/admin-nav";
import { SALES_MANAGER_CAPABILITIES } from "@/lib/ops/agent-roles";
import { inferUltimateTool } from "@/lib/admin-tool-bridge";
import { TOOL_REGISTRY } from "@/lib/agent-tools/tool-registry";

/**
 * Phase one of «مدير المبيعات» (the owner's word, ٣٠ سبتمبر): the sales office in the
 * new house is named after the employee, its body is the sales agent himself, and
 * everything sales-related sits under him. Measured before this phase: the office was
 * called a room, its only content was the customer desk, nothing in the menu reached it
 * at all, and the swarm centre counted the same customers a second way — 20 there,
 * 4 here.
 */
const read = (f: string) => readFileSync(f, "utf8");
const PAGE = "app/admin/v2/sales/page.tsx";
const FORBIDDEN_TRADE = /عربون|عقد|سعر|سعّر|هامش|ربح|إيراد|مخزن|خامات|أمر تشغيل|ورشة|أمر بيع|VIP/i;

describe("the sales office is named after the employee, not the room", () => {
  it("seats the manager in the office and no production employee beside him", () => {
    const office = OFFICES.find((o) => o.id === "sales-office");
    expect(office?.label).toBe("مدير المبيعات");
    expect(office?.employees).toEqual(["مدير المبيعات"]);
    expect(office?.employees.join(" ")).not.toMatch(/الإنتاج/);
  });

  it("carries his name in the page header and nowhere the old room name", () => {
    const page = read(PAGE);
    expect(page).toContain("مدير المبيعات");
    expect(page).not.toContain("مكتب المبيعات");
  });

  it("is reachable from both menus, and the old house says it is the new house", () => {
    const v2Item = V2_NAV.flatMap((c) => c.items).find((i) => i.href === "/admin/v2/sales");
    expect(v2Item?.label).toBe("مدير المبيعات");
    const door = LEGACY_NAV.flatMap((c) => c.items).find((i) => i.href === "/admin/v2/sales");
    expect(door?.label, "the old house has no door to the moved employee").toBe("مدير المبيعات");
    expect(door?.badge).toBe("البيت الجديد");
  });

  it("keeps the map and the menu in agreement about who lives there", () => {
    const record = EXPLICIT.find((e) => e.id === PAGE);
    expect(record?.office).toBe("sales-office");
    expect(record?.status).toBe("moved");
    expect(OFFICES.find((o) => o.id === record?.office)?.label).toBe("مدير المبيعات");
  });
});

describe("his body is the agent the owner built, not a list of buttons", () => {
  it("opens with his face and his desk under it", () => {
    const page = read(PAGE);
    expect(page).toContain('<ChatPanel agentKey="vanguard"');
    expect(page).toContain("<CustomersPanel");
    expect(page).toContain("Suspense");
  });

  it("signs him in Arabic on his own screen", () => {
    const panel = read("components/admin/agents/ChatPanel.tsx");
    expect(panel).toMatch(/vanguard:\s*\{\s*name:\s*'مدير المبيعات'/);
    expect(panel).toContain("{signedAs(message.sender_name)}");
  });

  it("offers only the trades the store is allowed to do", () => {
    expect(SALES_MANAGER_CAPABILITIES.length).toBeGreaterThan(0);
    for (const chip of SALES_MANAGER_CAPABILITIES) {
      expect(chip, chip).not.toMatch(FORBIDDEN_TRADE);
      // A chip the router cannot answer is the dead button the owner already banned.
      const routed = inferUltimateTool(chip);
      expect(routed, `no tool answers «${chip}»`).toBeTruthy();
      expect(TOOL_REGISTRY[routed!.toolName], `«${chip}» routes to ${routed!.toolName}, which does not exist`).toBeTruthy();
    }
    // The room's own copy must not promise a forbidden trade either.
    expect(read(PAGE)).not.toMatch(FORBIDDEN_TRADE);
  });
});

describe("one counting rule for the word «عميل»", () => {
  it("reads the customer list through the shared roll, not its own query", () => {
    const handlers = read("lib/admin-extended-handlers.ts");
    const body = handlers.slice(handlers.indexOf("export async function executeLeadList"));
    const fn = body.slice(0, body.indexOf("\nexport async function", 20));
    expect(fn, "the tool does not ask the shared reader").toContain("lib/customers/read");
    expect(fn).not.toMatch(/from\(\s*"users"\s*\)/);
    // The number is spoken in Arabic, and the file path never travels to his screen.
    expect(fn).toContain("من الدفتر الواحد");
    expect(fn).not.toContain("countedBy");
  });

  it("turns the quick action that used to count into a door", () => {
    const panel = read("components/admin/agents/QuickActionsPanel.tsx");
    expect(panel).not.toMatch(/toolName:\s*'lead_list'/);
    expect(panel).toContain("'/admin/v2/sales'");
    expect(panel).toContain("action.to");
  });

  /**
   * Measured on the live data before this phase: the landing screen answered «0 /
   * لا توجد بيانات» for the word عميل while the office answered five humans — the door
   * behind it counts profile rows inside a tenant it resolves on its own. The card now
   * reads the same roll, and says so when the roll does not answer.
   */
  it("makes the landing screen read the same roll", () => {
    const overview = read("app/admin/page.tsx");
    expect(overview, "the landing screen never asks the roll").toContain('fetch("/api/admin/customers"');
    expect(overview).toMatch(/value:\s*customersTotal \?\? 0/);
    expect(overview, "the old rival counter is still feeding a card").not.toContain("analytics.metrics?.totalLeads || 0");
    const card = overview.slice(overview.indexOf('title: "العملاء"'));
    expect(card.slice(0, 400)).toContain('href: "/admin/v2/sales"');
    expect(card.slice(0, 400), "a silent zero is how a dead counter hides").toContain("الدفتر ما ردّش");
  });

  it("relabels the old house's doors so none of them promises the moved work", () => {
    const work = read("app/admin/work/page.tsx");
    expect(work).toContain('href: "/admin/v2/sales"');
    expect(work).toContain("مدير المبيعات");
    expect(work, "the old work centre still promises order follow-up").not.toMatch(/label:\s*"متابعة العملاء"/);
    const landing = read("app/admin/page.tsx");
    expect(landing, "the landing card still promises customers on the old page").not.toContain("العملاء، المستأجرين، الإدارة");
  });
});

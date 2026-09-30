// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  LEGACY_ADDRESS_REDIRECTS,
  LEGACY_TAB_REDIRECTS,
  legacyAddressRedirect,
  legacyTabRedirect,
  retiredAgentQueryRedirect,
} from "@/lib/ops/legacy-address-table";

/**
 * Batch four of the naming retirement. The retired addresses had to keep working —
 * a bookmark on the owner's phone and every Telegram message he already sent carry
 * them — but they were kept as *pages inside the new house*, which is the one thing
 * the program forbids: a redirect living inside `/admin/v2` means the new house
 * still knows the old name, and the old house can never be deleted while its own
 * rooms are what answer for it.
 *
 * So the mapping moves to the outer gate, into one table, and the forwarder pages
 * die. The table is the only place a retired address exists.
 */
describe("the retired addresses are answered at the gate, not inside the house", () => {
  it("carries every retired page address with its query", () => {
    expect(LEGACY_ADDRESS_REDIRECTS.length).toBeGreaterThan(2);
    expect(legacyAddressRedirect("/admin/v2/qayyim", "?highlight=sofa")).toBe(
      "/admin/v2/ops?highlight=sofa",
    );
    expect(legacyAddressRedirect("/admin/v2/agents/qayyim", "?proposal=12")).toBe(
      "/admin/v2/agents/ops?proposal=12",
    );
    expect(legacyAddressRedirect("/admin/qayyim", "")).toBe("/admin/v2/ops");
  });

  it("survives a trailing slash and answers nothing else", () => {
    expect(legacyAddressRedirect("/admin/v2/agents/qayyim/", "?agent=ops-lead")).toBe(
      "/admin/v2/agents/ops?agent=ops-lead",
    );
    expect(legacyAddressRedirect("/admin/v2/ops", "")).toBeNull();
    expect(legacyAddressRedirect("/rooms/majlis", "")).toBeNull();
  });

  it("points every entry at a page that actually ships", () => {
    for (const entry of LEGACY_ADDRESS_REDIRECTS) {
      expect(existsSync(`app${entry.to}/page.tsx`), `${entry.from} -> ${entry.to} has no page`).toBe(true);
    }
  });

  it("leaves no forwarder page behind in either house", () => {
    for (const entry of LEGACY_ADDRESS_REDIRECTS) {
      expect(existsSync(`app${entry.from}/page.tsx`), `${entry.from} is still a page`).toBe(false);
    }
  });

  it("is wired into the outer gate", () => {
    const gate = readFileSync("proxy.ts", "utf8");
    expect(gate).toContain("legacy-address-table");
    expect(gate).toContain("legacyAddressRedirect");
  });
});

/**
 * The retired *keys* are the other half of the same problem: an old Telegram
 * message deep-links to `?agent=qayyim-core`, and until now the new house itself
 * translated that name — which is the program's rule eight broken in one line of
 * import. The translation moves to the gate, and the new house only ever accepts
 * a live key or falls back to the leader.
 */
describe("a retired agent key is normalised at the gate, not inside the house", () => {
  it("rewrites a retired key to the live one, keeping the rest of the query", () => {
    expect(retiredAgentQueryRedirect("/admin/v2/agents/ops", "?agent=qayyim-core")).toBe(
      "/admin/v2/agents/ops?agent=ops-lead",
    );
    expect(retiredAgentQueryRedirect("/admin/v2/agents/ops", "?agent=prime&proposal=7")).toBe(
      "/admin/v2/agents/ops?agent=ops-lead&proposal=7",
    );
  });

  it("leaves a live key, an unknown key and no key alone", () => {
    expect(retiredAgentQueryRedirect("/admin/v2/agents/ops", "?agent=ops-qa")).toBeNull();
    expect(retiredAgentQueryRedirect("/admin/v2/agents/ops", "?agent=whoever")).toBeNull();
    expect(retiredAgentQueryRedirect("/admin/v2/agents/ops", "?proposal=7")).toBeNull();
  });

  it("leaves the new house with no name translator imported", () => {
    const offenders = readdirSync("app/admin/v2", { recursive: true })
      .map((p) => String(p))
      .filter((p) => /\.tsx?$/.test(p))
      .filter((p) => readFileSync(join("app/admin/v2", p), "utf8").includes("legacyToOps"));
    expect(offenders, offenders.join("\n")).toEqual([]);
  });
});

/**
 * Phase four of the customers employee: the tab in the old house and the window in the
 * sales office are the same component, so one of them had to stop existing. The old tab
 * is erased — but the consultant's Telegram messages deep-link to `?tab=leads&expand=…`,
 * so the gate answers that address, and no door dies on the owner's phone.
 */
describe("the old customers tab is erased, and its address still lands", () => {
  it("sends an old customers deep link to the sales office, keeping the card key", () => {
    expect(legacyTabRedirect("/admin/sales", "?tab=leads&expand=phone%3A1005554444")).toBe(
      "/admin/v2/sales?expand=phone%3A1005554444",
    );
    expect(legacyTabRedirect("/admin/sales", "?tab=leads")).toBe("/admin/v2/sales");
  });

  it("leaves every other tab of the old house alone", () => {
    expect(legacyTabRedirect("/admin/sales", "?tab=sales")).toBeNull();
    expect(legacyTabRedirect("/admin/sales", "")).toBeNull();
    expect(legacyTabRedirect("/admin/v2/sales", "?tab=leads")).toBeNull();
  });

  it("keeps the old house free of the moved employee", () => {
    const old = readFileSync("app/admin/sales/page.tsx", "utf8");
    expect(old).not.toContain("CustomersPanel");
    expect(old).not.toContain('"leads"');
    expect(LEGACY_TAB_REDIRECTS.length).toBeGreaterThan(0);
  });

  it("is wired into the outer gate", () => {
    expect(readFileSync("proxy.ts", "utf8")).toContain("legacyTabRedirect");
  });
});

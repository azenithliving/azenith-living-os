// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import {
  LEGACY_ADDRESS_REDIRECTS,
  legacyAddressRedirect,
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

// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";

/**
 * The first employee with a house of its own. These four assertions are the
 * transfer's paper trail: the panel exists and holds the body, the old page no
 * longer carries it, the new window renders it, and no apology sign is left where a
 * real surface now lives.
 */
const PANEL = "components/admin/sales/CustomersPanel.tsx";
const OLD = "app/admin/sales/page.tsx";
const NEW = "app/admin/v2/sales/page.tsx";
const read = (f: string) => (existsSync(f) ? readFileSync(f, "utf8") : "");

describe("the sales office window", () => {
  it("holds the customers body in its own file", () => {
    const t = read(PANEL);
    expect(t.length, "the panel was not created").toBeGreaterThan(1000);
    expect(t).toContain("export default function CustomersPanel");
    expect(t.split("\n").length, "the panel is thinner than the tab that moved").toBeGreaterThan(700);
  });

  it("keeps the moved employee out of the old page", () => {
    const t = read(OLD);
    expect(t).not.toMatch(/function LeadsTab/);
    // Phase four erased the tab: the fence now guards the structure, not just the name,
    // so the customers body can never be welded back into the old house.
    expect(t).not.toContain("CustomersPanel");
    expect(t).not.toMatch(/id:\s*"leads"/);
    expect(t.split("\n").length, "the old page should have shrunk by the moved body").toBeLessThan(1400);
  });

  it("renders the employee, not a signpost", () => {
    const t = read(NEW);
    expect(t).toContain("<CustomersPanel");
    expect(t).toContain("Suspense");
    expect(t).not.toMatch(/فاضية|سيُنقل المحتوى لاحقاً/);
  });

  it("keeps the ledger honest about what is still moving", () => {
    const ledger = JSON.parse(readFileSync("docs/ledger/transfers.json", "utf8")) as {
      rows: { atom: string; state: string }[];
    };
    const row = ledger.rows.find((r) => r.atom === "/admin/sales#العملاء");
    expect(row, "the customers capability is missing from the ledger").toBeTruthy();
    // The old tab is erased, and its retired address is answered at the outer gate —
    // so the ledger says what is true instead of what is convenient.
    expect(row!.state).toBe("erased");
  });
});

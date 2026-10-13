// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

import { isDisplayable, priceOf } from "@/lib/shop/rule";
import { priceLine } from "@/lib/shop/words";
import { V2_NAV } from "@/lib/admin-nav";
import { EXPLICIT, OFFICES } from "@/lib/ops/migration-map";

/**
 * The ready-products shelf, guarded.
 *
 * Measured 2026-10-13, counting the store's own table: 158 tables, and `products` held exactly one
 * row — «صوفا ملكية», active, with no price, no picture and no category, written while another agent
 * was building the store. The owner's ruling the same night: the shop is made-to-order, so a ready
 * piece is his exception, not stock, and he wants a shelf a visitor can open that says «قريبًا» while
 * there is nothing on it.
 */
const read = (f: string) => readFileSync(f, "utf8");

/** The row that was actually in the table when this phase was measured. */
const INHERITED_ROW = { is_active: true, name: "صوفا ملكية", sale_price: 0, base_price: 0, featured_image_url: null };

describe("a piece only stands on the shelf when a customer can ask two questions about it", () => {
  it("refuses the row another agent left behind", () => {
    expect(isDisplayable(INHERITED_ROW)).toBe(false);
    expect(priceOf(INHERITED_ROW)).toBe(0);
  });

  it("refuses a priced piece with no picture", () => {
    expect(isDisplayable({ is_active: true, sale_price: 45000, featured_image_url: "" })).toBe(false);
  });

  it("refuses a piece the owner hid", () => {
    expect(isDisplayable({ is_active: false, sale_price: 45000, featured_image_url: "shop/a.jpg" })).toBe(false);
  });

  it("takes the priced, photographed piece", () => {
    expect(isDisplayable({ is_active: true, sale_price: 45000, featured_image_url: "shop/a.jpg" })).toBe(true);
    // The list price answers when no offer was made.
    expect(isDisplayable({ is_active: true, base_price: 45000, featured_image_url: "https://cdn/a.jpg" })).toBe(true);
  });
});

describe("the visitor's page reads the shelf and admits when it is empty", () => {
  const page = read("app/shop/page.tsx");

  it("asks the shelf for its pieces and never invents one", () => {
    expect(page).toContain("listShelf(");
    expect(page).not.toContain("fallback");
  });

  it("says «قريبًا» and the owner's sentence about being made-to-order", () => {
    expect(page).toContain("قريبًا");
    expect(page).toContain("SHELF_EMPTY_LINE");
    expect(page).toContain('href="/request"');
  });

  it("is reachable from the customer's own menu, on phone and desktop", () => {
    const header = read("components/Header.tsx");
    expect((header.match(/href="\/shop"/g) ?? []).length).toBe(2);
    expect(read("app/sitemap.ts")).toContain("/shop");
  });
});

describe("the owner's desk puts a piece on the shelf without touching the workshop", () => {
  const door = read("app/api/admin/shop/route.ts");
  const desk = read("components/admin/shop/ShopDesk.tsx");

  it("never erases a row — hiding is the reversible word", () => {
    expect(door).not.toContain("export async function DELETE");
    expect(door).not.toContain(".delete()");
    expect(desk).not.toContain('method: "DELETE"');
    expect(desk).toContain("خبّيها عن الزائر");
  });

  it("keeps cost, stock and workshop numbers off both surfaces", () => {
    for (const file of ["app/api/admin/shop/route.ts", "components/admin/shop/ShopDesk.tsx", "app/shop/page.tsx"]) {
      expect(read(file), file).not.toMatch(/cost_price|stock_quantity|inventory|bom_/);
    }
  });

  it("does not drag the service credential into the browser", () => {
    // `lib/shop/shelf.ts` reads the database and is server-only; the desk may only take the words.
    expect(desk).toContain('from "@/lib/shop/words"');
    expect(desk).not.toContain('from "@/lib/shop/shelf"');
    expect(read("lib/shop/words.ts")).not.toContain("supabase-admin");
  });

  it("reads and writes through the same rule the customer's page uses", () => {
    expect(door).toContain("isDisplayable");
    expect(read("lib/shop/shelf.ts")).toContain("isDisplayable");
  });

  it("keeps the database's own English off his screen", () => {
    // Measured live 2026-10-13: the first insert was refused by a foreign key and the desk printed
    // «insert or update on table "products" violates foreign key constraint…» to the owner.
    expect(door).toContain("arabicReason");
    expect(door).not.toMatch(/error:[^,\n]*\$\{error\??\.message/);
    expect(door).not.toMatch(/error:.*\$\{upload\.error\.message/);
  });

  it("does not assume the sign-in account is filed as staff", () => {
    // `products.created_by` points at the staff register, and the register holds no row for the
    // owner's login (measured: 0 rows in `users` for the gate email).
    expect(door).toContain('from("users")');
    expect(door).toContain("created_by: staff?.data?.id ?? null");
  });
});

describe("the price is written the way the owner reads it", () => {
  it("takes Arabic numerals and spells the currency", () => {
    const line = priceLine(45000);
    expect(line).toContain("جنيه");
    expect(line).toMatch(/^[٠-٩٬]+ جنيه$/);
    expect(line).not.toMatch(/[0-9]/);
  });
});

describe("the shelf is seated in the cockpit, not parked off the menu", () => {
  it("carries its Arabic office name in the new house", () => {
    const item = V2_NAV.flatMap((c) => c.items).find((i) => i.href === "/admin/v2/shop");
    expect(item?.label).toBe("رفّ الجاهز");
  });

  it("agrees with the migration map about who owns it", () => {
    const record = EXPLICIT.find((e) => e.id === "app/admin/v2/shop/page.tsx");
    expect(record?.office).toBe("shelf-desk");
    expect(record?.status).toBe("moved");
    expect(OFFICES.find((o) => o.id === "shelf-desk")?.label).toBe("رفّ الجاهز");
  });
});

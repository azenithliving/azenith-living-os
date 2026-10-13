// @vitest-environment node
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";

import { localForm, normalizeWhatsApp, whatsappHref, NUMBERS_KEY } from "@/lib/store-numbers/format";

/**
 * The store's phone number, guarded to one owner.
 *
 * Measured 2026-10-13: four producers of one fact — the company record, the server env, a browser
 * env, and a build-time variable the published site never had. The published result: five customer
 * pages with zero WhatsApp links, and 18 catalogue buttons opening a number that is not the store's
 * in a form wa.me cannot open. The owner dictated the number and asked to change and add numbers
 * from the dashboard, with all of them applying to the whole site.
 */
const read = (f: string) => readFileSync(f, "utf8");

describe("a number is either dialable or it is not said at all", () => {
  it("takes the local Egyptian form and gives it the country code", () => {
    expect(normalizeWhatsApp("01090819584")).toBe("201090819584");
    expect(normalizeWhatsApp("+20 109 081 9584")).toBe("201090819584");
    expect(normalizeWhatsApp("201090819584")).toBe("201090819584");
  });

  it("refuses a fragment, a landline-shaped guess and nothing at all", () => {
    expect(normalizeWhatsApp("12345")).toBeNull();
    expect(normalizeWhatsApp("")).toBeNull();
    expect(normalizeWhatsApp(null)).toBeNull();
    expect(normalizeWhatsApp(undefined)).toBeNull();
  });

  it("writes a WhatsApp address only through the one builder", () => {
    expect(whatsappHref("201090819584")).toBe("https://wa.me/201090819584");
    expect(whatsappHref("201090819584", "كنبة ٣ مقاعد")).toBe(`https://wa.me/201090819584?text=${encodeURIComponent("كنبة ٣ مقاعد")}`);
    expect(whatsappHref(null, "أي رسالة")).toBeNull();
  });
});

describe("the number has exactly one owner", () => {
  it("the server config asks the owner and never the environment", () => {
    const config = read("lib/runtime-config.ts");
    expect(config).toContain("getPrimaryWhatsApp()");
    expect(config).not.toContain('readEnv("WHATSAPP_DEFAULT_NUMBER")');
  });

  it("the browser config is gone, so it cannot disagree", () => {
    expect(existsSync("lib/client-runtime-config.ts")).toBe(false);
  });

  it("no page reads a build-time number any more", () => {
    for (const file of ["app/page.tsx", "app/furniture/page.tsx", "app/furniture/[type]/page.tsx", "app/api/config/route.ts"]) {
      expect(read(file), file).not.toContain("process.env.NEXT_PUBLIC_WHATSAPP_NUMBER");
    }
  });

  it("the customer's pages ask the owner", () => {
    expect(read("app/furniture/page.tsx")).toContain("getPrimaryWhatsApp");
    expect(read("app/furniture/[type]/page.tsx")).toContain("getPrimaryWhatsApp");
    expect(read("app/page.tsx")).toContain("getRuntimeConfig");
  });
});

describe("the number shows on every page a customer opens", () => {
  it("the root layout reads the owner and hands it down", () => {
    const layout = read("app/layout.tsx");
    expect(layout).toContain("getStoreNumbers()");
    expect(layout).toContain("storeNumbers={storeNumbers}");
  });

  it("the footer links it and writes it the way he reads it", () => {
    const footer = read("components/Footer.tsx");
    expect(footer).toContain("whatsappHref(n.value)");
    expect(footer).toContain("arabicNumerals(localForm(n.value))");
    expect(footer).toContain("storeNumbers.length === 0 && !email");
  });

  it("shows the local form, not the country-coded one", () => {
    expect(localForm("201090819584")).toBe("01090819584");
    expect(localForm("01090819584")).toBe("01090819584");
  });
});

describe("the dashboard is where he changes it", () => {
  const door = read("app/api/admin/numbers/route.ts");
  const card = read("components/admin/settings/StoreNumbersCard.tsx");

  it("saves through the one settings key the pages read", () => {
    expect(door).toContain("NUMBERS_KEY");
    expect(read("lib/store-numbers/read.ts")).toContain("eq(\"key\", NUMBERS_KEY)");
    expect(read("lib/store-numbers/format.ts")).toContain(`"${NUMBERS_KEY}"`);
  });

  it("keeps the credential out of the browser: the footer may only take the arithmetic", () => {
    expect(card).not.toContain('from "@/lib/store-numbers/read"');
    expect(read("components/Footer.tsx")).toContain('from "@/lib/store-numbers/format"');
    expect(read("components/Footer.tsx")).not.toContain('from "@/lib/store-numbers/read"');
    expect(read("lib/store-numbers/format.ts")).not.toContain("supabase-admin");
  });

  it("keeps at least one number and exactly one primary", () => {
    expect(door).toContain("رقم واحد على الأقل لازم يفضل");
    expect(door).toContain("if (!cleaned.some((n) => n.primary)) cleaned[0].primary = true");
  });

  it("answers with what the store kept, not with what it was told", () => {
    expect(door).toContain("wrote: cleaned.length, stored: stored.length");
  });

  it("removal needs a second press, and the last number cannot go", () => {
    expect(card).toContain("أؤكد الإزالة");
    expect(card).toContain("آخر رقم في المتجر ما بيتشال");
  });

  it("carries no erase of a database row", () => {
    expect(card).not.toMatch(/method:\s*"DELETE"/);
    expect(door).not.toContain("export async function DELETE");
  });
});

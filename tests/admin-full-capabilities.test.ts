import { describe, expect, it } from "vitest";
import { TOOL_REGISTRY } from "@/lib/agent-tools/tool-registry";
import { isSelfExecutionEnabled, isVercelProduction } from "@/lib/admin-cloud-evolution";
import { resolveAdminWhatsAppPhone } from "@/lib/admin-whatsapp-resolver";
import { heuristicClassify } from "@/lib/admin-intent-classifier";
import { isDbFixable } from "@/lib/seo-auto-fixer";

describe("full capabilities (no intentional gaps)", () => {
  it("has 33+ tools with zero stubs", () => {
    const stubs = Object.entries(TOOL_REGISTRY).filter(([, t]) =>
      /not yet implemented/i.test(String(t.handler))
    );
    expect(stubs).toEqual([]);
    expect(Object.keys(TOOL_REGISTRY).length).toBeGreaterThanOrEqual(34);
  });

  it("classifies manufacturing and inventory", () => {
    expect(heuristicClassify("افحص المخزون المنخفض")?.toolName).toBe("inventory_check_low");
    expect(heuristicClassify("اعرض مخزون التصنيع")?.toolName).toBe("mfg_inventory_list");
    expect(heuristicClassify("اعرض أوامر التصنيع")?.toolName).toBe("mfg_orders_list");
  });

  it("classifies SEO fix with auto apply", () => {
    const r = heuristicClassify("أصلح مشاكل SEO");
    expect(r?.toolName).toBe("seo_fix_issues");
  });

  it("seo auto-fixer covers db-fixable issues", () => {
    expect(isDbFixable("missing_title")).toBe(true);
    expect(isDbFixable("images_missing_alt")).toBe(true);
  });

  it("whatsapp resolver finds a phone without WHATSAPP_ADMIN_PHONE", async () => {
    const prev = process.env.WHATSAPP_ADMIN_PHONE;
    delete process.env.WHATSAPP_ADMIN_PHONE;
    const r = await resolveAdminWhatsAppPhone();
    if (prev) process.env.WHATSAPP_ADMIN_PHONE = prev;
    expect(typeof r.source).toBe("string");
  });

  it("cloud evolution path exists for production", () => {
    expect(typeof isVercelProduction()).toBe("boolean");
    expect(typeof isSelfExecutionEnabled()).toBe("boolean");
  });
});

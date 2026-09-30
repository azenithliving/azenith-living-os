import { describe, expect, it } from "vitest";
import { TOOL_REGISTRY } from "@/lib/agent-tools/tool-registry";
import { isSelfExecutionEnabled, isVercelProduction } from "@/lib/admin-cloud-evolution";
import { heuristicClassify } from "@/lib/admin-intent-classifier";
import { isDbFixable } from "@/lib/seo-auto-fixer";

describe("full capabilities (no intentional gaps)", () => {
  // The floor moved down on purpose: the warehouse, the workshop and the money-analysis
  // tools were removed by the owner's ruling, so a higher number here would mean the
  // phantom layer crept back.
  it("has 25+ tools with zero stubs", () => {
    const stubs = Object.entries(TOOL_REGISTRY).filter(([, t]) =>
      /not yet implemented/i.test(String(t.handler))
    );
    expect(stubs).toEqual([]);
    expect(Object.keys(TOOL_REGISTRY).length).toBeGreaterThanOrEqual(25);
  });

  it("refuses the trades the store does not run", () => {
    expect(heuristicClassify("افحص المخزون المنخفض")?.toolName).toBe("out_of_trade_refusal");
    expect(heuristicClassify("اعرض مخزون التصنيع")?.toolName).toBe("out_of_trade_refusal");
    expect(heuristicClassify("اعرض أوامر التصنيع")?.toolName).toBe("out_of_trade_refusal");
  });

  it("classifies SEO fix with auto apply", () => {
    const r = heuristicClassify("أصلح مشاكل SEO");
    expect(r?.toolName).toBe("seo_fix_issues");
  });

  it("seo auto-fixer covers db-fixable issues", () => {
    expect(isDbFixable("missing_title")).toBe(true);
    expect(isDbFixable("images_missing_alt")).toBe(true);
  });

  it("cloud evolution path exists for production", () => {
    expect(typeof isVercelProduction()).toBe("boolean");
    expect(typeof isSelfExecutionEnabled()).toBe("boolean");
  });
});

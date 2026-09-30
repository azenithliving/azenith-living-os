// @vitest-environment node
import { describe, it, expect } from "vitest";
import { inferUltimateTool, runUltimateTool } from "@/lib/admin-tool-bridge";

/**
 * What the chat says when the owner asks about the workshop.
 *
 * The store does not run a warehouse, issue production orders or compute a margin — the
 * owner ruled that twice. Until now the chat had tools for exactly those questions, and
 * the margin tool multiplied revenue by an invented 0.58 and called it a direct financial
 * analysis. These tests hold the honest answer in place of the dead tool.
 */
const FACTORY_ASKS: Array<[string, string]> = [
  ["اعرض مخزون التصنيع", "inventory"],
  ["افحص المخزون المنخفض", "inventory"],
  ["زود مخزون المنتج ١٠", "inventory"],
  ["احسب لي كشف مواد الصالون", "materials"],
  ["اعرض أوامر التصنيع", "production"],
  ["أنشئ أمر تشغيل للورشة", "production"],
  ["حلل هوامش الربح", "margin"],
];

describe("the chat refuses the trades the store does not run", () => {
  it.each(FACTORY_ASKS)("«%s» does not reach for a factory tool", (message, domain) => {
    const hit = inferUltimateTool(message);
    expect(hit?.toolName, `${message} still routes to ${hit?.toolName}`).toBe("out_of_trade_refusal");
    expect(hit?.params?.domain).toBe(domain);
  });

  it("answers in Arabic and says what the store is not", async () => {
    const res = await runUltimateTool("out_of_trade_refusal", { domain: "inventory" }, { userId: "admin" });
    expect(res.success).toBe(true);
    expect(res.message).toMatch(/[؀-ۿ]/);
    expect(res.message).toMatch(/مش|بره/);
  });

  it("leaves the real work of the sales office alone", () => {
    expect(inferUltimateTool("اعرض العملاء محتاجين رد")?.toolName).not.toBe("out_of_trade_refusal");
    expect(inferUltimateTool("كيف حال السرب النهاردة")?.toolName).not.toBe("out_of_trade_refusal");
  });
});

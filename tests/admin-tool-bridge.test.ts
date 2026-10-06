import { describe, expect, it } from "vitest";
import { inferUltimateTool, wantsGenesis } from "@/lib/admin-tool-bridge";

describe("admin-tool-bridge", () => {
  it("detects genesis intent", () => {
    expect(wantsGenesis("كوّن موقع ذهبي جديد")).toBe(true);
    expect(wantsGenesis("list_keys")).toBe(false);
  });

  it("infers seo tool", () => {
    const t = inferUltimateTool("حلّل SEO للموقع");
    expect(t?.toolName).toBe("seo_analyze");
  });

  it("infers backup tool", () => {
    const t = inferUltimateTool("اعمل نسخة احتياطية");
    expect(t?.toolName).toBe("backup_create");
  });

  it("maps Qayyim swarm mission chips to real manufacturing tools", () => {
    // Materials, stock and job tickets belong to the workshop, which is outside the
    // store by the owner's ruling — the chat answers instead of reaching for a tool.
    expect(inferUltimateTool("احسب BOM لصالون إمبراطوري")?.toolName).toBe("out_of_trade_refusal");
    expect(inferUltimateTool("فحص مخزون خامات التصنيع")?.toolName).toBe("out_of_trade_refusal");
    expect(inferUltimateTool("إنشاء أمر تشغيل جديد")?.toolName).toBe("out_of_trade_refusal");
  });

  // The forecast rule is wording-wide («توقع», «الشهر الجاي»), so these cases
  // keep it from eating the world-model path, which answers a different question.
  it("routes a revenue forecast to the arithmetic, not the world model", () => {
    expect(inferUltimateTool("توقع مبيعات الشهر الجاي")?.toolName).toBe("ops_forecast");
    expect(inferUltimateTool("هو الشهر الجاي هيجيب كام؟")?.toolName).toBe("ops_forecast");
    expect(inferUltimateTool("اعمل توقع للأسبوع الجاي")?.toolName).toBe("ops_forecast");
    expect(inferUltimateTool("اعمل توقع للأسبوع الجاي")?.params.horizonDays).toBe(7);
    expect(inferUltimateTool("توقع 14 يوم الجاي")?.params.horizonDays).toBe(30);
  });

  it("still answers what-is-selling from the world model", () => {
    expect(inferUltimateTool("اللي بيتبيع دلوقتي إيه؟")?.toolName).toBe("ops_world");
    expect(inferUltimateTool("المبيعات الفترة دي عاملة إيه")?.toolName).toBe("ops_world");
  });

  // Measured live 2026-10-07: «وريني عالم الدار» reached no tool, and the leader answered with an
  // unmeasured status report and a table of invented states. A desk's own Arabic name has to open
  // that desk — the name is printed in the digest the owner reads.
  it("opens the world desk when he calls it by name", () => {
    expect(inferUltimateTool("وريني عالم الدار")?.toolName).toBe("ops_world");
    expect(inferUltimateTool("إيه عالم الدار دلوقتي؟")?.toolName).toBe("ops_world");
    expect(inferUltimateTool("اعرض عالم الدار كامل")?.toolName).toBe("ops_world");
  });
});

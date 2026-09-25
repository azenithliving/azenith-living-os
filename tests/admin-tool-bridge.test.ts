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
    expect(inferUltimateTool("احسب BOM لصالون إمبراطوري")?.toolName).toBe("bom_calculate");
    expect(inferUltimateTool("فحص مخزون خامات التصنيع")?.toolName).toBe("mfg_inventory_list");
    expect(inferUltimateTool("إنشاء أمر تشغيل جديد")?.toolName).toBe("mfg_job_create");
  });

  // The forecast rule is wording-wide («توقع», «الشهر الجاي»), so these cases
  // keep it from eating the world-model path, which answers a different question.
  it("routes a revenue forecast to the arithmetic, not the world model", () => {
    expect(inferUltimateTool("توقع مبيعات الشهر الجاي")?.toolName).toBe("qayyim_forecast");
    expect(inferUltimateTool("هو الشهر الجاي هيجيب كام؟")?.toolName).toBe("qayyim_forecast");
    expect(inferUltimateTool("اعمل توقع للأسبوع الجاي")?.toolName).toBe("qayyim_forecast");
    expect(inferUltimateTool("اعمل توقع للأسبوع الجاي")?.params.horizonDays).toBe(7);
    expect(inferUltimateTool("توقع 14 يوم الجاي")?.params.horizonDays).toBe(30);
  });

  it("still answers what-is-selling from the world model", () => {
    expect(inferUltimateTool("اللي بيتبيع دلوقتي إيه؟")?.toolName).toBe("qayyim_world");
    expect(inferUltimateTool("المبيعات الفترة دي عاملة إيه")?.toolName).toBe("qayyim_world");
  });
});

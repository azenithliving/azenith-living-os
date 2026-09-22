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

  it("maps PRIME mission chips to real manufacturing tools", () => {
    expect(inferUltimateTool("احسب BOM لصالون إمبراطوري")?.toolName).toBe("bom_calculate");
    expect(inferUltimateTool("فحص مخزون خامات التصنيع")?.toolName).toBe("mfg_inventory_list");
    expect(inferUltimateTool("إنشاء أمر تشغيل جديد")?.toolName).toBe("mfg_job_create");
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QayyimSeoAgent } from "@/lib/qayyim/QayyimSeoAgent";

const SITE_URL = "https://site.test";

const FIXTURE_HTML = `<!DOCTYPE html>
<html lang="ar">
<head>
  <title>أزينيث - الرئيسية</title>
  <meta name="description" content="وصف تجريبي للاختبار">
  <link rel="canonical" href="https://site.test/">
</head>
<body>
  <h1>غرف نوم فاخرة</h1>
  <h1>تصميم داخلي مصري</h1>
  <img src="/room-1.jpg" alt="غرفة نوم ماستر">
  <img src="/room-2.jpg">
</body>
</html>`;

// رد الذكاء الاصطناعي الوهمي: مشكلة داخل النطاق + مشكلة خارجه (لاختبار الفلتر)
vi.mock("@/lib/ai-orchestrator", () => ({
  askOrchestratorMessages: vi.fn().mockResolvedValue({
    success: true,
    content: [
      "ISSUE-001: Missing H1 - critical - https://site.test/rooms - العنوان الرئيسي مفقود من صفحة الغرف",
      "ISSUE-002: Slow server - high - https://evil.example.com/x - خادم بطيء خارج النطاق",
      "التقرير جاهز.",
    ].join("\n"),
  }),
}));

vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdminClient: vi.fn().mockReturnValue(null),
}));

vi.mock("@/lib/admin-company", () => ({
  resolveAdminCompanyId: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/qayyim-ops", () => ({
  createQayyimDraft: vi.fn().mockResolvedValue({}),
}));

function stubFetch() {
  vi.stubGlobal("fetch", vi.fn().mockImplementation(async (input: any) => {
    const url = typeof input === "string" ? input : input?.url ?? String(input);
    if (url.startsWith(SITE_URL) && !url.includes("missing")) {
      return new Response(FIXTURE_HTML, {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }
    return new Response(JSON.stringify({ error: "not found" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }));
}

describe("QayyimSeoAgent.auditSEO — grounding (P1)", () => {
  beforeEach(() => {
    stubFetch();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("يرفض التدقيق لما NEXT_PUBLIC_SITE_URL مش متظبطة", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    const agent = new QayyimSeoAgent();
    const result = await agent.auditSEO({ url: "/" });
    expect(result.success).toBe(false);
    expect(result.data?.error).toBe("SITE_URL not configured");
  });

  it("يرفض URL خارج نطاق الموقع", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", SITE_URL);
    const agent = new QayyimSeoAgent();
    const result = await agent.auditSEO({ url: "https://evil.example.com/x" });
    expect(result.success).toBe(false);
    expect(result.data?.error).toBe("URL outside site");
  });

  it("يجيب أدلة حقيقية من الصفحة المجروبة (title + h1s + imgsMissingAlt)", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", SITE_URL);
    const agent = new QayyimSeoAgent();
    const result = await agent.auditSEO({ url: "/" });

    expect(result.success).toBe(true);
    const evidence = result.data?.evidence;
    expect(evidence).toBeDefined();
    expect(evidence.title).toBe("أزينيث - الرئيسية");
    expect(evidence.h1s).toHaveLength(2);
    expect(evidence.imgsMissingAlt).toBe(1);
    expect(evidence.imgCount).toBe(2);
    expect(evidence.fetchedUrl).toMatch(new RegExp(`^${SITE_URL}`));
  });

  it("يفلتر الادعاءات اللي أدلتها خارج النطاق ويضيف تحذير عربي", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", SITE_URL);
    const agent = new QayyimSeoAgent();
    const result = await agent.auditSEO({ url: "/" });

    const issues = result.data?.issues ?? [];
    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe("ISSUE-001");
    expect(issues[0].evidenceUrl).toBe("https://site.test/rooms");
    expect(
      (result.suggestions ?? []).some((s: string) => s.includes("فلترة") && s.includes("1"))
    ).toBe(true);
  });

  it("يفشل بصدق لما الجيب يرجع HTTP خطأ", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", SITE_URL);
    const agent = new QayyimSeoAgent();
    const result = await agent.auditSEO({ url: "/missing-page" });
    expect(result.success).toBe(false);
    expect(result.data?.error).toMatch(/^fetch failed: HTTP 400$/);
  });
});

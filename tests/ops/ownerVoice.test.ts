// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import { ownerVoice, voiceTally } from "@/lib/ops/owner-voice";

/**
 * The employees read back to him in his own language.
 *
 * Census of his chat 2026-10-06 (scratch/census-latin-in-chat.mjs): 851 agent rows, 736 of them
 * carrying Latin words — 681 are machine labels sitting inside Arabic prose («النتيجة العامة: Pass»,
 * «رابط التفاصيل: evidenceUrl»), 100 are mostly Latin because a tool answered in English
 * («SEO analysis completed for - Score: 97/100», «PageSpeed API 429: Too Many Requests»), and 91
 * echo the retired tool key (qayyim_world, qayyim_rivals). His law is Arabic on his surfaces, with a
 * web address allowed as its own element — so URLs and paths pass through untouched.
 */
const latin = (s: string) => s.match(/[A-Za-z]{2,}/g) ?? [];

describe("his numerals", () => {
  it("turns Latin digits into his", () => {
    expect(ownerVoice("الدرجة 97 من 100")).toBe("الدرجة ٩٧ من ١٠٠");
  });

  it("leaves a web address alone, digits and all", () => {
    const text = "شوف https://azenith-living.vercel.app/products/sofa-malaki-2024";
    expect(ownerVoice(text)).toBe(text);
  });

  it("leaves a site path alone", () => {
    const text = "افتح /admin/v2/agents/ops-lead";
    expect(ownerVoice(text)).toBe(text);
  });

  it("leaves a code span alone, because he pastes it rather than reads it", () => {
    const text = "شغّل `page.goto(url)` ثم راجع النتيجة";
    expect(ownerVoice(text)).toBe(text);
  });
});

describe("the report vocabulary", () => {
  it("says a passing check in Arabic", () => {
    expect(ownerVoice("النتيجة العامة: Pass")).toBe("النتيجة العامة: ناجح");
    expect(ownerVoice("فحص: FAIL")).toBe("فحص: واقع");
  });

  it("translates the whole line a tool answers with", () => {
    expect(ownerVoice("SEO analysis completed for - Score: 97/100")).toBe(
      "الظهور في البحث التحليل خلص لـ - الدرجة: ٩٧/١٠٠"
    );
  });

  it("reads a rate limit the way he would say it", () => {
    expect(ownerVoice("PageSpeed API 429: Too Many Requests")).toBe(
      "سرعة الصفحة الواجهة ٤٢٩: طلبات كتير أوي"
    );
  });

  it("names the accessibility report and its standard in Arabic", () => {
    const out = ownerVoice("(Accessibility Audit Report) المعيار: WCAG 2.1");
    expect(out).toContain("(تقرير فحص إمكانية الوصول)");
    expect(out).toContain("معيار الوصول العالمي");
    expect(out).toContain("٢.١");
    expect(latin(out)).toEqual([]);
  });

  it("reads the header findings line in Arabic", () => {
    expect(ownerVoice("Rate Limiting: Wildcard Credentials")).toBe(
      "تحديد المعدل: نجمي شامل بيانات اعتماد"
    );
  });

  it("reads the report's section headings in Arabic", () => {
    expect(ownerVoice("Executive Summary — Severity levels: High, Medium, Low.")).toBe(
      "الملخص التنفيذي — درجات الخطورة: مرتفع, متوسط, منخفض."
    );
  });

  it("does not say a heading twice when the swarm glosses it in English", () => {
    const out = ownerVoice("تقرير فحص إمكانية الوصول (Accessibility Audit Report) — المخالفات ٣");
    expect((out.match(/تقرير فحص إمكانية الوصول/g) ?? []).length).toBe(1);
    expect(out).not.toContain("Accessibility");
    expect(out).toContain("المخالفات ٣");
  });

  it("keeps a bracket that adds something new", () => {
    expect(ownerVoice("تقرير — (الفحص اليومي) مفصّل")).toContain("(الفحص اليومي)");
  });

  it("keeps an Arabic word that merely starts like a mapped one", () => {
    const text = "كلمة Passport مش هتتغير هنا";
    expect(ownerVoice(text)).toContain("Passport");
  });

  it("does not invent a meaning for a Latin word it does not know", () => {
    const text = "في كلمة غريبة اسمها zebra هنا";
    expect(ownerVoice(text)).toContain("zebra");
    expect(voiceTally(text).words).toEqual([]);
  });
});

describe("machine identifiers", () => {
  it("names a live tool by its own Arabic name", () => {
    const out = ownerVoice("شغّل ops_world دلوقتي");
    expect(out).not.toContain("ops_world");
    expect(out).toContain("ايزاي الشغل الفترة دي");
  });

  it("refuses the retired key: neither old nor new identifier reaches him", () => {
    const out = ownerVoice("الأداة qayyim_world موجودة");
    expect(out).not.toContain("qayyim");
    expect(out).not.toContain("ops_");
    expect(out).toContain("ايزاي الشغل الفترة دي");
  });

  it("says nothing rather than printing an identifier it cannot name", () => {
    const out = ownerVoice("راجع qayyim_nonsense_table من فضلك");
    expect(out).not.toContain("qayyim");
    expect(out).toContain("من فضلك");
  });

  it("keeps the sentence readable after a removal", () => {
    const out = ownerVoice("جدول qayyim_rivals فيه بيانات");
    expect(out).not.toMatch(/\s{3,}/);
    expect(out).toContain("فيه بيانات");
  });

  it("names any snake_case tool by its own Arabic name, retired or live", () => {
    const out = ownerVoice("شغّل gsc_queries و draft_list دلوقتي");
    expect(out).toContain("كلمات البحث الحقيقية من جوجل");
    expect(out).toContain("جرد المسودات المعلقة");
    expect(out).not.toMatch(/[A-Za-z]/);
  });

  it("drops a table name rather than reading it out", () => {
    const out = ownerVoice("راجع sales_orders من فضلك");
    expect(out).not.toContain("sales_orders");
    expect(out).toContain("من فضلك");
  });
});

/**
 * The four glosses measured on the published sales screen 2026-10-07, taken from the stored report
 * text itself. The layer was already wired into this chat, and these still reached his eyes —
 * a bracketed English word whose Arabic equivalent the very same line had already said.
 */
describe("an English gloss repeating the Arabic beside it", () => {
  const cases: Array<[string, string]> = [
    ["العملاء المجهولون (Anonymous): ١٧ مستخدماً.", "Anonymous"],
    ["عملاء بانتظار رد (Needing Reply): ٢.", "Needing"],
    ["درجة الحرارة (Freshness): بيضيع", "Freshness"],
    ["تفاصيل قائمة العملاء (Leads):", "Leads"],
    ["لا توجد حركة بحث (Traffic) مُسجلة", "Traffic"],
    ["مساحات التفاعل: النماذج (form).", "form"],
    ["النية: تصفح (browsing).", "browsing"],
    ["مساحات التفاعل: الملف الشخصي (profile)، طلبات التسعير (quote).", "profile"],
    ["مساحات التفاعل: الملف الشخصي (profile)، طلبات التسعير (quote).", "quote"],
    ["التواجد: (Profile, Conversation, Conversion).", "Profile"],
    ["لا توجد بيانات حالياً (٠ rows).", "rows"],
  ];
  for (const [line, word] of cases) {
    it(`keeps «${word}» off his screen: ${line.slice(0, 28)}…`, () => {
      const out = ownerVoice(line);
      expect(out).not.toContain(word);
      expect(out).toMatch(/[\u0600-\u06FF]/);
      expect(out).not.toMatch(/\(\s*\)/);
    });
  }

  it("does not delete a Latin bracket that stands where no Arabic did", () => {
    // The rule is "the gloss repeats the Arabic in front of it". With nothing Arabic in front, the
    // bracket is the only information he has — so the word is translated in place, not removed.
    expect(ownerVoice("(browsing) ثم رجع للكارت")).toContain("browsing");
    expect(ownerVoice("غرفة المعيشة (VIP - فيلا ميفيدا)")).toContain("كبار الشخصيات");
    expect(ownerVoice("غرفة المعيشة (VIP - فيلا ميفيدا)")).not.toContain("VIP");
  });
});

describe("the tally the writer logs", () => {
  it("counts what it changed instead of claiming silence", () => {
    const tally = voiceTally("Pass 429 qayyim_rivals /products/sofa-malaki");
    expect(tally.digits).toBe(3);
    expect(tally.words).toEqual(["Pass"]);
    expect(tally.ids).toEqual(["qayyim_rivals"]);
  });

  it("is zero on a line that already speaks his language", () => {
    expect(voiceTally("كل حاجة بالعربي و١٢ رقم")).toEqual({ digits: 0, words: [], ids: [] });
  });
});

describe("the chat bubble is wired to the voice", () => {
  const panel = readFileSync("components/admin/agents/ChatPanel.tsx", "utf8");

  it("reads an employee's report through it", () => {
    expect(panel).toContain("ownerVoice(");
  });

  it("does not rewrite his own words", () => {
    const line = panel.split("\n").find((l) => l.includes("MarkdownContent content=")) ?? "";
    expect(line).toContain("isUser");
  });
});

describe("the tools that answered in English", () => {
  const seo = readFileSync("lib/seo-analyzer.ts", "utf8");
  const handlers = readFileSync("lib/agent-tools/tool-handlers.ts", "utf8");

  it("the SEO summary speaks Arabic", () => {
    expect(seo).not.toContain("SEO analysis completed for");
    expect(seo).toContain("الظهور في البحث");
  });

  it("the speed-test failure speaks Arabic", () => {
    expect(handlers).not.toContain("`PageSpeed API ${res.status}: ${res.statusText}`");
  });
});

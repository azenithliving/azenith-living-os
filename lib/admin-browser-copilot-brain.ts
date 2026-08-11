import {
  inspectAdminLiveBrowserPage,
  runAdminLiveBrowserAction,
} from "@/lib/admin-live-browser";
import { cloudSearchAndRead, cloudFetchPage } from "@/lib/admin-live-browser-cloud";

type BrowserSource = {
  title: string;
  url: string;
  excerpt: string;
};

type BrowserResearchResult = {
  success: boolean;
  message: string;
  data: {
    query: string;
    objective: string;
    steps: string[];
    sources: BrowserSource[];
    learned: string[];
    nextActions: string[];
    needsHuman?: string[];
  };
};

function firstUrl(value: string) {
  return value.match(/https?:\/\/[^\s"'<>]+/i)?.[0];
}

function searchUrl(query: string) {
  return `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
}

function cleanExcerpt(text: string) {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 520);
}

function isUsefulResult(url: string) {
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return false;
    const host = parsed.hostname.replace(/^www\./, "");
    if (host.includes("bing.com") || host.includes("microsoft.com/rewards")) return false;
    if (url.includes("/search?") || url.includes("/images/search")) return false;
    return true;
  } catch {
    return false;
  }
}

function inferObjective(query: string) {
  const lower = query.toLowerCase();
  if (/ai|ذكاء|agent|وكيل|تعلم|learn|tool|مهارة|skill/.test(lower)) {
    return "استكشاف أدوات ومهارات ومراجع قابلة للتعلم ثم تحويلها لخطوات تنفيذ داخل النظام";
  }
  if (/seo|سرعة|performance|تحويل|conversion|منافس/.test(lower)) {
    return "جمع أدلة خارجية قابلة للتطبيق على تحسين الموقع والمقارنة";
  }
  if (/برمجة|كود|code|api|docs|مكتبة|library/.test(lower)) {
    return "قراءة مصادر تقنية واستخراج طريقة تنفيذ قابلة للتحويل لكود بعد موافقتك عند الحاجة";
  }
  return "بحث حي بالمتصفح ثم تلخيص ما تم تعلمه وخطة الاستفادة منه";
}

function learnedPointsFrom(source: BrowserSource) {
  const text = source.excerpt;
  const points: string[] = [];
  if (/docs|documentation|guide|api/i.test(`${source.url} ${source.title}`)) {
    points.push("مصدر توثيقي يصلح لاستخراج خطوات تنفيذ دقيقة بدل التخمين.");
  }
  if (/pricing|plans|features|tools|platform/i.test(text)) {
    points.push("يمكن مقارنة المزايا والقيود قبل اقتراح دمج أو أداة جديدة.");
  }
  if (/login|sign in|captcha|account|subscribe/i.test(text)) {
    points.push("قد تظهر خطوة بشرية مثل تسجيل الدخول أو الاشتراك؛ عندها يتوقف المساعد ويطلب تدخلك ثم يكمل.");
  }
  if (points.length === 0) {
    points.push(`تم استخراج محتوى قابل للمراجعة من: ${source.title || source.url}`);
  }
  return points;
}

export async function runBrowserResearchMission(params: {
  query: string;
  objective?: string;
  maxSources?: number;
}): Promise<BrowserResearchResult> {
  const query = params.query.trim();
  const objective = params.objective?.trim() || inferObjective(query);
  const maxSources = Math.min(Math.max(Number(params.maxSources) || 3, 1), 5);
  const steps: string[] = [];
  const sources: BrowserSource[] = [];
  const directUrl = firstUrl(query);

  // ── محاولة Playwright أولاً ─────────────────────────────────────────
  try {
    await runAdminLiveBrowserAction({ action: "newTab", url: directUrl || searchUrl(query) });
    steps.push(directUrl ? `فتح الرابط مباشرة: ${directUrl}` : `بحث حي في Bing عن: ${query}`);

    const landing = await inspectAdminLiveBrowserPage(10_000);
    if (directUrl) {
      sources.push({ title: landing.title || "صفحة مباشرة", url: landing.url, excerpt: cleanExcerpt(landing.text) });
    } else {
      const resultLinks = landing.links
        .filter((link) => isUsefulResult(link.href))
        .filter((link, index, arr) => arr.findIndex((item) => item.href === link.href) === index)
        .slice(0, maxSources);

      for (const link of resultLinks) {
        await runAdminLiveBrowserAction({ action: "goto", url: link.href });
        steps.push(`فتح نتيجة: ${link.text || link.href}`);
        const page = await inspectAdminLiveBrowserPage(10_000);
        sources.push({ title: page.title || link.text || page.url, url: page.url, excerpt: cleanExcerpt(page.text) });
      }
    }
  } catch (playwrightError) {
    // ── Playwright غير متاح (serverless) → cloud fallback ────────────
    const reason = playwrightError instanceof Error ? playwrightError.message : "Playwright unavailable";
    steps.push(`تعذّر تشغيل Playwright (${reason.slice(0, 80)}) — أستخدم Cloud Browser`);

    try {
      if (directUrl) {
        const page = await cloudFetchPage(directUrl);
        sources.push({ title: page.title || "صفحة مباشرة", url: page.url, excerpt: cleanExcerpt(page.text) });
        steps.push(`Cloud fetch: ${page.title || page.url} (${page.source})`);
      } else {
        const { sources: cloudSources, steps: cloudSteps } = await cloudSearchAndRead(query, maxSources);
        for (const s of cloudSources) {
          sources.push({ title: s.title || s.url, url: s.url, excerpt: cleanExcerpt(s.text) });
        }
        steps.push(...cloudSteps);
      }
    } catch (cloudError) {
      steps.push(`فشل Cloud Browser أيضاً: ${cloudError instanceof Error ? cloudError.message : "خطأ"}`);
    }
  }

  const learned = sources.flatMap(learnedPointsFrom).slice(0, 8);
  const needsHuman = sources.some((source) => /login|sign in|captcha|account|subscribe/i.test(source.excerpt))
    ? ["قد تحتاج بعض الصفحات إلى تسجيل دخول/كابتشا/اشتراك؛ المساعد يجهز الخطوات ويتوقف لتدخلك ثم يكمل من نفس المتصفح."]
    : undefined;

  const nextActions = [
    "تحويل النتائج إلى خطة تنفيذ واضحة قبل أي تعديل فعلي.",
    "استخدام المصادر كدليل في طلب الموافقة عند وجود تغيير مؤثر.",
    "فتح الصفحات داخل المتصفح الحي عند الحاجة لمعاينة بصرية أو خطوة بشرية.",
  ];

  const sourceLines = sources
    .map((source, index) => `${index + 1}. ${source.title}\n${source.url}\n${source.excerpt || "لا يوجد نص كاف قابل للاستخراج."}`)
    .join("\n\n");

  return {
    success: sources.length > 0,
    message:
      `استخدمت المتصفح للبحث والتعلم.\n\n` +
      `الهدف: ${objective}\n\n` +
      `ما تم:\n${steps.map((step) => `• ${step}`).join("\n")}\n\n` +
      `ما تعلمته:\n${learned.map((item) => `• ${item}`).join("\n") || "• لم أجد محتوى كافياً، وسأحتاج صياغة بحث أدق."}\n\n` +
      `المصادر:\n${sourceLines || "لا توجد مصادر صالحة."}` +
      (needsHuman ? `\n\nيحتاج تدخل بشري:\n${needsHuman.map((item) => `• ${item}`).join("\n")}` : ""),
    data: { query, objective, steps, sources, learned, nextActions, needsHuman },
  };
}

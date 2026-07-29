import type { ClassifiedIntent } from "@/lib/admin-intent-types";
import { getTool } from "@/lib/agent-tools/tool-registry";
import { runBrowserResearchMission } from "@/lib/admin-browser-copilot-brain";

export interface BrowserAugmentation {
  used: boolean;
  reason: string;
  summary: string;
  sources: Array<{ title: string; url: string }>;
  learned: string[];
}

const BROWSER_NATIVE_TOOLS = new Set(["browser_research", "web_search", "read_website"]);
const BROWSER_ENRICHED_TOOLS = new Set([
  "seo_analyze",
  "seo_fix_issues",
  "speed_analyze",
  "speed_optimize",
  "speed_deep_audit",
  "revenue_opportunities",
  "project_evolve",
  "content_health_check",
]);

function messageWantsFreshContext(message: string) {
  return /متصفح|تصفح|browser|ابحث|بحث|اتعلم|تعلم|استكشف|منافس|competitor|latest|أحدث|اليوم|ترند|trend|توثيق|docs|documentation|موقع|رابط|https?:\/\//i.test(
    message
  );
}

export function shouldAugmentWithBrowser(message: string, intent: ClassifiedIntent) {
  if (process.env.ADMIN_ASSISTANT_BROWSER_AUGMENTATION === "off") return false;
  if (intent.kind === "conversation" || intent.kind === "health" || intent.kind === "analytics") {
    return messageWantsFreshContext(message);
  }
  if (intent.kind === "agents" || intent.kind === "genesis") return messageWantsFreshContext(message);
  if (intent.kind !== "ultimate_tool" || !intent.toolName) return messageWantsFreshContext(message);
  if (BROWSER_NATIVE_TOOLS.has(intent.toolName)) return false;
  if (BROWSER_ENRICHED_TOOLS.has(intent.toolName)) return true;

  const tool = getTool(intent.toolName);
  return tool?.category === "research" || messageWantsFreshContext(message);
}

function queryFor(message: string, intent: ClassifiedIntent) {
  if (intent.kind === "ultimate_tool") {
    if (intent.toolName === "seo_analyze" || intent.toolName === "seo_fix_issues") {
      const url = String(intent.toolParams?.url || message);
      return `SEO best practices and competitor context for ${url}`;
    }
    if (intent.toolName?.startsWith("speed")) {
      const url = String(intent.toolParams?.url || message);
      return `performance optimization current guidance Core Web Vitals for ${url}`;
    }
    if (intent.toolName === "project_evolve") {
      return `implementation references and current best practices for: ${message}`;
    }
  }
  return message;
}

export function formatBrowserAugmentationForChat(augmentation: BrowserAugmentation) {
  if (!augmentation.used) return "";
  const sources = augmentation.sources
    .slice(0, 3)
    .map((source, index) => `${index + 1}. ${source.title || source.url}\n${source.url}`)
    .join("\n");
  const learned = augmentation.learned
    .slice(0, 5)
    .map((item) => `- ${item}`)
    .join("\n");

  return [
    "🌐 **طبقة المتصفح الحي استخدمت كداعم للقرار**",
    `السبب: ${augmentation.reason}`,
    learned ? `ما أضافته للقرار:\n${learned}` : "",
    sources ? `مصادر/صفحات تم فحصها:\n${sources}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function runBrowserAugmentation(
  message: string,
  intent: ClassifiedIntent
): Promise<BrowserAugmentation | null> {
  if (!shouldAugmentWithBrowser(message, intent)) return null;

  try {
    const result = await runBrowserResearchMission({
      query: queryFor(message, intent),
      objective:
        "استخدام المتصفح كطبقة تعلم مساعدة قبل/أثناء تنفيذ قدرة أخرى، لا كقدرة منفصلة فقط",
      maxSources: 2,
    });

    return {
      used: result.success,
      reason:
        intent.kind === "ultimate_tool" && intent.toolName
          ? `تدعيم قدرة ${intent.toolName} بسياق خارجي حي`
          : "الطلب يحتاج معرفة أو تحقق خارجي حي",
      summary: result.message,
      sources: result.data.sources.map((source) => ({
        title: source.title,
        url: source.url,
      })),
      learned: result.data.learned,
    };
  } catch (error) {
    return {
      used: false,
      reason: "حاولت استخدام المتصفح كطبقة مساعدة لكن لم يكتمل الفحص",
      summary: error instanceof Error ? error.message : "Browser augmentation failed",
      sources: [],
      learned: [],
    };
  }
}

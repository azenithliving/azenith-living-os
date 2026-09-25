/**
 * intent-router.ts — understands Egyptian dialect by ASKING A MODEL,
 * not by matching letters.
 *
 * Flow: deterministic regex fast-path first (free, instant) → if nothing
 * matches, a fast free LLM (Groq) maps the raw colloquial message onto the
 * tool catalog. Unknown tools are rejected by whitelist so a hallucinated
 * tool name can never reach execution.
 */

import { askGroqMessages, askGoogleMessages } from "@/lib/ai-orchestrator";
import { inferUltimateTool } from "@/lib/admin-tool-bridge";

export interface RoutedIntent {
  toolName: string;
  params: Record<string, unknown>;
}

export const TOOL_CATALOG: Array<{ name: string; desc: string }> = [
  { name: "qa_load_probe", desc: "قياس حمل/سرعة حقيقي على الصفحات العامة (p50/p95/p99)" },
  { name: "qa_security_headers", desc: "فحص رؤوس الأمان الحقيقية + CORS probe للصفحة الرئيسية أو رابط" },
  { name: "qa_accessibility", desc: "تدقيق إمكانية وصول (a11y) حقيقي على الصفحات" },
  { name: "qayyim_luxury_score", desc: "حساب Luxury Score الفعلي للموقع" },
  { name: "qayyim_goals_risk", desc: "عرض الأهداف المهددة من قاعدة البيانات" },
  { name: "seo_analyze", desc: "تحليل SEO لصفحة/رابط" },
  { name: "seo_fix_issues", desc: "إصلاح مشاكل SEO تلقائيا" },
  { name: "content_health_check", desc: "فحص صحة محتوى صفحة (home/about/contact)" },
  { name: "product_list", desc: "عرض المنتجات من قاعدة البيانات" },
  { name: "backup_list", desc: "قائمة النسخ الاحتياطية" },
  { name: "backup_create", desc: "أخذ نسخة احتياطية" },
  { name: "revenue_analyze", desc: "تحليل الإيرادات والمبيعات" },
  { name: "metrics_realtime", desc: "المؤشرات اللحظية للنظام 24 ساعة" },
  { name: "goal_list", desc: "قائمة الأهداف" },
  { name: "goal_check_progress", desc: "تقدم آخر هدف" },
  { name: "system_health_check", desc: "فحص صحة النظام التقني" },
  { name: "mfg_inventory_list", desc: "جرد مخزون التصنيع/الخامات" },
  { name: "lead_list", desc: "قائمة العملاء/الليدز" },
  { name: "agent_memory_inspect", desc: "استعراض ذاكرة الوكلاء" },
  { name: "financial_margins_analyze", desc: "تحليل هوامش الأرباح" },
  { name: "speed_analyze", desc: "تدقيق سرعة استجابة صفحة" },
  { name: "web_search", desc: "بحث في الويب عن موضوع" },
];

const ALLOWED = new Set(TOOL_CATALOG.map((t) => t.name));

const SYSTEM = `أنت موجّه نوايا لوكيل "قيّم الدار" لموقع أثاث مصري. المستخدم يكتب بالعامية المصرية بأي صياغة.
مهمتك: تقرر لو رسالته تطلب أداة من القائمة دي. اختَر أداة واحدة أو none.

الأدوات:
${TOOL_CATALOG.map((t) => `- ${t.name}: ${t.desc}`).join("\n")}

أجب بـ JSON فقط بلا أي نص آخر:
{"toolName":"اسم_الأداة أو none","params":{}}
قواعد:
- لو الطلب عام/سؤال معرفي/نقاش → toolName = "none"
- أي رابط في كلام المستخدم يروح في params.url
- لا تخترع أسماء أدوات خارج القائمة.`;

export function parseIntent(raw: string): RoutedIntent | null {
  try {
    const json = raw.match(/\{[\s\S]*\}/)?.[0];
    if (!json) return null;
    const obj = JSON.parse(json);
    if (typeof obj?.toolName !== "string" || obj.toolName === "none") return null;
    if (!ALLOWED.has(obj.toolName)) return null;
    return { toolName: obj.toolName, params: obj.params && typeof obj.params === "object" ? obj.params : {} };
  } catch {
    return null;
  }
}

export async function routeIntent(message: string): Promise<RoutedIntent | null> {
  const intent = await routeIntentInner(message);
  // Tools that act on a page default to the live site when the user did not
  // name a URL ("وريني سرعة الموقع" → speed_analyze needs params.url).
  if (intent && NEEDS_URL.has(intent.toolName) && !intent.params.url) {
    intent.params = { ...intent.params, url: process.env.NEXT_PUBLIC_SITE_URL || "https://azenith-living.vercel.app/" };
  }
  return intent;
}

const NEEDS_URL = new Set([
  "speed_analyze", "speed_deep_audit", "seo_analyze", "seo_fix_issues",
  "qa_security_headers",
]);

async function routeIntentInner(message: string): Promise<RoutedIntent | null> {
  const fast = inferUltimateTool(message);
  if (fast) return fast;

  const msgs = [
    { role: "system" as const, content: SYSTEM },
    { role: "user" as const, content: message.slice(0, 600) },
  ];

  // Gemini first (measured live: Groq's llama-3.3 returns empty content for
  // this JSON-routing task on our key pool), Groq as backup.
  try {
    const google = await askGoogleMessages(msgs, { temperature: 0 });
    if (google.success && google.content?.trim()) {
      const raw = google.content.replace(/```json|```/g, "");
      const parsed = parseIntent(raw);
      if (parsed || /"toolName"\s*:\s*"none"/i.test(raw)) return parsed;
    }
  } catch {}

  try {
    const groq = await askGroqMessages(msgs, { temperature: 0, maxTokens: 200, jsonMode: true });
    if (groq.success && groq.content?.trim()) return parseIntent(groq.content);
  } catch {}

  return null;
}

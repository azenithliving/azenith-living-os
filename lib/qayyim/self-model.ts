/**
 * self-model.ts — what the swarm knows about itself.
 *
 * Aggregates the real registries (AGENT_ROLES, TOOL_CATALOG) with live DB
 * head-counts so «عرف نفسك» answers with numbers, not prose.
 * Server-only: imports the service-role DAL. UI reads it through an API.
 */
import "server-only";
import { supabaseServer } from "@/lib/dal/unified-supabase";
import { AGENT_ROLES } from "./agent-roles";
import { TOOL_CATALOG } from "@/lib/agents/intent-router";

export interface SelfModel {
  generatedAt: string;
  title: string;
  brand: string;
  agents: Array<{ key: string; name: string; roles: number }>;
  tools: Array<{ name: string; desc: string }>;
  limits: string[];
  /** What runs on its own schedule. Declared here so `whoami` cannot forget it. */
  organs: Organ[];
  counters?: { drafts?: number; goals?: number; learnings?: number; eventsToday?: number };
  /** Counters whose query failed — reported instead of silently reading as zero. */
  dataGaps?: string[];
}

export interface Organ {
  label: string;
  cadence: string;
  /** The module the round actually calls. The suite greps for it, so a deleted
   * organ fails the self-report test instead of turning the report into fiction. */
  source: string;
}

export const AUTONOMOUS_ORGANS: Organ[] = [
  { label: "مؤشر الفخامة المقاس", cadence: "كل يوم", source: "@/lib/qayyim/luxury-v2" },
  { label: "الأهداف المهددة", cadence: "كل يوم", source: "@/lib/qayyim/goal-risk" },
  { label: "مراقبة شذوذ الزوار", cadence: "كل يوم", source: "@/lib/qayyim/anomaly" },
  { label: "كاناري الصفحات العامة", cadence: "كل يوم", source: "@/lib/qayyim/canary" },
  { label: "قياس المنافسين", cadence: "كل اثنين", source: "@/lib/qayyim/rivals" },
  { label: "تدقيق ردود السرب", cadence: "كل أحد", source: "@/lib/qayyim/self-audit" },
  { label: "إغلاق المهام المعلقة", cadence: "كل يوم", source: "@/lib/qayyim/task-reconcile" },
  { label: "تقرير الصباح على تليجرام", cadence: "كل يوم", source: "@/lib/qayyim/daily-story" },
];

const AGENT_NAMES: Record<string, string> = {
  "qayyim-core": "القائد",
  "qayyim-cont": "المحتوى",
  "qayyim-vis": "المرئيات",
  "qayyim-seo": "الظهور",
  "qayyim-ux": "التجربة",
  "qayyim-ana": "التحليلات",
  "qayyim-dev": "التطوير",
  "qayyim-qa": "الجودة",
};

const LIMITS = [
  "كرون يومي واحد كحد أقصى (Vercel Hobby)",
  "لا نشر بلا موافقة بشرية (دستور — قاعدة 3)",
  "صفر خدمات مدفوعة",
  "روابط وأرقام من خريطة المسارات وقاعدة البيانات فقط",
];

type CounterKey = "drafts" | "goals" | "learnings" | "eventsToday";

const COUNTER_LABELS: Record<CounterKey, string> = {
  drafts: "مسودات معلقة",
  goals: "أهداف نشطة",
  learnings: "تعلّمات مسجّلة",
  eventsToday: "حدث آخر 24 ساعة",
};

type CountResult = { count: number | null; error: { message: string } | null };

export async function buildSelfModel(companyId: string | null): Promise<SelfModel> {
  const model: SelfModel = {
    generatedAt: new Date().toISOString(),
    title: "مدير تشغيل المحتوى",
    brand: "قيّم الدار",
    agents: Object.keys(AGENT_ROLES).map((key) => ({
      key,
      name: AGENT_NAMES[key] ?? key,
      roles: (AGENT_ROLES[key] ?? []).length,
    })),
    tools: TOOL_CATALOG.map((t) => ({ name: t.name, desc: t.desc })),
    limits: LIMITS,
    organs: AUTONOMOUS_ORGANS,
  };
  const sb = supabaseServer;
  if (!companyId || !sb) return model;

  const dayAgo = new Date(Date.now() - 864e5).toISOString();
  const headCount = (table: string) =>
    sb.from(table).select("id", { count: "exact", head: true }).eq("company_id", companyId);

  const results: [CounterKey, CountResult][] = [
    ["drafts", await headCount("qayyim_drafts").in("status", ["draft", "previewing"])],
    ["goals", await headCount("qayyim_goals").eq("status", "active")],
    ["learnings", await headCount("qayyim_swarm_learnings")],
    ["eventsToday", await headCount("qayyim_sync_events").gte("created_at", dayAgo)],
  ];

  const counters: NonNullable<SelfModel["counters"]> = {};
  const gaps: string[] = [];
  for (const [key, res] of results) {
    if (res.error) gaps.push(`${COUNTER_LABELS[key]} (${res.error.message})`);
    else counters[key] = res.count ?? 0;
  }
  model.counters = counters;
  if (gaps.length) model.dataGaps = gaps;
  return model;
}

export function renderSelfReport(m: SelfModel): string {
  const live = m.counters
    ? (Object.keys(COUNTER_LABELS) as CounterKey[]).map(
        (k) => `${m.counters?.[k] ?? "؟"} ${COUNTER_LABELS[k]}`
      )
    : null;

  return [
    `**${m.title}** (${m.brand}) — تقرير ذاتي حي`,
    `• الوكلاء: ${m.agents.length} — ${m.agents.map((a) => `${a.name}(${a.roles} دورًا)`).join("، ")}`,
    `• الأدوات المقاسة: ${m.tools.length} أداة — ${m.tools
      .slice(0, 6)
      .map((t) => t.name)
      .join("، ")}${m.tools.length > 6 ? "…" : ""}`,
    live ? `• الآن: ${live.join(" · ")}` : "• العدادات غير متاحة (لا شركة محددة)",
    m.dataGaps?.length ? `• لم أستطع قراءة: ${m.dataGaps.join("، ")}` : "",
    `• اللي بيحصل لوحده من غير ما تطلب: ${m.organs.map((o) => `${o.label}: ${o.cadence}`).join("، ")}`,
    `• حدودي المعلنة: ${m.limits.join("؛ ")}`,
    "لو طلبتُ خارج هذه الحدود هقولك بصراحة وسمّي الناقص.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function renderIdentityLine(agentKey: string, m: SelfModel): string {
  const me = m.agents.find((a) => a.key === agentKey);
  return `[هويتك: أنت «${m.title}» — ${m.brand}${
    me ? `، وكيل ${me.name} (${me.roles} أدوار)` : ""
  }. أدوات السرب الآن ${m.tools.length} أداة. ممنوع الطلبات خارج الأدوات: ارفض بصراحة وسمِّ الناقص.]`;
}

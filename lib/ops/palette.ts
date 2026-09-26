/**
 * The command palette's brain: what the swarm can actually be told to do, in
 * the owner's language, and how a half-typed dialect query finds it.
 *
 * Deliberately client-safe and pure — no `server-only`, no fetch. The chat
 * screen pulls the live self-model over `/api/admin/ops/self` and hands it
 * here, so the palette can never advertise a capability the registries lost.
 *
 * Two rules this file exists to keep:
 *  • an entry is only listed if something real happens on Enter — a whitelisted
 *    tool id, a page that renders, or a view this screen can open;
 *  • Arabic lines carry no Latin. A tool id is a command's address, not its
 *    name: it travels in `runTool` and is rendered on a line of its own.
 */
import type { SelfModelView } from "./self-view";

export type { SelfModelView };

export type PaletteKind = "capability" | "agent" | "schedule" | "view" | "open";

export interface PaletteCommand {
  id: string;
  kind: PaletteKind;
  /** What the owner reads. Arabic only, always. */
  label: string;
  /** A second Arabic line, or a Latin id rendered in its own element. */
  hint?: string;
  /** The whitelisted tool the chat must run — no intent guessing involved. */
  runTool?: string;
  /** The message that lands in the conversation. */
  send?: string;
  /** Or the page that opens instead of a message. */
  href?: string;
  /** For an agent row: which chat to open. */
  agentKey?: string;
}

/**
 * One Arabic command per tool the router can really run. Keyed by tool id, and
 * `tests/ops/palette.test.ts` asserts the two sets stay equal — so adding a
 * tool without a command, or a command for a tool that no longer exists, fails
 * a test instead of turning the palette into fiction.
 */
export const CAPABILITY_LABELS: Record<string, string> = {
  ops_self: "عرف نفسك: قدراتك وأدواتك وحدودك",
  ops_world: "ايزاي الشغل الفترة دي: مبيعات وأكثر مبيعًا وزوار وموسم",
  gsc_queries: "كلمات البحث الحقيقية من جوجل",
  ops_rivals: "قياس المنافسين: أسعارهم ومنتجاتهم",
  ops_forecast: "توقع المبيعات للفترة الجاية",
  draft_list: "جرد المسودات المعلقة",
  qa_load_probe: "اختبار حمل الصفحات العامة",
  qa_security_headers: "فحص رؤوس الأمان للإطلالة",
  qa_accessibility: "تدقيق إمكانية الوصول للصفحات",
  ops_luxury_score: "مقياس الفخامة المقاس",
  ops_goals_risk: "الأهداف المهددة في الدار",
  seo_analyze: "تحليل الظهور لصفحة",
  seo_fix_issues: "إصلاح مشاكل الظهور تلقائيًا",
  content_health_check: "فحص صحة محتوى صفحة",
  product_list: "عرض المنتجات من قاعدة البيانات",
  backup_list: "قائمة النسخ الاحتياطية",
  backup_create: "أخذ نسخة احتياطية دلوقتي",
  revenue_analyze: "تحليل الإيرادات والمبيعات",
  metrics_realtime: "المؤشرات اللحظية للنظام",
  goal_list: "قائمة الأهداف",
  goal_check_progress: "تقدم آخر هدف",
  system_health_check: "فحص تقني عميق للنظام",
  mfg_inventory_list: "جرد خامات التصنيع",
  lead_list: "قائمة العملاء",
  agent_memory_inspect: "استعراض ذاكرة الوكلاء",
  financial_margins_analyze: "تحليل هوامش الأرباح",
  speed_analyze: "تدقيق سرعة استجابة صفحة",
  web_search: "بحث في الويب عن موضوع",
};

/** Where the palette takes the owner without going through the swarm. */
export const NAV_LINKS: Array<{ label: string; href: string }> = [
  { label: "استوديو السرب: الوكلاء الثمانية", href: "/admin/v2/ops" },
  { label: "مركز قيادة الوكلاء", href: "/admin/v2/agents" },
  { label: "لوحة المالك", href: "/admin/v2/owner-dashboard" },
  { label: "قاعدة البيانات", href: "/admin/v2/database" },
  { label: "إعدادات الموقع", href: "/admin/v2/settings" },
];

export const SELF_VIEW_COMMAND: PaletteCommand = {
  id: "view:self",
  kind: "view",
  label: "اسأل عن نفسك: القدرات والحدود والعدادات",
  hint: "تقرير حي من السجلات والعدادات",
};

const VIEWS: PaletteCommand[] = [
  SELF_VIEW_COMMAND,
];

export function buildPalette(model: SelfModelView | null | undefined): PaletteCommand[] {
  const items: PaletteCommand[] = [...VIEWS];

  for (const link of NAV_LINKS) {
    items.push({ id: `open:${link.href}`, kind: "open", label: link.label, href: link.href });
  }

  if (!model) return items;

  for (const tool of model.tools) {
    const label = CAPABILITY_LABELS[tool.name];
    if (!label) continue; // a tool nobody named is not a command the owner can give
    items.push({
      id: `capability:${tool.name}`,
      kind: "capability",
      label,
      hint: tool.name,
      runTool: tool.name,
      send: label,
    });
  }

  for (const agent of model.agents) {
    items.push({
      id: `agent:${agent.key}`,
      kind: "agent",
      label: agent.name,
      hint: `فتح محادثة · ${agent.roles} أدوار مسجّلة`,
      href: "/admin/v2/agents/ops",
      agentKey: agent.key,
    });
  }

  for (const organ of model.organs) {
    items.push({
      id: `schedule:${organ.label}`,
      kind: "schedule",
      label: `${organ.label}: بيشتغل لوحده`,
      hint: organ.cadence,
    });
  }

  return items;
}

const DIACRITICS = /[\u064B-\u0652\u0670\u0640]/g;
const FOLD: Record<string, string> = {
  أ: "ا",
  إ: "ا",
  آ: "ا",
  ٱ: "ا",
  ء: "ا",
  ؤ: "و",
  ئ: "ي",
  ى: "ي",
  ة: "ه",
};

/** Egyptian typing drops the hamza and swaps ة/ى freely, so both spellings have
 * to find the same command. */
export function normalizeArabic(text: string): string {
  return text
    .replace(DIACRITICS, "")
    .replace(/[ء-ي]/g, (ch) => FOLD[ch] ?? ch)
    .toLowerCase()
    .trim();
}

function haystack(item: PaletteCommand): string {
  return normalizeArabic([item.label, item.hint, item.runTool, item.agentKey, item.send].filter(Boolean).join(" "));
}

/** 0 = the command starts with what he typed, 1 = it contains it, 2 = a weaker
 * field carried the match. Stable within a rank, so the palette reads the same
 * twice in a row. */
function rank(item: PaletteCommand, tokens: string[]): number {
  const label = normalizeArabic(item.label);
  const all = haystack(item);
  if (!tokens.every((t) => all.includes(t))) return -1;
  if (label.startsWith(tokens[0])) return 0;
  if (label.includes(tokens[0])) return 1;
  return 2;
}

export function filterPalette(items: PaletteCommand[], query: string): PaletteCommand[] {
  const tokens = normalizeArabic(query).split(/\s+/).filter(Boolean);
  if (!tokens.length) return items;
  return items
    .map((item, index) => ({ item, index, score: rank(item, tokens) }))
    .filter((r) => r.score >= 0)
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .map((r) => r.item);
}

const SECTION_TITLES: Record<PaletteKind, string> = {
  capability: "أقدر أنفذها دلوقتي",
  agent: "الوكلاء",
  schedule: "بيشتغل لوحده بجدولها",
  view: "عن نفسها",
  open: "أجزاء في الموقع",
};

export function paletteSectionTitle(kind: PaletteKind): string {
  return SECTION_TITLES[kind];
}

/** The order the sections appear in — capabilities first, he came to work. */
export const PALETTE_SECTIONS: PaletteKind[] = ["capability", "view", "agent", "open", "schedule"];

export function isPaletteHotkey(event: {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
}): boolean {
  if (event.key.toLowerCase() !== "k") return false;
  if (event.shiftKey || event.altKey) return false;
  return Boolean(event.ctrlKey || event.metaKey);
}

export const PALETTE_PLACEHOLDER = "دوّر على قدرة: سرعة، فخامة، مسودات…";

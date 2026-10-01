/**
 * metricLabels.ts — the Arabic word for the numbers a tool answers with.
 *
 * The result card used to print whatever key the tool returned, so the owner's chat
 * showed «agents 8 · tools 25» inside an Arabic sentence. A metric with no Arabic
 * word here is left off the card rather than shown under its machine name; the raw
 * record stays one press away in the data panel.
 */
export const METRIC_LABELS: Record<string, string> = {
  agents: "عدد الموظفين",
  tools: "عدد الأدوات",
  tasks: "المهام",
  pages: "الصفحات",
  products: "المنتجات",
  rooms: "الغرف",
  images: "الصور",
  drafts: "المسودات",
  learnings: "الدروس المحفوظة",
  goals: "الأهداف",
  visitors: "الزوار",
  leads: "المهتمين",
  customers: "العملاء",
  count: "العدد",
  total: "الإجمالي",
  success: "الناجح",
  failed: "الفاشل",
  pending: "المعلّق",
  score: "التقييم",
  luxuryScore: "درجة الفخامة",
  indexed: "المفهرسة",
  blocked: "المحجوبة",
};

export function metricLabel(key: string): string {
  return METRIC_LABELS[key] ?? "";
}

/** His numerals are the Arabic ones, everywhere he reads a number. */
export function arNum(value: number | string): string {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? new Intl.NumberFormat("ar-EG").format(n) : String(value);
}

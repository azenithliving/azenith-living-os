/**
 * The order's state, in the words the shop uses out loud.
 *
 * Measured live 2026-10-07: the world digest told the owner «الحالات: confirmed 2» because it read
 * the `status` column straight into an Arabic sentence. His ledger holds `completed`, `processing`
 * and `confirmed`; the rest are the states the store's own order flow can reach.
 *
 * An unrecognised value is named as unknown rather than printed: a code word he cannot read is not
 * an answer, and guessing a meaning for it would be worse.
 */
const LABELS: Record<string, string> = {
  pending: "في انتظار التأكيد",
  confirmed: "متأكّد",
  processing: "قيد التجهيز",
  shipped: "في الطريق",
  delivered: "اتسلّم",
  completed: "مكتمل",
  cancelled: "ملغي",
  refunded: "ارجعت الفلوس",
  failed: "واقع",
};

export function orderStatusLabel(raw: string | null | undefined): string {
  const key = String(raw ?? "").trim().toLowerCase();
  if (!key) return "غير محدد";
  return LABELS[key] ?? "حالة غير معروفة";
}

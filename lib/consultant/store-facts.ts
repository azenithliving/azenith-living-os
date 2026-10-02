/**
 * store-facts.ts — what the advisor is allowed to know about its own store.
 *
 * Measured on the published store 2026-10-02: asked who executes the work and which districts
 * the store covers, the advisor answered as an outside consultant — «في أغلب شركات المقاولات
 * والتشطيبات المحترمة في هذه المنطقة» — because nothing in its prompt carried the store's own
 * record. The persona knew the regions of Egypt; it did not know what the store sells, that its
 * own team executes, or how a customer reaches a human.
 *
 * So the facts are read live from the store's own tables — the company row and the catalogue —
 * not copied into code, where they would rot. What no table holds (a showroom address, opening
 * hours, ready prices) is named as unrecorded, and the advisor is told to say so instead of
 * inventing it: an invented address is a customer standing in front of a door that is not there.
 */
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export type StoreFacts = {
  /** The store's WhatsApp as a local Egyptian number, digits only, without the country code. */
  whatsappLocal: string | null;
  /** The catalogue's own line names, as the store records them. */
  lines: string[];
};

const AR_DIGITS = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];

const toArabicDigits = (value: string): string => value.replace(/\d/g, (d) => AR_DIGITS[Number(d)]);

/** A catalogue line keeps its Arabic and drops the Latin gloss in brackets: «غرف الملابس (Dressing)». */
export function cleanSectionName(name: string): string {
  return String(name ?? "")
    .replace(/\s*\([^)]*[A-Za-z][^)]*\)\s*/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export async function readStoreFacts(): Promise<StoreFacts> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return { whatsappLocal: null, lines: [] };
  try {
    const [company, sections] = await Promise.all([
      supabase.from("companies").select("whatsapp").limit(1),
      supabase.from("room_sections").select("name").order("name", { ascending: true }).limit(60),
    ]);
    const raw = String(company.data?.[0]?.whatsapp ?? "").replace(/\D/g, "");
    const local = raw.startsWith("20") ? raw.slice(2) : raw;
    const lines = (sections.data ?? [])
      .map((row) => cleanSectionName(String(row.name ?? "")))
      .filter(Boolean);
    return { whatsappLocal: local || null, lines };
  } catch (err) {
    console.warn("[Consultant] store facts unreadable, the advisor will speak without them:", err);
    return { whatsappLocal: null, lines: [] };
  }
}

/**
 * The facts as one block for the advisor's own prompt. Arabic only, digits in the shape this
 * owner reads, and the unrecorded things named out loud so they are never invented.
 */
export function storeFactsBlock(facts: StoreFacts): string {
  const parts = [
    "[حقائق الدار من سجلها — دي حقائقك عن نفسك، متقولش عن الدار غيرها]",
    "- الدار أزينث ليفينج: بتصمم وتنفّذ وتصنع الأثاث المخصص والتشطيبات داخل مصر، وفريق الدار هو اللي بينفّذ الشغل من التصميم لحد التسليم.",
    facts.lines.length
      ? `- خطوط الشغل المسجلة في كتالوج الدار: ${facts.lines.join("، ")}.`
      : null,
    facts.whatsappLocal
      ? `- للتواصل المباشر: واتساب الدار على ${toArabicDigits(facts.whatsappLocal)}.`
      : null,
    "- غير المسجل عندك: عنوان معرض، مواعيد عمل، وأسعار جاهزة. متخترعش أي واحد فيهم؛ قول إن فريق الدار هيكمّل التفاصيل مع العميل على واتساب.",
    "- سؤال «مين اللي بينفّذ الشغل؟» جوابه من الدار: التنفيذ بفريق الدار نفسه — التصميم من مهندسيها، والتصنيع في ورشتها، والتركيب بأطقمها.",
    "- سؤال «بتوصلوا فين؟» جوابه من الدار: الدار شغالة في مناطق مصر المسجلة في سياق المناطق، والمشروع بيتسلّم للعميل وهو مرتاح.",
    "- متتكلمش عن شركات أو ورش أو سوق بشكل عام، ولا تقارن الدار بحد؛ الدار بتتكلم عن شغلها هي.",
  ].filter(Boolean) as string[];
  return parts.join("\n");
}

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
import { coverageSentence } from "@/lib/regions";

export type StoreFacts = {
  /** The store's WhatsApp as a local Egyptian number, digits only, without the country code. */
  whatsappLocal: string | null;
  /** The catalogue's own line names, as the store records them. */
  lines: string[];
  /** The opening hours as the owner wrote them in the store's knowledge, or null. */
  workingHours?: string | null;
};

/** The knowledge row that carries the hours, written by the owner in the sales screen. */
const HOURS_PREFIX = "مواعيد العمل";

const AR_DIGITS = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];

const toArabicDigits = (value: string): string => value.replace(/\d/g, (d) => AR_DIGITS[Number(d)]);

/** A catalogue line keeps its Arabic and drops the Latin gloss in brackets: «غرف الملابس (Dressing)». */
export function cleanSectionName(name: string): string {
  return String(name ?? "")
    .replace(/\s*\([^)]*[A-Za-z][^)]*\)\s*/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * The hours sentence the owner wrote, newest first — the only reader of it in the store.
 *
 * The advisor quotes this row, and the surfaces that compute a schedule (is the office open? when
 * does it next open?) must obey the same row rather than restating its numbers in code. One reader,
 * so the two can never disagree again.
 */
export async function readHoursSentence(): Promise<string | null> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from("consultant_learnings")
      .select("instruction")
      .like("instruction", `${HOURS_PREFIX}%`)
      .order("created_at", { ascending: false })
      .limit(1);
    if (error) {
      console.warn("[StoreFacts] سطر المواعيد مقروءش:", error.message);
      return null;
    }
    return String(data?.[0]?.instruction ?? "").trim() || null;
  } catch (err) {
    console.warn("[StoreFacts] سطر المواعيد اتلف:", err);
    return null;
  }
}

export async function readStoreFacts(): Promise<StoreFacts> {
  const supabase = getSupabaseAdminClient();
  const empty: StoreFacts = { whatsappLocal: null, lines: [], workingHours: null };
  if (!supabase) return empty;
  try {
    const [company, sections, workingHours] = await Promise.all([
      supabase.from("companies").select("whatsapp").limit(1),
      supabase.from("room_sections").select("name").order("name", { ascending: true }).limit(60),
      readHoursSentence(),
    ]);
    const raw = String(company.data?.[0]?.whatsapp ?? "").replace(/\D/g, "");
    const local = raw.startsWith("20") ? raw.slice(2) : raw;
    const lines = (sections.data ?? [])
      .map((row) => cleanSectionName(String(row.name ?? "")))
      .filter(Boolean);
    return { whatsappLocal: local || null, lines, workingHours };
  } catch (err) {
    console.warn("[Consultant] store facts unreadable, the advisor will speak without them:", err);
    return empty;
  }
}

/**
 * The regions the store works in, spoken from the one list the store keeps (`lib/regions.ts`).
 * Restating them here is how the advisor's sentence and the customer's area chips drifted apart.
 */
const REGIONS_AR = `${coverageSentence()}، وباقي محافظات مصر`;

/**
 * The store's own answer to «where do you work and who executes», built from its record.
 *
 * Measured twice on the published store: left to the model, this question came back as an
 * outside consultant's guide to other companies, and once with an offer of "approximate costs"
 * the store never recorded. A question whose answer is a fact gets the fact, not a guess.
 */
export function buildCoverageReply(facts: StoreFacts, language?: string): string {
  if (language === "en") {
    const wa = facts.whatsappLocal ? ` Our WhatsApp is ${facts.whatsappLocal}.` : "";
    return (
      "Azenith Living designs, executes and manufactures across Egypt: Greater Cairo (New Cairo, Rehab, Madinaty, Shorouk, Nasr City, Heliopolis, Maadi, Zamalek), Giza (October, Sheikh Zayed, Haram, Mohandessin), the North Coast, Ain Sokhna, Alexandria and the other governorates. The work is carried out by the store's own team — design by its engineers, manufacturing in its workshop, installation by its crews, until the project is handed over." +
      " We keep no showroom: everything is designed and built to order and to the customer's measurements, so there is no finished piece to visit." +
      wa +
      " Tell me the space and the style and I will take it from there."
    );
  }
  const wa = facts.whatsappLocal ? ` واتساب الدار على ${toArabicDigits(facts.whatsappLocal)}،` : "";
  return [
    `أهلاً بيك في أزينث ليفينج. الدار شغالة في ${REGIONS_AR}.`,
    "التنفيذ بفريق الدار نفسه: التصميم من مهندسيها، والتصنيع في ورشتها، والتركيب بأطقمها، لحد ما المشروع يتسلّم وإنت مرتاح.",
    "وملناش معرض تتزوره: كل الشغل بيتصمّم وبيتصنّع على مقاسك وحسب طلبك، فمفيش قطعة جاهزة مستنياك.",
    `لو حابب نظبط تفاصيل مشروعك بالظبط،${wa} أو قولي المساحة والستايل وأكمّل معاك هنا.`,
  ].join("\n");
}

/**
 * The store's own answer to «can I visit the showroom», from the owner's words: there is no
 * showroom, because nothing is made ready to be seen. The replacement is the store's actual
 * process — measurements and pictures, then the workshop builds it to fit.
 */
export function buildShowroomReply(facts: StoreFacts, language?: string): string {
  if (language === "en") {
    const wa = facts.whatsappLocal ? ` Send them to our WhatsApp: ${facts.whatsappLocal}.` : "";
    return "Azenith Living keeps no showroom and holds no ready stock — that is on purpose. Everything is designed and manufactured to order, to your measurements and your space, so there is no finished piece waiting to be visited." +
      wa +
      " Tell me the room's measurements and the style you like, and I will walk you through materials, colours and the next step.";
  }
  const wa = facts.whatsappLocal ? ` ابعتهم على واتساب الدار ${toArabicDigits(facts.whatsappLocal)}،` : "";
  return [
    "احنا في أزينث ليفينج ملناش معرض: الدار ما بتخزنش قطع جاهزة، كل حاجة بتتصمّم وبتتصنّع حسب الطلب وعلى مقاس بيتك.",
    "يعني اللي هيحصل إنك تقولي مقاسات المكان والستايل اللي مريحك، وأنا أحدد معاك الخامة والألوان والتقسيم، وبعدها فريق الدار ينفّذ في ورشته لحد التركيب.",
    `لو عندك صور للمكان${wa} أو قولي المساحات هنا وأبدأ معاك خطوة خطوة.`,
  ].join("\n");
}

/**
 * The store's opening hours, quoted from the row the owner wrote.
 *
 * Measured on the local build 2026-10-02, asked «انتم شغالين الساعة كام؟» the advisor answered
 * «أنا متاح 24 ساعة في اليوم، 7 أيام في الأسبوع» — a chatbot describing its uptime, while the
 * store's own hours were sitting in its record. Null when nothing is recorded, or for an English
 * visitor (the row is written in Arabic), so the question keeps its normal path rather than
 * being answered with an invented translation.
 */
export function buildHoursReply(facts: StoreFacts, language?: string): string | null {
  if (!facts.workingHours || language === "en") return null;
  const recorded = facts.workingHours.startsWith(HOURS_PREFIX)
    ? facts.workingHours.slice(HOURS_PREFIX.length).replace(/^[\s:.\-،]+/, "").trim()
    : facts.workingHours.trim();
  if (!recorded) return null;
  const wa = facts.whatsappLocal ? ` أو ابعتهم على واتساب الدار ${toArabicDigits(facts.whatsappLocal)}،` : "";
  return [
    `أهلاً بيك في أزينث ليفينج. مواعيدنا: ${recorded}`,
    `لو حابب تبدأ مشروعك، قولي المساحة والستايل${wa} وأكمّل معاك خطوة خطوة.`,
  ].join("\n");
}

/**
 * The facts as one block for the advisor's own prompt. Arabic only, digits in the shape this
 * owner reads, and the unrecorded things named out loud so they are never invented.
 */
export function storeFactsBlock(facts: StoreFacts): string {
  const parts = [
    "[حقائق الدار من سجلها — دي حقائقك عن نفسك، متقولش عن الدار غيرها]",
    "- الدار أزينث ليفينج: بتصمم وتنفّذ وتصنع الأثاث المخصص والتشطيبات داخل مصر، وفريق الدار هو اللي بينفّذ الشغل من التصميم لحد التسليم.",
    "- الدار ملهاش معرض: الشغل كله بيتصمّم وبيتصنّع حسب الطلب وعلى مقاس العميل، فمفيش قطعة جاهزة تتشاف قبل الطلب. ما تدعوش عميل يزور معرض؛ اطلب منه المساحة والستايل وصورته، ووجّهه لواتساب الدار.",
    facts.lines.length
      ? `- خطوط الشغل المسجلة في كتالوج الدار: ${facts.lines.join("، ")}.`
      : null,
    facts.whatsappLocal
      ? `- للتواصل المباشر: واتساب الدار على ${toArabicDigits(facts.whatsappLocal)}.`
      : null,
    "- غير المسجل عندك: أي سعر جاهز أو رقم متر ثابت. متخترعش رقم؛ السعر عند الدار بيتحدد بعد المقاسات والخامة ومستوى التشطيب، وفريق الدار بيكمّل التفاصيل على واتساب.",
    "- سؤال «مين اللي بينفّذ الشغل؟» جوابه من الدار: التنفيذ بفريق الدار نفسه — التصميم من مهندسيها، والتصنيع في ورشتها، والتركيب بأطقمها.",
    "- سؤال «بتوصلوا فين؟» جوابه من الدار: الدار شغالة في مناطق مصر المسجلة في سياق المناطق، والمشروع بيتسلّم للعميل وهو مرتاح.",
    "- متتكلمش عن شركات أو ورش أو سوق بشكل عام، ولا تقارن الدار بحد؛ الدار بتتكلم عن شغلها هي.",
  ].filter(Boolean) as string[];
  return parts.join("\n");
}

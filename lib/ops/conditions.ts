/**
 * A business condition the owner can act on needs the desk that measures it.
 *
 * Measured 2026-10-09 over his 865 agent rows: 313 of them state a count of rooms or products,
 * 110 state traffic, 98 state a quality score, 25 state a competitor fact, 7 state the opening
 * hours, 4 state ready stock, 2 state that the shop is stable. The guard that already exists asks
 * one question — did any desk run? — so every one of those sentences passed as long as SOME desk
 * had run, whatever it measured. A row signed «الفحص الشامل للموقع» was believed when it quoted
 * revenue, and a row that really read the shop's numbers was believed when it invented a
 * competitor's price.
 *
 * This module asks the question that matters for a condition: which desk measures THIS fact, and
 * did it run in this turn?
 *
 * What a condition is, measured by reading the six first rows the first draft would have cut:
 * a sentence only states a business condition when it puts a VALUE on it. «لنرى نبض الزوار» is a
 * plan, «كل يوم، مراقبة شذوذ الزوار» is a schedule, «SEO، سرعة، إيرادات» is a list of topics —
 * none of them claims a fact, and cutting them would have been a new lie in the opposite
 * direction. So the quantitative conditions need a number in the same sentence; the state
 * conditions («الوضع مستقر», «ظاهر للعملاء», «مخزون», «بنفتح ٩») assert by their wording alone.
 *
 * Two conditions carry an empty desk list on purpose. Ready stock: the owner ordered the opposite
 * (everything is made to order, no showroom, no ready goods). Opening hours: the hours are a
 * recorded fact the store reads from its own register, and no chat desk reads it yet.
 */
import { stripSentences } from "./claims";
import { WORLD_DESK, type DeskRun } from "./provenance";

/** Arabic-Indic and Western digits both count — his screen and a model's output differ. */
const HAS_NUMBER = /[0-9٠-٩]/;

const WORLD_DESKS = [WORLD_DESK, "ops_world"];
const QA_DESKS = [
  "site_audit",
  "qa_accessibility",
  "qa_security_headers",
  "qa_load_probe",
  "content_health_check",
  "system_health_check",
  "metrics_realtime",
];

export type Condition = {
  /** What the owner reads when the guard has to say what was missing. */
  label: string;
  /** The wording that puts this condition in play. */
  topic: RegExp;
  /** A value must sit in the same sentence, or it is a topic, not a claim. */
  needsNumber: boolean;
  /** Desk ids that actually measure it. Empty = nothing in the shop measures it. */
  measuredBy: string[];
};

export const CONDITIONS: Condition[] = [
  {
    label: "إن الشغل ماشي تمام أو مفيش مشاكل",
    // The live wording never repeats itself: «الوضع العام: مستقر»، «الأمر تحت السيطرة»،
    // «الدار في أوج عرضها»، «حالة ممتازة» (measured 2026-10-09: 25 rows carry one of these,
    // 5 of them with no desk running). The state word is matched as a span after its anchor,
    // so «خامات ممتازة» about a product is not mistaken for a claim about the shop.
    topic:
      /(الوضع|الدار|الشغل|الأمر|المحل)[^.\n]{0,18}(?:مستقر|مستقرة|تحت السيطرة|في أوج|ممتازة|تمام)|كله تمام|كل حاجة تمام|لا توجد مشاكل|مفيش مشاكل|لا مشاكل|بحالة جيدة|جيدة جدًا|كل شيء على ما يرام/,
    needsNumber: false,
    measuredBy: QA_DESKS,
  },
  {
    label: "إن العميل شايف المنتج أو الصفحة",
    topic: /(ظاهر(?:ين)? للعملاء|متاح(?:ة)? للجمهور|يظهر للعملاء|منشور(?:ة)? فعلًا|الكل شايفه)/,
    needsNumber: false,
    measuredBy: [...WORLD_DESKS, "content_health_check", "product_list", "site_audit"],
  },
  {
    label: "إن في بضاعة جاهزة أو مخزون",
    topic: /(مخزون|متوفر(?:ة)? فورًا|جاهز(?:ة)? للتسليم|في المخزن|بضاعة جاهزة)/,
    needsNumber: false,
    // The owner ordered the opposite: nothing is ready, everything is made to order.
    measuredBy: [],
  },
  {
    label: "مواعيد العمل أو يوم الإجازة",
    topic: /(مواعيد العمل|بنفتح|المحل بيفتح|يوم الإجازة|مغلق يوم|الساعة\s*[0-9٠-٩]+\s*(?:ص|صباحًا|م|مساءً))/,
    needsNumber: false,
    // The hours live in the store's own register, and no chat desk reads it.
    measuredBy: [],
  },
  {
    label: "رقم في المبيعات أو متوسط طلب",
    // A money claim carries money: a currency unit, or the figure sitting on the word itself.
    // «لتحريكهم في قمع المبيعات» names the topic and states no value, so it is not a claim.
    topic: /(ج\.م|ريال|EGP|دينار)|((المبيعات|إيرادات|أرباح|متوسط الطلب)[^.\n|]{0,12}[0-9٠-٩])/,
    needsNumber: false,
    measuredBy: [...WORLD_DESKS, "ops_forecast", "ops_luxury_score"],
  },
  {
    label: "عدد الزيارات أو الجلسات",
    topic: /[0-9٠-٩]+\s*(?:حدث|زيارة|زائر|زوار|جلسة|جلسات|مشاهدة|مشاهدات)|(?:الزوار|الزيارات|الجلسات)[^.\n|]{0,10}[0-9٠-٩]/,
    needsNumber: false,
    measuredBy: [...WORLD_DESKS, "gsc_queries", "metrics_realtime", "ops_self"],
  },
  {
    label: "عدد الغرف أو المنتجات",
    // The number has to sit on the noun: a table row that happens to carry a row number and the
    // word «منتج» is a finding about one product, not a count of the catalogue.
    topic: /[0-9٠-٩]+\s*(?:غرفة|غرف|منتج|منتجات|قسم|أقسام|صنف)|(?:الكتالوج|الغرف|المنتجات)[^.\n|]{0,10}[0-9٠-٩]/,
    needsNumber: false,
    measuredBy: [...WORLD_DESKS, "product_list", "lead_list", "ops_self", "site_audit"],
  },
  {
    label: "درجة جودة أو مقياس فخامة",
    topic: /(مقياس الفخامة|درجة الجودة|Luxury Score|نقاط من)/,
    needsNumber: true,
    measuredBy: ["ops_luxury_score", "qa_accessibility", "seo_analyze"],
  },
  {
    label: "سعر أو منتج عند منافس",
    topic: /(المنافس|المنافسين|منافس)/,
    needsNumber: true,
    measuredBy: ["ops_rivals"],
  },
  {
    label: "توقع للفترة الجاية",
    topic: /(متوقع|توقع المبيعات|الفترة الجاية|الشهر الجاي|الأسبوع الجاي)/,
    needsNumber: true,
    measuredBy: ["ops_forecast", ...WORLD_DESKS],
  },
];

/** Does this sentence state the condition — wording, and a value where one is needed? */
function states(condition: Condition, sentence: string): boolean {
  if (!condition.topic.test(sentence)) return false;
  return !condition.needsNumber || HAS_NUMBER.test(sentence);
}

/** Which conditions this text states. */
export function statedConditions(text: string): Condition[] {
  const body = String(text ?? "");
  return CONDITIONS.filter((c) => states(c, body));
}

/**
 * Conditions the text states that none of the successfully recorded desks measures.
 * A desk that ran and failed measures nothing, so it is not counted.
 */
export function unmeasuredConditions(text: string, desks: DeskRun[]): Condition[] {
  const ran = new Set(desks.filter((d) => d.ok).map((d) => d.desk));
  return statedConditions(text).filter((c) => !c.measuredBy.some((id) => ran.has(id)));
}

/**
 * Strike the sentences that put an unmeasured value on a business condition, and say which
 * conditions were left without a reading. Arabic only: a desk id never enters his sentence.
 */
export function honestConditions(
  text: string,
  desks: DeskRun[]
): { text: string; removed: string[]; unmeasured: string[]; disclosed: boolean } {
  const source = String(text ?? "");
  const missing = unmeasuredConditions(source, desks);
  if (!missing.length) return { text: source, removed: [], unmeasured: [], disclosed: false };

  const { body, removed } = stripSentences(source, (sentence) => unmeasuredConditions(sentence, desks).length > 0);
  const names = missing.map((c) => c.label);
  const note = `اتشال من الرد كلام عن: ${names.join("، ")} — مفيش مكتب قياس اتشغّل عليه في الطلب ده.`;
  return {
    text: body ? `${body}\n\n${note}` : note,
    removed,
    unmeasured: names,
    disclosed: true,
  };
}

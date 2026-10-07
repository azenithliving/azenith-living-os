import { CAPABILITY_LABELS } from "./palette";
import { foldArabic } from "@/lib/arabic";

/**
 * The employees' voice on his screen.
 *
 * Census of his chat 2026-10-06: 736 of 851 agent rows carry Latin words. In 681 of them the Latin
 * is a machine label dropped into an Arabic sentence («النتيجة العامة: Pass», «رابط التفاصيل:
 * evidenceUrl»); 100 are mostly Latin because a tool answered in English («SEO analysis completed
 * for - Score: 97/100»); 91 echo a retired tool key (qayyim_world, qayyim_rivals).
 *
 * This runs where the bubble renders, not where the row is stored: his history is already written,
 * and the law is about what he reads. Two things it never does — it does not touch his own words
 * (the caller decides that), and it does not rewrite a web address or a site path, because a link
 * is allowed on his screens as its own element. An identifier it cannot name in Arabic is dropped
 * rather than printed: silence beats a machine word he has to decode.
 */
/**
 * A web address or a site path is allowed on his screens as its own element, and a code span is
 * something he copies to a terminal, not something he reads. Both pass through untouched.
 */
const PROTECTED = /(https?:\/\/[^\s)>\]"'،]+|\/[A-Za-z0-9\-_./]{4,}|`[^`]*`)/g;

/** Multi-word report strings, matched before single tokens so the longest reading wins. */
const PHRASES: Array<[string, string]> = [
  ["Too Many Requests", "طلبات كتير أوي"],
  ["Accessibility Audit Report", "تقرير فحص إمكانية الوصول"],
  ["Executive Summary", "الملخص التنفيذي"],
  ["Severity levels", "درجات الخطورة"],
  ["Measured Data", "البيانات المقاسة"],
  ["Focus states", "حالات التركيز"],
  ["Semantic HTML", "ترميز دلالي"],
  ["Alt text", "النص البديل للصور"],
  ["axe-core", "فاحص الوصول"],
  ["axe core", "فاحص الوصول"],
  ["Keyboard Navigation", "التنقل بلوحة المفاتيح"],
  ["Contrast Ratio", "نسبة التباين"],
  ["Security Headers", "ترويسات الأمان"],
  ["Rate Limiting", "تحديد المعدل"],
  ["Content-Security-Policy", "ترويسة سياسة المحتوى"],
  ["Strict-Transport-Security", "ترويسة النقل الآمن الصارم"],
  ["X-Content-Type-Options", "ترويسة نوع المحتوى"],
  ["X-Frame-Options", "ترويسة التأطير"],
  ["Headers Check", "فحص الترويسات"],
  ["evidenceUrl", "رابط الدليل"],
  ["PageSpeed", "سرعة الصفحة"],
];

const WORDS: Record<string, string> = {
  pass: "ناجح",
  passed: "نجح",
  fail: "واقع",
  failed: "واقع",
  fails: "بيقع",
  score: "الدرجة",
  url: "الرابط",
  api: "الواجهة",
  seo: "الظهور في البحث",
  analysis: "التحليل",
  analyze: "يحلل",
  completed: "خلص",
  // The roll's own space names, measured on the published sales screen 2026-10-07 inside
  // «التواجد: (Profile, Conversation, Conversion)» and «لا توجد بيانات حالياً (٠ rows)».
  profile: "الملف الشخصي",
  conversation: "كلامه مع الموظف",
  conversion: "تحوّل",
  rows: "صف",
  vip: "كبار الشخصيات",
  for: "لـ",
  hsts: "النقل الآمن الصارم",
  security: "الأمان",
  requests: "الطلبات",
  request: "طلب",
  content: "المحتوى",
  options: "الخيارات",
  fallback: "بديل",
  error: "خطأ",
  warning: "تنبيه",
  total: "الإجمالي",
  status: "الحالة",
  page: "الصفحة",
  pages: "الصفحات",
  title: "العنوان",
  images: "الصور",
  image: "صورة",
  missing: "ناقص",
  invalid: "غير سليم",
  valid: "سليم",
  timeout: "مهلة",
  description: "الوصف",
  heading: "عنوان رئيسي",
  product: "منتج",
  products: "منتجات",
  site: "الموقع",
  speed: "السرعة",
  accessibility: "إمكانية الوصول",
  audit: "فحص",
  report: "تقرير",
  policy: "سياسة",
  cookies: "ملفات التعريف",
  credentials: "بيانات اعتماد",
  cors: "سياسة الأصل المتقاطع",
  ssl: "التشفير",
  csp: "سياسة المحتوى",
  wildcard: "نجمي شامل",
  rate: "معدل",
  limiting: "تحديد",
  luxury: "الفخامة",
  standard: "المعيار",
  wcag: "معيار الوصول العالمي",
  high: "مرتفع",
  medium: "متوسط",
  low: "منخفض",
  critical: "حرج",
  measured: "مقاس",
  measuring: "قياس",
  violations: "مخالفات",
  violation: "مخالفة",
  severity: "خطورة",
  levels: "مستويات",
  level: "مستوى",
  alt: "بديل",
  text: "نص",
  semantic: "دلالي",
  html: "ترميز",
  labels: "تسميات",
  label: "تسمية",
  focus: "تركيز",
  states: "حالات",
  state: "حالة",
  data: "بيانات",
  summary: "ملخص",
  executive: "تنفيذي",
  and: "و",
  keyboard: "لوحة المفاتيح",
  navigation: "التنقل",
  verified: "متثبت",
  contrast: "التباين",
  ratio: "نسبة",
  normal: "عادي",
  sms: "رسالة نصية",
  gateway: "بوابة",
  integration: "تكامل",
  insights: "رؤى",
  live: "حي",
  evolve: "يتطوّر",
};

const TOKEN = /[A-Za-z][A-Za-z0-9_.\-]*[A-Za-z0-9]|[A-Za-z]/g;
/** Any snake_case word is a machine identifier by shape — a tool id, a table, a column. */
const MACHINE_ID = /\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b/gi;
const DIGITS = /(?<![A-Za-z0-9])[0-9]+(?![A-Za-z0-9])/g;

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const PHRASE_RE = PHRASES.map(([from]) => new RegExp(`(?<![\\w-])${escape(from)}(?![\\w-])`, "gi"));

/** The live tool id behind a stored one, then the Arabic name the palette already gives it. */
function arabicToolName(id: string): string | null {
  const live = id.toLowerCase().startsWith("qayyim_") ? `ops_${id.slice(id.indexOf("_") + 1)}`.toLowerCase() : id.toLowerCase();
  const label = CAPABILITY_LABELS[live];
  if (!label) return null;
  return label.split(":")[0].trim() || null;
}

export type VoiceTally = { digits: number; words: string[]; ids: string[] };

function speak(segment: string, tally: VoiceTally): string {
  let out = segment;

  out = out.replace(MACHINE_ID, (id) => {
    const named = arabicToolName(id);
    if (!tally.ids.includes(id)) tally.ids.push(id);
    return named ? `${named} ` : "";
  });

  PHRASE_RE.forEach((re, i) => {
    out = out.replace(re, (found) => {
      const to = PHRASES[i][1];
      if (!tally.words.includes(found)) tally.words.push(found);
      return to;
    });
  });

  out = out.replace(TOKEN, (token) => {
    const to = WORDS[token.toLowerCase()];
    if (!to) return token;
    if (!tally.words.includes(token)) tally.words.push(token);
    return to;
  });

  return out.replace(DIGITS, (run) => {
    tally.digits += run.length;
    return run.replace(/[0-9]/g, (d) => String.fromCodePoint(0x0660 + Number(d)));
  });
}

/**
 * Latin glosses this store's own reports put beside their Arabic, measured on the published sales
 * screen 2026-10-07: «العملاء المجهولون (Anonymous)», «حركة بحث (Traffic)», «درجة الحرارة
 * (Freshness)», «قائمة العملاء (Leads)», «بانتظار رد (Needing Reply)», «النماذج (form)».
 */
const GLOSS_AR: Record<string, string> = {
  anonymous: "مجهولون",
  traffic: "حركة بحث",
  freshness: "درجة الحرارة",
  leads: "قائمة العملاء",
  "needing reply": "بانتظار رد",
  form: "نماذج",
  forms: "نماذج",
  vip: "كبار الشخصيات",
};

/** Folded Arabic words with the «ال» prefix loosened, so «النماذج» answers «نماذج». */
function arWords(value: string): string[] {
  return foldArabic(value)
    .split(/[^\p{L}\p{M}]+/u)
    .filter((w) => w.length > 1)
    .map((w) => (w.startsWith("ال") && w.length > 4 ? w.slice(2) : w));
}

/**
 * The swarm writes an Arabic heading and then glosses it in its own English: «تقرير فحص إمكانية
 * الوصول (Accessibility Audit Report)». Once the gloss is translated, his screen says the same
 * words twice — so a bracketed phrase that already stands right in front of it is dropped, whether
 * the bracket was written in Arabic or in Latin. An unknown Latin gloss keeps its bracket and is
 * translated in place: a word he cannot read is worse than a line that says the same thing twice.
 */
function dropDuplicatedGloss(text: string): string {
  return text.replace(/[ \t]*[(（]([^()]{2,80})[)）]/g, (whole, inner: string, offset: number) => {
    const value = inner.trim();
    const before = text.slice(0, offset);
    if (/\p{Script=Arabic}/u.test(value)) {
      const gloss = arWords(value);
      if (!gloss.length) return whole;
      const said = new Set(arWords(before));
      return gloss.every((w) => said.has(w)) ? "" : whole;
    }
    const key = foldArabic(value.toLowerCase().replace(/\s+/g, " ").trim());
    const ar = GLOSS_AR[key];
    // The pattern this store's reports write is «the Arabic word (its English twin)». When the
    // bracket is pure Latin and Arabic stands right in front of it, the gloss repeats what he has
    // just read — so it goes, whether or not this layer knows the word.
    if (/^[\p{L}\p{N}\s./-]+$/u.test(value) && !/\p{Script=Arabic}/u.test(value) && /[\u0600-\u06FF]\s*$/.test(before)) return "";
    if (!ar) return whole;
    const wanted = arWords(ar);
    const said = new Set(arWords(before));
    return wanted.every((w) => said.has(w)) ? "" : `(${ar})`;
  });
}

function run(text: string, tally: VoiceTally): string {
  let out = "";
  let last = 0;
  for (const m of text.matchAll(PROTECTED)) {
    const at = m.index ?? 0;
    out += speak(text.slice(last, at), tally) + m[0];
    last = at + m[0].length;
  }
  out += speak(text.slice(last), tally);
  return dropDuplicatedGloss(out.replace(/[ \t]{2,}/g, " "));
}

/** What the row says when it reaches his eyes. */
export function ownerVoice(text: string): string {
  return run(text, { digits: 0, words: [], ids: [] });
}

/** What was changed — the read-back, so a claim about the voice can be counted, not felt. */
export function voiceTally(text: string): VoiceTally {
  const tally: VoiceTally = { digits: 0, words: [], ids: [] };
  run(text, tally);
  return tally;
}

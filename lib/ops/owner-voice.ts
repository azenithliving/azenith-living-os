import { CAPABILITY_LABELS } from "./palette";

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
};

const TOKEN = /[A-Za-z][A-Za-z0-9_.\-]*[A-Za-z0-9]|[A-Za-z]/g;
const MACHINE_ID = /\b(?:qayyim|ops)_[a-z0-9_]+\b/gi;
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
 * The swarm writes an Arabic heading and then glosses it in its own English: «تقرير فحص إمكانية
 * الوصول (Accessibility Audit Report)». Once the gloss is translated, his screen says the same
 * words twice — so a bracketed Arabic phrase that already stands right in front of it is dropped.
 */
function dropDuplicatedGloss(text: string): string {
  return text.replace(/[ \t]*[(（]([^()]{2,80})[)）]/g, (whole, inner: string, offset: number) => {
    const value = inner.trim();
    if (!/\p{Script=Arabic}/u.test(value)) return whole;
    return text.slice(0, offset).includes(value) ? "" : whole;
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

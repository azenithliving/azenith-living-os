/**
 * P6-M4 — the consultant's own judgement, bounded.
 *
 * The storefront has written owner-approved question/answer pairs into
 * `consultant_faq` since migration 024, and nothing ever read them back: every
 * visitor question went to a model, so the owner's own words were the one source
 * the consultant could not use. This gate gives it that source under three locks:
 *
 *  • the row has an approver (`approved_by`) — nothing the owner never signed is
 *    said in his name;
 *  • the row is active;
 *  • the visitor's question actually matches, at 0.8 similarity or better.
 *
 * Anything else returns null, and the route keeps its existing behaviour: model
 * answer, human takeover when the visitor asks for a person.
 *
 * Pure: no database, no model. Normalisation is hand-written because Egyptian
 * spelling varies by keyboard and by habit (همزة, ta marbuta, «ال» prefixes), and
 * a matcher that only recognises one spelling silently answers nothing.
 */

export interface FaqRow {
  id?: string;
  question: string;
  answer: string;
  approved_by?: string | null;
  is_active?: boolean | null;
}

export interface FaqMatch {
  row: FaqRow;
  score: number;
}

const DIACRITICS = /[\u064B-\u0652\u0670\u0640]/g;

/** Filler that carries no topic: matching on it produces false hits. */
const STOPWORDS = new Set([
  "ما", "هل", "في", "من", "على", "عن", "ايه", "اي", "ديه", "ده", "دي", "اللي", "اللى", "لو", "عايز", "عايزة",
  "انا", "انت", "انتم", "عند", "مع", "كده", "جدا", "بتاع", "بتاعت", "هو", "هي", "يا", "الي", "إلي", "كان",
  // Egyptian filler that carries no topic: «هل فيه توصيل؟» is a question about
  // توصيل, and counting «فيه» as content was scoring a real match at 0.675.
  "فيه", "فيها", "فين", "كمان", "عشان", "علشان", "بس", "اوي", "قوي", "يعني", "يا", "اللي", "دلوقتي", "بشدة",
  "the", "a", "an", "is", "are", "do", "does", "you", "your", "my",
  "for", "of", "and", "to", "in", "can", "could", "please", "what", "how",
]);

/**
 * Small synonym classes, folded to their first member.
 *
 * Kept short and only for the words this shop's questions actually use — a
 * general thesaurus would be a bigger surface to be wrong about than the
 * handful of pairs it rescues.
 */
const SYNONYMS: string[][] = [
  ["عمل", "شغل", "شغلان"],
  ["مواعيد", "ميعاد", "موعد", "وقت", "أوقات"],
  ["توصيل", "شحن", "توصيلة", "نقل"],
  ["سعر", "أسعار", "تكلفة", "سعرة", "تسعير"],
  ["معرض", "معارض", "showroom"],
  ["صيانة", "صيان", "maintenance"],
  ["ضمان", "ضمانه", "warranty"],
];

const SYNONYM_LOOKUP = new Map<string, string>();
for (const group of SYNONYMS) {
  for (const word of group) SYNONYM_LOOKUP.set(word, group[0]);
}

function foldHamza(text: string): string {
  return text
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي");
}

/** Canonical form used for both sides of every comparison. */
export function normalizeArabic(text: string): string {
  const bare = foldHamza(text.replace(DIACRITICS, "").toLowerCase());
  return bare
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Remove the prefixes Egyptian typing attaches to a topic word: the definite
 * article, the conjunctions «و/ف/ب», and the preposition «ل» — each only while
 * what is left is still long enough to be a word rather than a fragment, so
 * «له» never becomes «ه».
 */
function stem(word: string): string {
  let w = word;
  for (let guard = 0; guard < 3; guard++) {
    if (w.length > 4 && (w.startsWith("وال") || w.startsWith("فال") || w.startsWith("بال"))) {
      w = w.slice(3);
      continue;
    }
    if (w.length > 4 && w.startsWith("ال")) {
      w = w.slice(2);
      continue;
    }
    if (w.length > 4 && /^[لبف]/.test(w)) {
      w = w.slice(1);
      continue;
    }
    break;
  }
  return w;
}

function tokens(text: string): Set<string> {
  const out = new Set<string>();
  for (const raw of normalizeArabic(text).split(" ")) {
    if (raw.length < 2) continue;
    const word = stem(raw);
    if (STOPWORDS.has(word) || STOPWORDS.has(raw)) continue;
    out.add(SYNONYM_LOOKUP.get(word) ?? word);
  }
  return out;
}

/**
 * 0..1 topic overlap. Containment (how much of the shorter question is present
 * in the longer) is what makes a four-word rephrasing of a ten-word FAQ match,
 * so it is scored at 0.9 — never a full 1, because partial coverage is still
 * partial coverage.
 */
export function similarity(a: string, b: string): number {
  const left = tokens(a);
  const right = tokens(b);
  if (!left.size || !right.size) return 0;

  let inter = 0;
  for (const t of left) if (right.has(t)) inter++;
  if (inter === 0) return 0;

  const union = left.size + right.size - inter;
  const jaccard = inter / union;
  const containment = inter / Math.min(left.size, right.size);
  return Math.max(jaccard, 0.9 * containment);
}

/** Only a row the owner signed and left switched on may be said in his name. */
export function isAutonomous(row: FaqRow): boolean {
  return (
    typeof row.answer === "string" && row.answer.trim().length > 0 &&
    typeof row.approved_by === "string" && row.approved_by.trim().length > 0 &&
    row.is_active !== false
  );
}

export function pickFaqAnswer(
  message: string,
  rows: FaqRow[],
  opts: { threshold?: number } = {},
): FaqMatch | null {
  const threshold = opts.threshold ?? 0.8;
  if (!message || !message.trim() || !rows.length) return null;

  let best: FaqMatch | null = null;
  for (const row of rows) {
    if (!isAutonomous(row)) continue;
    const score = similarity(message, row.question);
    if (score >= threshold && (!best || score > best.score)) best = { row, score };
  }
  return best;
}

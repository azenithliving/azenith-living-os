/**
 * paper-sketch-parser.ts — reads a room drawn by hand on paper, with two witnesses.
 *
 * The model reads the sketch the way a person does; the offline engine reads the
 * digits as pixels. A number only counts when both saw it: the model alone invents
 * tidy rooms, and the offline reader alone mis-reads pencil (measured on a clean
 * fixture: it returned "450m" for "4.50 m" and missed a side label entirely).
 *
 * So a reading is never presented as done unless the second witness confirmed at
 * least one number. Otherwise it is a written proposal with the reason, which is the
 * owner's own rule: a capability either runs on real evidence or says so.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { askVisionAny } from '@/lib/ai-orchestrator';

/** Shipped with the app so the reader never waits on a download to do its job. */
const LOCAL_LANG_DIR = join(process.cwd(), 'public', 'ocr');

/**
 * Where the letter-tables come from: the file system when it is there (the local
 * server), otherwise this site's own address. Never a third party — a customer's
 * drawing is not fetched through somebody else's machine to be read.
 */
function langSource(): { langPath: string; gzip: boolean } | null {
  if (existsSync(LOCAL_LANG_DIR)) return { langPath: LOCAL_LANG_DIR, gzip: false };
  const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, '');
  return base ? { langPath: `${base}/ocr`, gzip: false } : null;
}

export type SketchDimension = {
  label: string;
  meters: number;
  confirmed: boolean;
  /** Who vouched for this number. A number with no witness is never shown as done. */
  confirmedBy?: Witness[];
};

/** The two witnesses that can vouch for a number besides the reader itself. */
export type Witness = 'pixels' | 'customer';
export type SketchOpening = { kind: 'door' | 'window'; widthMeters: number | null };

export type SketchReading = {
  ok: boolean;
  failure: string | null;
  room: string | null;
  dimensions: SketchDimension[];
  openings: SketchOpening[];
  areaSqm: number | null;
  confirmedCount: number;
  ocr: { ran: boolean; text: string; confidence: number | null; ms: number; error: string | null };
  /** Which company's reader actually answered this drawing, when one did. */
  reader?: string | null;
  notes: string | null;
};

const PROMPT = `انت تقرأ ورقة مرسومة بالقلم لمكان في شقة. استخرج فقط ما هو مكتوب أو مرسوم عليها.
أعد JSON بلا أي شرح وبالشكل ده بالظبط:
{"room":"نوع المكان لو مكتوب","dimensions":[{"label":"اسم الضلع كما كتب","meters":4.5}],"openings":[{"kind":"door","widthMeters":0.9}],"notes":"أي ملاحظة مكتوبة على الورقة"}
قواعد صارمة: لا تخترع أي رقم غير مكتوب على الورقة. لو مفيش أرقام، ارجع dimensions فاضية. لو الباب أو الشباك مرسوم من غير مقاس، اكتب widthMeters=null. الأرقام بالعربي أو الأعجمي كلها تتحول لأعجمي داخل الـ JSON.`;

/** Arabic-Indic digits and separators folded to one comparable form: «٤٫٥٠» → «450». */
export function digitSignature(value: string | number): string {
  const arabicDigits = '٠١٢٣٤٥٦٧٨٩';
  const latin = String(value).replace(/[٠-٩]/g, (d) => String(arabicDigits.indexOf(d)));
  return latin.replace(/[^0-9]/g, '');
}

/**
 * The signatures one number can appear as on paper.
 *
 * A model that returns 4.5 has to meet the pixel reader's "4.50", its dotless
 * "450m" (measured: that is what the engine gave for a printed 4.50 with a unit
 * beside it), and an Arabic «٤٫٥». Writing the number out to one and two decimals
 * covers all three without letting 10 match 1 — only zeros are added, never removed.
 */
export function numberSignatures(meters: number): Set<string> {
  const forms = new Set<string>([String(meters), meters.toFixed(1), meters.toFixed(2)]);
  return new Set([...forms].map((form) => digitSignature(form)).filter(Boolean));
}

/** The model wraps JSON in prose and fences often enough that it is part of parsing. */
function extractJson(text: string): unknown | null {
  const cleaned = text.replace(/```(?:json)?/gi, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

function asMeters(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(String(value ?? '').replace(/,/g, '.'));
  return Number.isFinite(n) && n > 0 && n < 200 ? n : null;
}

/**
 * One pass of the offline engine, with a budget.
 *
 * The Arabic and English letter-tables ship with the app under `public/ocr` instead
 * of being fetched from a content delivery network at read time: measured, the
 * download was what made the engine miss its budget (it read the same image in
 * 400 ms once the tables were local). It also means a reading does not stop working
 * because a third party moved, and no customer's picture ever leaves for a CDN.
 */
async function readWithOfflineEngine(
  imageBuffer: Buffer,
  budgetMs: number
): Promise<SketchReading['ocr']> {
  const started = Date.now();
  try {
    const outcome = await Promise.race([
      import('tesseract.js').then(async ({ createWorker }) => {
        const tables = langSource();
        const worker = tables
          ? await createWorker('ara+eng', 1, tables)
          : await createWorker('ara+eng');
        try {
          return await worker.recognize(imageBuffer);
        } finally {
          await worker.terminate();
        }
      }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), budgetMs)),
    ]);
    if (!outcome) {
      return { ran: false, text: '', confidence: null, ms: Date.now() - started, error: 'انتهى الوقت قبل ما المحرك يخلص' };
    }
    return {
      ran: true,
      text: String(outcome.data?.text ?? ''),
      confidence: typeof outcome.data?.confidence === 'number' ? outcome.data.confidence : null,
      ms: Date.now() - started,
      error: null,
    };
  } catch (error) {
    return { ran: false, text: '', confidence: null, ms: Date.now() - started, error: String((error as Error)?.message ?? error).slice(0, 120) };
  }
}

export async function readPaperSketch(input: {
  base64: string;
  mime?: string;
  /** The offline engine's ceiling. Generous, because it downloads its Arabic data. */
  ocrBudgetMs?: number;
  /**
   * A witness already read in the visitor's browser. When it is there the server does
   * not run its own copy: the phone did that work faster, and a second reading of the
   * same pixels under a time budget only produces a timeout.
   */
  offline?: { ran?: boolean; text?: string; confidence?: number | null; ms?: number; error?: string | null } | null;
  /**
   * Opt-IN to running the engine inside this call — and the default is off, on purpose.
   * Measured across every reading this store has ever taken: the engine finished 0 times
   * in a request (12 attempts between 12 and 40 seconds, 6 of them hitting the whole
   * budget), so a caller that does not think about it must not pay for it silently.
   */
  runOffline?: boolean;
  /**
   * The numbers the customer typed for his own room. This is the witness that always
   * answers, and the one that ends an argument: the sheet he confirmed is the sheet
   * the store works from.
   */
  customer?: number[] | null;
}): Promise<SketchReading> {
  const mime = input.mime || 'image/png';

  const ocr: SketchReading['ocr'] =
    input.offline && typeof input.offline.ran === 'boolean'
      ? {
          ran: input.offline.ran,
          text: String(input.offline.text ?? '').slice(0, 4000),
          confidence: typeof input.offline.confidence === 'number' ? input.offline.confidence : null,
          ms: Number.isFinite(input.offline.ms as number) ? Number(input.offline.ms) : 0,
          error: input.offline.error ? String(input.offline.error).slice(0, 140) : null,
        }
      : input.runOffline === true
        ? await readWithOfflineEngine(Buffer.from(input.base64, 'base64'), input.ocrBudgetMs ?? 40_000)
        : // Not run, and not a failure to hide: a caller that wants this witness has to ask
          // for it by name, because by default it costs 40 seconds and returns nothing.
          { ran: false, text: '', confidence: null, ms: 0, error: 'مطلوب صراحة (runOffline: true)' };

  const ocrSignatures = new Set<string>();
  const ocrNumbers: number[] = [];
  for (const token of ocr.text.match(/[\d٠-٩]+[.,]?[\d٠-٩]*/g) ?? []) {
    const sig = digitSignature(token);
    if (!sig) continue;
    ocrSignatures.add(sig);
    const value = Number(token.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(',', '.'));
    if (Number.isFinite(value) && value > 0 && value < 200) ocrNumbers.push(Math.round(value * 100) / 100);
  }

  // Asked of whoever can read a picture, not of one company that is often out of ceiling —
  // and a reply only counts when it can actually be parsed, so a reader that answers in
  // prose does not end the chain.
  const model = await askVisionAny(PROMPT, input.base64, mime, {
    maxTokens: 700,
    usable: (content) => extractJson(content) !== null,
  });
  const reader = typeof (model as { reader?: unknown }).reader === 'string' ? (model as { reader: string }).reader : null;
  const parsed = model.success ? extractJson(model.content) : null;

  const raw = (parsed ?? {}) as {
    room?: unknown;
    dimensions?: unknown;
    openings?: unknown;
    notes?: unknown;
  };

  const dimensions: SketchDimension[] = (Array.isArray(raw.dimensions) ? raw.dimensions : [])
    .map((entry) => {
      const e = (entry ?? {}) as Record<string, unknown>;
      const meters = asMeters(e.meters ?? e.value ?? e.length);
      const label = String(e.label ?? e.name ?? '').trim().slice(0, 40);
      return meters === null ? null : { label: label || 'ضلع', meters, confirmed: false };
    })
    .filter((d): d is SketchDimension => d !== null)
    .slice(0, 12);

  const openings: SketchOpening[] = (Array.isArray(raw.openings) ? raw.openings : [])
    .map((entry) => {
      const e = (entry ?? {}) as Record<string, unknown>;
      const kind = String(e.kind ?? '').toLowerCase();
      if (kind !== 'door' && kind !== 'window') return null;
      return { kind, widthMeters: asMeters(e.widthMeters ?? e.width) };
    })
    .filter((o): o is SketchOpening => o !== null)
    .slice(0, 12);

  const customerNumbers = (Array.isArray(input.customer) ? input.customer : [])
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0 && value < 200);
  const customerSignatures = new Set<string>();
  for (const value of customerNumbers) {
    for (const form of numberSignatures(Math.round(value * 100) / 100)) customerSignatures.add(form);
  }

  for (const dimension of dimensions) {
    const forms = numberSignatures(dimension.meters);
    const seen = [...forms];
    const by: Witness[] = [];
    if (seen.some((form) => ocrSignatures.has(form))) by.push('pixels');
    if (seen.some((form) => customerSignatures.has(form))) by.push('customer');
    dimension.confirmedBy = by;
    dimension.confirmed = by.length > 0;
  }
  const confirmedCount = dimensions.filter((d) => d.confirmed).length;
  const notes = typeof raw.notes === 'string' ? raw.notes.trim().slice(0, 200) : null;
  const room = typeof raw.room === 'string' ? raw.room.trim().slice(0, 40) : null;

  // Area only from two numbers the second witness actually saw.
  const verified = dimensions.filter((d) => d.confirmed).map((d) => d.meters);
  const areaSqm = verified.length >= 2 ? Math.round(verified[0] * verified[1] * 100) / 100 : null;

  if (!model.success) {
    // The quota is spent, not the measurement. The numbers the pixels showed and the
    // numbers the customer typed are still handed over — as one witness's word,
    // labelled as such, because there is nothing yet to compare them against.
    const alone: SketchDimension[] = [
      ...ocrNumbers
        .filter((value) => value >= 0.2 && value <= 40)
        .map((value) => ({ label: 'من الورقة', meters: value, confirmed: false, confirmedBy: [] as Witness[] })),
      ...customerNumbers.map((value) => ({
        label: 'كتبها العميل',
        meters: Math.round(value * 100) / 100,
        confirmed: false,
        confirmedBy: [] as Witness[],
      })),
    ].slice(0, 12);
    // Say which word is in the list, because «the pixels showed» when no pixel reading ran
    // is a story about a witness that was not there.
    const oneSided: string[] = [];
    if (ocrNumbers.length) oneSided.push('البيكسلات');
    if (customerNumbers.length) oneSided.push('كلام العميل');
    return {
      ok: false,
      failure: `القارئ الذكي مرفوض دلوقتي (${shortError(model.error)}) — ${
        oneSided.length ? `الأرقام دي من ${oneSided.join(' و ')}، وشاهد واحد ما بيكفيش` : 'مفيش رقم جه من شاهد تاني'
      }`,
      room,
      dimensions: alone,
      openings: [],
      areaSqm: null,
      confirmedCount: 0,
      ocr,
      notes,
      reader,
    };
  }
  if (!parsed) {
    // An answer that is not JSON is a different failure from an empty sheet, and
    // telling the owner «the paper had no numbers» would be a lie about his customer.
    return {
      ok: false,
      failure: 'القارئ الذكي ردّ بصيغة مش مفهومة — مبنخترعش أرقام من رد مش مقروء',
      room,
      dimensions: [],
      openings: [],
      areaSqm: null,
      confirmedCount: 0,
      ocr,
      notes,
      reader,
    };
  }
  if (dimensions.length === 0) {
    return {
      ok: false,
      failure: 'الورقة ما فيهاش رقم مكتوب يقدر يتحقق — مبنخترعش مقاسات',
      room,
      dimensions: [],
      openings,
      areaSqm: null,
      confirmedCount: 0,
      ocr,
      notes,
      reader,
    };
  }
  if (confirmedCount === 0) {
    const others: string[] = [];
    if (ocr.ran) others.push('قراءة البيكسلات');
    if (customerNumbers.length) others.push('المقاسات اللي كتبها العميل');
    return {
      ok: false,
      failure: others.length
        ? `ولا رقم من اللي استخرجهم القارئ الذكي طابق ${others.join(' ولا ')} — بيتعرض اقتراح، مش منجز`
        : // The way out is named, because this is the state every reading arrives in now
          // that the pixel engine is not run inside a request: the customer's own numbers
          // are the witness that always answers.
          'ولا رقم طابق شاهد تاني — بيتعرض اقتراح، مش منجز. الشاهد اللي بيجاوب دايماً هو العميل: يكتب مقاساته في ورقته',
      room,
      dimensions,
      openings,
      areaSqm: null,
      confirmedCount,
      ocr,
      notes,
      reader,
    };
  }

  return {
    ok: true,
    failure: null,
    room,
    dimensions,
    openings,
    areaSqm,
    confirmedCount,
    ocr,
    notes,
    reader,
  };
}

/** A quota message is 200 characters of provider prose; the owner needs its first clause. */
function shortError(message: string | undefined | null): string {
  const text = String(message ?? '').replace(/\s+/g, ' ').trim();
  if (!text) return 'سبب غير معروف';
  if (/429|quota|rate/i.test(text)) return 'سقف الدقايق خلص';
  return text.slice(0, 60);
}

/**
 * Compare a stored reading against numbers the customer typed, with the same folding
 * the witnesses already use — so the desk, the passport page and the parser cannot
 * disagree about what «the same number» means.
 */
export function applyCustomerWitness<
  T extends { label: string; meters: number; confirmed?: boolean; confirmedBy?: Witness[] }
>(dimensions: T[], typed: number[]): (T & { confirmed: boolean; confirmedBy: Witness[] })[] {
  const signatures = new Set<string>();
  for (const value of typed.map((v) => Number(v)).filter((v) => Number.isFinite(v) && v > 0)) {
    for (const form of numberSignatures(Math.round(value * 100) / 100)) signatures.add(form);
  }

  return dimensions.map((dimension) => {
    const forms = [...numberSignatures(dimension.meters)];
    const by: Witness[] = Array.isArray(dimension.confirmedBy) ? [...dimension.confirmedBy] : [];
    if (forms.some((form) => signatures.has(form)) && !by.includes('customer')) by.push('customer');
    return { ...dimension, confirmed: by.length > 0, confirmedBy: by };
  });
}

/**
 * Was there no reading at all, as opposed to a reading that disagrees?
 *
 * Measured 2026-10-07: the cloud reader refused on the published store, so a paper arrived with zero
 * numbers and its owner could never seal his own sheet. Refusing to seal a disagreement is the rule;
 * refusing to seal an absence punishes the customer for a witness that never showed up.
 */
export function readerAbsent(row: { ok?: boolean | null; failure?: string | null } | null): boolean {
  return row?.ok === false && /مرفوض|مش مفهومة/.test(String(row?.failure ?? ''));
}

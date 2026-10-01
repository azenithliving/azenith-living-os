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

import { askGoogleVision } from '@/lib/ai-orchestrator';

export type SketchDimension = { label: string; meters: number; confirmed: boolean };
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

/** One pass of the offline engine, with a budget: a slow reader must not hang the door. */
async function readWithOfflineEngine(
  imageBuffer: Buffer,
  budgetMs: number
): Promise<SketchReading['ocr']> {
  const started = Date.now();
  try {
    const outcome = await Promise.race([
      import('tesseract.js').then(async ({ createWorker }) => {
        const worker = await createWorker('ara+eng');
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
}): Promise<SketchReading> {
  const mime = input.mime || 'image/png';

  // The free reader first: it costs nothing, answers in well under a second once its
  // data is warm, and it is the witness that survives a throttled model quota.
  const ocr = await readWithOfflineEngine(Buffer.from(input.base64, 'base64'), input.ocrBudgetMs ?? 12_000);
  const ocrSignatures = new Set<string>();
  const ocrNumbers: number[] = [];
  for (const token of ocr.text.match(/[\d٠-٩]+[.,]?[\d٠-٩]*/g) ?? []) {
    const sig = digitSignature(token);
    if (!sig) continue;
    ocrSignatures.add(sig);
    const value = Number(token.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(',', '.'));
    if (Number.isFinite(value) && value > 0 && value < 200) ocrNumbers.push(Math.round(value * 100) / 100);
  }

  const model = await askGoogleVision(PROMPT, input.base64, mime, { maxTokens: 700 });
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

  for (const dimension of dimensions) {
    dimension.confirmed = ocrSignatures.has(digitSignature(dimension.meters));
  }
  const confirmedCount = dimensions.filter((d) => d.confirmed).length;
  const notes = typeof raw.notes === 'string' ? raw.notes.trim().slice(0, 200) : null;
  const room = typeof raw.room === 'string' ? raw.room.trim().slice(0, 40) : null;

  // Area only from two numbers the second witness actually saw.
  const verified = dimensions.filter((d) => d.confirmed).map((d) => d.meters);
  const areaSqm = verified.length >= 2 ? Math.round(verified[0] * verified[1] * 100) / 100 : null;

  if (!model.success) {
    // The quota is spent, not the measurement. The numbers the pixels showed are
    // still handed over — as one witness's word, labelled as such.
    const alone = ocrNumbers
      .filter((value) => value >= 0.2 && value <= 40)
      .slice(0, 12)
      .map((value) => ({ label: 'من الورقة', meters: value, confirmed: false }));
    return {
      ok: false,
      failure: ocr.ran
        ? `القارئ الذكي مرفوض دلوقتي (${shortError(model.error)}) — الأرقام دي شوفت في البيكسلات بس، وشاهد واحد ما بيكفيش`
        : `القارئ الذكي مرفوض والمحلي ما كملش (${shortError(model.error)})`,
      room,
      dimensions: alone,
      openings: [],
      areaSqm: null,
      confirmedCount: 0,
      ocr,
      notes,
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
    };
  }
  if (!ocr.ran) {
    return {
      ok: false,
      failure: `المحرك المحلي ما كملش القراءة (${ocr.error || 'سبب غير معروف'}) — الرقم من شاهد واحد ومتعلّمتش كمنجز`,
      room,
      dimensions,
      openings,
      areaSqm: null,
      confirmedCount,
      ocr,
      notes,
    };
  }
  if (confirmedCount === 0) {
    return {
      ok: false,
      failure: 'ولا رقم من اللي استخرجهم القارئ الذكي ظهر في قراءة البيكسلات — بيتعرض اقتراح، مش منجز',
      room,
      dimensions,
      openings,
      areaSqm: null,
      confirmedCount,
      ocr,
      notes,
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
  };
}

/** A quota message is 200 characters of provider prose; the owner needs its first clause. */
function shortError(message: string | undefined | null): string {
  const text = String(message ?? '').replace(/\s+/g, ' ').trim();
  if (!text) return 'سبب غير معروف';
  if (/429|quota|rate/i.test(text)) return 'سقف الدقايق خلص';
  return text.slice(0, 60);
}

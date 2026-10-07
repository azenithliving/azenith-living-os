/**
 * dossier.ts — the golden pre-call file: what the owner should have read before he dials.
 *
 * The plan asked for a screen that shows, before the call, the customer's drawing, its
 * dimensions, the colours he is drawn to, his area, and the pieces he kept looking at. Three
 * of those five have a real source in this store tonight; two do not, and this module says so
 * in the same voice it uses for the things it can show. That is the whole design rule: a
 * dossier that fills a gap with a guess is worse than no dossier, because the owner walks into
 * a call trusting it.
 *
 * What is read, from where:
 *  - the man: the customers roll (`lib/customers/read.ts`) — one line per human, counted from
 *    every space he has stood in.
 *  - the paper: `room_sketches` rows whose `customer_key` is his roll key.
 *  - the colours: the dominant colour the image bank stores on every picture it holds.
 *
 * What has no source, and is printed as missing:
 *  - his area: no address, city or governorate is stored anywhere (measured across the seven
 *    tables a customer can stand in).
 *  - the pieces he browsed: there is no product-view log; the only trace kept is the last
 *    page he stood on, which is shown under browsing instead of being dressed up as history.
 *
 * The second rule is the store's own: nothing on this screen may carry a Latin run inside an
 * Arabic line. The columns are messier than the surfaces that read them assumed (measured here
 * 2026-10-02, 23 profile rows): `room_type` holds both «مجلس رجال» and «Kids Bedroom», `style`
 * holds «نيوكلاسيك» next to the page slug «elite-brief», `budget` holds «120k-200k» next to
 * «5,500 - 12,000 EGP». Every value passes through `arabicOnly`, which translates the spellings
 * this store has actually produced and drops what it cannot say in Arabic. A dropped value
 * makes a smaller file; a slug on his phone makes an unreadable one.
 */
import { foldArabic } from "@/lib/arabic";
import { arDigits, arNum } from "@/lib/ops/metricLabels";
import type { SheetImage } from "@/lib/cad/sheet-images";
import { tallyVotes, topPicks, type VoteRow } from "@/lib/cad/vote-keys";
import type { SketchDimension } from "@/lib/cad/paper-sketch-parser";
import { SHAPE_LABELS, planFromPaper, type Plan } from "@/lib/cad/plan";
import { FAMILY_LABELS } from "@/lib/cad/palette";
import type { ColourPick } from "@/lib/cad/colours";
import type { CustomerRow } from "@/lib/customers/roll";
import { phoneForms } from "@/lib/customers/identity";

export type DossierFact = { label: string; value: string };

export type DossierSection = {
  id: "who" | "paper" | "taste" | "colours" | "family" | "missing";
  title: string;
  facts: DossierFact[];
  /** Colours are swatches, not words: hex values the bank measured off the pictures. */
  swatches?: string[];
  /** The colours he himself stopped on, as the sheet recorded them. */
  chosen?: Array<{ hex: string; label: string }>;
  /** The pictures the family itself stopped on, with who stopped. */
  picks?: Array<{ url: string; likes: number; voters: string[] }>;
  /** What this store cannot answer about him, said out loud. */
  missing?: string[];
};

export type DossierSketch = {
  id: number;
  token: string | null;
  room: string | null;
  /** The area in his own words, captured when he asked for his suggestions on WhatsApp. */
  customer_city?: string | null;
  dimensions: SketchDimension[];
  /** Doors and windows the paper mentions, as the reading stored them. */
  openings?: { kind: string; widthMeters: number | null }[];
  /** The room already walked from this paper's numbers, if the store ever walked it. */
  plan?: Plan | null;
  /** The colours he chose on his own sheet — up to three, each a colour the bank really holds. */
  colour_picks?: ColourPick[] | null;
  area_sqm: number | string | null;
  ok: boolean;
  confirmed_at: string | null;
  frozen_hash: string | null;
  created_at: string;
};

export function buildDossier(input: {
  line: CustomerRow | null;
  sketches: DossierSketch[];
  images: SheetImage[];
  imagesRoomType: string;
  imagesForHisRoom: boolean;
  /** The family's taps on his papers, as the vote desk recorded them. */
  votes?: VoteRow[];
}): { headline: string; sections: DossierSection[]; plan: Plan | null; plan_question: string | null } {
  const { line, sketches, images } = input;
  const newest = sketches[0] ?? null;

  // The owner's file and the customer's sheet must show one room, not two readings of it. The
  // stored drawing is used where it exists; where a paper predates the column the same builder
  // walks it, and where the numbers genuinely do not decide a shape the file says what to ask.
  const drawing = newest
    ? newest.plan
      ? { plan: newest.plan, question: (newest.plan.conflicts ?? [])[0] ?? null }
      : planFromPaper({ dimensions: newest.dimensions, openings: newest.openings ?? [] })
    : { plan: null, question: null as string | null };

  const who: DossierFact[] = [];
  const name = personName(line?.name);
  if (name) who.push({ label: "الاسم", value: name });
  if (line?.phone) who.push({ label: "الموبايل", value: arDigits(line.phone) });
  const intent = intentLabel(line?.intent);
  if (intent) who.push({ label: "نيّته من كلامه", value: intent });
  const budget = budgetLabel(line?.budget);
  if (budget) who.push({ label: "الميزانية اللي هو قالها", value: budget });
  who.push({
    label: "مكانه من الدفتر",
    value: `${arNum(line?.spaces.length ?? 0)} مكان: ${(line?.spaces ?? []).map(spaceLabel).join("، ") || "ولا مكان"}`,
  });
  who.push({
    label: "آخر مرة لمسته",
    value: line?.lastTouch ? `${whenLabel(line.lastTouch)} · ${line.freshness.label}` : "مفيش تاريخ مسجل",
  });
  if (line?.needsReply) who.push({ label: "حالًا", value: "محتاج رد — هو مستني من أكتر من يوم" });

  const paper: DossierFact[] = [];
  if (newest) {
    const agreed = newest.dimensions.filter((d) => d.confirmed);
    // One source for the area: the room the store drew. `area_sqm` holds it once anyone confirms;
    // before that a closed drawing still measures itself, and the file must not contradict the
    // picture sitting above it. Only when there is no drawing does it fall back to the paper's own
    // named pair, and only then say «متحسبتش».
    const area =
      Number(newest.area_sqm) ||
      (drawing.plan?.complete ? Number(drawing.plan.areaSqm) : 0) ||
      derivedArea(newest.dimensions);
    paper.push({ label: "عدد أوراقه", value: arNum(sketches.length) });
    paper.push({ label: "أحدث ورقة", value: roomLabel(newest.room) || "مكان من غير اسم على الورقة" });
    if (newest.customer_city) paper.push({ label: "منطقته", value: newest.customer_city });
    paper.push({
      label: "الأبعاد",
      value: newest.dimensions.length
        ? newest.dimensions.map((d) => `${dimLabel(d.label)} ${arNum(d.meters)} متر${d.confirmed ? " · متفق عليه" : ""}`).join(" | ")
        : "مفيش رقم اتقرا",
    });
    paper.push({
      label: "المساحة",
      value: area ? `${arNum(round2(area))} متر مربع` : "متحسبتش — محتاجة طول وعرض بيتفق عليهم",
    });
    // The room as drawn is what the two of you are actually agreeing to. When the numbers do not
    // decide a shape, the file prints the question rather than a shape it invented.
    paper.push({
      label: "شكل المكان",
      value: drawing.plan
        ? `${SHAPE_LABELS[drawing.plan.shape]} · ${drawing.plan.complete ? "أرقامه مطابقة" : "أرقامه مش مطابقة"}`
        : drawing.question ?? "الشكل لسه ما اتحددش — اسأله هو مرسومه إزاي",
    });
    paper.push({
      label: "اتفاقك معه",
      value: newest.confirmed_at
        ? `أكد ${arNum(agreed.length)} من ${arNum(newest.dimensions.length)} مقاس${newest.frozen_hash ? " والورقة مختومة" : ""}`
        : "لسه ماأكدش مقاساته — ابعتله ورقته",
    });
    if (newest.token) {
      // The sheet's own address is a link the screen renders as its own element, never a Latin
      // path inside an Arabic sentence — on a phone that reads as scrambled letters.
      paper.push({ label: "ورقته على الإنترنت", value: "عنده صفحة خاصة بيأكد عليها مقاساته — الزر تحت الرسم" });
    }
    if (!newest.ok) {
      paper.push({ label: "قراءتنا للورقة", value: "الورقة دي ما اتقراش لحد الآن — دي أول حاجة تسأله عليها" });
    }
  } else {
    paper.push({ label: "ورقته", value: "مفيش ورقة متصورة له — اطلب الرسمة على الواتساب وارفعها" });
  }

  const looking = line?.looking ?? null;
  const timing = timingLabel(looking?.serviceType);
  const taste: DossierFact[] = [];
  const room = roomLabel(looking?.roomType);
  const style = arabicOnly(looking?.style);
  const service = timing ? null : arabicOnly(looking?.serviceType);
  const page = pageLabel(looking?.lastPage);
  if (room) taste.push({ label: "الغرفة اللي بيدوّر عليها", value: room });
  if (style) taste.push({ label: "الطراز اللي كتبه", value: style });
  if (timing) taste.push({ label: "وقته", value: timing });
  // The same column carries «تصميم وتنفيذ» and «1-3 Months» in this store: two labels, because
  // calling a service a deadline is how a file starts being disbelieved.
  if (service) taste.push({ label: "الخدمة اللي طلبها", value: service });
  if (page) taste.push({ label: "آخر صفحة وقف عندها", value: page });
  const tasteMissing = taste.length ? undefined : ["المتجر ما سجلش عنه حاجة وهو بيتصفح — اسأله هو اللي بيديك أدق معلومة."];

  const swatches = [...new Set(images.map((i) => i.color).filter((c): c is string => Boolean(c)))].slice(0, 8);

  // The family's own taps. Printed as pictures and names, because «they liked three pieces»
  // tells the owner nothing he can use on the phone; the picture he can point at and say
  // «اللي بعتوه دي».
  const votes = input.votes ?? [];
  const tallies = tallyVotes(votes);
  const voters = [...new Set(votes.map((vote) => vote.voter))];
  const liked = tallies.filter((tally) => tally.likes > 0);
  const picks = topPicks(liked, 3)
    .filter((tally) => typeof tally.url === "string" && tally.url.startsWith("http"))
    .map((tally) => {
      // The bank keeps a small copy of every picture. The owner opens this file on a phone
      // before a call, so the full-size original is the wrong thing to download three of.
      const known = images.find((image) => image.id !== null && `i${image.id}` === tally.image_key);
      return { url: known?.thumb?.startsWith("http") ? known.thumb : String(tally.url), likes: tally.likes, voters: tally.voters };
    });
  const family: DossierFact[] = voters.length
    ? [
        { label: "عدد اللي صوتوا", value: arNum(voters.length) },
        { label: "أسمائهم زي ما كتبوا", value: voters.join("، ") },
        { label: "قطع وقفوا عندها", value: arNum(liked.length) },
      ]
    : [];

  // His own picks, read off the newest paper that carries them. A colour he chose is a fact from
  // him, so it is printed apart from the bank's palette rather than mixed into it.
  const chosen = (sketches.find((sketch) => Array.isArray(sketch.colour_picks) && sketch.colour_picks.length) ?? null)?.colour_picks ?? [];

  const sections: DossierSection[] = [
    { id: "who", title: "اللي هتكلّمه", facts: who },
    { id: "paper", title: "رسمته", facts: paper },
    { id: "taste", title: "اللي بيدوّر عليه", facts: taste, missing: tasteMissing },
    {
      id: "colours",
      title: input.imagesForHisRoom ? "ألوان الصور اللي لمكانه" : "ألوان من البيت العام — مكانه مش في البنك",
      facts: [{ label: "عدد الصور", value: arNum(images.length) }],
      swatches,
      chosen: chosen.map((pick) => ({ hex: pick.hex, label: FAMILY_LABELS[pick.family] ?? "لون اختاره" })),
      missing: swatches.length ? undefined : ["البنك ما بيخزّنش لون مسيطر على الصور دي."],
    },
    {
      id: "family",
      title: voters.length ? "اللي العائلة اختارته" : "غرفة قرار العائلة — لسه محدش صوت",
      facts: family,
      picks: picks.length ? picks : undefined,
      missing: voters.length ? undefined : ["حد يفتح الرابط ويضغط «أحبها» على قطعة — لسه محدش عمل ده."],
    },
    {
      id: "missing",
      title: "اللي مش معروف عنه",
      facts: [],
      missing: [
        // He says his area himself when he asks for his suggestions on WhatsApp; until he
        // does, the file admits the gap instead of guessing a delivery zone.
        ...(sketches.some((s) => s.customer_city)
          ? []
          : ["منطقته الجغرافية: مفيش عنوان بيتسجل في أي سجل من سجلات المتجر."]),
        ...(voters.length
          ? []
          : ["أكثر القطع اللي بص عليها: مفيش سجل مشاهدة — اللي موجود آخر صفحة وقف عندها بس."]),
      ],
    },
  ];

  // His mobile is printed the way he dials it — the stored key drops the leading zero on purpose,
  // and a number without it is not a number this owner can call.
  const headline = line
    ? `${name || "عميل من غير اسم"}${phoneForms(line.phone) ? ` · ${arDigits(phoneForms(line.phone)!.display)}` : ""} · ${arNum(sketches.length)} ورقة`
    : "اختار عميل من الدفتر الأول";

  return { headline, sections, plan: drawing.plan, plan_question: drawing.plan ? null : drawing.question };
}

const INTENTS: Record<string, string> = { browsing: "بيتفرج بس", interested: "مهتم", buyer: "ناوي يشتري", quote: "عايز عرض" };
const SPACES: Record<string, string> = {
  profile: "كشفه",
  conversation: "كلامه مع الموظف",
  quote: "طلب عرض",
  form: "فورم الاهتمام",
  order: "طلب",
  appointment: "موعد",
  paper: "ورقته",
  conversion: "تحوّل",
};
/** The pages this store has actually recorded a customer standing on. */
const PAGES: Record<string, string> = {
  "/elite-brief": "ملخص النخبة",
  "/request": "اطلب عرض",
  "/products": "المنتجات",
  "/rooms": "الغرف",
  "/contact": "التواصل",
};
/** The timing answers the site's own form writes, keyed on their letters and digits only. */
const WHEN_WANTS: Record<string, string> = {
  immediate: "عايز حالًا",
  "13months": "في تلات شهور",
  "36months": "في نص سنة",
  "612months": "في سنة",
  flexible: "وقته مفتوح",
};
/**
 * Every English room spelling measured in this store's own columns, with the seven types the
 * image bank files its pictures under folded into the same names. Latin and unlisted is dropped.
 */
const ROOMS: Record<string, string> = {
  "master bedroom": "غرفة النوم الرئيسية",
  "living room": "الصالة والمعيشة",
  "dining room": "السفرة",
  "children room": "غرف الأطفال",
  "kids bedroom": "غرف الأطفال",
  "guest bedroom": "غرف الضيوف",
  "teen room": "غرف المراهقين",
  "corner sofa": "الركنة",
  "comprehensive interior": "المنزل بالكامل",
  "full unit": "الوحدة كاملة",
  "kitchen": "المطبخ",
  "dressing room": "غرفة الملابس",
};

/**
 * The shape a value has to take before it can be printed: Latin words out (the site glues them
 * on itself — «مودرن (Modern)», «(VIP - فيلا ميفيدا)»), brackets and dangling dashes out, his
 * digits in. What survives is still what the store recorded; nothing here is reworded.
 */
const arabicShape = (text: string) =>
  text
    .replace(/[A-Za-z][A-Za-z0-9._+/-]*/g, " ")
    .replace(/[（）()]/g, " ")
    .replace(/\s*[-–]\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * A human's name is the one value this file may print in Latin: a line with no Arabic in it does
 * not flip the bidi rendering, and dropping the name would hide who he is going to dial. What is
 * dropped is the tag the site's own form glued to it, not the man.
 */
function personName(raw: string | null | undefined): string | null {
  const inArabic = arabicOnly(raw);
  if (inArabic) return inArabic;
  // Latin-only: the name stays whole, because a line with no Arabic in it does not scramble.
  const text = String(raw ?? "").replace(/[（）()]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  return text || null;
}

/** A measure has a name. If the reader wrote one he cannot read, it is a side — that is true. */
const dimLabel = (raw: string | null | undefined): string => arabicOnly(raw) ?? "ضلع";

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * The area the paper never stated. Multiplying any two confirmed numbers would be the kind of
 * tidy lie this file exists to avoid, so the product is only taken when the two sides say which
 * they are — one length and one width, both agreed by him.
 */
function derivedArea(dims: SketchDimension[]): number | null {
  const agreed = dims.filter((d) => d.confirmed && Number.isFinite(d.meters) && d.meters > 0);
  const length = agreed.find((d) => foldArabic(d.label ?? "").includes("طول"));
  const width = agreed.find((d) => foldArabic(d.label ?? "").includes("عرض"));
  if (!length || !width) return null;
  return length.meters * width.meters;
}

/** `master-bedroom` and `Master Bedroom ` are one room to this store. */
const keyOf = (raw: string | null | undefined) =>
  String(raw ?? "").trim().toLowerCase().replace(/[-_\s]+/g, " ").replace(/[^a-z0-9 ]/g, "").trim();

/**
 * The one gate every value passes before it reaches his screen: Arabic in, Arabic out; a known
 * machine word in, its Arabic name out; anything else null, and no fact printed.
 */
export function arabicOnly(raw: string | null | undefined): string | null {
  const text = String(raw ?? "").trim();
  if (!text) return null;
  if (/\p{Script=Arabic}/u.test(text)) return arDigits(arabicShape(text)) || null;
  return ROOMS[keyOf(text)] ?? null;
}

/** A room name — handwriting, English spelling or bank slug — said the way he reads it. */
export function roomLabel(raw: string | null | undefined): string | null {
  return ROOMS[keyOf(raw)] ?? arabicOnly(raw);
}

function intentLabel(raw: string | null | undefined): string | null {
  return INTENTS[keyOf(raw)] ?? arabicOnly(raw);
}

function timingLabel(raw: string | null | undefined): string | null {
  return WHEN_WANTS[keyOf(raw).replace(/ /g, "")] ?? null;
}

function pageLabel(path: string | null | undefined): string | null {
  const clean = String(path ?? "").split("?")[0].trim();
  if (!clean) return null;
  return PAGES[clean] ?? null;
}

/**
 * The budget ranges the site's own form writes — «120k-200k», «3M-5M», «300k+», and the one
 * «5,500 - 12,000 EGP» it also holds. What this cannot read is dropped: «k» and «EGP» are Latin,
 * and a range is not worth an unreadable line.
 */
export function budgetLabel(raw: string | null | undefined): string | null {
  const text = String(raw ?? "").trim();
  if (!text) return null;
  const pair = (from: number, to: number, unit: string) =>
    `من ${arNum(from)} إلى ${arNum(to)}${unit ? ` ${unit}` : ""} جنيه`;
  const thousands = text.match(/^(\d+(?:\.\d+)?)\s*k\s*[-–]\s*(\d+(?:\.\d+)?)\s*k$/i);
  if (thousands) return pair(Number(thousands[1]), Number(thousands[2]), "ألف");
  const millions = text.match(/^(\d+(?:\.\d+)?)\s*m\s*[-–]\s*(\d+(?:\.\d+)?)\s*m$/i);
  if (millions) return pair(Number(millions[1]), Number(millions[2]), "مليون");
  const open = text.match(/^(\d+(?:\.\d+)?)([km])\+$/i);
  if (open) return `أكثر من ${arNum(Number(open[1]))} ${keyOf(open[2]) === "m" ? "مليون" : "ألف"} جنيه`;
  const money = text.match(/^([\d.,]+)\s*[-–]\s*([\d.,]+)\s*(?:egp|جنيه)?$/i);
  if (money) {
    const from = Number(money[1].replace(/[.,]/g, ""));
    const to = Number(money[2].replace(/[.,]/g, ""));
    if (Number.isFinite(from) && Number.isFinite(to)) return pair(from, to, "");
  }
  return arabicOnly(text);
}

function spaceLabel(raw: string): string {
  return SPACES[raw] ?? raw;
}

function whenLabel(iso: string): string {
  const hours = Math.max(0, (Date.now() - Date.parse(iso)) / 3600e3);
  if (!Number.isFinite(hours)) return "مفيش تاريخ";
  if (hours < 1) return "من دقايق";
  if (hours < 24) return `من ${arNum(Math.round(hours))} ساعة`;
  return `من ${arNum(Math.round(hours / 24))} يوم`;
}

/** The link the customer's own sheet is opened by — kept as a path, never a machine id. */
export function paperPath(token: string): string {
  return `/passport/${token}`;
}

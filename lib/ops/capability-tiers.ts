/**
 * capability-tiers.ts — what still works when no model answers.
 *
 * The owner's law, stated 2026-10-01: everything the dashboard does that needs
 * intelligence must keep working with zero keys. That is not achieved by pretending a
 * server thinks for free — open-ended Arabic writing and reading a hand-drawn picture
 * need a model, and no honest $0 path exists around that. It is achieved by giving every
 * capability a floor it cannot fall below, and by never letting a surface go blank or
 * answer with machine prose when the model is away.
 *
 * Three tiers, and a surface says which one answered:
 *  ١ قواعد وحساب — no key, no cost, always on (the anomaly math, the constitution rules,
 *    the cold clock, the command search, the roll's counting rule).
 *  ٢ جهاز المالك — the phone's own engine: his voice in and out today, and the pixel
 *    reading, which is the only place that engine has ever finished.
 *  ٣ مفاتيحه — free writing and picture reading. Away means refused, queued and said.
 *
 * This module is the ledger of those claims, kept pure so a guard can read it: a
 * capability that declares no floor is a capability that goes dark when a key dies, and
 * the test suite fails on that instead of the owner finding it on a Tuesday.
 */

export type CapabilityTier = "rules" | "device" | "model";

export type Capability = {
  id: string;
  /** What the owner calls it, in his words. */
  label: string;
  /** One line on what it actually does — not what its name promises. */
  does: string;
  /** Tier ١: what answers with no key and no cost. Never empty, never a promise. */
  floor: string;
  /** Tier ٢: what his own device does without a key. Empty string means nothing does. */
  device: string;
  /** Tier ٣: what only a model can do, and what happens while it is away. */
  model: string;
};

export const CAPABILITIES: Capability[] = [
  {
    id: "chat",
    label: "موظفك يفهمك",
    does: "بيقولك الأمر اللي اتفهم، والمهمة اللي اتنفذت، واللي محتاج سؤال يرجع يسألك.",
    floor: "أوامرك المعروفة بتتفهم بقواعد وأنماط محفوظة وبحث في كابينة الأوامر قبل أي نداء لنموذج — فالطلب المتكرر بيتنفذ ومفيش مفتاح مطلوب.",
    device: "صوتك بيتحوّل لكلام جوه متصفح موبايلك، والرد بيتنطق في المتصفح: صفر مفتاح وصفر تكلفة.",
    model: "الرد الحر بالصياغة العربية. غايب يعني رفض واضح والمهمة تتسجّل، مش شاشة فاضية.",
  },
  {
    id: "paper-desk",
    label: "قراءة ورقة العميل",
    does: "بيحوّل الرسم المرسوم بالقلم لأرقام متفق عليها بينك وبين العميل.",
    floor: "الورقة بتتصوّر وبتتسجّل بصورتها وبسبب الرفض لو الرقم ما اتأكدش، والعميل بيكتب مقاساته بنفسه في ورقته — القياس ده مبيتخمنش.",
    device: "قراءة البيكسلات مكانها الصحيح جهازك انت: هي الوحيدة اللي بتخلص هناك فعلًا.",
    model: "استخراج الضلع والباب من الرسم. غايب يعني المقاسات كلها بتيجي من العميل، والورقة لسه ليها صاحب.",
  },
  {
    id: "surveillance",
    label: "رقابة الموقع",
    does: "بيلاقي الشذوذ في الأرقام وبيحكّي حالة المتجر.",
    floor: "كشف الشذوذ حساب إحصائي على نافذة زمنية: الوسيط والمدى هما الأساس، مش المتوسط اللي تسحبه قمة واحدة — والتقرير بياخد أرقامه من السجلات نفسها. كل ده بصفر مفتاح.",
    device: "",
    model: "صياغة الحكاية اليومية بجمل عربية. غايب يعني الأرقام تتعرض في قالبها الثابت من غير تزيين.",
  },
  {
    id: "security",
    label: "حماية الموقع",
    does: "بيمنع أي تنفيذ خارج الدستور، وبيقرا النية قبل ما ينفّذ.",
    floor: "محرّك الدستور قواعد مكتوبة في ملف بتسمح أو ترفض قبل أي تنفيذ، وبوابات الحراسة على الواجهات شغالة دايمًا — مفيش نموذج في الطريق ده.",
    device: "",
    model: "تلخيص سبب الرفض في جملة مفهومة. غايب يعني السبب الخام بيتعرض زي ما هو.",
  },
  {
    id: "image-analysis",
    label: "تحليل الصور",
    does: "بيختار صور المكان لورقة العميل وبيوصف صورة مرفوعة.",
    floor: "بنك الصور المحلي ببياناته (نوع المكان والستايل) هو اللي بيختار، والورقة بتقول صراحة لو مكان العميل مش في البنك.",
    device: "",
    model: "وصف صورة مرفوعة بكلام حر. غايب يعني الصورة تتعرض باسمها ونوعها من غير اختراع وصف.",
  },
  {
    id: "follow-up",
    label: "متابعة العملاء",
    does: "بيقولك مين استنى أطول فترة ومين محتاج رد دلوقتي.",
    floor: "ساعة البرودة محسوبة من آخر لمسة لكل عميل، والدفتر بيعدّ من كل الأماكن مرة واحدة — القايمة دي مفيهاش نموذج.",
    device: "",
    model: "رسالة المتابعة المكتوبة. غايب يعني الاسم ورقمه ومدة انتظاره يتعرضوا، والرسالة انت تكتبها.",
  },
  {
    id: "customer-analysis",
    label: "قراءة العميل",
    does: "بيقولك مين اللي مستني رد، وإيه اللي لفت نظره، وإيه الخطوة الجاية قبل ما تكلّمه.",
    floor: "الملف الذهبي قبل المكالمة بيجاوب من السجلات نفسها: كلامه في الدفتر، ورسمته ومقاساته، وآخر صفحة وقف عندها، ومدة انتظاره محسوبة — وده كله بصفر مفتاح.",
    device: "",
    model: "الصياغة الحرة لقراءة العميل واقتراحات الرد. غايب يعني الأرقام والانتظار والرادار يتعرضوا في قالبهم الثابت، والرد انت تكتبه.",
  },
];

/** Shown wherever a model answer was expected and none was available. */
export const NO_KEY_MESSAGE = "مفيش مفتاح شغال دلوقتي — المتجر ما بيخترعش رد";

export const QUOTA_MESSAGE = "سقف الدقايق خلص عند المزود — هنعاود، والطلب اتسجّل";

/** Every provider answered badly. The old text was English machine prose shown to a man. */
export const ALL_PROVIDERS_MESSAGE = "ولا مزود ردّ رد مقبول — المتجر ما بيخترعش رد عشان يسدّ مكانه";

/** Why a model answer did not arrive — so a surface can fall to its floor, not to prose. */
export type ModelFailureReason = "no_key" | "quota" | "failed";

/**
 * Read a model failure back into a reason. The strings compared are the ones this store
 * emits, so a surface can fall to its floor without a caller parsing English prose.
 */
export function modelFailureReason(message: unknown): ModelFailureReason {
  const text = String(message ?? "");
  if (text === NO_KEY_MESSAGE || /no api keys/i.test(text)) return "no_key";
  if (text === QUOTA_MESSAGE || /429|quota|rate/i.test(text)) return "quota";
  return "failed";
}

export function capabilityOf(id: string | null | undefined): Capability | null {
  if (!id) return null;
  return CAPABILITIES.find((c) => c.id === id) ?? null;
}

/**
 * The line a surface prints when the model was supposed to answer and did not. It names
 * the floor that is still standing, so the owner sees what the store can do right now
 * instead of an error string.
 */
export function modelFloorLine(id: string, reason: "no_key" | "quota" | "failed" = "no_key"): string {
  const capability = capabilityOf(id);
  const head = reason === "quota" ? QUOTA_MESSAGE : reason === "failed" ? "النموذج ما ردّش — مفيش رد متخمن" : NO_KEY_MESSAGE;
  if (!capability) return head;
  const device = capability.device ? ` اللي شغال على جهازك: ${capability.device}` : "";
  return `${head}. ${capability.floor}${device}`;
}

/** What the guard counts: a capability without a floor is a surface that goes dark. */
export function keylessCoverage(): { total: number; withFloor: number; withDevice: number } {
  return {
    total: CAPABILITIES.length,
    withFloor: CAPABILITIES.filter((c) => c.floor.trim().length > 0).length,
    withDevice: CAPABILITIES.filter((c) => c.device.trim().length > 0).length,
  };
}

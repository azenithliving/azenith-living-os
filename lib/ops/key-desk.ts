/**
 * key-desk.ts — the free models the store can run on, and how he gets a key for each.
 *
 * The owner asked for a list, not a mystery: which models exist for nothing, what each one
 * is actually good at here, how many of his keys answer right now, and the two steps that
 * get him a key when the count is zero. The numbers come from the database and from a live
 * check; this file carries only what a human needs to act — the address of the key page and
 * one honest line on what the provider is good for in THIS store's work.
 *
 * Nothing here claims a quota figure. A free ceiling is what the provider says on the day,
 * and the only measurement this project trusts is the answer in the response.
 */

export type KeyDeskProvider = {
  /** The id the pool and the router use. */
  id: string;
  /** What the owner sees. */
  label: string;
  /** What it is good for in this store, in one line. */
  good: string;
  /** Where the key is created. */
  keysUrl: string;
  /** Two steps, in his language. */
  steps: string;
};

export const KEY_DESK_PROVIDERS: KeyDeskProvider[] = [
  {
    id: "google",
    label: "جيميني",
    good: "القارئ الوحيد اللي بيفهم رسم اليد على الورقة، وبيعمل ذاكرة المتجر.",
    keysUrl: "https://aistudio.google.com/apikey",
    steps: "ادخل بحساب جوجل بتاعك، ثم اضغط زر «أنشئ مفتاح» واختار أي مشروع. المفتاح بيبدأ بـ AIza.",
  },
  {
    id: "groq",
    label: "جروكس",
    good: "أسرع رد نصي: ده اللي بيشتغل بيه الموظفون في المحادثة السريعة.",
    keysUrl: "https://console.groq.com/keys",
    steps: "سجّل دخول ثم اضغط زر «أنشئ مفتاح». المفتاح بيبدأ بـ gsk_.",
  },
  {
    id: "openrouter",
    label: "أوبن‑روتِر",
    good: "بوّابة على نماذج كتير بمفتاح واحد، وفيها نماذج مجانية تتبدّل لو مزود وقع.",
    keysUrl: "https://openrouter.ai/keys",
    steps: "ادخل بحساب جيميل أو جيت‑هاب ثم اضغط «مفتاح جديد». المفتاح بيبدأ بـ sk-or-v1-.",
  },
  {
    id: "cerebras",
    label: "سيربراس",
    good: "نماذج مفتوحة المصدر بسرعة عالية — بديل كويس للردود الطويلة.",
    keysUrl: "https://cloud.cerebras.ai",
    steps: "أنشئ حساب ثم خد المفتاح من صفحة حسابك. المفتاح بيبدأ بـ sk-cp-.",
  },
  {
    id: "sambanova",
    label: "سامبانوفا",
    good: "نموذج ديب‑سيك الكامل بسرعة عالية: بديل جاهز للكتابة الطويلة والمنطق لما غيرُه يوقع.",
    keysUrl: "https://cloud.sambanova.ai",
    steps: "سجّل بحساب جوجل أو بالإيميل، ثم افتح صفحة مفاتيح واجهة البرمجة من القائمة واضغط «إنشاء مفتاح».",
  },
  {
    id: "together",
    label: "توجيذر",
    good: "النماذج المفتوحة بمقاسات كبيرة، مفيد لتحليل النصوص الطويلة.",
    keysUrl: "https://api.together.ai/settings/api-keys",
    steps: "سجّل ثم ادخل صفحة المفاتيح واضغط «إنشاء». المفتاح بيبدأ بـ tgp_.",
  },
  {
    id: "mistral",
    label: "ميسترال",
    good: "كتابات فرنسية مفتوحة المصدر، جيّدة في العربية الرسمية.",
    keysUrl: "https://console.mistral.ai/api-keys",
    steps: "أنشئ حساب ثم اضغط زر المفتاح الجديد. المفتاح بيبدأ بـ sk-.",
  },
  {
    id: "deepseek",
    label: "ديب‑سيك",
    good: "منطقي قوي في الحساب والمقارنة؛ مفيد في قرارات الصواب والخطأ.",
    keysUrl: "https://platform.deepseek.com/api_keys",
    steps: "سجّل حساب جديد ثم أنشئ مفتاح من صفحة المفاتيح. المفتاح بيبدأ بـ sk-.",
  },
  {
    id: "cohere",
    label: "كوهير",
    good: "بحث دلالي وتلخيص نصوص طويلة.",
    keysUrl: "https://dashboard.cohere.com/api-keys",
    steps: "أنشئ حساب ثم ادخل صفحة المفاتيح وأنشئ واحد. المفتاح بيبدأ بـ AQ.",
  },
  {
    id: "anthropic",
    label: "أنتروبيك",
    good: "دقة في التعليمات الطويلة والمراجعة.",
    keysUrl: "https://console.anthropic.com/settings/keys",
    steps: "أنشئ حساب ثم اضغط «أنشئ مفتاح» في صفحة المفاتيح. المفتاح بيبدأ بـ sk-ant-.",
  },
  {
    id: "openai",
    label: "أوبن‑أي",
    good: "مرجع عام للكتابة؛ غالي نسبيًا فمش أساس هنا.",
    keysUrl: "https://platform.openai.com/api-keys",
    steps: "يحتاج رصيد مدفوع في أغلب الدول، فسيّبه آخر أولوية. المفتاح بيبدأ بـ sk-proj-.",
  },
  {
    id: "huggingface",
    label: "هاجنج‑فيس",
    good: "نماذج عربية مفتوحة زي «علام» و«نايل» للتجربة.",
    keysUrl: "https://huggingface.co/settings/tokens",
    steps: "أنشئ حساب ثم اعمل رمز جديد بصلاحيّة قراءة. المفتاح بيبدأ بـ hf_.",
  },
  {
    id: "xai",
    label: "إكس‑أي",
    good: "نموذج سريع؛ حساباته الجديدة لازم تتفعّل قبل الاستخدام.",
    keysUrl: "https://console.x.ai",
    steps: "بعد إنشاء المفتاح أكمل تفعيل الفريق من صفحته، وإلا كل طلب بيرفض.",
  },
];

export const KEY_DESK_IDS = KEY_DESK_PROVIDERS.map((p) => p.id);

export function keyDeskGuide(id: string): KeyDeskProvider | null {
  return KEY_DESK_PROVIDERS.find((p) => p.id === id) ?? null;
}

/** What one row of the desk means to the owner, in the words the screen prints. */
export function deskVerdict(row: { rows: number; active: number; alive: number; refused: number; quota: number }): string {
  if (row.rows === 0) return "مفيش مفتاح من دول في المتجر";
  if (row.alive > 0) return "فيه مفتاح بيجاوب دلوقتي";
  if (row.quota > 0) return "المفاتيح سليمة بس سقفها خلص دلوقتي";
  if (row.active > 0) return "مفيش تأكيد حيّ — اعمل التحقق";
  return "كلها مرفوضة من المزود";
}

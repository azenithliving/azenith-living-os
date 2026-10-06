/**
 * agent-roles.ts — the real capability catalog per Qayyim agent.
 *
 * Every role string routes to a tool that actually executes
 * (admin-tool-bridge inference → measured probes / DB queries / swarm audit),
 * or to the swarm audit shortcut. No button promises what the backend can't do.
 */

export const AGENT_ROLES: Record<string, string[]> = {
  "ops-lead": [
    "افحص الموقع كله شاملاً وأعطني تقريراً تنفيذياً",
    "نسّق السرب لتحسين الصفحة الرئيسية كاملاً",
    "اعرض المسودات المعلقة للمراجعة والنشر",
    "اعرض أهدافي المهددة هذا الشهر",
    "افحص رؤوس الأمان للصفحة الرئيسية",
    "استعرض ذاكرة الوكلاء",
  ],
  "ops-content": [
    "افحص صحة محتوى الصفحة الرئيسية",
    "أصلح مشاكل الظهور في نتائج البحث للمحتوى الحالي",
    "راجع نص صفحة من نحن واقترح نسخة أفخم",
    "وحد نبرة وصفات الغرف",
  ],
  "ops-visual": [
    "اقترح أفضل صورة هيرو من الصور المنسقة",
    "اعرض المنتجات التي بلا صور كافية",
    "اكتب الوصف البديل العربي لصور غرفة المعيشة",
    "افحص اتساق الهوية البصرية بين الصفحات",
  ],
  "ops-seo": [
    "افحص الظهور في نتائج البحث للصفحة الرئيسية الآن",
    "أصلح مشاكل الظهور في نتائج البحث للموقع",
    "افحص صحة محتوى الصفحة الرئيسية",
    "دقّق سرعة استجابة الصفحة الرئيسية",
  ],
  "ops-ux": [
    "اعرض أهدافي المهددة هذا الشهر",
    "حلّل سلوك الزوار واقترح تحسين تحويل",
    "اقترح تجربة A/B لصفحة الغرف",
    "دقّق سرعة استجابة الصفحة الرئيسية",
  ],
  "ops-analytics": [
    "احسب درجة الفخامة الآن للموقع كله",
    "توقع مبيعات الشهر الجاي بالأرقام",
    "اعرض أهدافي المهددة هذا الشهر",
    "اعرض المؤشرات اللحظية للنظام",
  ],
  "ops-dev": [
    "دقّق سرعة استجابة الصفحة الرئيسية",
    "افحص صحة النظام التقني",
    "اعرض المؤشرات اللحظية للنظام",
    "افحص حالة مفاتيحك",
  ],
  "ops-qa": [
    "شغّل اختبار حمل خفيف على الصفحات العامة",
    "افحص رؤوس الأمان للصفحة الرئيسية",
    "شغّل تدقيق إمكانية الوصول للصفحة الرئيسية والغرف",
    "اعرض أهدافي المهددة هذا الشهر",
  ],
};

/**
 * The sales employee is not a ninth swarm member — the catalog above is the swarm's
 * eight, and three guards count it. His capabilities live with his face in the chat
 * component, and they are the ones the store can really do: read the one customer roll
 * and reach the human behind it. Qualifying «VIP» buyers, collecting deposits, writing
 * contracts, pricing and margins are outside the store's trade by the owner's ruling
 * (٣٠ سبتمبر), so nothing here offers them and a chat that asks gets the written
 * refusal instead.
 */
export const SALES_MANAGER_CAPABILITIES = [
  "اعرض قائمة العملاء",
  "اعرض العملاء المشتريين",
  "اعرض العملاء اللي مستنيين رد",
];

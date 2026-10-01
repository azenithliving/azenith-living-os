/**
 * The office map — where each atom of the old admin house lives in the new one.
 *
 * Two rules make this the thing the owner can trust. First: the atoms come from
 * `scripts/ops-census.mjs`, generated from the repository, so nothing is remembered
 * and nothing is forgotten. Second: assignment is by rule, and a rule that matches
 * nothing leaves the atom UNASSIGNED — a guard then fails and names it. An unmarked
 * nail is therefore a red build, not a silent hole.
 *
 * Read `docs/ledger/contract.md` before editing: offices are frozen by the owner,
 * and a shared machine must never be swallowed into an employee's office.
 */
export type Office = {
  /** Stable id used in the ledger and in the old-house badges. */
  id: string;
  /** The Arabic name the owner reads in the menu. */
  label: string;
  /** Why this office exists — the question of his it answers. */
  answers: string;
  /** Domain employees seated here. Shared machinery is never listed. */
  employees: string[];
};

export const OFFICES: Office[] = [
  {
    id: "decision-desk",
    label: "مكتب القرار",
    answers: "إيه اللي حصل في المتجر النهارده، وإيه اللي محتاج موافقتي",
    employees: ["مدير تشغيل المحتوى"],
  },
  {
    id: "swarm-house",
    label: "دار الموظفين",
    answers: "مين شغال، وإيه اللي عمله، وأقول لمين إيه",
    employees: [
      "وكيل المحتوى", "وكيل الصور", "وكيل الظهور", "وكيل التجربة",
      "وكيل التحليلات", "وكيل التطوير", "وكيل الجودة",
    ],
  },
  {
    id: "sales-office",
    /**
     * Named after the employee, not the room (the owner's word, ٣٠ سبتمبر): the sales
     * office in the new house IS «مدير المبيعات», and vanguard is his body. A room has
     * doors you navigate; an employee is someone you ask.
     */
    label: "مدير المبيعات",
    answers: "مين كلّمنا، وإيه اللي مستنيين ردّه، وإيه اللي وقف",
    employees: ["مدير المبيعات"],
  },
  {
    id: "paper-desk",
    /**
     * The desk, not an employee: what sits here is a machine that reads a hand-drawn
     * room with two witnesses. No agent is seated here yet — the reader answers for
     * itself, and a card for an employee who does not exist is the one thing the
     * command canvas already refuses to show.
     */
    label: "ورق المقاسات",
    answers: "الورقة اللي العميل رسمها بالقلم — إيه اللي بنأكد منه وإيه اللي لأ",
    employees: [],
  },
  {
    id: "elite-room",
    label: "غرفة النخبة",
    answers: "مين لسه على قائمة الانتظار، ومين دخل بالدعوة",
    employees: ["موظف النخبة"],
  },
  {
    id: "records-office",
    label: "مكتب السجلات",
    answers: "إيه اللي اتعمل، ومين عمله، وهل اتنقل فعلاً ولا لأ",
    employees: ["موظف المتابعة"],
  },
  {
    id: "workshop",
    label: "الورشة",
    answers: "أجرب على نسخة من المتجر من غير ما ألمس الأصلي",
    employees: ["موظف التجريب"],
  },
  {
    id: "system-room",
    label: "غرفة النظام",
    answers: "المتجر سليم؟ البيانات متصلة؟ الإعدادات ليه اتغيرت؟",
    employees: ["موظف النظام"],
  },
];

/**
 * Not an office. The sign an atom gets when it is machinery several offices stand
 * on: counted so it can never be forgotten, and never seated inside one employee.
 */
export const SHARED_OFFICE = "shared";

/**
 * Rule order matters: first match wins. `match` is tested against an atom id
 * (a page path, a door resource, a component path). Anything that reaches the end
 * unassigned is a classification we have not made yet — the guard fails on it.
 */
export type OfficeRule = {
  match: RegExp;
  office: string;
  /** Why this rule exists, in one line the owner can read. */
  reason: string;
};

export const OFFICE_RULES: OfficeRule[] = [
  // The leader's own surfaces and the swarm's doors.
  { match: /^app\/admin\/(page|owner-dashboard\/page)\.tsx$/, office: "decision-desk", reason: "نظرة العامة ولوحة المالك كانت بتجاوبين على نفس السؤال" },
  { match: /^app\/admin\/v2\/(page|owner-dashboard)\//, office: "decision-desk", reason: "البيت الجديد بيبدأ من مكتب القرار" },
  { match: /^app\/admin\/(agents|assistant|intel|intelligence)\//, office: "swarm-house", reason: "كل ما له علاقة بالوكلاء في دار واحدة" },
  { match: /^app\/admin\/v2\/agents\//, office: "swarm-house", reason: "نفس الدار في البيت الجديد" },
  { match: /^app\/admin\/sales\//, office: "sales-office", reason: "العميل من السؤال للطلب — الإنتاج مش شغلانة المتجر (قرار المالك ٣٠ سبتمبر)" },
  { match: /^app\/admin\/elite\//, office: "elite-room", reason: "الباب الخاص بالنخبة له عالمه" },
  { match: /^app\/admin\/(browser|computer|phone|sandbox|fate)\//, office: "workshop", reason: "كل التجريب على نسخة في مكان واحد" },
  { match: /^app\/admin\/(work)\//, office: "records-office", reason: "المهام والسجلات" },
  { match: /^app\/admin\/v2\/(work|ledger)\//, office: "records-office", reason: "السجل جزء من مكتب المتابعة" },
  { match: /^app\/admin\/(system|settings|database)\//, office: "system-room", reason: "صحة الموقع وإعداداته" },

  // Service doors, grouped by their first path segment under /api/admin.
  { match: /^app\/api\/admin\/(ops|agents|assistant|mastermind)\//, office: "swarm-house", reason: "أبواب السرب" },
  { match: /^app\/api\/admin\/(sales|leads|tenants|bookings|channels|whatsapp)\//, office: "sales-office", reason: "أبواب العملاء والطلبات" },
  { match: /^app\/api\/admin\/elite\//, office: "elite-room", reason: "أبواب النخبة" },
  { match: /^app\/api\/admin\/(browser|computer|phone|sandbox|automation|simulate-scenario)\//, office: "workshop", reason: "أبواب التجربة" },
  { match: /^app\/api\/admin\/(tasks|decisions|audit|telemetry|work)\//, office: "records-office", reason: "أبواب السجلات والقرارات" },
  { match: /^app\/api\/admin\/(system|settings|database|keys|health|env|config)\//, office: "system-room", reason: "أبواب النظام والمفاتيح" },

  // The furniture that both houses stand on today: it moves to the new tree first.
  { match: /^components\/admin\/sales\//, office: "sales-office", reason: "عفش مدير المبيعات في البيت الجديد" },
  { match: /^components\/admin\/agents\//, office: "swarm-house", reason: "عفش دار الموظفين" },
  { match: /^components\/admin\/ops\//, office: "swarm-house", reason: "عفش الاستوديو والمراقبة" },
  { match: /^components\/admin\/(dashboard|overview)\//, office: "decision-desk", reason: "عفش المؤشرات" },
  { match: /^lib\/ops\//, office: "swarm-house", reason: "جسم السرب نفسه" },

  // Second pass: the doors and furniture the first rules did not reach.
  { match: /^app\/api\/admin\/(2fa|verify-2fa|gate)\//, office: "system-room", reason: "أبواب الدخول والأمان" },
  { match: /^app\/api\/admin\/aaca\//, office: "system-room", reason: "فحص البنية التحتية" },
  { match: /^app\/api\/admin\/ai\//, office: "system-room", reason: "صحة مصادر الذكاء" },
  { match: /^app\/api\/admin\/telegram\//, office: "decision-desk", reason: "القناة اللي بتوصلك رسالة الصبح" },
  { match: /^app\/api\/admin\/owner\//, office: "decision-desk", reason: "أبواب المالك: موافقات وإيقاف طارئ" },
  { match: /^app\/api\/admin\/notifications\//, office: "decision-desk", reason: "اللي يستنى ردك" },
  { match: /^app\/api\/admin\/metrics\//, office: "decision-desk", reason: "المؤشرات اللحظية" },
  { match: /^app\/api\/admin\/agent\//, office: "swarm-house", reason: "أبواب الوكيل الواحد" },
  { match: /^app\/api\/admin\/(intel|images|proactive|quality|knowledge)\//, office: "swarm-house", reason: "أعضاء السرب: الصور والاستخبارات والجودة" },
  { match: /^app\/api\/admin\/(categories|products)\//, office: "swarm-house", reason: "الكتالوج شغلنة وكيل المحتوى" },
  { match: /^app\/api\/admin\/inventory\//, office: "sales-office", reason: "المخزن بره المتجر بقرار المالك — الباب لسه موجود ومحتاج حكم" },
  { match: /^app\/api\/admin\/analyze-lead\//, office: "sales-office", reason: "تقييم العميل المحتمل" },
  { match: /^app\/api\/admin\/(live-browser|remote-browser|architect)\//, office: "workshop", reason: "أبواب التجربة على نسخة" },
  { match: /^components\/admin\/settings\//, office: "system-room", reason: "كروت الإعدادات" },
  { match: /^components\/admin\/browser\//, office: "workshop", reason: "عفش المتصفح الحي" },
  { match: /^components\/admin\/(Notification|GlobalAssistantDock|UnifiedAssistant|AssistantBrowserCopilot)/, office: "swarm-house", reason: "المساعد الموحد والجرس" },
  { match: /^components\/admin\/AIKeysControlPanel/, office: "system-room", reason: "خزان مفاتيح الذكاء" },
  { match: /^components\/admin\/TelegramControlPanel/, office: "decision-desk", reason: "ضبط رسالة الصبح" },
  { match: /^\/api\/cron\/ops-daily$/, office: "swarm-house", reason: "جولة السرب اليومية" },
  { match: /^\/api\/cron\/admin-daily-report$/, office: "decision-desk", reason: "تقريرك اليومي" },
  { match: /^\/admin(\/owner-dashboard)?$/, office: "decision-desk", reason: "أول ما يفتح: مكتب القرار" },
  { match: /^\/admin\/(work)$/, office: "records-office", reason: "المهام" },
  { match: /^\/admin\/(sales)$/, office: "sales-office", reason: "المبيعات" },
  { match: /^\/admin\/(elite)$/, office: "elite-room", reason: "النخبة" },
  { match: /^\/admin\/(agents)$/, office: "swarm-house", reason: "الوكلاء" },
  { match: /^\/admin\/(system|settings|database)$/, office: "system-room", reason: "النظام" },
  { match: /^\/bookings$/, office: "sales-office", reason: "من هنا يبدأ طلب التسعير: أول ملمس للعميل لمدير المبيعات" },
  { match: /^\/elite-intelligence$/, office: "elite-room", reason: "واجهة دعوة النخبة قدام العميل" },

  /**
   * The language toggle is not an employee's screen. The live walk found it as a
   * view on three customer addresses — one machine repeated, owned by nobody, so it
   * gets the shared sign and no office may swallow it.
   */
  { match: /#(EN|AR)$/, office: SHARED_OFFICE, reason: "زرار اللغة مكرر على صفحات العميل — آلة مشتركة مش موظف" },

  /**
   * Address rules for the capability atoms: a view is seated where its address
   * lives. Specific new-house paths come first, then the old ones by their segment.
   */
  { match: /^\/admin\/v2\/(agents|ops)\b/, office: "swarm-house", reason: "دار الموظفين في البيت الجديد" },
  { match: /^\/admin\/v2\/sales\b/, office: "sales-office", reason: "المبيعات في البيت الجديد" },
  { match: /^\/admin\/v2\/elite\b/, office: "elite-room", reason: "النخبة في البيت الجديد" },
  { match: /^\/admin\/v2\/work\b/, office: "records-office", reason: "المتابعة في البيت الجديد" },
  { match: /^\/admin\/v2\/(system|settings|database)\b/, office: "system-room", reason: "النظام في البيت الجديد" },
  { match: /^\/admin\/(agents|assistant|intel|intelligence)\b/, office: "swarm-house", reason: "الوكلاء ومراكزهم في القديم" },
  { match: /^\/admin\/sales\b/, office: "sales-office", reason: "المبيعات في القديم — عنوان الإنتاج بيترد عليه من البوابة الخارجية" },
  { match: /^\/admin\/elite\b/, office: "elite-room", reason: "النخبة في القديم" },
  { match: /^\/admin\/(browser|computer|phone|sandbox|fate)\b/, office: "workshop", reason: "التجريب في القديم" },
  { match: /^\/admin\/work\b/, office: "records-office", reason: "المهام في القديم" },
  { match: /^\/admin\/(system|settings|database)\b/, office: "system-room", reason: "النظام في القديم" },
  { match: /^\/admin\b/, office: "decision-desk", reason: "باقي البيت: مكتب القرار" },

  /**
   * The fence the first census left open, now counted: the doors outside
   * `/api/admin` that an admin surface calls, and the library files at the library
   * root. Measured today: 8 doors (2520 lines) and 40 library files (14955 lines).
   * Most of the latter are machinery several offices stand on, and machinery is
   * never seated inside an employee — it gets the shared sign instead, so the
   * guard can fail a build that tries to swallow it.
   */
  { match: /^app\/api\/consultant\//, office: "swarm-house", reason: "مستشار المتجر وجسمه: آلة السرب" },
  { match: /^app\/api\/(tenant|tenants)\//, office: "system-room", reason: "الشركات والاشتراكات ضبط، مش موظف" },
  { match: /^app\/api\/system-health\//, office: "system-room", reason: "فحص صحة المتجر" },
  { match: /^app\/api\/analytics\//, office: "decision-desk", reason: "الأرقام اللي بتظهر في مؤشراتك" },
  { match: /^app\/api\/omnipotent\//, office: SHARED_OFFICE, reason: "آلة المرآة اللي بتقرأ منها البوابة الخارجية — ما ليهاش مكتب" },
  { match: /^lib\/(lead-insights|leads-delete-guard)\.ts$/, office: "sales-office", reason: "آلة الموظف نفسه: ما بيفتحهاش غير سطح المبيعات وبابه" },
  { match: /^lib\/(?!ops\/)[^/]+\/.*\.ts$|^lib\/[^/]+\.ts$/, office: SHARED_OFFICE, reason: "آلة مشتركة فوقها أكتر من مكتب — ما بتدخلش جوه موظف" },
  { match: /^app\/api\//, office: SHARED_OFFICE, reason: "باب ما بيفتحوش وجه إداري — آلة مستنية التصنيف" },
];

/** Atoms the rules cannot see: they need an explicit decision, not a guess. */
export type ExplicitPlacement = { id: string; office: string; status: string; reason: string };

export const EXPLICIT: ExplicitPlacement[] = [
  { id: "app/admin/v2/page.tsx", office: "decision-desk", status: "pending", reason: "صفحة الهبوط الجديدة" },
  { id: "app/admin/v2/ops/page.tsx", office: "swarm-house", status: "moved", reason: "الاستوديو اتنقل فعلاً" },
  { id: "app/admin/v2/agents/ops/page.tsx", office: "swarm-house", status: "moved", reason: "محادثة الوكلاء اتنقلت فعلاً" },
  { id: "app/admin/v2/database/page.tsx", office: "system-room", status: "pending", reason: "قاعدة البيانات" },
  { id: "app/admin/v2/elite/page.tsx", office: "elite-room", status: "pending", reason: "النخبة" },
  { id: "app/admin/v2/sales/page.tsx", office: "sales-office", status: "moved", reason: "مدير المبيعات — جسده وكيل المبيعات ومكتبه دفتر العميل" },
  { id: "components/admin/CockpitDoors.tsx", office: "decision-desk", status: "moved", reason: "بابا الكابينة في القائمة الجانبية: قرارات مستنية كلمتك بعددها الحيّ، والإيقاف الفوري" },
  { id: "app/admin/v2/sketches/page.tsx", office: "paper-desk", status: "moving", reason: "طاولة الورق: الرفع والحفظ والسجل شغالين — القراءة المحلية متنقلة للمتصفح لأن سيرفر الاستضافة ما بيخلصهاش في الوقت" },
  { id: "app/admin/v2/settings/page.tsx", office: "system-room", status: "pending", reason: "الإعدادات" },
  { id: "app/admin/v2/system/page.tsx", office: "system-room", status: "pending", reason: "حالة النظام" },
  { id: "app/admin/v2/work/page.tsx", office: "records-office", status: "pending", reason: "مركز العمل" },
  { id: "app/admin/layout.tsx", office: "decision-desk", status: "pending", reason: "قشرة البيت القديم" },
  { id: "app/admin/layout-client.tsx", office: "decision-desk", status: "pending", reason: "قشرة البيت القديمة بمكوناتها" },

  /**
   * The grand-name cluster: doors and panels whose names promise more than the code
   * has ever shown. They are deliberately NOT given an office yet — an office is a
   * verdict, and a verdict needs the dossier first (what it really does, where it is
   * duplicated, what is broken, what is missing). `needs-verdict` is the honest
   * fourth state: the owner sees it is not forgotten, and nobody pretends it is home.
   */
  { id: "app/api/admin/arsenal/route.ts", office: "records-office", status: "needs-verdict", reason: "اسم بلا صاحب معروف — ملف كامل بالدليل قبل الدمج أو المسح" },
  { id: "app/api/admin/command/route.ts", office: "records-office", status: "needs-verdict", reason: "اسم بلا صاحب معروف — ملف كامل بالدليل قبل الدمج أو المسح" },
  { id: "app/api/admin/eternal/genesis/route.ts", office: "swarm-house", status: "needs-verdict", reason: "اسم بلا صاحب معروف — ملف كامل بالدليل قبل الدمج أو المسح" },
  { id: "app/api/admin/fate/route.ts", office: "workshop", status: "needs-verdict", reason: "اسم بلا صاحب معروف — ملف كامل بالدليل قبل الدمج أو المسح" },
  { id: "app/api/admin/fate/latest/route.ts", office: "workshop", status: "needs-verdict", reason: "اسم بلا صاحب معروف — ملف كامل بالدليل قبل الدمج أو المسح" },
  { id: "app/api/admin/mind/route.ts", office: "swarm-house", status: "needs-verdict", reason: "اسم بلا صاحب معروف — ملف كامل بالدليل قبل الدمج أو المسح" },
  { id: "app/api/admin/mind/decision/route.ts", office: "swarm-house", status: "needs-verdict", reason: "اسم بلا صاحب معروف — ملف كامل بالدليل قبل الدمج أو المسح" },
  { id: "app/api/admin/prime/route.ts", office: "swarm-house", status: "kept-as-door", reason: "باب المدير الأول: حيّ عشان مفضّلة ومفتاح قديم، مش سطح" },
  { id: "app/api/admin/qayyim/[[...legacy]]/route.ts", office: "swarm-house", status: "kept-as-door", reason: "باب الاسم المفصول: رسايل تليجرام القديمة بتضرب عليه" },
  { id: "app/api/admin/silent/route.ts", office: "records-office", status: "needs-verdict", reason: "اسم بلا صاحب معروف — ملف كامل بالدليل قبل الدمج أو المسح" },
  { id: "app/api/admin/sovereign/pulse/route.ts", office: "decision-desk", status: "needs-verdict", reason: "اسم بلا صاحب معروف — ملف كامل بالدليل قبل الدمج أو المسح" },
  { id: "app/api/admin/supreme/route.ts", office: "swarm-house", status: "needs-verdict", reason: "اسم بلا صاحب معروف — ملف كامل بالدليل قبل الدمج أو المسح" },
  { id: "app/api/admin/war-room/route.ts", office: "workshop", status: "needs-verdict", reason: "اسم بلا صاحب معروف — ملف كامل بالدليل قبل الدمج أو المسح" },
  { id: "components/admin/AdminProactiveStrip.tsx", office: "decision-desk", status: "needs-verdict", reason: "مكوّن على الشاشة مش في دار — محتاج تصنيف" },
  { id: "components/admin/ArchitectWidget.tsx", office: "workshop", status: "needs-verdict", reason: "مكوّن على الشاشة مش في دار — محتاج تصنيف" },
  { id: "components/admin/EvolutionManager.tsx", office: "swarm-house", status: "needs-verdict", reason: "مكوّن على الشاشة مش في دار — محتاج تصنيف" },
  { id: "components/admin/GrowthInsights.tsx", office: "decision-desk", status: "needs-verdict", reason: "مكوّن على الشاشة مش في دار — محتاج تصنيف" },
  { id: "components/admin/master-dashboard-components.tsx", office: "decision-desk", status: "needs-verdict", reason: "ملف كبير فيه أكتر من حاجة — بيتقسم الأول" },
  { id: "components/admin/MasterControlCenter.tsx", office: "decision-desk", status: "needs-verdict", reason: "مكوّن على الشاشة مش في دار — محتاج تصنيف" },
  { id: "components/admin/NeuralMirror.tsx", office: "swarm-house", status: "needs-verdict", reason: "مكوّن على الشاشة مش في دار — محتاج تصنيف" },
  { id: "components/admin/NeuralStream.tsx", office: "swarm-house", status: "needs-verdict", reason: "مكوّن على الشاشة مش في دار — محتاج تصنيف" },
  { id: "components/admin/SmartSuggestions.tsx", office: "swarm-house", status: "needs-verdict", reason: "مكوّن على الشاشة مش في دار — محتاج تصنيف" },
  { id: "components/admin/SovereignMindPanel.tsx", office: "swarm-house", status: "needs-verdict", reason: "مكوّن على الشاشة مش في دار — محتاج تصنيف" },
  { id: "components/admin/SovereignPulse.tsx", office: "decision-desk", status: "needs-verdict", reason: "مكوّن على الشاشة مش في دار — محتاج تصنيف" },

  /**
   * The phantom CRM. The agent class calls itself «مدير العمليات والمبيعات», six
   * source files write to three customer tables, and none of those tables exists in
   * the live database. Six of its doors answer 503/400 on the published site right
   * now. This is rehabilitation material, not deletion material: what it promised is
   * a real lead pipeline, and the customers employee is the office that would run it.
   */
  { id: "app/api/vanguard/automation/tasks/route.ts", office: "sales-office", status: "needs-verdict", reason: "سيآرإم وهمي: جدول العملاء بتاعه مش موجود في الداتابيس" },
  { id: "app/api/vanguard/automation/triggers/route.ts", office: "sales-office", status: "needs-verdict", reason: "سيآرإم وهمي: جدول العملاء بتاعه مش موجود في الداتابيس" },
  { id: "app/api/vanguard/automation/workflows/route.ts", office: "sales-office", status: "needs-verdict", reason: "سيآرإم وهمي: جدول العملاء بتاعه مش موجود في الداتابيس" },
  { id: "app/api/vanguard/automation/routing/route.ts", office: "sales-office", status: "needs-verdict", reason: "سيآرإم وهمي: جدول العملاء بتاعه مش موجود في الداتابيس" },
  { id: "app/api/vanguard/automation/notifications/route.ts", office: "sales-office", status: "needs-verdict", reason: "سيآرإم وهمي: جدول العملاء بتاعه مش موجود في الداتابيس" },
  { id: "lib/agents/VanguardAgent.ts", office: "sales-office", status: "needs-verdict", reason: "وكيل بيقول عن نفسه مدير العمليات والمبيعات — ولا سطح بينادي عليه" },

  /**
   * Found by pressing the live site, not by reading the tree: six different old
   * addresses render the identical agent centre. The one named after production is
   * gone — the workshop is outside the store by the owner's ruling, and its address is
   * answered at the gate.
   * None of the rest is deleted: each owes a rehabilitation file first.
   */
  { id: "app/admin/intel/page.tsx", office: "swarm-house", status: "duplicate-surface", reason: "بيطلّع نفس شاشة مركز الوكلاء (قياس حيّ)" },
  { id: "app/admin/intelligence/page.tsx", office: "swarm-house", status: "duplicate-surface", reason: "بيطلّع نفس شاشة مركز الوكلاء (قياس حيّ)" },
  { id: "app/admin/assistant/page.tsx", office: "swarm-house", status: "duplicate-surface", reason: "بيطلّع نفس شاشة مركز الوكلاء (قياس حيّ)" },
  { id: "app/admin/sandbox/page.tsx", office: "swarm-house", status: "duplicate-surface", reason: "بيطلّع نفس شاشة مركز الوكلاء (قياس حيّ)" },
];

/** Atoms still waiting for a real verdict — the number that must go down, phase by phase. */
export const NEEDS_VERDICT = EXPLICIT.filter((e) => e.status === "needs-verdict").length;

export type CensusAtom = { kind: string; id: string; lines?: number; usedBy?: string; route?: string };

/**
 * The office an atom belongs to, or null when no rule reached it.
 *
 * A `view` atom is a capability inside a page — the tab that opens without the
 * address moving. It is seated where its page is seated, because moving the page
 * without the tab is exactly the nail the owner asked not to lose.
 */
export function officeOf(atom: CensusAtom): OfficeRule | ExplicitPlacement | null {
  const explicit = EXPLICIT.find((e) => e.id === atom.id);
  if (explicit) return explicit;
  const direct = OFFICE_RULES.find((r) => r.match.test(atom.id));
  if (direct) return direct;
  if (atom.kind === "view" && atom.route) {
    const route = atom.route;
    const byRoute = OFFICE_RULES.find((r) => r.match.test(route)) ?? null;
    if (byRoute) return byRoute;
  }
  return null;
}

/** Every atom with no office — the list the guard fails on, and the owner reads. */
export function unassignedAtoms(atoms: CensusAtom[]): CensusAtom[] {
  return atoms.filter((a) => officeOf(a) === null);
}

/** The atoms the fence counts but no office seats: machinery every office stands on. */
export function sharedMachines(atoms: CensusAtom[]): CensusAtom[] {
  return atoms.filter((a) => officeOf(a)?.office === SHARED_OFFICE);
}

/**
 * facts.ts — what the store's settings table actually controls, measured on the live database.
 *
 * Counted 2026-11-03 against the live table and a reader grep over the whole repository:
 * `site_settings` holds twenty keys. Six of them are read by code that uses the value (`theme` and
 * `seo` while the site shell renders, `telegram_config` by `lib/telegram-config.ts`,
 * `contact_numbers` by `lib/store-numbers/read.ts`, `admin_gate_2fa_required` by `lib/admin-gate.ts`,
 * `nightly_snapshot_last` by `lib/ops/nightly-snapshot.ts`). The other fourteen reach no customer
 * screen: the only code that touches them is the old house's own tabs, which read and write them
 * inside the admin pages.
 *
 * The first count (2026-10-13) found seventeen keys and three live; three more have been written
 * since — the store's number desk, the gate's two-factor row, and the nightly copy's stamp — and a
 * registry that stops naming keys is a registry that starts printing machine keys on his screen.
 *
 * So the cockpit desk does not present dead switches as controls. It names what answers, counts what
 * does not, and says which one is a secret.
 */

export type FactKind =
  | "object"
  | "text"
  | "color"
  | "list"
  | "secret-object"
  | "numbers"
  | "flag"
  | "stamp";

export type SettingFact = {
  key: string;
  /** The Arabic name he reads instead of the machine key. */
  label: string;
  /** What changes when this value changes — in his words, not the code's. */
  controls: string;
  kind: FactKind;
  /** Where the value is edited, when a desk already exists for it. */
  editor?: string;
  /** A secret never leaves the server: no value, no echo, no save-back of the mask. */
  secret?: boolean;
};

/** The keys a live surface reads. */
export const LIVE_FACTS: SettingFact[] = [
  {
    key: "seo",
    label: "الإعلانات ومصادر الدخل",
    controls: "ما إذا كان الموقع يعرض إعلانات، وخطط الدخل اللي بننظر فيها",
    kind: "object",
    editor: "كارت الإعلانات في نفس الصفحة",
  },
  {
    key: "theme",
    label: "شكل الموقع",
    controls: "الألوان والخط اللي بيتحمّل بيهم الموقع للزائر أول ما يفتح",
    kind: "object",
  },
  {
    key: "telegram_config",
    label: "تنبيهات تليجرام",
    controls: "البوت اللي بتبعتلك منه رسالة المتجر، والرسايل اللي بتوصله",
    kind: "secret-object",
    editor: "لوحة تليجرام",
    secret: true,
  },
  {
    key: "contact_numbers",
    label: "أرقام الشغل",
    controls: "الرقم اللي بيشوفه العميل ويطلبه، واللي بيفتح عليه زرار واتساب في الموقع كله",
    kind: "numbers",
    editor: "كارت «أرقام التواصل» في نفس الصفحة",
  },
  {
    key: "admin_gate_2fa_required",
    label: "التحقق بخطوتين على باب اللوحة",
    controls: "لو اتشغّل، الدخول يطلب كود مؤقت بعد كلمة السر · مقفول بأمر منك، ومفيش شاشة بتكتبه",
    kind: "flag",
  },
  {
    key: "nightly_snapshot_last",
    label: "بصمة آخر نسخة ليلية",
    controls: "آخر نسخة اتعملت من السجل بالليل: يومها، وكم سطر وجدول اتنقلوا، وكم حاجة فشلت",
    kind: "stamp",
    editor: "بتكتبها الرحلة الليلية نفسها",
  },
];

/** The mask the door answers with instead of a secret. Saving it back is refused. */
export const SECRET_MASK = "«مخفي — بيتحفظ في الخزانة مش على الشاشة»";

/**
 * Which keys carry a credential. One owner for that fact — the `secret` flag on the facts above —
 * so no surface has to keep its own copy of the list.
 */
export function isSecretSetting(key: string): boolean {
  return LIVE_FACTS.some((fact) => fact.key === key && fact.secret === true);
}

/**
 * The keys with no reader. Named in Arabic so he can see what is sitting in his store's records,
 * counted by the guard so the number cannot drift, and never rendered as a control.
 */
export const DEAD_KEYS: { key: string; label: string }[] = [
  { key: "cms_hero_title", label: "عنوان الصفحة الرئيسي" },
  { key: "cms_hero_subtitle", label: "سطر تحت العنوان الرئيسي" },
  { key: "cms_hero_background", label: "خلفية الصفحة الرئيسي" },
  { key: "cms_service_options", label: "قائمة أنواع الخدمة" },
  { key: "cms_style_options", label: "قائمة الأذواق" },
  { key: "cms_budget_options", label: "قائمة الميزانيات" },
  { key: "seo_title", label: "عنوان البحث" },
  { key: "seo_description", label: "وصف البحث" },
  { key: "seo_keywords", label: "كلمات البحث" },
  { key: "favicon_url", label: "أيقونة المتصفح" },
  { key: "logo_url", label: "رابط الشعار" },
  { key: "font_family", label: "الخط" },
  { key: "primary_color", label: "اللون الأساسي" },
  { key: "secondary_color", label: "اللون التاني" },
];

/** The Arabic name for a key, or null when the desk has never heard of it. */
export function factLabel(key: string): string | null {
  const live = LIVE_FACTS.find((f) => f.key === key);
  if (live) return live.label;
  return DEAD_KEYS.find((d) => d.key === key)?.label ?? null;
}

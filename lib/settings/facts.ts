/**
 * facts.ts — what the store's settings table actually controls, measured on the live database.
 *
 * Counted 2026-10-13 with `node scratch/census-site-settings.mjs` and a reader grep over the whole
 * repository: `site_settings` holds 17 keys. Three of them are read by a surface that renders
 * something (`theme` and `seo` are read while the site shell renders in `app/layout.tsx`,
 * `telegram_config` is read by `lib/telegram-config.ts`). The other fourteen — hero titles, style
 * and budget option lists, favicon, logo, font, the two colors, and the four seo fields — answer to
 * no reader at all: the only code that ever touched them was the old desk's own key/value editor,
 * which lists whatever the table holds.
 *
 * So the cockpit desk does not present fourteen dead switches as controls. It names what answers,
 * and counts what does not, and says which one is a secret.
 */

export type FactKind = "object" | "text" | "color" | "list" | "secret-object";

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

/** The three keys a live surface reads. */
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
];

/** The mask the door answers with instead of a secret. Saving it back is refused. */
export const SECRET_MASK = "«مخفي — بيتحفظ في الخزانة مش على الشاشة»";

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

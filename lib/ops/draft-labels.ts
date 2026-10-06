/**
 * The kind of draft, in Arabic.
 *
 * Measured live 2026-10-07: the drafts desk listed his pending work as «image_fix — v1 — منذ 4 يوم»,
 * because `draft_type` is a machine label of the form `<what>_<action>`. Arabic reads the same pair
 * the other way round — «تصحيح الصورة» — so one vocabulary serves both halves and the join reverses.
 *
 * A kind this shop has never used returns null: the desk then says the draft has no named kind,
 * rather than printing a key the owner has to decode.
 */
const PARTS: Record<string, string> = {
  fix: "تصحيح",
  curate: "تنظيم",
  add: "إضافة",
  update: "تحديث",
  remove: "حذف",
  rewrite: "إعادة صياغة",
  translate: "ترجمة",
  image: "الصورة",
  images: "الصور",
  identity: "الهوية",
  gallery: "المعرض",
  hero: "الواجهة",
  text: "النص",
  copy: "النصوص",
  description: "الوصف",
  price: "السعر",
  product: "المنتج",
  products: "المنتجات",
  banner: "البنر",
  category: "القسم",
  collection: "المجموعة",
  faq: "الأسئلة الشائعة",
  seo: "الظهور",
};

/** Words that name something done to a page, rather than a thing on it. */
const ACTIONS = new Set(["fix", "curate", "add", "update", "remove", "rewrite", "translate"]);

export function draftTypeLabel(raw: string | null | undefined): string | null {
  const key = String(raw ?? "").trim().toLowerCase();
  if (!key) return null;
  const parts = key.split("_").filter(Boolean);
  if (parts.length < 2) return PARTS[parts[0]] ?? null;
  const named = parts.map((part) => PARTS[part]);
  if (named.some((label) => !label)) return null;
  // Arabic puts the deed before the thing it is done to: «تصحيح الصورة», «تنظيم المعرض» — whichever
  // side of the underscore the action was written on.
  const actionIndex = parts.findIndex((part) => ACTIONS.has(part));
  if (actionIndex >= 0) {
    const action = named[actionIndex];
    const rest = named.filter((_, i) => i !== actionIndex);
    return [action, ...rest].join(" ");
  }
  // Two things with no deed between them read as a possession: «نص الواجهة».
  const [head, ...tail] = [...named].reverse();
  const construct = head.startsWith("ال") && head.length > 3 ? head.slice(2) : head;
  return [construct, ...tail].join(" ");
}

/**
 * Where the draft lands, as a place rather than a path.
 *
 * The desk lists drafts by `target_path`, and a slug is a machine address: «/#kitchens» means
 * nothing to the owner, while «قسم المطابخ» is the same fact in his words. A product page is a
 * product page whatever its id is, and an unknown path is named as unnamed — the slug never rides
 * along in the sentence.
 */
const PLACES: Record<string, string> = {
  "": "الصفحة الرئيسية",
  rooms: "صفحة الغرف",
  furniture: "صفحة الأثاث",
  kitchens: "قسم المطابخ",
  living: "قسم الريسبشن",
  sofas: "قسم الكنب",
  bedrooms: "قسم غرف النوم",
  dining: "قسم السفرة",
  outdoor: "قسم الأثاث الخارجي",
};

export function draftTargetLabel(raw: string | null | undefined): string {
  const value = String(raw ?? "").trim();
  if (!value) return "مكان من غير اسم";
  const [path, anchor] = value.split("#");
  const key = (anchor ?? path).replace(/^\/+|\/+$/g, "").toLowerCase();
  if (anchor && !key) return PLACES[""];
  if (key.startsWith("products/")) return "صفحة منتج";
  if (key.startsWith("collections/")) return "صفحة مجموعة";
  return PLACES[key] ?? "مكان من غير اسم";
}

/** Canonical room slugs and aliases — shared by pages and proxy gatekeeper */

export const ROOM_SLUG_ALIASES: Record<string, string> = {
  office: "home-office",
  "kids-bedroom": "children-room",
  "kids-room": "children-room",
  bedroom: "master-bedroom",
  "youth-room": "teen-room",
};

export const VALID_ROOM_SLUGS = new Set([
  "master-bedroom",
  "children-room",
  "teen-room",
  "living-room",
  "dining-room",
  "corner-sofa",
  "lounge",
  "dressing-room",
  "kitchen",
  "home-office",
  "interior-design",
  "guest-bedroom",
  "study-room",
  "bathroom",
  "guest-bathroom",
  "entrance-lobby",
]);

export function resolveRoomSlug(rawSlug: string): string {
  return ROOM_SLUG_ALIASES[rawSlug] ?? rawSlug;
}

export function isValidRoomSlug(rawSlug: string): boolean {
  if (!rawSlug || rawSlug.includes("..")) return false;
  return VALID_ROOM_SLUGS.has(resolveRoomSlug(rawSlug));
}

/** For tests and audits */
export const VALID_ROOM_SLUG_LIST = [...VALID_ROOM_SLUGS] as const;

/**
 * A room's name in the customer's own words, keyed so the English scope a form stores and the slug a
 * page uses both resolve to one answer.
 *
 * Before this, the qualification form showed «Living Room» to an Arabic customer while the room page
 * above it was titled «غرف المعيشة» — two surfaces, two namers, no shared owner (measured on the
 * published store 2026-10-07). The English values stay untouched because they are what the database
 * rows and the scoring rules compare against; only what the customer reads is translated.
 */
const ROOM_NAME_AR: Record<string, string> = {
  livingroom: "غرف المعيشة والصالات",
  lounge: "الصالون",
  diningroom: "غرف الطعام",
  kitchen: "المطابخ",
  masterbedroom: "غرف النوم الرئيسية",
  bedroom: "غرف النوم",
  guestbedroom: "غرف نوم الضيوف",
  kidsbedroom: "غرف الأطفال",
  childrenroom: "غرف الأطفال",
  teenroom: "غرف الشباب",
  youthroom: "غرف الشباب",
  dressingroom: "غرف الملابس",
  homeoffice: "المكتب المنزلي",
  office: "المكتب المنزلي",
  studyroom: "غرفة الدراسة",
  bathroom: "الحمامات",
  guestbathroom: "حمام الضيوف",
  entrancelobby: "المدخل والريسبشن",
  cornersofa: "الكنب الركن",
  fullunit: "الوحدة بالكامل",
  interior: "التصميم الداخلي",
  interiordesign: "التصميم الداخلي",
};

/** The Arabic name of a room, or an empty string when this store has no name for it. */
export function roomNameAr(raw: string | null | undefined): string {
  const key = String(raw ?? "").toLowerCase().replace(/[^a-z\u0600-\u06FF]/g, "");
  return ROOM_NAME_AR[key] ?? "";
}
export const ROOM_ALIAS_SLUG_LIST = Object.keys(ROOM_SLUG_ALIASES) as (keyof typeof ROOM_SLUG_ALIASES)[];

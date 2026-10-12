/**
 * The room types the store's picture bank actually holds, in the words a customer reads.
 *
 * Its own module because the customer's sheet needs the labels and must never import the
 * database reader that sits next to them — measured 2026-10-03: a page that imported the
 * server module shipped the admin key into the browser bundle and answered 500.
 */
export const ROOM_TYPES = [
  "master-bedroom",
  "living-room",
  "dining-room",
  "children-room",
  "teen-room",
  "corner-sofa",
  "comprehensive-interior",
  // Measured on the live bank 2026-10-03: the harvester has been filling these too, so the
  // sheet and the customer's chips must know they exist.
  "lounge",
  "dressing-room",
  "kitchen",
  "home-office",
] as const;

/** The type the bank falls back to when a room name matches nothing. */
export const GENERAL_ROOM = "comprehensive-interior";

/**
 * Rooms the bank holds pictures for, but the customer's chips do not offer.
 *
 * The storefront advertises sixteen rooms; the family's decision sheet offers the eleven above. The
 * five here were harvested into the bank on 2026-10-12 so their cards stop borrowing a random picture
 * from a live search on every visit — but adding a room to what a CUSTOMER is invited to pick is the
 * owner's decision, not a side effect of a picture job, so they stay out of ROOM_CHOICES.
 */
export const BANK_ROOM_ONLY_TYPES = [
  "guest-bedroom",
  "study-room",
  "bathroom",
  "guest-bathroom",
  "entrance-lobby",
] as const;

export const ROOM_TYPE_LABELS: Record<string, string> = {
  "master-bedroom": "نوم رئيسي",
  "living-room": "صالة معيشة",
  "dining-room": "سفرة",
  "children-room": "أطفال",
  "teen-room": "مراهقين",
  "corner-sofa": "ركنة",
  "comprehensive-interior": "بيت كامل",
  // The four the harvester was written to fill but the sheet never carried: measured on the
  // published panel 2026-10-03, `lounge` printed as a machine key because nothing named it.
  lounge: "صالة صغيرة",
  "dressing-room": "غرفة قياس",
  kitchen: "مطبخ",
  "home-office": "مكتب منزلي",
  // Named for the paper and the cards, not offered as a chip: a customer who wrote «حمام» on his
  // sheet must read his own word back, not a machine key.
  "guest-bedroom": "غرفة ضيوف",
  "study-room": "غرفة دراسة",
  bathroom: "حمام",
  "guest-bathroom": "حمام ضيوف",
  "entrance-lobby": "صالة دخول",
};

/** Offered in the order the bank is fullest. */
export const ROOM_CHOICES = ROOM_TYPES.map((type) => ({ type, label: ROOM_TYPE_LABELS[type] }));

/** Every room the bank may answer a picture for — the chips' list plus the storefront-only five. */
export const BANK_TYPES: readonly string[] = [...ROOM_TYPES, ...BANK_ROOM_ONLY_TYPES];

/** Every way the bank's keys are spelled, folded to one shape. */
const FOLDED: Record<string, string> = Object.fromEntries(
  Object.entries(ROOM_TYPE_LABELS).map(([type, label]) => [type.replace(/[_\s]+/g, "-").toLowerCase(), label])
);

/**
 * The room as the customer's own sheet must name it.
 *
 * Three shapes arrive here: the bank's key (written when he taps a room chip), the handwriting the
 * paper carried (the store's own Arabic), and nothing. A key is answered with the very word printed
 * on the chip he tapped, Arabic is left exactly as it is, and anything else is dropped rather than
 * printed — «living-room» at the top of his page is a machine key wearing his heading.
 */
export function roomTypeName(raw: string | null | undefined): string | null {
  const text = String(raw ?? "").trim();
  if (!text) return null;
  const named = FOLDED[text.replace(/[_\s]+/g, "-").toLowerCase()];
  if (named) return named;
  return /\p{Script=Arabic}/u.test(text) && !/[A-Za-z]/.test(text) ? text : null;
}

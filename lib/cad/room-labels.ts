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
] as const;

/** The type the bank falls back to when a room name matches nothing. */
export const GENERAL_ROOM = "comprehensive-interior";

export const ROOM_TYPE_LABELS: Record<string, string> = {
  "master-bedroom": "نوم رئيسي",
  "living-room": "صالة معيشة",
  "dining-room": "سفرة",
  "children-room": "أطفال",
  "teen-room": "مراهقين",
  "corner-sofa": "ركنة",
  "comprehensive-interior": "بيت كامل",
};

/** Offered in the order the bank is fullest. */
export const ROOM_CHOICES = ROOM_TYPES.map((type) => ({ type, label: ROOM_TYPE_LABELS[type] }));

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
};

/** Offered in the order the bank is fullest. */
export const ROOM_CHOICES = ROOM_TYPES.map((type) => ({ type, label: ROOM_TYPE_LABELS[type] }));

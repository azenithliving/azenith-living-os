/** Canonical room slugs and aliases — shared by pages and proxy gatekeeper */

export const ROOM_SLUG_ALIASES: Record<string, string> = {
  office: "home-office",
  "kids-room": "children-room",
  bedroom: "master-bedroom",
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
export const ROOM_ALIAS_SLUG_LIST = Object.keys(ROOM_SLUG_ALIASES) as (keyof typeof ROOM_SLUG_ALIASES)[];

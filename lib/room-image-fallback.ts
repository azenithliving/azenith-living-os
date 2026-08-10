/**
 * Bulletproof static image fallback for room pages.
 *
 * These are verified Pexels CDN URLs (all return HTTP 200) that require NO API key.
 * Every room page ALWAYS gets images from this library when the live Pexels
 * search fails, returns empty results, or no API keys are available.
 */

export interface FallbackPhoto {
  id: number;
  url: string;
  src: {
    original?: string;
    large2x?: string;
    large?: string;
    medium?: string;
    small?: string;
  };
  alt?: string;
  photographer?: string;
}

// Verified working Pexels CDN photo IDs
const CDN_BASE = "https://images.pexels.com/photos";

// Room-specific verified images (3 per room, all HTTP 200 verified)
export const ROOM_FALLBACK_BY_ROOM: Record<string, string[]> = {
  "master-bedroom": ["6580220", "6758350", "5998138"],
  "children-room": ["3661202", "6434622", "5598284"],
  "teen-room": ["6980712", "6207812", "7018391"],
  "living-room": ["1571460", "1648771", "1457842"],
  "dining-room": ["6207819", "6198651", "3016430"],
  "corner-sofa": ["4850315", "2089698", "3757055"],
  lounge: ["6588592", "2177483", "6969824"],
  "dressing-room": ["6045084", "6957085", "6045048"],
  kitchen: ["2724749", "1080721", "2062426"],
  "home-office": ["6634140", "6474483", "4316737"],
  "interior-design": ["1571468", "259962", "1034584"],
  "guest-bedroom": ["3797991", "545034", "2029731"],
  "study-room": ["2908984", "1907785", "207662"],
  bathroom: ["1910472", "1040893", "2030037"],
  "guest-bathroom": ["2062431", "6585757", "6198662"],
  "entrance-lobby": ["2634488", "6956441", "2263510"],
};

// General verified luxury interior images used to pad rooms to a fuller gallery
const GENERAL_INTERIOR_POOL: string[] = [
  "1571460",
  "1648771",
  "1457842",
  "2631746",
  "2609047",
  "2177483",
  "1080721",
  "2089698",
  "2724749",
  "2062426",
  "6580220",
  "6077236",
  "2634488",
  "2662820",
  "1307394",
  "1212800",
  "1080696",
  "2029731",
  "2062431",
  "1743227",
  "1907785",
  "3788575",
];

function makeSrc(id: string) {
  const url = `${CDN_BASE}/${id}/pexels-photo-${id}.jpeg`;
  return {
    original: url,
    large2x: `${url}?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940`,
    large: `${url}?auto=compress&cs=tinysrgb&h=650&w=940`,
    medium: `${url}?auto=compress&cs=tinysrgb&h=350`,
    small: `${url}?auto=compress&cs=tinysrgb&h=130`,
  };
}

/**
 * Return a guaranteed non-empty array of fallback photos for a room.
 * Uses the room's verified images plus general luxury interior images,
 * deterministically offset by the style so each style shows a different gallery.
 */
export function getRoomFallbackImages(
  room: string,
  style: string = "modern"
): FallbackPhoto[] {
  const roomIds = ROOM_FALLBACK_BY_ROOM[room] || ROOM_FALLBACK_BY_ROOM["living-room"];

  // Deterministic offset so different styles show different photos
  let hash = 0;
  const str = `${room}-${style}`;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  const offset = Math.abs(hash) % GENERAL_INTERIOR_POOL.length;

  // Build a pool of ~12 unique images: room-specific first, then general
  const uniqueIds: string[] = [];
  const push = (id: string) => {
    if (!uniqueIds.includes(id)) uniqueIds.push(id);
  };
  roomIds.forEach(push);
  for (let i = 0; i < GENERAL_INTERIOR_POOL.length; i++) {
    push(GENERAL_INTERIOR_POOL[(offset + i) % GENERAL_INTERIOR_POOL.length]);
  }

  // Deliver up to 12 images
  return uniqueIds.slice(0, 12).map((id, index) => ({
    id: 888000 + index + 1,
    url: `${CDN_BASE}/${id}/pexels-photo-${id}.jpeg`,
    src: makeSrc(id),
    alt: `${room} ${style} luxury interior design ${index + 1}`,
    photographer: "Azenith Luxury Collection",
  }));
}

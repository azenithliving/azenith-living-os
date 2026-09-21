export interface ClientLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
  label?: string;
  address?: string;
  source?: "browser" | "manual";
  capturedAt?: string;
}

export interface NearbyPlace {
  name: string;
  category: string;
  distanceMeters: number;
  latitude: number;
  longitude: number;
  address?: string;
  phone?: string;
  openingHours?: string;
  mapUrl: string;
}

const FOOD_RE = /(اكل|أكل|مطعم|مطاعم|كافيه|قهوة|غدا|غداء|عشا|عشاء|فطار|فطور|بيتزا|برجر|سوشي|restaurant|restaurants|cafe|coffee|food|eat|dinner|lunch|breakfast)/i;
const LOCATION_RE = /(انا فين|أنا فين|موقعي|موقعى|فين حاليا|فين حاليًا|مكانى|مكاني|current location|where am i|my location)/i;

export function isValidClientLocation(location: unknown): location is ClientLocation {
  if (!location || typeof location !== "object") return false;
  const candidate = location as ClientLocation;
  return (
    typeof candidate.latitude === "number" &&
    typeof candidate.longitude === "number" &&
    Number.isFinite(candidate.latitude) &&
    Number.isFinite(candidate.longitude) &&
    candidate.latitude >= -90 &&
    candidate.latitude <= 90 &&
    candidate.longitude >= -180 &&
    candidate.longitude <= 180
  );
}

export function isFoodNearbyRequest(message: string): boolean {
  return FOOD_RE.test(message);
}

export function isCurrentLocationRequest(message: string): boolean {
  return LOCATION_RE.test(message);
}

export function formatLocationContext(location: ClientLocation): string {
  const pieces = [
    location.label,
    location.address,
    `GPS: ${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`,
    typeof location.accuracy === "number" ? `accuracy about ${Math.round(location.accuracy)}m` : undefined,
  ].filter(Boolean);
  return pieces.join(" | ");
}

export async function reverseGeocodeLocation(location: ClientLocation): Promise<string | null> {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", String(location.latitude));
  url.searchParams.set("lon", String(location.longitude));
  url.searchParams.set("accept-language", "ar,en");

  const data = await fetchJsonWithTimeout(url.toString(), 5000);
  const displayName = typeof data?.display_name === "string" ? data.display_name : "";
  return displayName.trim() || null;
}

export async function findNearbyFoodPlaces(location: ClientLocation): Promise<NearbyPlace[]> {
  const query = `
[out:json][timeout:10];
(
  node(around:1800,${location.latitude},${location.longitude})["amenity"~"restaurant|fast_food|cafe"];
  way(around:1800,${location.latitude},${location.longitude})["amenity"~"restaurant|fast_food|cafe"];
  relation(around:1800,${location.latitude},${location.longitude})["amenity"~"restaurant|fast_food|cafe"];
);
out center tags 20;
`;

  const response = await fetchJsonWithTimeout("https://overpass-api.de/api/interpreter", 9000, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      "User-Agent": "AzenithLiving/1.0 location-assistant",
    },
    body: new URLSearchParams({ data: query }).toString(),
  });

  const elements: unknown[] = Array.isArray(response?.elements) ? response.elements : [];
  const places: NearbyPlace[] = elements
    .map<NearbyPlace | null>((element: any): NearbyPlace | null => {
      const lat = typeof element.lat === "number" ? element.lat : element.center?.lat;
      const lon = typeof element.lon === "number" ? element.lon : element.center?.lon;
      if (typeof lat !== "number" || typeof lon !== "number") return null;

      const tags = element.tags || {};
      const name = firstText(tags.name, tags["name:ar"], tags["brand"]);
      if (!name) return null;

      const address = buildAddress(tags);
      const phone = firstText(tags.phone, tags["contact:phone"], tags.mobile, tags["contact:mobile"]);
      const openingHours = firstText(tags.opening_hours);
      const category = categoryLabel(tags.amenity);

      return {
        name,
        category,
        distanceMeters: Math.round(distanceMeters(location.latitude, location.longitude, lat, lon)),
        latitude: lat,
        longitude: lon,
        address,
        phone,
        openingHours,
        mapUrl: `https://www.openstreetmap.org/${element.type}/${element.id}`,
      };
    })
    .filter((place): place is NearbyPlace => place !== null);

  return places
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, 6);
}

export function buildLocationReply(location: ClientLocation, address: string | null, language?: string): string {
  const label = address || location.address || location.label || `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`;
  const accuracy = typeof location.accuracy === "number" ? Math.round(location.accuracy) : null;
  if (language === "en") {
    return `Your current detected location is around: ${label}${accuracy ? ` (accuracy about ${accuracy} meters)` : ""}.`;
  }
  return `موقعك الحالي ظاهر عندي تقريبًا: ${label}${accuracy ? `، ودقة التحديد حوالي ${accuracy} متر` : ""}.`;
}

export function buildNearbyFoodReply(places: NearbyPlace[], location: ClientLocation, language?: string): string {
  if (places.length === 0) {
    return language === "en"
      ? "I could read your location, but I did not find nearby restaurants in the open map data within about 1.8 km. Try a wider search area or a specific cuisine."
      : "قدرت أقرأ موقعك، لكن لم أجد مطاعم قريبة في بيانات الخريطة المفتوحة داخل حوالي ١.٨ كم. جرّب نطاق أوسع أو نوع أكل محدد.";
  }

  const lines = places.map((place, index) => {
    const distance = place.distanceMeters >= 1000 ? `${(place.distanceMeters / 1000).toFixed(1)} كم` : `${place.distanceMeters} متر`;
    const bits = [
      `${index + 1}. ${place.name} - ${place.category} - ${distance}`,
      place.phone ? `هاتف: ${place.phone}` : undefined,
      place.address ? `عنوان: ${place.address}` : undefined,
      place.openingHours ? `مواعيد: ${place.openingHours}` : undefined,
      `خريطة: ${place.mapUrl}`,
    ].filter(Boolean);
    return bits.join("\n");
  });

  if (language === "en") {
    return `Based on your current GPS location (${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}), these are nearby food options from OpenStreetMap:\n\n${lines.join("\n\n")}`;
  }
  return `بناءً على موقعك الحالي (${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)})، دي أقرب اختيارات أكل من OpenStreetMap:\n\n${lines.join("\n\n")}`;
}

function firstText(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function buildAddress(tags: Record<string, unknown>): string | undefined {
  const parts = [
    firstText(tags["addr:street"]),
    firstText(tags["addr:suburb"], tags["addr:neighbourhood"]),
    firstText(tags["addr:city"]),
  ].filter(Boolean);
  return parts.length > 0 ? parts.join("، ") : undefined;
}

function categoryLabel(amenity: unknown): string {
  if (amenity === "fast_food") return "وجبات سريعة";
  if (amenity === "cafe") return "كافيه";
  return "مطعم";
}

function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const earthRadius = 6371000;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

async function fetchJsonWithTimeout(url: string, timeoutMs: number, init?: RequestInit): Promise<any> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        "User-Agent": "AzenithLiving/1.0 location-assistant",
        ...(init?.headers || {}),
      },
    });
    if (!response.ok) {
      throw new Error(`Location provider returned ${response.status}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

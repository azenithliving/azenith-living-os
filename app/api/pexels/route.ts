import { NextRequest, NextResponse } from "next/server";
import { getNextAvailableKey, setKeyCooldown, getKeyStats } from "@/lib/api-keys-service";
import { getRoomFallbackImages } from "@/lib/room-image-fallback";
import { getSafeDeterministicPage } from "@/lib/pexels-utils";

// Pexels API caps pagination at 80 pages (8000 results max).
// Pages above 80 return HTTP 200 with an empty `photos` array, so we clamp.
const MAX_SAFE_PAGE = 80;
const MIN_SAFE_PAGE = 1;

// Smart Key Rotation Manager with Blacklisting for Pexels
class PexelsKeyRotationManager {
  private readonly BLACKLIST_DURATION_MS = 10 * 60 * 1000; // 10 minutes

  async getNextKey(): Promise<{ key: string | null; index: number; total: number }> {
    const keyRecord = await getNextAvailableKey("pexels");
    if (!keyRecord) return { key: null, index: -1, total: 0 };
    return { key: keyRecord.key, index: keyRecord.index, total: 1 };
  }

  async blacklistKey(key: string): Promise<void> {
    await setKeyCooldown("pexels", key, this.BLACKLIST_DURATION_MS);
    console.log(`[Pexels API] Key blacklisted in memory/DB for 10 minutes`);
  }

  async getStats(): Promise<{ total: number; available: number; blacklisted: number }> {
    const stats = await getKeyStats("pexels");
    return {
      total: stats.total,
      available: stats.active,
      blacklisted: stats.inCooldown
    };
  }
}

// Global rotation manager instance
const keyManager = new PexelsKeyRotationManager();

// Function to check if error is a rate limit (429) or quota exceeded
function isPexelsRateLimit(status: number, errorData: any): boolean {
  return status === 429 ||
    (errorData && errorData.error &&
      (errorData.error.includes('rate limit') || errorData.error.includes('quota')));
}

// Detect room slug from a free-text query (used when room param is missing)
function detectRoomFromQuery(query: string, fallbackRoom: string): string {
  const q = query.toLowerCase();
  if (q.includes("kids") || q.includes("children")) return "children-room";
  if (q.includes("teenager") || q.includes("teen")) return "teen-room";
  if (q.includes("guest bedroom")) return "guest-bedroom";
  if (q.includes("master bedroom") || (q.includes("bedroom") && !q.includes("guest"))) return "master-bedroom";
  if (q.includes("dining")) return "dining-room";
  if (q.includes("corner sofa") || q.includes("sectional")) return "corner-sofa";
  if (q.includes("living room") || q.includes("living")) return "living-room";
  if (q.includes("lounge")) return "lounge";
  if (q.includes("dressing") || q.includes("closet")) return "dressing-room";
  if (q.includes("kitchen")) return "kitchen";
  if (q.includes("home office") || q.includes("desk")) return "home-office";
  if (q.includes("study room") || q.includes("library")) return "study-room";
  if (q.includes("guest bathroom") || q.includes("powder")) return "guest-bathroom";
  if (q.includes("bathroom")) return "bathroom";
  if (q.includes("entrance") || q.includes("lobby") || q.includes("foyer")) return "entrance-lobby";
  if (q.includes("interior") || q.includes("architecture")) return "interior-design";
  return fallbackRoom || "living-room";
}

export async function GET(request: NextRequest) {
  let query = "luxury modern industrial interior";
  try {
    const { searchParams } = new URL(request.url);
    query = searchParams.get("query") || "luxury modern industrial interior";
    const perPage = Math.min(Math.max(Number(searchParams.get("per_page") || "12"), 1), 50);
    // Clamp page into Pexels' safe pagination range
    const requestedPage = Math.max(Number(searchParams.get("page") || "1"), 1);
    const orientation = searchParams.get("orientation") || "landscape";

    // Extract room and style for deterministic seed and style-aware queries
    const room = searchParams.get("room") || "";
    const style = searchParams.get("style") || "";

    let fallbackRoom = detectRoomFromQuery(query, "");
    let page = requestedPage;

    // If room and style are provided, build a more specific query and use a SAFE deterministic page
    if (room && style) {
      fallbackRoom = room;
      const styleHints: Record<string, string> = {
        modern: "modern minimal",
        classic: "classic elegant",
        industrial: "industrial loft",
        scandinavian: "scandinavian cozy",
        minimalist: "minimalist clean",
        luxury: "luxury premium",
        contemporary: "contemporary design",
      };

      const roomQueries: Record<string, string> = {
        "master-bedroom": "luxury master bedroom interior",
        "children-room": "luxury kids bedroom playful interior",
        "teen-room": "modern teenager bedroom study area interior",
        "living-room": "luxury living room lounge",
        "dining-room": "luxury dining room chandelier",
        "corner-sofa": "luxury sectional corner sofa living room",
        "lounge": "luxury lounge seating interior",
        "dressing-room": "walk-in closet dressing room design",
        "kitchen": "modern high-end kitchen marble",
        "home-office": "luxury home office study desk interior",
        "interior-design": "luxury architectural interior design",
        "guest-bedroom": "luxury cozy guest bedroom interior",
        "study-room": "luxury home library study room focus",
        "bathroom": "luxury spa bathroom marble interior",
        "guest-bathroom": "luxury powder room guest bathroom",
        "entrance-lobby": "luxury entrance foyer lobby grand interior",
      };

      const roomQuery = roomQueries[room] || `${room} interior`;
      const styleHint = styleHints[style] || style;
      query = `${styleHint} ${roomQuery}`;

      // Deterministic, safe page in [1, 80]
      page = getSafeDeterministicPage(room, style);
    }

    const stats = await keyManager.getStats();
    console.log(`[Pexels API] Stats: ${stats.total} total, ${stats.available} available, ${stats.blacklisted} blacklisted`);

    if (stats.available === 0) {
      console.warn("⚠️ No available Pexels API keys found. Returning static fallback images.");
      return NextResponse.json({
        ok: true,
        photos: getRoomFallbackImages(fallbackRoom || "living-room", style || "modern"),
        source: "static_fallback",
        keyUsed: -1,
      });
    }

    // Smart Round-Robin Key Rotation
    let attempts = 0;
    const maxAttempts = stats.total * 2;

    while (attempts < maxAttempts) {
      const { key, index, total } = await keyManager.getNextKey();

      if (!key) {
        console.log('[Pexels API] No available keys (all blacklisted)');
        break;
      }

      attempts++;
      console.log(`[Pexels API] Round-Robin: Using key ${index}/${total} (attempt ${attempts})`);

      try {
        const response = await fetch(
          `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${perPage}&page=${page}&orientation=${encodeURIComponent(orientation)}`,
          {
            headers: {
              "Authorization": key,
            },
            next: { revalidate: 3600 }
          }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));

          if (isPexelsRateLimit(response.status, errorData)) {
            console.log(`[Pexels API] Key ${index} hit rate limit (${response.status}), blacklisting...`);
            await keyManager.blacklistKey(key);
            continue; // Get next key via round-robin
          }

          // For other errors, try next key
          console.log(`[Pexels API] Key ${index} failed with status ${response.status}, trying next...`);
          continue;
        }

        const data = await response.json();
        const photos = data.photos || [];

        console.log(`[Pexels API] Key ${index} succeeded with ${photos.length} photos`);

        // CRITICAL: if Pexels returned an empty result (e.g. no matches for query),
        // fall back to static images instead of returning an empty gallery.
        if (photos.length === 0) {
          console.warn(`[Pexels API] Empty result for query "${query}" page ${page}. Using static fallback.`);
          return NextResponse.json({
            ok: true,
            photos: getRoomFallbackImages(fallbackRoom || "living-room", style || "modern"),
            source: "static_fallback",
            keyUsed: index,
          });
        }

        return NextResponse.json({
          ok: true,
          photos,
          keyUsed: index,
          totalKeys: total,
          blacklisted: (await keyManager.getStats()).blacklisted
        });

      } catch (error) {
        console.error(`[Pexels API] Key ${index} network error:`, error);
        continue; // Try next key
      }
    }

    // All keys exhausted - return static fallback (never empty)
    console.error(`[Pexels API] All ${stats.total} keys exhausted. Blacklisted: ${stats.blacklisted}. Using static fallback.`);
    return NextResponse.json({
      ok: true,
      photos: getRoomFallbackImages(fallbackRoom || "living-room", style || "modern"),
      source: "static_fallback",
      keyUsed: -1,
    });

  } catch (error) {
    console.error("❌ Pexels API error, returning static fallback:", error);
    return NextResponse.json({
      ok: true,
      photos: getRoomFallbackImages("living-room", "modern"),
      source: "static_fallback",
      keyUsed: -1,
    });
  }
}

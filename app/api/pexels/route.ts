import { NextRequest, NextResponse } from "next/server";
import { getNextAvailableKey, setKeyCooldown, getKeyStats } from "@/lib/api-keys-service";

/**
 * Deterministic seed generator for consistent image fetching per room+style
 */
function getDeterministicSeed(room: string, style: string): number {
  let hash = 0;
  const str = `${room}-${style}`;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash) % 1000 + 1;
}

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

// Static luxury fallback images when all keys exhausted
const ROOM_FALLBACK_IMAGES: Record<string, string[]> = {
  "master-bedroom": [
    "https://images.pexels.com/photos/6580220/pexels-photo-6580220.jpeg",
    "https://images.pexels.com/photos/6758350/pexels-photo-6758350.jpeg",
    "https://images.pexels.com/photos/5998138/pexels-photo-5998138.jpeg"
  ],
  "children-room": [
    "https://images.pexels.com/photos/3661202/pexels-photo-3661202.jpeg",
    "https://images.pexels.com/photos/6434622/pexels-photo-6434622.jpeg",
    "https://images.pexels.com/photos/5598284/pexels-photo-5598284.jpeg"
  ],
  "teen-room": [
    "https://images.pexels.com/photos/6980712/pexels-photo-6980712.jpeg",
    "https://images.pexels.com/photos/6207812/pexels-photo-6207812.jpeg",
    "https://images.pexels.com/photos/7018391/pexels-photo-7018391.jpeg"
  ],
  "living-room": [
    "https://images.pexels.com/photos/1571460/pexels-photo-1571460.jpeg",
    "https://images.pexels.com/photos/1648771/pexels-photo-1648771.jpeg",
    "https://images.pexels.com/photos/1457842/pexels-photo-1457842.jpeg"
  ],
  "dining-room": [
    "https://images.pexels.com/photos/6207819/pexels-photo-6207819.jpeg",
    "https://images.pexels.com/photos/6198651/pexels-photo-6198651.jpeg",
    "https://images.pexels.com/photos/3016430/pexels-photo-3016430.jpeg"
  ],
  "corner-sofa": [
    "https://images.pexels.com/photos/4850315/pexels-photo-4850315.jpeg",
    "https://images.pexels.com/photos/6934169/pexels-photo-6934169.jpeg",
    "https://images.pexels.com/photos/3757055/pexels-photo-3757055.jpeg"
  ],
  "lounge": [
    "https://images.pexels.com/photos/6588592/pexels-photo-6588592.jpeg",
    "https://images.pexels.com/photos/6480197/pexels-photo-6480197.jpeg",
    "https://images.pexels.com/photos/6969824/pexels-photo-6969824.jpeg"
  ],
  "dressing-room": [
    "https://images.pexels.com/photos/6045084/pexels-photo-6045084.jpeg",
    "https://images.pexels.com/photos/6957085/pexels-photo-6957085.jpeg",
    "https://images.pexels.com/photos/6045048/pexels-photo-6045048.jpeg"
  ],
  "kitchen": [
    "https://images.pexels.com/photos/2724749/pexels-photo-2724749.jpeg",
    "https://images.pexels.com/photos/1080721/pexels-photo-1080721.jpeg",
    "https://images.pexels.com/photos/2062426/pexels-photo-2062426.jpeg"
  ],
  "home-office": [
    "https://images.pexels.com/photos/6634140/pexels-photo-6634140.jpeg",
    "https://images.pexels.com/photos/6474483/pexels-photo-6474483.jpeg",
    "https://images.pexels.com/photos/4316737/pexels-photo-4316737.jpeg"
  ],
  "interior-design": [
    "https://images.pexels.com/photos/1571468/pexels-photo-1571468.jpeg",
    "https://images.pexels.com/photos/259962/pexels-photo-259962.jpeg",
    "https://images.pexels.com/photos/1034584/pexels-photo-1034584.jpeg"
  ],
  "guest-bedroom": [
    "https://images.pexels.com/photos/3797991/pexels-photo-3797991.jpeg",
    "https://images.pexels.com/photos/545034/pexels-photo-545034.jpeg",
    "https://images.pexels.com/photos/2029731/pexels-photo-2029731.jpeg"
  ],
  "study-room": [
    "https://images.pexels.com/photos/2908984/pexels-photo-2908984.jpeg",
    "https://images.pexels.com/photos/1907785/pexels-photo-1907785.jpeg",
    "https://images.pexels.com/photos/207662/pexels-photo-207662.jpeg"
  ],
  "bathroom": [
    "https://images.pexels.com/photos/1910472/pexels-photo-1910472.jpeg",
    "https://images.pexels.com/photos/1040893/pexels-photo-1040893.jpeg",
    "https://images.pexels.com/photos/2030037/pexels-photo-2030037.jpeg"
  ],
  "guest-bathroom": [
    "https://images.pexels.com/photos/6413919/pexels-photo-6413919.jpeg",
    "https://images.pexels.com/photos/6585757/pexels-photo-6585757.jpeg",
    "https://images.pexels.com/photos/6198662/pexels-photo-6198662.jpeg"
  ],
  "entrance-lobby": [
    "https://images.pexels.com/photos/6958434/pexels-photo-6958434.jpeg",
    "https://images.pexels.com/photos/6956441/pexels-photo-6956441.jpeg",
    "https://images.pexels.com/photos/2263510/pexels-photo-2263510.jpeg"
  ]
};

// Static luxury fallback images when all keys exhausted
function getStaticLuxuryFallback(query?: string) {
  console.log('[Pexels API] Returning static luxury fallback images for query:', query);
  
  let detectedRoom = "living-room";
  if (query) {
    const q = query.toLowerCase();
    if (q.includes("kids") || q.includes("children")) detectedRoom = "children-room";
    else if (q.includes("teenager") || q.includes("teen")) detectedRoom = "teen-room";
    else if (q.includes("master bedroom") || (q.includes("bedroom") && !q.includes("guest"))) detectedRoom = "master-bedroom";
    else if (q.includes("guest bedroom")) detectedRoom = "guest-bedroom";
    else if (q.includes("dining")) detectedRoom = "dining-room";
    else if (q.includes("corner sofa") || q.includes("sectional")) detectedRoom = "corner-sofa";
    else if (q.includes("living room") || q.includes("living")) detectedRoom = "living-room";
    else if (q.includes("lounge")) detectedRoom = "lounge";
    else if (q.includes("dressing") || q.includes("closet")) detectedRoom = "dressing-room";
    else if (q.includes("kitchen")) detectedRoom = "kitchen";
    else if (q.includes("home office") || q.includes("desk")) detectedRoom = "home-office";
    else if (q.includes("study room") || q.includes("library")) detectedRoom = "study-room";
    else if (q.includes("guest bathroom") || q.includes("powder")) detectedRoom = "guest-bathroom";
    else if (q.includes("bathroom")) detectedRoom = "bathroom";
    else if (q.includes("entrance") || q.includes("lobby") || q.includes("foyer")) detectedRoom = "entrance-lobby";
    else if (q.includes("interior") || q.includes("architecture")) detectedRoom = "interior-design";
  }

  const urls = ROOM_FALLBACK_IMAGES[detectedRoom] || ROOM_FALLBACK_IMAGES["living-room"];
  
  return {
    ok: true,
    photos: urls.map((url, i) => ({
      id: 999000 + i + 1,
      width: 1920,
      height: 1280,
      url: url,
      photographer: "Azenith Luxury Collection",
      photographer_url: "#",
      src: {
        original: url,
        large2x: `${url}?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940`,
        large: `${url}?auto=compress&cs=tinysrgb&h=650&w=940`,
        medium: `${url}?auto=compress&cs=tinysrgb&h=350`,
        small: `${url}?auto=compress&cs=tinysrgb&h=130`,
        portrait: `${url}?auto=compress&cs=tinysrgb&fit=crop&h=1200&w=800`,
        landscape: `${url}?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200`,
        tiny: `${url}?auto=compress&cs=tinysrgb&dpr=1&fit=crop&h=200&w=280`
      },
      avg_color: "#8B7355"
    })),
    fallbackMode: true,
    keyUsed: -1
  };
}

export async function GET(request: NextRequest) {
  let query = "luxury modern industrial interior";
  try {
    const { searchParams } = new URL(request.url);
    query = searchParams.get("query") || "luxury modern industrial interior";
    const perPage = Math.min(Math.max(Number(searchParams.get("per_page") || "12"), 1), 50);
    let page = Math.max(Number(searchParams.get("page") || "1"), 1);
    const orientation = searchParams.get("orientation") || "landscape";
    
    // Extract room and style for deterministic seed and style-aware queries
    const room = searchParams.get("room") || "";
    const style = searchParams.get("style") || "";
    
    // If room and style are provided, build a more specific query and use deterministic page
    if (room && style) {
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
      
      // Use deterministic page based on room+style for consistency
      const deterministicPage = getDeterministicSeed(room, style);
      page = deterministicPage;
    }

    const stats = await keyManager.getStats();
    console.log(`[Pexels API] Stats: ${stats.total} total, ${stats.available} available, ${stats.blacklisted} blacklisted`);

    if (stats.available === 0) {
      console.warn("⚠️ No available Pexels API keys found. Returning fallback images.");
      return NextResponse.json(getStaticLuxuryFallback(query));
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
        console.log(`[Pexels API] Key ${index} succeeded!`);
        
        return NextResponse.json({
          ok: true,
          photos: data.photos || [],
          keyUsed: index,
          totalKeys: total,
          blacklisted: (await keyManager.getStats()).blacklisted
        });
        
      } catch (error) {
        console.error(`[Pexels API] Key ${index} network error:`, error);
        continue; // Try next key
      }
    }

    // All keys exhausted - return static luxury fallback
    console.error(`[Pexels API] All ${stats.total} keys exhausted. Blacklisted: ${stats.blacklisted}`);
    return NextResponse.json(getStaticLuxuryFallback(query));
    
  } catch (error) {
    console.error("❌ Pexels API error, returning static fallback:", error);
    return NextResponse.json(getStaticLuxuryFallback(query));
  }
}

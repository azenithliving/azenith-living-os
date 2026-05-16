import { NextRequest, NextResponse } from "next/server";
import { getNextAvailableKey, setKeyCooldown, getKeyStats } from "@/lib/api-keys-service";

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
function getStaticLuxuryFallback() {
  console.log('[Pexels API] Returning static luxury fallback images');
  // Premium luxury interior placeholder images
  return {
    ok: true,
    photos: [
      {
        id: 999001,
        width: 1920,
        height: 1280,
        url: "https://images.pexels.com/photos/1571460/pexels-photo-1571460.jpeg",
        photographer: "Azenith Luxury Collection",
        photographer_url: "#",
        src: {
          original: "https://images.pexels.com/photos/1571460/pexels-photo-1571460.jpeg",
          large2x: "https://images.pexels.com/photos/1571460/pexels-photo-1571460.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
          large: "https://images.pexels.com/photos/1571460/pexels-photo-1571460.jpeg?auto=compress&cs=tinysrgb&h=650&w=940",
          medium: "https://images.pexels.com/photos/1571460/pexels-photo-1571460.jpeg?auto=compress&cs=tinysrgb&h=350",
          small: "https://images.pexels.com/photos/1571460/pexels-photo-1571460.jpeg?auto=compress&cs=tinysrgb&h=130",
          portrait: "https://images.pexels.com/photos/1571460/pexels-photo-1571460.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1200&w=800",
          landscape: "https://images.pexels.com/photos/1571460/pexels-photo-1571460.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
          tiny: "https://images.pexels.com/photos/1571460/pexels-photo-1571460.jpeg?auto=compress&cs=tinysrgb&dpr=1&fit=crop&h=200&w=280"
        },
        avg_color: "#8B7355"
      },
      {
        id: 999002,
        width: 1920,
        height: 1280,
        url: "https://images.pexels.com/photos/1648771/pexels-photo-1648771.jpeg",
        photographer: "Azenith Luxury Collection",
        photographer_url: "#",
        src: {
          original: "https://images.pexels.com/photos/1648771/pexels-photo-1648771.jpeg",
          large2x: "https://images.pexels.com/photos/1648771/pexels-photo-1648771.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
          large: "https://images.pexels.com/photos/1648771/pexels-photo-1648771.jpeg?auto=compress&cs=tinysrgb&h=650&w=940",
          medium: "https://images.pexels.com/photos/1648771/pexels-photo-1648771.jpeg?auto=compress&cs=tinysrgb&h=350",
          small: "https://images.pexels.com/photos/1648771/pexels-photo-1648771.jpeg?auto=compress&cs=tinysrgb&h=130",
          portrait: "https://images.pexels.com/photos/1648771/pexels-photo-1648771.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1200&w=800",
          landscape: "https://images.pexels.com/photos/1648771/pexels-photo-1648771.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
          tiny: "https://images.pexels.com/photos/1648771/pexels-photo-1648771.jpeg?auto=compress&cs=tinysrgb&dpr=1&fit=crop&h=200&w=280"
        },
        avg_color: "#4A4A4A"
      },
      {
        id: 999003,
        width: 1920,
        height: 1280,
        url: "https://images.pexels.com/photos/1457842/pexels-photo-1457842.jpeg",
        photographer: "Azenith Luxury Collection",
        photographer_url: "#",
        src: {
          original: "https://images.pexels.com/photos/1457842/pexels-photo-1457842.jpeg",
          large2x: "https://images.pexels.com/photos/1457842/pexels-photo-1457842.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
          large: "https://images.pexels.com/photos/1457842/pexels-photo-1457842.jpeg?auto=compress&cs=tinysrgb&h=650&w=940",
          medium: "https://images.pexels.com/photos/1457842/pexels-photo-1457842.jpeg?auto=compress&cs=tinysrgb&h=350",
          small: "https://images.pexels.com/photos/1457842/pexels-photo-1457842.jpeg?auto=compress&cs=tinysrgb&h=130",
          portrait: "https://images.pexels.com/photos/1457842/pexels-photo-1457842.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1200&w=800",
          landscape: "https://images.pexels.com/photos/1457842/pexels-photo-1457842.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
          tiny: "https://images.pexels.com/photos/1457842/pexels-photo-1457842.jpeg?auto=compress&cs=tinysrgb&dpr=1&fit=crop&h=200&w=280"
        },
        avg_color: "#C5A059"
      }
    ],
    fallbackMode: true,
    keyUsed: -1
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query") || "luxury modern industrial interior";
    const perPage = Math.min(Math.max(Number(searchParams.get("per_page") || "12"), 1), 50);
    const page = Math.max(Number(searchParams.get("page") || "1"), 1);
    const orientation = searchParams.get("orientation") || "landscape";

    const stats = await keyManager.getStats();
    console.log(`[Pexels API] Stats: ${stats.total} total, ${stats.available} available, ${stats.blacklisted} blacklisted`);

    if (stats.available === 0) {
      console.warn("⚠️ No available Pexels API keys found. Returning fallback images.");
      return NextResponse.json(getStaticLuxuryFallback());
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
    return NextResponse.json(getStaticLuxuryFallback());
    
  } catch (error) {
    console.error("❌ Sovereign Engine Crash:", error);
    return NextResponse.json(
      { ok: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}

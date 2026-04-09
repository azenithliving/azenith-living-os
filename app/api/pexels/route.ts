import { NextRequest, NextResponse } from "next/server";

// Smart Key Rotation Manager with Blacklisting for Pexels
class PexelsKeyRotationManager {
  private keys: string[];
  private currentIndex: number = 0;
  private blacklistedKeys: Map<string, number> = new Map(); // key -> timestamp when blacklisted
  private readonly BLACKLIST_DURATION_MS = 10 * 60 * 1000; // 10 minutes

  constructor() {
    this.keys = this.loadKeys();
    console.log('[Pexels API] Smart Rotation: Loaded', this.keys.length, 'keys');
  }

  private loadKeys(): string[] {
    const keys: string[] = [];
    
    // Primary: PEXELS_KEYS (comma-separated for multiple keys)
    if (process.env.PEXELS_KEYS) {
      keys.push(...process.env.PEXELS_KEYS.split(',').map(k => k.trim()).filter(k => k.length > 0));
    }
    
    // Fallback to single key env vars
    if (process.env.NEXT_PUBLIC_PEXELS_API_KEY) {
      keys.push(process.env.NEXT_PUBLIC_PEXELS_API_KEY.trim());
    }
    if (process.env.PEXELS_API_KEY) {
      keys.push(process.env.PEXELS_API_KEY.trim());
    }
    
    // Remove duplicates while preserving order
    return [...new Set(keys)];
  }

  private isBlacklisted(key: string): boolean {
    const blacklistedAt = this.blacklistedKeys.get(key);
    if (!blacklistedAt) return false;
    
    const now = Date.now();
    if (now - blacklistedAt > this.BLACKLIST_DURATION_MS) {
      this.blacklistedKeys.delete(key);
      console.log('[Pexels API] Key unblacklisted after 10min cooldown');
      return false;
    }
    return true;
  }

  private getAvailableKeys(): string[] {
    const now = Date.now();
    for (const [key, timestamp] of this.blacklistedKeys.entries()) {
      if (now - timestamp > this.BLACKLIST_DURATION_MS) {
        this.blacklistedKeys.delete(key);
      }
    }
    return this.keys.filter(key => !this.isBlacklisted(key));
  }

  // Round-robin: get next available key
  getNextKey(): { key: string | null; index: number; total: number } {
    const available = this.getAvailableKeys();
    
    if (available.length === 0) {
      return { key: null, index: -1, total: this.keys.length };
    }

    this.currentIndex = (this.currentIndex + 1) % available.length;
    const selectedKey = available[this.currentIndex];
    const originalIndex = this.keys.indexOf(selectedKey) + 1;
    
    return { key: selectedKey, index: originalIndex, total: this.keys.length };
  }

  blacklistKey(key: string): void {
    this.blacklistedKeys.set(key, Date.now());
    const keyIndex = this.keys.indexOf(key) + 1;
    console.log(`[Pexels API] Key ${keyIndex} blacklisted for 10 minutes (429 detected)`);
  }

  getStats(): { total: number; available: number; blacklisted: number } {
    return {
      total: this.keys.length,
      available: this.getAvailableKeys().length,
      blacklisted: this.blacklistedKeys.size
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

    const stats = keyManager.getStats();
    console.log(`[Pexels API] Stats: ${stats.total} total, ${stats.available} available, ${stats.blacklisted} blacklisted`);

    if (stats.total === 0) {
      console.error("❌ Azenith Critical: No Pexels API keys found.");
      return NextResponse.json(
        { ok: false, message: "No API keys available in environment" },
        { status: 500 }
      );
    }

    // Smart Round-Robin Key Rotation
    let attempts = 0;
    const maxAttempts = stats.total * 2;
    
    while (attempts < maxAttempts) {
      const { key, index, total } = keyManager.getNextKey();
      
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
            keyManager.blacklistKey(key);
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
          blacklisted: keyManager.getStats().blacklisted
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

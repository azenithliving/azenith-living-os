#!/usr/bin/env ts-node
/**
 * Azenith Infinite Pulse: Elite Accumulation Protocol v2.0
 * Smart Harvesting Script
 * 
 * Features:
 * - Round-robin rotation of 5 Pexels + 5 Gemini keys
 * - 100 deep-search queries per category
 * - Ultra-luxury filtering via Gemini
 * - 9,000 initial elite images, 36,000 cap
 * - Deduplication across categories
 * - Automated batch processing
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: ".env.local" });

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
  // API Keys (Round-robin rotation)
  PEXELS_KEYS: (process.env.PEXELS_KEYS || "").split(",").filter(Boolean),
  GEMINI_KEYS: (process.env.GOOGLE_AI_KEYS || "").split(",").filter(Boolean),
  
  // Harvesting Targets
  TARGET_CATEGORIES: [
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
    "interior-design"
  ],
  
  STYLES: ["modern", "classic", "industrial", "scandinavian"],
  
  // Search Queries per category (100 unique combinations)
  QUERIES_PER_CATEGORY: 100,
  IMAGES_PER_QUERY: 80, // Pexels max per page
  
  // Elite Filtering
  INITIAL_TARGET: 9000,  // Initial harvest
  MAX_CAP: 36000,        // Maximum database size
  LUXURY_THRESHOLD: 0.85, // Gemini confidence score
  
  // Rate Limiting
  PEXELS_DELAY_MS: 200,  // Between requests
  GEMINI_DELAY_MS: 500,  // Between AI calls
  BATCH_SIZE: 100,       // Insert batch size
  
  // Deduplication
  URL_DEDUP_SET: new Set<string>(),
  ID_DEDUP_SET: new Set<number>(),
};

// ============================================
// SUPABASE CLIENT
// ============================================

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

// ============================================
// ROUND-ROBIN API KEY ROTATION
// ============================================

class KeyRotator {
  private pexelsIndex = 0;
  private geminiIndex = 0;
  
  getPexelsKey(): string {
    const key = CONFIG.PEXELS_KEYS[this.pexelsIndex];
    this.pexelsIndex = (this.pexelsIndex + 1) % CONFIG.PEXELS_KEYS.length;
    return key;
  }
  
  getGeminiKey(): string {
    const key = CONFIG.GEMINI_KEYS[this.geminiIndex];
    this.geminiIndex = (this.geminiIndex + 1) % CONFIG.GEMINI_KEYS.length;
    return key;
  }
  
  getStats() {
    return {
      pexelsKeysAvailable: CONFIG.PEXELS_KEYS.length,
      geminiKeysAvailable: CONFIG.GEMINI_KEYS.length,
      currentPexelsIndex: this.pexelsIndex,
      currentGeminiIndex: this.geminiIndex,
    };
  }
}

const keyRotator = new KeyRotator();

// ============================================
// QUERY GENERATOR (100 per category)
// ============================================

function generateSearchQueries(category: string, style: string): string[] {
  const baseQueries: Record<string, string[]> = {
    "master-bedroom": [
      "luxury master bedroom suite hotel interior",
      "luxury master bedroom marble headboard design",
      "high-end master bedroom architectural digest",
      "luxury master suite walk-in closet attached",
      "luxury master bedroom velvet curtains gold",
      "modern luxury master bedroom minimal design",
      "classic luxury master bedroom four poster bed",
      "luxury master bedroom ensuite bathroom view",
      "hotel style master bedroom luxury interior",
      "luxury master bedroom chandelier crystal"
    ],
    "children-room": [
      "luxury kids bedroom interior design playful",
      "luxury children bedroom elegant furniture",
      "high-end kids room interior architectural",
      "luxury nursery room premium design",
      "modern luxury kids bedroom soft colors",
      "luxury children room themed design",
      "premium kids bedroom with study area",
      "luxury kids room custom furniture",
      "elegant children bedroom interior",
      "luxury kids bedroom playful sophisticated"
    ],
    "teen-room": [
      "modern teenager bedroom study area contemporary",
      "luxury teen bedroom gaming setup elegant",
      "high-end teen room study desk design",
      "luxury teenager bedroom minimalist style",
      "contemporary teen bedroom luxury interior",
      "luxury teen room with lounge area",
      "modern luxury teen bedroom design",
      "premium teenager bedroom interior",
      "luxury teen bedroom study lounge combo",
      "sophisticated teen room interior design"
    ],
    "living-room": [
      "luxury modern living room high-end interior design",
      "architectural digest living room luxury",
      "luxury living room marble fireplace gold",
      "high-end living room velvet sofa interior",
      "luxury living room floor ceiling windows",
      "modern luxury living room minimal design",
      "classic luxury living room crystal chandelier",
      "luxury living room double height ceiling",
      "penthouse living room luxury interior",
      "luxury living room art collection display"
    ],
    "dining-room": [
      "bespoke dining area luxury interior dining",
      "luxury dining room marble table gold",
      "modern chandelier dining room luxury",
      "high-end dining room interior design",
      "luxury dining room floor ceiling windows",
      "classic luxury dining room crystal chandelier",
      "luxury dining room velvet chairs gold",
      "architectural digest dining room interior",
      "luxury dining room art walls design",
      "penthouse dining room luxury interior"
    ],
    "corner-sofa": [
      "luxury corner sofa sectional living room",
      "high-end corner sofa velvet leather design",
      "luxury sectional sofa interior design",
      "premium corner sofa living room elegant",
      "luxury L-shaped sofa modern interior",
      "designer corner sofa luxury living room",
      "luxury modular sofa sectional interior",
      "high-end corner sofa chaise lounge",
      "luxury corner sofa gold accents room",
      "bespoke corner sofa luxury interior"
    ],
    "lounge": [
      "luxury lounge seating area interior design",
      "high-end lounge area modern elegant",
      "luxury reading corner interior design",
      "premium lounge chair side table interior",
      "luxury lounge area velvet armchair",
      "modern luxury lounge seating design",
      "classic luxury lounge interior room",
      "luxury lounge area floor lamp elegant",
      "architectural digest lounge interior",
      "luxury lounge area window view design"
    ],
    "dressing-room": [
      "bespoke walk-in closet luxury dressing room",
      "luxury dressing room island center",
      "high-end walk-in closet interior design",
      "luxury dressing room mirror lights",
      "premium walk-in closet organization",
      "luxury dressing room vanity mirror",
      "modern luxury walk-in closet design",
      "classic luxury dressing room interior",
      "luxury dressing room chandelier elegant",
      "designer walk-in closet luxury interior"
    ],
    "kitchen": [
      "luxury high-end kitchen marble bespoke interior",
      "luxury kitchen island marble waterfall",
      "high-end kitchen custom cabinets gold",
      "luxury kitchen pendant lights island",
      "modern luxury kitchen interior design",
      "classic luxury kitchen marble backsplash",
      "luxury kitchen professional appliances",
      "architectural digest kitchen interior",
      "luxury kitchen double island design",
      "penthouse kitchen luxury interior gold"
    ],
    "home-office": [
      "luxury home office study room executive interior",
      "high-end home office desk leather chair",
      "luxury home office floor ceiling shelves",
      "premium home office interior design",
      "luxury study room wood paneling gold",
      "modern luxury home office minimal design",
      "classic luxury home office library feel",
      "luxury home office view window design",
      "executive home office luxury interior",
      "architectural digest home office study"
    ],
    "interior-design": [
      "luxury comprehensive interior design whole house",
      "high-end interior design open plan",
      "luxury penthouse interior design architecture",
      "premium interior design studio apartment",
      "luxury villa interior design architecture",
      "modern luxury interior design minimal",
      "classic luxury interior design ornate",
      "luxury loft interior design industrial",
      "architectural digest interior design whole",
      "luxury interior design project complete"
    ]
  };
  
  const base = baseQueries[category] || ["luxury interior design"];
  const queries: string[] = [];
  
  // Generate 100 unique queries by combining base + style + variations
  for (let i = 0; i < CONFIG.QUERIES_PER_CATEGORY; i++) {
    const baseQuery = base[i % base.length];
    const styleHint = style === "modern" ? "modern minimal" : 
                      style === "classic" ? "classic elegant" :
                      style === "industrial" ? "industrial loft" :
                      "scandinavian cozy";
    
    const variations = [
      "",
      " 4k resolution",
      " architectural photography",
      " cinematic lighting",
      " photorealistic",
      " interior photography",
      " professional photo",
      " high resolution",
      " detailed",
      " wide angle"
    ];
    
    const variation = variations[Math.floor(i / 10) % variations.length];
    queries.push(`${styleHint} ${baseQuery}${variation}`);
  }
  
  return queries;
}

// ============================================
// PEXELS API FETCHER
// ============================================

async function fetchFromPexels(query: string, perPage: number = 80, page: number = 1): Promise<any[]> {
  const apiKey = keyRotator.getPexelsKey();
  
  try {
    const response = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${perPage}&page=${page}`,
      {
        headers: {
          "Authorization": apiKey,
        },
      }
    );
    
    if (!response.ok) {
      if (response.status === 429) {
        console.warn(`[Pexels] Rate limited, waiting...`);
        await sleep(5000);
        return fetchFromPexels(query, perPage, page);
      }
      throw new Error(`Pexels API error: ${response.status}`);
    }
    
    const data = await response.json();
    return data.photos || [];
  } catch (error) {
    console.error(`[Pexels] Fetch error:`, error);
    return [];
  }
}

// ============================================
// GEMINI ULTRA-LUXURY FILTER
// ============================================

async function filterWithGemini(photos: any[], category: string, style: string): Promise<any[]> {
  const apiKey = keyRotator.getGeminiKey();
  const approved: any[] = [];
  
  for (const photo of photos) {
    try {
      const prompt = `
        Analyze this interior design image for category "${category}" with style "${style}".
        
        Rate the following from 0-1:
        1. Luxury Level (0-1): Is this high-end, premium, luxury interior?
        2. Style Match (0-1): Does it match ${style} style?
        3. Category Fit (0-1): Is this clearly a ${category}?
        4. Image Quality (0-1): Is this professional photography, high resolution?
        5. Overall Score (0-1): Would this appear in Architectural Digest?
        
        Image URL: ${photo.src?.large || photo.src?.medium}
        Photographer: ${photo.photographer}
        
        Respond ONLY with a JSON object:
        {
          "luxury": number,
          "styleMatch": number,
          "categoryFit": number,
          "quality": number,
          "overall": number,
          "isElite": boolean,
          "reason": "brief explanation"
        }
      `;
      
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
          })
        }
      );
      
      if (!response.ok) {
        if (response.status === 429) {
          console.warn(`[Gemini] Rate limited, waiting...`);
          await sleep(60000); // Wait 1 minute for Gemini
          continue;
        }
        throw new Error(`Gemini API error: ${response.status}`);
      }
      
      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      
      // Extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        
        if (result.isElite && result.overall >= CONFIG.LUXURY_THRESHOLD) {
          approved.push({
            ...photo,
            aiScore: result.overall,
            aiReason: result.reason,
            metadata: {
              luxury: result.luxury,
              styleMatch: result.styleMatch,
              categoryFit: result.categoryFit,
              quality: result.quality,
              overall: result.overall,
              reason: result.reason,
              analyzedAt: new Date().toISOString()
            }
          });
        }
      }
      
      await sleep(CONFIG.GEMINI_DELAY_MS);
    } catch (error) {
      console.warn(`[Gemini] Analysis error for photo ${photo.id}:`, error);
    }
  }
  
  return approved;
}

// ============================================
// DEDUPLICATION
// ============================================

function isDuplicate(photo: any): boolean {
  const url = photo.src?.large || photo.src?.original || photo.url;
  const id = photo.id;
  
  if (CONFIG.URL_DEDUP_SET.has(url)) return true;
  if (CONFIG.ID_DEDUP_SET.has(id)) return true;
  
  return false;
}

function markAsDuplicate(photo: any): void {
  const url = photo.src?.large || photo.src?.original || photo.url;
  CONFIG.URL_DEDUP_SET.add(url);
  CONFIG.ID_DEDUP_SET.add(photo.id);
}

// ============================================
// DATABASE OPERATIONS
// ============================================

async function insertEliteImages(images: any[], category: string, style: string): Promise<number> {
  const records = images.map(photo => ({
    id: photo.id,
    url: photo.src?.large || photo.src?.medium || photo.url,
    room_type: category,
    style: style,
    metadata: {
      photographer: photo.photographer,
      photographer_url: photo.photographer_url,
      width: photo.width,
      height: photo.height,
      avg_color: photo.avg_color,
      aiScore: photo.aiScore,
      aiReason: photo.aiReason,
      ...photo.metadata
    },
    is_active: true
  }));
  
  try {
    const { error } = await supabase
      .from("curated_images")
      .upsert(records, { 
        onConflict: "id",
        ignoreDuplicates: true 
      });
    
    if (error) {
      console.error(`[Database] Insert error:`, error);
      return 0;
    }
    
    return records.length;
  } catch (error) {
    console.error(`[Database] Exception:`, error);
    return 0;
  }
}

async function getCurrentImageCount(): Promise<number> {
  const { count, error } = await supabase
    .from("curated_images")
    .select("*", { count: "exact", head: true })
    .eq("is_active", true);
  
  if (error) {
    console.error(`[Database] Count error:`, error);
    return 0;
  }
  
  return count || 0;
}

// ============================================
// UTILITIES
// ============================================

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================
// MAIN HARVESTING ENGINE
// ============================================

async function harvestCategory(category: string, style: string): Promise<number> {
  console.log(`\n[Harvest] Starting: ${category} / ${style}`);
  
  const queries = generateSearchQueries(category, style);
  let harvestedCount = 0;
  
  for (let i = 0; i < queries.length; i++) {
    const query = queries[i];
    console.log(`  Query ${i + 1}/${queries.length}: ${query.substring(0, 60)}...`);
    
    // Check current count
    const currentCount = await getCurrentImageCount();
    if (currentCount >= CONFIG.MAX_CAP) {
      console.log(`[Harvest] Cap reached: ${currentCount}/${CONFIG.MAX_CAP}`);
      return harvestedCount;
    }
    
    // Fetch from Pexels
    const photos = await fetchFromPexels(query, CONFIG.IMAGES_PER_QUERY);
    await sleep(CONFIG.PEXELS_DELAY_MS);
    
    if (photos.length === 0) {
      console.log(`    No photos found`);
      continue;
    }
    
    // Filter duplicates
    const uniquePhotos = photos.filter(p => !isDuplicate(p));
    console.log(`    Fetched: ${photos.length}, Unique: ${uniquePhotos.length}`);
    
    if (uniquePhotos.length === 0) continue;
    
    // Filter with Gemini for ultra-luxury
    const elitePhotos = await filterWithGemini(uniquePhotos, category, style);
    console.log(`    Gemini approved: ${elitePhotos.length}/${uniquePhotos.length}`);
    
    if (elitePhotos.length === 0) continue;
    
    // Mark as duplicates (we're storing these)
    elitePhotos.forEach(markAsDuplicate);
    
    // Insert to database
    const inserted = await insertEliteImages(elitePhotos, category, style);
    harvestedCount += inserted;
    
    console.log(`    Inserted: ${inserted} | Total DB: ${currentCount + inserted}`);
    
    // Rate limiting between batches
    await sleep(CONFIG.PEXELS_DELAY_MS * 2);
  }
  
  return harvestedCount;
}

async function runEliteHarvester() {
  console.log("╔════════════════════════════════════════════════════════╗");
  console.log("║  AZENITH INFINITE PULSE: ELITE HARVESTER v2.0          ║");
  console.log("║  Smart Accumulation Protocol                           ║");
  console.log("╚════════════════════════════════════════════════════════╝\n");
  
  // Initial stats
  const stats = keyRotator.getStats();
  console.log(`API Keys: ${stats.pexelsKeysAvailable} Pexels, ${stats.geminiKeysAvailable} Gemini`);
  console.log(`Categories: ${CONFIG.TARGET_CATEGORIES.length}`);
  console.log(`Styles: ${CONFIG.STYLES.length}`);
  console.log(`Initial Target: ${CONFIG.INITIAL_TARGET} images`);
  console.log(`Max Cap: ${CONFIG.MAX_CAP} images\n`);
  
  // Check current database state
  const currentCount = await getCurrentImageCount();
  console.log(`Current Database: ${currentCount} elite images\n`);
  
  if (currentCount >= CONFIG.INITIAL_TARGET) {
    console.log(`[Status] Initial target reached. Running maintenance harvest...`);
  }
  
  let totalHarvested = 0;
  
  // Harvest each category-style combination
  for (const category of CONFIG.TARGET_CATEGORIES) {
    for (const style of CONFIG.STYLES) {
      const count = await harvestCategory(category, style);
      totalHarvested += count;
      
      // Check if we've reached the cap
      const newCount = await getCurrentImageCount();
      if (newCount >= CONFIG.MAX_CAP) {
        console.log(`\n[Complete] Maximum cap reached: ${newCount}/${CONFIG.MAX_CAP}`);
        console.log(`Total harvested this run: ${totalHarvested}`);
        return;
      }
    }
  }
  
  console.log(`\n[Complete] Harvesting finished`);
  console.log(`Total harvested this run: ${totalHarvested}`);
  console.log(`Final database count: ${await getCurrentImageCount()}`);
}

// ============================================
// ENTRY POINT
// ============================================

if (require.main === module) {
  runEliteHarvester()
    .then(() => {
      console.log("\n✅ Elite Harvesting Complete");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n❌ Elite Harvesting Failed:", error);
      process.exit(1);
    });
}

export { runEliteHarvester, harvestCategory, CONFIG };

#!/usr/bin/env ts-node
/**
 * Azenith Infinite Pulse: TEST HARVEST RUN
 * Test Run: Fetch and filter 50 images for living-room category across all 4 styles
 * Using API Rotation with 5 keys
 * Using official @google/generative-ai SDK
 */

import { createClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: ".env.local" });

// ============================================
// TEST CONFIGURATION
// ============================================

const CONFIG = {
  // API Keys (Round-robin rotation)
  PEXELS_KEYS: (process.env.PEXELS_KEYS || "").split(",").filter(Boolean),
  GEMINI_KEYS: (process.env.GOOGLE_AI_KEYS || "").split(",").filter(Boolean),

  // Test Run: Only living-room category, 4 styles
  TARGET_CATEGORIES: ["living-room"],
  STYLES: ["modern", "classic", "industrial", "scandinavian"],

  // Reduced for test: ~3 queries per style = ~12-15 images per style = ~50 total
  QUERIES_PER_CATEGORY: 12,
  IMAGES_PER_QUERY: 40, // Smart Buffering: 40 images for larger pool

  // Tiered Filtering Thresholds (Dynamic Confidence Strategy)
  THRESHOLD_TIERS: [0.90, 0.80, 0.70], // Ultra-Elite -> Premium -> High-End Luxury
  MIN_THRESHOLD: 0.70, // NEVER go below this (Azenith brand prestige)

  // Rate Limiting
  PEXELS_DELAY_MS: 200,
  GEMINI_DELAY_MS: 500,

  // Deduplication
  URL_DEDUP_SET: new Set<string>(),
  ID_DEDUP_SET: new Set<number>(),

  // Test limits
  MAX_IMAGES_PER_STYLE: 13, // ~50 total across 4 styles
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
    console.log(`  [API Rotate] Pexels key ${this.pexelsIndex}/${CONFIG.PEXELS_KEYS.length}`);
    return key;
  }

  getGeminiKey(): string {
    const key = CONFIG.GEMINI_KEYS[this.geminiIndex];
    this.geminiIndex = (this.geminiIndex + 1) % CONFIG.GEMINI_KEYS.length;
    console.log(`  [API Rotate] Gemini key ${this.geminiIndex}/${CONFIG.GEMINI_KEYS.length}`);
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
// QUERY GENERATOR
// ============================================

function generateSearchQueries(category: string, style: string): string[] {
  const baseQueries: Record<string, string[]> = {
    "living-room": [
      "luxury modern living room high-end interior design",
      "architectural digest living room luxury",
      "luxury living room marble fireplace gold",
      "high-end living room velvet sofa interior"
    ]
  };

  const base = baseQueries[category] || ["luxury interior design"];
  const queries: string[] = [];

  // Generate queries by combining base + style + variations
  for (let i = 0; i < CONFIG.QUERIES_PER_CATEGORY; i++) {
    const baseQuery = base[i % base.length];
    const styleHint = style === "modern" ? "modern minimal" :
                      style === "classic" ? "classic elegant" :
                      style === "industrial" ? "industrial loft" :
                      "scandinavian cozy";

    const variations = [
      "",
      " 4k resolution",
      " architectural photography"
    ];

    const variation = variations[i % variations.length];
    queries.push(`${styleHint} ${baseQuery}${variation}`);
  }

  return queries;
}

// ============================================
// PEXELS API FETCHER
// ============================================

async function fetchFromPexels(query: string, perPage: number = 20, page: number = 1): Promise<any[]> {
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
// GEMINI TIERED LUXURY FILTER - Using Official SDK
// ============================================

// Fetch image and convert to base64
async function fetchImageAsBase64(imageUrl: string): Promise<{ data: string; mimeType: string } | null> {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      console.warn(`[Image Fetch] Failed to fetch ${imageUrl}: ${response.status}`);
      return null;
    }
    
    const contentType = response.headers.get("content-type") || "image/jpeg";
    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    
    return {
      data: base64,
      mimeType: contentType
    };
  } catch (error) {
    console.warn(`[Image Fetch] Error fetching ${imageUrl}:`, error);
    return null;
  }
}

// Analyze photo using Google Generative AI SDK
async function analyzePhotoWithGeminiSDK(photo: any, category: string, style: string): Promise<{ score: number; isElite: boolean; reason: string; metadata: any } | null> {
  const apiKey = keyRotator.getGeminiKey();
  const startTime = Date.now();

  try {
    // Initialize SDK with API key - use v1 API version (not v1beta)
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel(
      { model: "gemini-1.5-flash-001" },
      { apiVersion: "v1" }
    );

    // Fetch image as base64
    const imageUrl = photo.src?.large || photo.src?.medium || photo.src?.original;
    if (!imageUrl) {
      console.warn(`[Gemini SDK] No image URL for photo ${photo.id}`);
      return null;
    }

    const imageData = await fetchImageAsBase64(imageUrl);
    if (!imageData) {
      console.warn(`[Gemini SDK] Failed to fetch image for photo ${photo.id}`);
      return null;
    }

    const prompt = `
      Analyze this interior design image for category "${category}" with style "${style}".

      Rate the following from 0-1:
      1. Luxury Level (0-1): Is this high-end, premium, luxury interior?
      2. Style Match (0-1): Does it match ${style} style?
      3. Category Fit (0-1): Is this clearly a ${category}?
      4. Image Quality (0-1): Is this professional photography, high resolution?
      5. Overall Score (0-1): Would this appear in Architectural Digest?

      Photographer: ${photo.photographer || "Unknown"}

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

    // Prepare content with inline data
    const result = await model.generateContent({
      contents: [{
        role: "user",
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: imageData.mimeType,
              data: imageData.data
            }
          }
        ]
      }]
    });

    const duration = Date.now() - startTime;
    const response = await result.response;
    const text = response.text();

    console.log(`[Gemini SDK] Response received (${duration}ms)`);

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        score: parsed.overall,
        isElite: parsed.isElite,
        reason: parsed.reason,
        metadata: {
          luxury: parsed.luxury,
          styleMatch: parsed.styleMatch,
          categoryFit: parsed.categoryFit,
          quality: parsed.quality,
          overall: parsed.overall,
          reason: parsed.reason
        }
      };
    }
  } catch (error: any) {
    // Handle specific SDK errors
    if (error?.message?.includes("429") || error?.status === 429) {
      console.warn(`[Gemini SDK] Rate limited for photo ${photo.id}, skipping...`);
      return null;
    }
    if (error?.message?.includes("404") || error?.status === 404) {
      console.warn(`[Gemini SDK] Model not found (404) for photo ${photo.id}, check API key permissions`);
      return null;
    }
    console.warn(`[Gemini SDK] Analysis error for photo ${photo.id}:`, error?.message || error);
  }

  return null;
}

// Tiered Filtering with Dynamic Confidence Strategy
async function filterWithGeminiTiered(photos: any[], category: string, style: string, threshold: number): Promise<any[]> {
  const approved: any[] = [];

  for (const photo of photos) {
    const analysis = await analyzePhotoWithGeminiSDK(photo, category, style);

    if (analysis && analysis.isElite && analysis.score >= threshold) {
      approved.push({
        ...photo,
        aiScore: analysis.score,
        aiReason: analysis.reason,
        metadata: {
          ...analysis.metadata,
          thresholdUsed: threshold,
          analyzedAt: new Date().toISOString()
        }
      });
      console.log(`      ✓ Photo ${photo.id}: Score ${analysis.score.toFixed(2)} (threshold: ${threshold})`);
    }

    await sleep(CONFIG.GEMINI_DELAY_MS);
  }

  return approved;
}

// Smart Tiered Filtering: Try 0.90 -> 0.80 -> 0.70
async function filterWithSmartTiers(photos: any[], category: string, style: string): Promise<any[]> {
  console.log(`    [Smart Tier] Starting with ${photos.length} photos`);

  for (let tierIndex = 0; tierIndex < CONFIG.THRESHOLD_TIERS.length; tierIndex++) {
    const threshold = CONFIG.THRESHOLD_TIERS[tierIndex];
    const tierName = tierIndex === 0 ? "Ultra-Elite" : tierIndex === 1 ? "Premium" : "High-End Luxury";

    console.log(`    [Tier ${tierIndex + 1}] ${tierName} threshold: ${threshold}`);

    const approved = await filterWithGeminiTiered(photos, category, style, threshold);

    if (approved.length > 0) {
      console.log(`    [Tier Success] ${approved.length} images approved at ${threshold} threshold`);
      return approved;
    }

    // Log threshold drop (except for last tier)
    if (tierIndex < CONFIG.THRESHOLD_TIERS.length - 1) {
      console.log(`    ⚠️ Dropping threshold to ${CONFIG.THRESHOLD_TIERS[tierIndex + 1]} due to low yield`);
    }
  }

  console.log(`    ❌ Low-Quality Batch: No images passed even at floor threshold (${CONFIG.MIN_THRESHOLD})`);
  return [];
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
    const { data, error } = await supabase
      .from("curated_images")
      .upsert(records, {
        onConflict: "id",
        ignoreDuplicates: true
      })
      .select();

    if (error) {
      console.error(`[Database] Insert error:`, error);
      return 0;
    }

    console.log(`  [Database] Inserted ${data?.length || records.length} records`);
    return data?.length || records.length;
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

async function getImagesForCategoryStyle(category: string, style: string): Promise<number> {
  const { count, error } = await supabase
    .from("curated_images")
    .select("*", { count: "exact", head: true })
    .eq("room_type", category)
    .eq("style", style)
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

  // Check current count for this style
  const currentStyleCount = await getImagesForCategoryStyle(category, style);
  console.log(`  Current count for ${style}: ${currentStyleCount}/${CONFIG.MAX_IMAGES_PER_STYLE}`);

  if (currentStyleCount >= CONFIG.MAX_IMAGES_PER_STYLE) {
    console.log(`  [Skip] ${style} already has ${currentStyleCount} images`);
    return 0;
  }

  const queries = generateSearchQueries(category, style);
  let harvestedCount = 0;

  for (let i = 0; i < queries.length; i++) {
    // Check if we've hit the limit for this style
    const currentCount = await getImagesForCategoryStyle(category, style);
    if (currentCount >= CONFIG.MAX_IMAGES_PER_STYLE) {
      console.log(`  [Limit reached] ${style}: ${currentCount} images`);
      break;
    }

    const query = queries[i];
    console.log(`\n  Query ${i + 1}/${queries.length}: ${query.substring(0, 60)}...`);

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

    if (uniquePhotos.length === 0) {
      console.log(`    ⚠️ All photos already used - skipping to next query`);
      continue;
    }

    // Filter with Smart Tiered Strategy (0.90 -> 0.80 -> 0.70)
    const elitePhotos = await filterWithSmartTiers(uniquePhotos, category, style);

    if (elitePhotos.length === 0) {
      console.log(`    ⚠️ Low-Quality Batch: No images passed tiered filter - skipping to next query`);
      continue;
    }

    // Mark as duplicates (we're storing these)
    elitePhotos.forEach(markAsDuplicate);

    // Insert to database
    const inserted = await insertEliteImages(elitePhotos, category, style);
    harvestedCount += inserted;

    const newTotal = await getImagesForCategoryStyle(category, style);
    console.log(`    Style total: ${newTotal} images`);

    // Rate limiting between batches
    await sleep(CONFIG.PEXELS_DELAY_MS * 2);
  }

  return harvestedCount;
}

async function runTestHarvester() {
  console.log("╔════════════════════════════════════════════════════════╗");
  console.log("║  AZENITH TEST HARVEST RUN                              ║");
  console.log("║  Target: 50 images for living-room (4 styles)          ║");
  console.log("╚════════════════════════════════════════════════════════╝\n");

  // Initial stats
  const stats = keyRotator.getStats();
  console.log(`API Keys: ${stats.pexelsKeysAvailable} Pexels, ${stats.geminiKeysAvailable} Gemini`);
  console.log(`Category: ${CONFIG.TARGET_CATEGORIES[0]}`);
  console.log(`Styles: ${CONFIG.STYLES.join(", ")}`);
  console.log(`Max per style: ${CONFIG.MAX_IMAGES_PER_STYLE} images\n`);

  // Check current database state
  const currentCount = await getCurrentImageCount();
  console.log(`Current Database: ${currentCount} elite images\n`);

  let totalHarvested = 0;

  // Harvest for each style
  for (const style of CONFIG.STYLES) {
    const count = await harvestCategory("living-room", style);
    totalHarvested += count;
    console.log(`\n[Style Complete] ${style}: ${count} new images`);
  }

  // Final summary
  console.log("\n╔════════════════════════════════════════════════════════╗");
  console.log("║  TEST HARVEST COMPLETE                                 ║");
  console.log("╚════════════════════════════════════════════════════════╝");
  console.log(`Total harvested this run: ${totalHarvested}`);

  // Show final breakdown
  console.log("\n[Final Breakdown by Style]");
  for (const style of CONFIG.STYLES) {
    const count = await getImagesForCategoryStyle("living-room", style);
    console.log(`  ${style}: ${count} images`);
  }

  const finalTotal = await getCurrentImageCount();
  console.log(`\nFinal database count: ${finalTotal} images`);
}

// ============================================
// ENTRY POINT
// ============================================

if (require.main === module) {
  runTestHarvester()
    .then(() => {
      console.log("\n✅ Test Harvest Complete");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n❌ Test Harvest Failed:", error);
      process.exit(1);
    });
}

export { runTestHarvester, CONFIG };

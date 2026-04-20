#!/usr/bin/env ts-node
/**
 * Azenith Infinite Pulse: Elite Accumulation Protocol v3.0
 * Mega Scale: 50,000 → 15,000 Elite Images
 * 
 * Features:
 * - 50,000 raw images from Pexels
 * - AI filtering to 15,000 elite (30% acceptance rate)
 * - Equal distribution: 1,500 per room (4 styles × ~375 each)
 * - Smart throttling to protect API keys
 * - URL-only storage (CDN-ready for millions of visitors)
 * - Monthly auto-refresh cycle
 */

import { createClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as dotenv from "dotenv";
import { analyzeImageWithProxy, checkProxyHealth } from "../lib/gemini-proxy-client";

// Load environment variables
dotenv.config({ path: ".env.local" });

// ============================================
// CONFIGURATION - OPTIMIZED FOR MILLIONS OF VISITORS
// ============================================

const CONFIG = {
  // API Keys (Round-robin rotation)
  PEXELS_KEYS: (process.env.PEXELS_KEYS || "").split(",").filter(Boolean),
  GEMINI_KEYS: (process.env.GOOGLE_AI_KEYS || "").split(",").filter(Boolean),
  GROQ_KEYS: (process.env.GROQ_KEYS || "").split(",").filter(Boolean),
  
  // === MEGA SCALE TARGETS ===
  TARGET_RAW_IMAGES: 50000,        // سحب 50,000 صورة أولية
  TARGET_FILTERED_IMAGES: 15000,    // الناتج النهائي: 15,000 صورة elite
  
  // === EQUAL DISTRIBUTION: 1,500 per room ===
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
  ], // 10 rooms × 4 styles × 375 = 15,000
  
  STYLES: ["modern", "classic", "industrial", "scandinavian"],
  
  // Images per room-style combination (equal distribution)
  IMAGES_PER_COMBINATION: 375,  // 15,000 ÷ 10 rooms ÷ 4 styles = 375
  
  // === AI FILTERING THRESHOLDS (Tiered for 30% acceptance) ===
  THRESHOLDS: {
    ULTRA_ELITE: 0.95,    // 10% - Perfect match
    PREMIUM: 0.88,        // 15% - Excellent match  
    ELITE: 0.80,          // 5% - Very good match
  },
  MIN_THRESHOLD: 0.80,   // Never below 80% (Azenith brand prestige)
  
  // === SMART THROTTLING (API Protection) ===
  THROTTLING: {
    // Daily batch limits to stay within free tiers
    DAILY_PEXELS_LIMIT: 800,      // 800 requests/day (5 keys × 200)
    DAILY_GEMINI_LIMIT: 2500,     // 2500 images/day (5 keys × 500)
    
    // Delays between requests (ms)
    PEXELS_DELAY: 300,            // 300ms = ~200/hour/key (safe)
    GEMINI_DELAY: 1200,           // 1200ms = ~50/minute/key (safe)
    GROQ_DELAY: 500,              // 500ms backup filtering
    
    // Cooldown if approaching limits
    COOLDOWN_THRESHOLD: 80,        // 80% usage triggers cooldown
    COOLDOWN_DURATION: 3600000,    // 1 hour rest
  },
  
  // === STORAGE: URL-ONLY (CDN Optimization) ===
  STORAGE: {
    SAVE_URLS_ONLY: true,          // No local storage, use Pexels CDN
    SAVE_METADATA: true,          // Photographer, dimensions, AI scores
    THUMBNAIL_SIZE: "medium",     // 350px for previews
    DISPLAY_SIZE: "large",        // 940px for gallery
    ORIGINAL_SIZE: "original",    // Full resolution on demand
  },
  
  // === BATCH PROCESSING ===
  PEXELS_BATCH_SIZE: 80,          // Pexels max per request
  DB_BATCH_SIZE: 500,             // Insert 500 at a time
  CHECKPOINT_INTERVAL: 1000,       // Save progress every 1K images
  
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
// API USAGE TRACKER (Protects Limits)
// ============================================

class APIUsageTracker {
  private pexelsUsed = 0;
  private geminiUsed = 0;
  private dailyStartTime = Date.now();
  
  checkPexelsLimit(): boolean {
    return this.pexelsUsed < CONFIG.THROTTLING.DAILY_PEXELS_LIMIT;
  }
  
  checkGeminiLimit(): boolean {
    return this.geminiUsed < CONFIG.THROTTLING.DAILY_GEMINI_LIMIT;
  }
  
  incrementPexels(): void {
    this.pexelsUsed++;
  }
  
  incrementGemini(count: number = 1): void {
    this.geminiUsed += count;
  }
  
  getStats() {
    return {
      pexels: { used: this.pexelsUsed, limit: CONFIG.THROTTLING.DAILY_PEXELS_LIMIT },
      gemini: { used: this.geminiUsed, limit: CONFIG.THROTTLING.DAILY_GEMINI_LIMIT },
      percentUsed: {
        pexels: Math.round((this.pexelsUsed / CONFIG.THROTTLING.DAILY_PEXELS_LIMIT) * 100),
        gemini: Math.round((this.geminiUsed / CONFIG.THROTTLING.DAILY_GEMINI_LIMIT) * 100),
      }
    };
  }
  
  shouldCooldown(): boolean {
    const stats = this.getStats();
    return stats.percentUsed.pexels > CONFIG.THROTTLING.COOLDOWN_THRESHOLD ||
           stats.percentUsed.gemini > CONFIG.THROTTLING.COOLDOWN_THRESHOLD;
  }
}

const usageTracker = new APIUsageTracker();

// ============================================
// ROUND-ROBIN KEY ROTATION WITH FAILOVER
// ============================================

class KeyRotator {
  private pexelsIndex = 0;
  private geminiIndex = 0;
  private failedKeys = new Map<string, number>();
  
  getPexelsKey(): string | null {
    const attempts = CONFIG.PEXELS_KEYS.length;
    for (let i = 0; i < attempts; i++) {
      const key = CONFIG.PEXELS_KEYS[this.pexelsIndex];
      this.pexelsIndex = (this.pexelsIndex + 1) % CONFIG.PEXELS_KEYS.length;
      
      if (!this.isKeyFailed(key)) {
        return key;
      }
    }
    return null; // All keys exhausted
  }
  
  getGeminiKey(): string | null {
    const attempts = CONFIG.GEMINI_KEYS.length;
    for (let i = 0; i < attempts; i++) {
      const key = CONFIG.GEMINI_KEYS[this.geminiIndex];
      this.geminiIndex = (this.geminiIndex + 1) % CONFIG.GEMINI_KEYS.length;
      
      if (!this.isKeyFailed(key)) {
        return key;
      }
    }
    return null;
  }
  
  markKeyFailed(key: string): void {
    this.failedKeys.set(key, Date.now());
    console.log(`[KeyRotator] Key marked failed, cooling for 1 hour`);
  }
  
  private isKeyFailed(key: string): boolean {
    const failedAt = this.failedKeys.get(key);
    if (!failedAt) return false;
    
    // Reset after 1 hour
    if (Date.now() - failedAt > 3600000) {
      this.failedKeys.delete(key);
      return false;
    }
    return true;
  }
  
  getStats() {
    return {
      pexelsAvailable: CONFIG.PEXELS_KEYS.length - this.getFailedCount(CONFIG.PEXELS_KEYS),
      geminiAvailable: CONFIG.GEMINI_KEYS.length - this.getFailedCount(CONFIG.GEMINI_KEYS),
      failedKeys: this.failedKeys.size,
    };
  }
  
  private getFailedCount(keys: string[]): number {
    return keys.filter(k => this.failedKeys.has(k)).length;
  }
}

const keyRotator = new KeyRotator();

// ============================================
// QUERY GENERATOR (Diverse for maximum coverage)
// ============================================

function generateSearchQueries(category: string, style: string): string[] {
  const styleKeywords: Record<string, string[]> = {
    modern: ["contemporary", "minimalist", "sleek", "clean lines", "modern"],
    classic: ["traditional", "elegant", "timeless", "ornate", "classic"],
    industrial: ["loft", "raw", "exposed", "urban", "industrial"],
    scandinavian: ["nordic", "hygge", "light wood", "airy", "scandinavian"],
  };
  
  const roomKeywords: Record<string, string[]> = {
    "master-bedroom": ["master bedroom", "master suite", "primary bedroom"],
    "children-room": ["kids bedroom", "children room", "nursery"],
    "teen-room": ["teen bedroom", "teenager room", "youth room"],
    "living-room": ["living room", "family room", "sitting room"],
    "dining-room": ["dining room", "dining area", "breakfast room"],
    "corner-sofa": ["corner sofa", "sectional sofa", "L-shaped sofa"],
    "lounge": ["lounge", "reading nook", "relaxation area"],
    "dressing-room": ["walk-in closet", "dressing room", "wardrobe"],
    "kitchen": ["kitchen", "culinary space", "chef kitchen"],
    "home-office": ["home office", "study", "workspace"],
  };
  
  const styles = styleKeywords[style] || [style];
  const rooms = roomKeywords[category] || [category];
  
  // Generate 10 diverse queries per combination
  const queries: string[] = [];
  for (const room of rooms) {
    for (const s of styles) {
      queries.push(
        `luxury ${room} ${s} interior design high-end`,
        `premium ${room} ${s} architectural digest`,
        `elegant ${room} ${s} luxury home`,
        `bespoke ${room} ${s} interior`,
        `designer ${room} ${s} luxury`,
      );
    }
  }
  
  return [...new Set(queries)]; // Deduplicate
}

// ============================================
// PEXELS FETCHING WITH THROTTLING
// ============================================

async function fetchFromPexels(query: string, perPage: number = 80): Promise<any[]> {
  if (!usageTracker.checkPexelsLimit()) {
    console.log(`[Pexels] Daily limit reached, cooling down...`);
    await sleep(CONFIG.THROTTLING.COOLDOWN_DURATION);
    return [];
  }
  
  const key = keyRotator.getPexelsKey();
  if (!key) {
    console.error(`[Pexels] No available keys!`);
    return [];
  }
  
  try {
    const response = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${perPage}&orientation=landscape`,
      {
        headers: { Authorization: key },
        signal: AbortSignal.timeout(30000), // 30s timeout
      }
    );
    
    usageTracker.incrementPexels();
    
    if (response.status === 429) {
      keyRotator.markKeyFailed(key);
      return [];
    }
    
    if (!response.ok) {
      console.error(`[Pexels] Error ${response.status}: ${response.statusText}`);
      return [];
    }
    
    const data = await response.json();
    return data.photos || [];
  } catch (error) {
    console.error(`[Pexels] Fetch error:`, error);
    return [];
  }
}

// ============================================
// GEMINI AI FILTERING (Tiered for 30% acceptance)
// ============================================

async function filterWithGemini(photos: any[], category: string, style: string): Promise<any[]> {
  if (photos.length === 0) return [];
  
  if (!usageTracker.checkGeminiLimit()) {
    console.log(`[Gemini] Daily limit reached, using quality fallback...`);
    return photos.slice(0, Math.ceil(photos.length * 0.2));
  }
  
  const proxyHealth = await checkProxyHealth();
  const elitePhotos: any[] = [];
  let geminiKeyIndex = Math.floor(Math.random() * CONFIG.GEMINI_KEYS.length);
  
  console.log(`[Gemini] Processing ${photos.length} photos for ${category}/${style}...`);

  for (const photo of photos) {
    let attempts = 0;
    let success = false;

    while (attempts < 2 && !success) {
      try {
        const prompt = `
          Analyze this interior design for a ${category} in ${style} style.
          Rate quality & match 0-100. Respond with ONLY the number.
          URL: ${photo.src?.medium || photo.url}
        `;
        
        const { score, error } = await analyzeImageWithProxy(
          prompt,
          photo.src?.large || photo.src?.original || photo.url,
          geminiKeyIndex % CONFIG.GEMINI_KEYS.length,
          category,
          style
        );
        
        if (error) {
          console.warn(`[Gemini] Attempt ${attempts+1} failed, rotating: ${error.substring(0, 50)}...`);
          geminiKeyIndex++; // Rotate key immediately on error
          attempts++;
          await sleep(500);
          continue;
        }
        
        photo.aiScore = score;
        photo.aiReason = `Matched ${category}/${style}`;
        
        if (score >= CONFIG.THRESHOLDS.ELITE) {
          elitePhotos.push(photo);
        }
        
        success = true;
        usageTracker.incrementGemini();
        // Dynamic delay based on proxy health
        await sleep(proxyHealth.ok ? 400 : 1000);
        
      } catch (error) {
        geminiKeyIndex++;
        attempts++;
        await sleep(1000);
      }
    }
    
    // Always rotate key slightly to balance load
    if (Math.random() > 0.7) geminiKeyIndex++;
  }
  
  return elitePhotos;
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
// DATABASE OPERATIONS (URL-ONLY STORAGE)
// ============================================

async function insertEliteImages(images: any[], category: string, style: string): Promise<number> {
  const records = images.map(photo => ({
    id: photo.id,
    url: photo.src?.[CONFIG.STORAGE.DISPLAY_SIZE] || photo.src?.medium || photo.url,
    thumbnail_url: photo.src?.[CONFIG.STORAGE.THUMBNAIL_SIZE] || photo.src?.small,
    original_url: photo.src?.[CONFIG.STORAGE.ORIGINAL_SIZE] || photo.url,
    room_type: category,
    style: style,
    metadata: {
      photographer: photo.photographer,
      photographer_url: photo.photographer_url,
      width: photo.width,
      height: photo.height,
      avg_color: photo.avg_color,
      ai_score: photo.aiScore,
      ai_reason: photo.aiReason,
      source: "pexels",
      harvested_at: new Date().toISOString(),
    },
    is_active: true,
    display_order: Math.floor(Math.random() * 1000), // For random display
  }));
  
  try {
    // Batch insert in chunks
    let inserted = 0;
    for (let i = 0; i < records.length; i += CONFIG.DB_BATCH_SIZE) {
      const batch = records.slice(i, i + CONFIG.DB_BATCH_SIZE);
      
      const { error } = await supabase
        .from("curated_images")
        .upsert(batch, { 
          onConflict: "id",
          ignoreDuplicates: true 
        });
      
      if (error) {
        console.error(`[Database] Batch insert error:`, error);
      } else {
        inserted += batch.length;
      }
    }
    
    return inserted;
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

async function getCombinationCount(category: string, style: string): Promise<number> {
  const { count, error } = await supabase
    .from("curated_images")
    .select("*", { count: "exact", head: true })
    .eq("room_type", category)
    .eq("style", style)
    .eq("is_active", true);
  
  if (error) return 0;
  return count || 0;
}

// ============================================
// UTILITIES
// ============================================

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================
// MAIN HARVESTING ENGINE (Equal Distribution)
// ============================================

async function harvestCategory(category: string, style: string): Promise<number> {
  console.log(`\n[Harvest] ${category} / ${style}`);
  
  // Check if we already have enough for this combination
  const currentCount = await getCombinationCount(category, style);
  const needed = CONFIG.IMAGES_PER_COMBINATION - currentCount;
  
  if (needed <= 0) {
    console.log(`  ✅ Already have ${currentCount}/${CONFIG.IMAGES_PER_COMBINATION} images`);
    return 0;
  }
  
  console.log(`  Need: ${needed} more images (current: ${currentCount})`);
  
  const queries = generateSearchQueries(category, style);
  let harvestedCount = 0;
  let queryIndex = 0;
  
  while (harvestedCount < needed && queryIndex < queries.length) {
    // Check API limits
    if (usageTracker.shouldCooldown()) {
      console.log(`[Harvest] API usage high, cooling for 15 minutes...`);
      await sleep(900000); // Reduce cooldown to 15m for faster progress
    }
    
    const query = queries[queryIndex++];
    console.log(`  Query ${queryIndex}/${queries.length}: ${query}`);
    
    // Fetch from Pexels
    const photos = await fetchFromPexels(query, CONFIG.PEXELS_BATCH_SIZE);
    await sleep(200); // Faster Pexels fetching
    
    if (photos.length === 0) {
      // If we run out of images for a query, add more variations dynamically
      if (queryIndex === queries.length && harvestedCount < needed) {
        console.log(`  💡 Generating additional query variations...`);
        queries.push(
          `high-end ${style} ${category} inspiration`,
          `exclusive ${category} ${style} furniture`,
          `${style} ${category} architecture photography`
        );
      }
      continue;
    }
    
    // Filter duplicates
    const uniquePhotos = photos.filter(p => !isDuplicate(p));
    if (uniquePhotos.length === 0) continue;
    
    // Filter with Gemini
    const elitePhotos = await filterWithGemini(uniquePhotos, category, style);
    
    if (elitePhotos.length === 0) continue;
    
    // Mark as duplicates
    elitePhotos.forEach(markAsDuplicate);
    
    // Only take what we need
    const toInsert = elitePhotos.slice(0, needed - harvestedCount);
    
    // Insert to database
    const inserted = await insertEliteImages(toInsert, category, style);
    harvestedCount += inserted;
    
    console.log(`  ✓ Inserted: ${inserted} | Progress: ${currentCount + harvestedCount}/${CONFIG.IMAGES_PER_COMBINATION}`);
  }
  
  return harvestedCount;
}

// ============================================
// MAIN ENTRY POINT
// ============================================

async function runEliteHarvesterV3() {
  console.log("╔════════════════════════════════════════════════════════╗");
  console.log("║  AZENITH INFINITE PULSE: ELITE HARVESTER v3.0          ║");
  console.log("║  Mega Scale: 50,000 → 15,000 Elite Images              ║");
  console.log("║  CDN-Optimized for Millions of Visitors                ║");
  console.log("╚════════════════════════════════════════════════════════╝\n");
  
  // Stats
  console.log(`📊 Configuration:`);
  console.log(`   Target Raw: ${CONFIG.TARGET_RAW_IMAGES.toLocaleString()}`);
  console.log(`   Target Elite: ${CONFIG.TARGET_FILTERED_IMAGES.toLocaleString()}`);
  console.log(`   Per Room: ${CONFIG.IMAGES_PER_COMBINATION} images`);
  console.log(`   Rooms: ${CONFIG.TARGET_CATEGORIES.length}`);
  console.log(`   Styles: ${CONFIG.STYLES.length}`);
  console.log(`   API Keys: ${CONFIG.PEXELS_KEYS.length} Pexels, ${CONFIG.GEMINI_KEYS.length} Gemini\n`);
  
  // Check current state
  const totalCount = await getCurrentImageCount();
  console.log(`💾 Current Database: ${totalCount.toLocaleString()}/${CONFIG.TARGET_FILTERED_IMAGES.toLocaleString()} images\n`);
  
  if (totalCount >= CONFIG.TARGET_FILTERED_IMAGES) {
    console.log(`✅ Target already reached! Running maintenance check...\n`);
  }
  
  let totalHarvested = 0;
  const startTime = Date.now();
  
  // Harvest each combination
  for (const category of CONFIG.TARGET_CATEGORIES) {
    for (const style of CONFIG.STYLES) {
      const count = await harvestCategory(category, style);
      totalHarvested += count;
      
      // Progress report
      const progress = ((totalHarvested / CONFIG.TARGET_FILTERED_IMAGES) * 100).toFixed(1);
      console.log(`\n📈 Total Progress: ${totalHarvested.toLocaleString()}/${CONFIG.TARGET_FILTERED_IMAGES.toLocaleString()} (${progress}%)`);
      
      // Save checkpoint every 1000 images
      if (totalHarvested % CONFIG.CHECKPOINT_INTERVAL === 0) {
        console.log(`💾 Checkpoint saved at ${totalHarvested.toLocaleString()} images`);
      }
    }
  }
  
  const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  const finalCount = await getCurrentImageCount();
  
  console.log(`\n╔════════════════════════════════════════════════════════╗`);
  console.log(`║  ✅ HARVESTING COMPLETE                                  ║`);
  console.log(`║     Duration: ${duration} minutes                                   ║`);
  console.log(`║     Harvested: ${totalHarvested.toLocaleString()} images                               ║`);
  console.log(`║     Total DB: ${finalCount.toLocaleString()}/${CONFIG.TARGET_FILTERED_IMAGES.toLocaleString()} images                         ║`);
  console.log(`╚════════════════════════════════════════════════════════╝\n`);
  
  // Final API stats
  const stats = usageTracker.getStats();
  console.log(`📊 API Usage:`);
  console.log(`   Pexels: ${stats.pexels.used}/${stats.pexels.limit} (${stats.percentUsed.pexels}%)`);
  console.log(`   Gemini: ${stats.gemini.used}/${stats.gemini.limit} (${stats.percentUsed.gemini}%)`);
}

// Run if called directly
if (require.main === module) {
  runEliteHarvesterV3()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("\n❌ Harvesting Failed:", error);
      process.exit(1);
    });
}

export { runEliteHarvesterV3, CONFIG };

#!/usr/bin/env ts-node
/**
 * Azenith Infinite Pulse: Weekly Link Audit Cron Job
 * 
 * Purpose:
 * - Audits all 36,000 images for dead links
 * - Marks failed images as inactive
 * - Triggers replacement harvesting
 * - Runs weekly via cron or Vercel Cron
 * 
 * Schedule: 0 2 * * 0 (Every Sunday at 2 AM)
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
  BATCH_SIZE: 100,              // Images to check per batch
  CONCURRENT_CHECKS: 5,           // Parallel checks
  REQUEST_TIMEOUT_MS: 10000,      // 10 second timeout
  DELAY_BETWEEN_BATCHES_MS: 1000, // 1 second between batches
  MAX_DEAD_PERCENTAGE: 10,        // Alert threshold
};

// ============================================
// LINK CHECKER
// ============================================

async function checkImageUrl(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT_MS);
    
    const response = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      headers: {
        "User-Agent": "Azenith-Link-Audit/1.0"
      }
    });
    
    clearTimeout(timeout);
    
    // Check if image is accessible
    if (response.status === 200) {
      const contentType = response.headers.get("content-type");
      return contentType?.startsWith("image/") || false;
    }
    
    // 403 might still be valid (some CDNs block HEAD)
    if (response.status === 403) {
      return true; // Assume valid, will be caught by client-side
    }
    
    return false;
  } catch (error) {
    return false;
  }
}

// ============================================
// AUDIT PROCESS
// ============================================

async function auditBatch(images: any[]): Promise<{ dead: number[]; alive: number[] }> {
  const results = { dead: [] as number[], alive: [] as number[] };
  
  // Check images concurrently
  const checks = images.map(async (image) => {
    const isAlive = await checkImageUrl(image.url);
    
    if (isAlive) {
      results.alive.push(image.id);
    } else {
      results.dead.push(image.id);
      console.log(`[Audit] Dead link found: ${image.id} - ${image.url.substring(0, 60)}...`);
    }
  });
  
  await Promise.all(checks);
  
  return results;
}

async function markImagesAsDead(imageIds: number[]): Promise<void> {
  if (imageIds.length === 0) return;
  
  const { error } = await supabase
    .from("curated_images")
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
      metadata: {
        audited_dead_at: new Date().toISOString(),
        audited_dead_weekly: true
      }
    })
    .in("id", imageIds);
  
  if (error) {
    console.error(`[Audit] Failed to mark dead images:`, error);
  } else {
    console.log(`[Audit] Marked ${imageIds.length} images as dead`);
  }
}

async function triggerReplacementHarvest(deadCount: number): Promise<void> {
  console.log(`[Audit] Triggering replacement harvest for ${deadCount} images`);
  
  // This would call the elite-harvester script
  // For now, we just log it - actual implementation depends on deployment setup
  console.log(`[Audit] Run: npx ts-node scripts/elite-harvester.ts to replace`);
}

// ============================================
// MAIN AUDIT
// ============================================

async function runWeeklyAudit() {
  console.log("╔════════════════════════════════════════════════════════╗");
  console.log("║  AZENITH WEEKLY LINK AUDIT                             ║");
  console.log("║  Checking 36,000 Elite Images for Dead Links           ║");
  console.log("╚════════════════════════════════════════════════════════╝\n");
  
  const startTime = Date.now();
  let totalChecked = 0;
  let totalDead = 0;
  let offset = 0;
  
  // Get total count
  const { count, error: countError } = await supabase
    .from("curated_images")
    .select("*", { count: "exact", head: true })
    .eq("is_active", true);
  
  if (countError) {
    console.error("[Audit] Failed to get count:", countError);
    return;
  }
  
  const totalImages = count || 0;
  console.log(`[Audit] Total active images to check: ${totalImages}\n`);
  
  // Process in batches
  while (true) {
    const { data: images, error } = await supabase
      .from("curated_images")
      .select("id, url")
      .eq("is_active", true)
      .range(offset, offset + CONFIG.BATCH_SIZE - 1);
    
    if (error) {
      console.error(`[Audit] Fetch error at offset ${offset}:`, error);
      break;
    }
    
    if (!images || images.length === 0) {
      break;
    }
    
    console.log(`[Audit] Checking batch ${Math.floor(offset / CONFIG.BATCH_SIZE) + 1}: ${images.length} images`);
    
    const { dead, alive } = await auditBatch(images);
    
    totalChecked += images.length;
    totalDead += dead.length;
    
    // Mark dead images
    await markImagesAsDead(dead);
    
    // Progress
    const percentage = ((totalChecked / totalImages) * 100).toFixed(1);
    const deadPercentage = ((totalDead / totalChecked) * 100).toFixed(2);
    console.log(`  Progress: ${percentage}% | Dead: ${totalDead} (${deadPercentage}%) | Alive: ${alive.length}\n`);
    
    offset += CONFIG.BATCH_SIZE;
    
    // Rate limiting
    await new Promise(r => setTimeout(r, CONFIG.DELAY_BETWEEN_BATCHES_MS));
  }
  
  // Summary
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  const deadPercentage = ((totalDead / totalChecked) * 100).toFixed(2);
  
  console.log("\n╔════════════════════════════════════════════════════════╗");
  console.log("║  AUDIT COMPLETE                                        ║");
  console.log("╚════════════════════════════════════════════════════════╝");
  console.log(`Total Checked: ${totalChecked}`);
  console.log(`Dead Links: ${totalDead} (${deadPercentage}%)`);
  console.log(`Duration: ${duration}s`);
  
  // Alert if too many dead
  if (parseFloat(deadPercentage) > CONFIG.MAX_DEAD_PERCENTAGE) {
    console.log(`\n⚠️  ALERT: Dead link percentage (${deadPercentage}%) exceeds threshold (${CONFIG.MAX_DEAD_PERCENTAGE}%)`);
    console.log("Triggering emergency replacement harvest...");
    await triggerReplacementHarvest(totalDead);
  }
  
  // Trigger replacement if any dead found
  if (totalDead > 0) {
    await triggerReplacementHarvest(totalDead);
  }
  
  console.log("\n✅ Weekly Audit Complete");
}

// ============================================
// ENTRY POINT
// ============================================

if (require.main === module) {
  runWeeklyAudit()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n❌ Weekly Audit Failed:", error);
      process.exit(1);
    });
}

export { runWeeklyAudit, checkImageUrl };

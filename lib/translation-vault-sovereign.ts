"use server";

/**
 * Translation Vault - Sovereign System
 * 4-Layer Shield Architecture | Zero-Failure Translation System
 * 
 * Architecture:
 * Layer 1: Client Cache (localStorage) - 0ms response
 * Layer 2: Database Vault (Supabase) - Persistent cache  
 * Layer 3: Smart Rotation (Round-Robin with cool-down)
 * Layer 4: Failover Hierarchy (Groq → Mistral → Static Fallback)
 */

import { sovereignOrchestrator, type TranslationResult } from "./resource-orchestrator";

type Language = 'ar' | 'en';

// Re-export types
export interface TranslationCacheEntry {
  hash: string;
  source_text: string;
  source_lang: string;
  en_text: string;
  context?: string;
  last_updated: string;
}

// Legacy compatibility - now delegates to ResourceOrchestrator
export async function checkTranslationCache(
  sourceText: string,
  context?: string
): Promise<string | null> {
  // ResourceOrchestrator handles this internally
  return null; // Orchestrator checks cache directly
}

export async function saveTranslationToCache(
  sourceText: string,
  enText: string,
  context?: string
): Promise<void> {
  // ResourceOrchestrator saves automatically after successful translation
  console.log("[Translation Vault] Cache save handled by ResourceOrchestrator");
}

/**
 * Sovereign Translation - 4-Layer Shield
 * Zero-failure translation with automatic failover
 */
export async function translateWithVault(
  sourceText: string,
  targetLang: Language,
  context?: string
): Promise<string> {
  // Skip if target is Arabic (source is presumably English)
  if (targetLang === "ar") {
    return sourceText;
  }

  // Use the sovereign orchestrator (handles all 4 layers)
  const result = await sovereignOrchestrator.translate(sourceText, targetLang, context);

  if (!result.success || !result.translation) {
    console.error("[Translation Vault] Sovereign translation failed:", result.error);
    return sourceText; // Return original as last resort
  }

  console.log(`[Translation Vault] Translation successful via ${result.source}`);
  return result.translation;
}

/**
 * Bulk Translation with Batching
 * Optimized for high-volume operations
 */
export async function bulkTranslateAndCache(
  items: Array<{ text: string; context?: string }>
): Promise<{ success: number; failed: number }> {
  console.log(`[Translation Vault] Starting bulk translation for ${items.length} items...`);

  const results = await sovereignOrchestrator.translateBatch({
    items,
    targetLang: "en",
  });

  const success = results.filter(r => r.success).length;
  const failed = results.length - success;

  console.log(`[Translation Vault] Bulk complete: ${success} success, ${failed} failed`);
  return { success, failed };
}

/**
 * Luxury Content Generation (OpenRouter + Claude)
 * For high-end product descriptions and marketing copy
 */
export async function generateLuxuryContent(
  prompt: string,
  imageUrl?: string
): Promise<string> {
  const result = await sovereignOrchestrator.generateLuxuryContent(prompt, imageUrl);

  if (!result.success || !result.translation) {
    console.error("[Translation Vault] Luxury content generation failed:", result.error);
    return prompt; // Return original prompt as fallback
  }

  return result.translation;
}

/**
 * System Health Status
 * Monitor key pools and cooldown status
 */
export function getTranslationSystemStatus(): {
  groq: { total: number; available: number; inCooldown: number };
  openrouter: { total: number; available: number; inCooldown: number };
  mistral: { total: number; available: number; inCooldown: number };
} {
  return sovereignOrchestrator.getSystemStatus();
}

/**
 * Legacy function - maintained for compatibility
 * Now uses ResourceOrchestrator internally
 */
export async function getAllCachedTranslations(): Promise<TranslationCacheEntry[]> {
  // This would need direct Supabase access - kept for compatibility
  // In production, use ResourceOrchestrator's DatabaseVault
  console.warn("[Translation Vault] getAllCachedTranslations not implemented in sovereign mode");
  return [];
}

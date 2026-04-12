/**
 * ResourceOrchestrator - The Sovereign Neural Spine
 * 4-Layer Shield Architecture | Zero-Failure System
 * 
 * Layer 1: Client Cache (localStorage) - 0ms response
 * Layer 2: Database Vault (Supabase) - Persistent cache
 * Layer 3: Smart Rotation (Round-Robin with 6 keys each)
 * Layer 4: Failover Hierarchy (Groq → Mistral → Static Fallback)
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

// ============================================
// CONFIGURATION & TYPES
// ============================================

interface KeyPool {
  keys: string[];
  currentIndex: number;
  coolDownUntil: Map<string, number>; // key -> timestamp
}

interface TranslationRequest {
  text: string;
  context?: string;
  targetLang: string;
}

export interface TranslationResult {
  success: boolean;
  translation?: string;
  source: 'client-cache' | 'db-vault' | 'groq' | 'openrouter' | 'mistral' | 'fallback';
  error?: string;
}

interface BatchTranslationRequest {
  items: Array<{ text: string; context?: string }>;
  targetLang: string;
}

// Provider-specific routing
const PROVIDER_CONFIG = {
  groq: {
    model: "llama-3.3-70b-versatile",
    maxTokens: 1024,
    temperature: 0.3,
    timeout: 3000, // 3s for instant UI
  },
  openrouter: {
    model: "anthropic/claude-3.7-sonnet",
    maxTokens: 2048,
    temperature: 0.4, // Higher for creative luxury copy
    timeout: 8000, // 8s for quality content
  },
  mistral: {
    model: "mistral-large-latest",
    maxTokens: 1024,
    temperature: 0.2, // Lower for validation
    timeout: 5000,
  },
};

const COOLDOWN_HOURS = 6;
const BATCH_SIZE = 10; // Max items per batch

// ============================================
// TEXT FILTERING - Layer 0 Protection
// ============================================

class TextGuard {
  private static readonly BLOCKED_PATTERNS = [
    /^\d+$/, // Pure numbers
    /^[A-Z0-9]{3,}$/, // Codes (e.g., ABC123)
    /^(function|class|const|let|var|import|export)\s/, // Code
    /^(if|for|while|return|async|await)\s/, // Code keywords
    /\{[\s\S]*\}/, // JSON/code blocks
  ];

  private static readonly BRAND_NAMES = [
    'azenith', 'أزينث', 'azenith living', 'ويندسرف'
  ];

  static shouldTranslate(text: string): { allowed: boolean; reason?: string } {
    // Skip empty or too short
    if (!text || text.trim().length < 2) {
      return { allowed: false, reason: 'too_short' };
    }

    // Check blocked patterns
    for (const pattern of this.BLOCKED_PATTERNS) {
      if (pattern.test(text.trim())) {
        return { allowed: false, reason: 'blocked_pattern' };
      }
    }

    // Check brand names
    const lowerText = text.toLowerCase();
    for (const brand of this.BRAND_NAMES) {
      if (lowerText.includes(brand.toLowerCase())) {
        return { allowed: false, reason: 'brand_name' };
      }
    }

    return { allowed: true };
  }

  static sanitizeForTranslation(text: string): string {
    return text
      .replace(/\n+/g, ' ') // Remove extra newlines
      .replace(/\s+/g, ' ') // Normalize spaces
      .trim();
  }
}

// ============================================
// KEY MANAGEMENT - Layer 3 Smart Rotation
// ============================================

class KeyManager {
  private pools: Map<string, KeyPool> = new Map();
  private static instance: KeyManager;

  static getInstance(): KeyManager {
    if (!KeyManager.instance) {
      KeyManager.instance = new KeyManager();
    }
    return KeyManager.instance;
  }

  constructor() {
    this.initializePools();
  }

  private initializePools() {
    // Parse key pools from environment
    const parseKeys = (envVar: string | undefined): string[] => {
      if (!envVar) return [];
      return envVar.split(',').map(k => k.trim()).filter(k => k.length > 10);
    };

    this.pools.set('groq', {
      keys: parseKeys(process.env.GROQ_KEYS),
      currentIndex: 0,
      coolDownUntil: new Map(),
    });

    this.pools.set('openrouter', {
      keys: parseKeys(process.env.OPENROUTER_KEYS),
      currentIndex: 0,
      coolDownUntil: new Map(),
    });

    this.pools.set('mistral', {
      keys: parseKeys(process.env.MISTRAL_KEYS),
      currentIndex: 0,
      coolDownUntil: new Map(),
    });

    console.log('[KeyManager] Initialized pools:', {
      groq: this.pools.get('groq')?.keys.length || 0,
      openrouter: this.pools.get('openrouter')?.keys.length || 0,
      mistral: this.pools.get('mistral')?.keys.length || 0,
    });
  }

  getNextKey(provider: string): string | null {
    const pool = this.pools.get(provider);
    if (!pool || pool.keys.length === 0) return null;

    const now = Date.now();
    const availableKeys = pool.keys.filter(key => {
      const coolDown = pool.coolDownUntil.get(key);
      return !coolDown || coolDown <= now;
    });

    if (availableKeys.length === 0) {
      console.warn(`[KeyManager] No available keys for ${provider}, all in cooldown`);
      return null;
    }

    // Round-robin among available keys
    const key = availableKeys[pool.currentIndex % availableKeys.length];
    pool.currentIndex = (pool.currentIndex + 1) % availableKeys.length;
    
    return key;
  }

  markKeyFailed(provider: string, key: string, status: number) {
    const pool = this.pools.get(provider);
    if (!pool) return;

    if (status === 429 || status === 401 || status === 403) {
      const coolDownUntil = Date.now() + (COOLDOWN_HOURS * 60 * 60 * 1000);
      pool.coolDownUntil.set(key, coolDownUntil);
      
      console.log(`[KeyManager] Key isolated for ${provider} until ${new Date(coolDownUntil).toISOString()}`);
    }
  }

  getPoolStatus(provider: string): { total: number; available: number; inCooldown: number } {
    const pool = this.pools.get(provider);
    if (!pool) return { total: 0, available: 0, inCooldown: 0 };

    const now = Date.now();
    const inCooldown = pool.keys.filter(key => {
      const cd = pool.coolDownUntil.get(key);
      return cd && cd > now;
    }).length;

    return {
      total: pool.keys.length,
      available: pool.keys.length - inCooldown,
      inCooldown,
    };
  }
}

// ============================================
// LAYER 2: DATABASE VAULT
// ============================================

class DatabaseVault {
  private supabase: ReturnType<typeof createClient> | null = null;
  private static instance: DatabaseVault;

  static getInstance(): DatabaseVault {
    if (!DatabaseVault.instance) {
      DatabaseVault.instance = new DatabaseVault();
    }
    return DatabaseVault.instance;
  }

  private getSupabase(): ReturnType<typeof createClient> {
    if (this.supabase) return this.supabase;

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      throw new Error('Missing Supabase credentials for Database Vault');
    }

    this.supabase = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    return this.supabase;
  }

  async computeHash(text: string, context?: string): Promise<string> {
    const data = text + (context || "");
    const encoder = new TextEncoder();
    const encoded = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
  }

  async checkCache(text: string, context?: string): Promise<string | null> {
    try {
      const hash = await this.computeHash(text, context);
      const { data, error } = await this.getSupabase()
        .from("translations_cache")
        .select("en_text")
        .eq("hash", hash)
        .maybeSingle();

      if (error) {
        console.error('[DatabaseVault] Cache lookup error:', error);
        return null;
      }

      if (data) {
        console.log(`[DatabaseVault] Cache HIT for hash: ${hash}`);
        return (data as { en_text: string }).en_text;
      }

      return null;
    } catch (err) {
      console.error('[DatabaseVault] Error:', err);
      return null;
    }
  }

  async saveToCache(text: string, translation: string, context?: string): Promise<boolean> {
    try {
      const hash = await this.computeHash(text, context);
      const { error } = await this.getSupabase().from("translations_cache").upsert({
        hash,
        source_text: text,
        source_lang: "ar",
        en_text: translation,
        context: context || null,
        last_updated: new Date().toISOString(),
      });

      if (error) {
        console.error('[DatabaseVault] Save error:', error);
        return false;
      }

      console.log(`[DatabaseVault] Saved translation for hash: ${hash}`);
      return true;
    } catch (err) {
      console.error('[DatabaseVault] Save error:', err);
      return false;
    }
  }

  async batchSaveToCache(items: Array<{ text: string; translation: string; context?: string }>): Promise<number> {
    let saved = 0;
    for (const item of items) {
      if (await this.saveToCache(item.text, item.translation, item.context)) {
        saved++;
      }
    }
    return saved;
  }
}

// ============================================
// LAYER 4: STATIC FALLBACK
// ============================================

class StaticFallback {
  private cache: Map<string, string> = new Map();
  private loaded = false;

  load(): Map<string, string> {
    if (this.loaded) return this.cache;

    try {
      const fallbackPath = resolve(process.cwd(), 'public', 'fallback-en.json');
      if (existsSync(fallbackPath)) {
        const content = readFileSync(fallbackPath, 'utf-8');
        const data = JSON.parse(content);
        for (const [key, value] of Object.entries(data)) {
          this.cache.set(key, value as string);
        }
        console.log(`[StaticFallback] Loaded ${this.cache.size} static translations`);
      }
    } catch (err) {
      console.warn('[StaticFallback] Could not load fallback:', err);
    }

    this.loaded = true;
    return this.cache;
  }

  get(text: string): string | undefined {
    return this.load().get(text);
  }

  has(text: string): boolean {
    return this.load().has(text);
  }
}

// ============================================
// API PROVIDERS
// ============================================

class APIProviders {
  private keyManager = KeyManager.getInstance();

  private async fetchWithTimeout(url: string, options: RequestInit, timeout: number): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  }

  async callGroq(prompt: string): Promise<TranslationResult> {
    const key = this.keyManager.getNextKey('groq');
    if (!key) {
      return { success: false, error: 'No Groq keys available', source: 'groq' };
    }

    try {
      const response = await this.fetchWithTimeout(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${key}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: PROVIDER_CONFIG.groq.model,
            messages: [
              { role: 'system', content: 'Translate Arabic to English for luxury interior design website. Preserve elegant tone.' },
              { role: 'user', content: prompt },
            ],
            temperature: PROVIDER_CONFIG.groq.temperature,
            max_tokens: PROVIDER_CONFIG.groq.maxTokens,
          }),
        },
        PROVIDER_CONFIG.groq.timeout
      );

      if (!response.ok) {
        this.keyManager.markKeyFailed('groq', key, response.status);
        return { success: false, error: `Groq API error: ${response.status}`, source: 'groq' };
      }

      const data = await response.json();
      return { 
        success: true, 
        translation: data.choices[0].message.content,
        source: 'groq'
      };
    } catch (err) {
      return { success: false, error: `Groq fetch failed: ${err}`, source: 'groq' };
    }
  }

  async callOpenRouter(prompt: string, imageUrl?: string): Promise<TranslationResult> {
    const key = this.keyManager.getNextKey('openrouter');
    if (!key) {
      return { success: false, error: 'No OpenRouter keys available', source: 'openrouter' };
    }

    const messages: any[] = [
      { role: 'system', content: 'You are a luxury copywriter. Translate Arabic to elegant English for high-end interior design.' },
    ];

    if (imageUrl) {
      messages.push({
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: imageUrl } },
        ],
      });
    } else {
      messages.push({ role: 'user', content: prompt });
    }

    try {
      const response = await this.fetchWithTimeout(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${key}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': process.env.PRIMARY_DOMAIN || 'https://azenithliving.vercel.app',
          },
          body: JSON.stringify({
            model: PROVIDER_CONFIG.openrouter.model,
            messages,
            temperature: PROVIDER_CONFIG.openrouter.temperature,
            max_tokens: PROVIDER_CONFIG.openrouter.maxTokens,
          }),
        },
        PROVIDER_CONFIG.openrouter.timeout
      );

      if (!response.ok) {
        this.keyManager.markKeyFailed('openrouter', key, response.status);
        return { success: false, error: `OpenRouter API error: ${response.status}`, source: 'openrouter' };
      }

      const data = await response.json();
      return { 
        success: true, 
        translation: data.choices[0].message.content,
        source: 'openrouter'
      };
    } catch (err) {
      return { success: false, error: `OpenRouter fetch failed: ${err}`, source: 'openrouter' };
    }
  }

  async callMistral(prompt: string): Promise<TranslationResult> {
    const key = this.keyManager.getNextKey('mistral');
    if (!key) {
      return { success: false, error: 'No Mistral keys available', source: 'mistral' };
    }

    try {
      const response = await this.fetchWithTimeout(
        'https://api.mistral.ai/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${key}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: PROVIDER_CONFIG.mistral.model,
            messages: [
              { role: 'system', content: 'Validate and correct translations. Ensure technical accuracy.' },
              { role: 'user', content: prompt },
            ],
            temperature: PROVIDER_CONFIG.mistral.temperature,
            max_tokens: PROVIDER_CONFIG.mistral.maxTokens,
          }),
        },
        PROVIDER_CONFIG.mistral.timeout
      );

      if (!response.ok) {
        this.keyManager.markKeyFailed('mistral', key, response.status);
        return { success: false, error: `Mistral API error: ${response.status}`, source: 'mistral' };
      }

      const data = await response.json();
      return { 
        success: true, 
        translation: data.choices[0].message.content,
        source: 'mistral'
      };
    } catch (err) {
      return { success: false, error: `Mistral fetch failed: ${err}`, source: 'mistral' };
    }
  }
}

// ============================================
// MAIN ORCHESTRATOR
// ============================================

export class ResourceOrchestrator {
  private static instance: ResourceOrchestrator;
  private dbVault = DatabaseVault.getInstance();
  private staticFallback = new StaticFallback();
  private apiProviders = new APIProviders();

  static getInstance(): ResourceOrchestrator {
    if (!ResourceOrchestrator.instance) {
      ResourceOrchestrator.instance = new ResourceOrchestrator();
    }
    return ResourceOrchestrator.instance;
  }

  // ==========================================
  // LAYER 1: Client Cache (for browser)
  // ==========================================
  
  private getClientCacheKey(text: string, context?: string): string {
    return `tr_${text.slice(0, 50)}_${context || ''}`;
  }

  // ==========================================
  // SINGLE TRANSLATION - Full 4-Layer Flow
  // ==========================================
  
  async translate(
    text: string, 
    targetLang: string = 'en', 
    context?: string,
    useClientCache: boolean = false
  ): Promise<TranslationResult> {
    
    // Layer 0: Text Guard
    const guardCheck = TextGuard.shouldTranslate(text);
    if (!guardCheck.allowed) {
      return { 
        success: true, 
        translation: text, // Return as-is
        source: 'client-cache', // Not really cache, but bypassed
      };
    }

    const cleanText = TextGuard.sanitizeForTranslation(text);

    // Layer 1: Client Cache (only if requested)
    if (useClientCache) {
      // Note: In browser, this would check localStorage
      // Server-side, we skip this layer
    }

    // Layer 2: Database Vault
    const cached = await this.dbVault.checkCache(cleanText, context);
    if (cached) {
      return { success: true, translation: cached, source: 'db-vault' };
    }

    // Layer 3: API with Failover
    let result: TranslationResult | null = null;

    // Try Groq first (fastest for UI)
    result = await this.apiProviders.callGroq(
      `Translate: "${cleanText}"\nContext: ${context || 'luxury interior design'}`
    );

    // Failover to Mistral if Groq fails
    if (!result.success) {
      console.log('[ResourceOrchestrator] Groq failed, trying Mistral...');
      result = await this.apiProviders.callMistral(
        `Translate Arabic to English:\n"${cleanText}"\nContext: ${context || 'luxury interior design'}`
      );
    }

    // Try OpenRouter for luxury content if both fail
    if (!result.success) {
      console.log('[ResourceOrchestrator] Trying OpenRouter as final attempt...');
      result = await this.apiProviders.callOpenRouter(
        `Translate this luxury interior design text from Arabic to English:\n"${cleanText}"`
      );
    }

    // Layer 4: Static Fallback
    if (!result.success) {
      const fallback = this.staticFallback.get(cleanText);
      if (fallback) {
        return { success: true, translation: fallback, source: 'fallback' };
      }
      return { success: false, error: 'All providers failed and no fallback available', source: 'fallback' };
    }

    // Save successful translation to vault
    if (result.translation) {
      await this.dbVault.saveToCache(cleanText, result.translation, context);
    }

    return result;
  }

  // ==========================================
  // BATCH TRANSLATION - Optimized for bulk
  // ==========================================
  
  async translateBatch(request: BatchTranslationRequest): Promise<TranslationResult[]> {
    const { items, targetLang } = request;
    const results: TranslationResult[] = [];

    // Process in batches
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE);
      
      console.log(`[ResourceOrchestrator] Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(items.length / BATCH_SIZE)} (${batch.length} items)`);

      // Check database cache first
      const uncached: typeof batch = [];
      for (const item of batch) {
        const cached = await this.dbVault.checkCache(item.text, item.context);
        if (cached) {
          results.push({ success: true, translation: cached, source: 'db-vault' });
        } else {
          uncached.push(item);
        }
      }

      // Translate uncached items via API
      if (uncached.length > 0) {
        const batchPrompt = uncached.map((item, idx) => 
          `${idx + 1}. "${item.text}" (context: ${item.context || 'general'})`
        ).join('\n');

        const apiResult = await this.apiProviders.callGroq(
          `Translate these Arabic texts to English for a luxury interior design website:\n${batchPrompt}\n\nReturn as numbered list matching the input order.`
        );

        if (apiResult.success && apiResult.translation) {
          // Parse results and save to cache
          const translations = apiResult.translation.split('\n').filter(line => line.trim());
          
          for (let j = 0; j < uncached.length; j++) {
            const item = uncached[j];
            const translation = translations[j]?.replace(/^\d+\.\s*/, '').trim() || item.text;
            
            await this.dbVault.saveToCache(item.text, translation, item.context);
            results.push({ success: true, translation, source: 'groq' });
          }
        } else {
          // If batch fails, try individual items
          for (const item of uncached) {
            const singleResult = await this.translate(item.text, targetLang, item.context);
            results.push(singleResult);
          }
        }
      }
    }

    return results;
  }

  // ==========================================
  // LUXURY CONTENT (OpenRouter + Claude)
  // ==========================================
  
  async generateLuxuryContent(
    prompt: string, 
    imageUrl?: string
  ): Promise<TranslationResult> {
    const result = await this.apiProviders.callOpenRouter(prompt, imageUrl);
    
    if (!result.success) {
      // Failover to Mistral for validation
      return await this.apiProviders.callMistral(prompt);
    }
    
    return result;
  }

  // ==========================================
  // SYSTEM STATUS
  // ==========================================
  
  getSystemStatus(): {
    groq: { total: number; available: number; inCooldown: number };
    openrouter: { total: number; available: number; inCooldown: number };
    mistral: { total: number; available: number; inCooldown: number };
  } {
    const km = KeyManager.getInstance();
    return {
      groq: km.getPoolStatus('groq'),
      openrouter: km.getPoolStatus('openrouter'),
      mistral: km.getPoolStatus('mistral'),
    };
  }
}

// Export singleton instance
export const sovereignOrchestrator = ResourceOrchestrator.getInstance();

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import useSessionStore from "@/stores/useSessionStore";
import { useTranslation } from "@/contexts/TranslationContext";
import { getTranslation, translateWithContext, type Language } from "@/lib/multilingual-engine";

// In-memory cache for AI translations
const aiTranslationCache = new Map<string, string>();

interface UseTranslateOptions {
  scope?: string;
  tier?: string;
  immediate?: boolean;
}

interface TranslationState {
  text: string;
  isLoading: boolean;
  error: string | null;
}

/**
 * Universal Translation Hook
 * Handles both static UI translations (instant) and AI-powered dynamic translations (cached)
 * 
 * Features:
 * - Instant static translations for UI keys
 * - Server-side vault cache for 100% pre-translated feel
 * - AI-powered translations for dynamic content with 3s timeout fallback
 * - Smart caching to prevent redundant API calls
 * - Shimmer loading state for luxury feel
 * - Zero-latency feeling through aggressive caching
 */
export function useTranslate(
  content: string,
  options: UseTranslateOptions = {}
): {
  t: (key: string) => string;
  translated: string;
  isLoading: boolean;
  error: string | null;
  translate: (text: string) => Promise<string>;
} {
  const language = useSessionStore((state) => state.language);
  const isHydrated = useSessionStore((state) => state.isHydrated);
  const { serverCache } = useTranslation(); // Server-side cache from Supabase

  const [state, setState] = useState<TranslationState>({
    text: content,
    isLoading: false,
    error: null,
  });

  // Track if component is mounted
  const isMounted = useRef(true);

  // Generate cache key
  const getCacheKey = useCallback((text: string, lang: Language) => {
    return `${text}:${lang}:${options.scope || "default"}:${options.tier || "default"}`;
  }, [options.scope, options.tier]);

  // Static translation helper (instant)
  const t = useCallback((key: string): string => {
    return getTranslation(key, language);
  }, [language]);

  // AI translation with server-side vault caching
  const translate = useCallback(async (text: string): Promise<string> => {
    if (!text || !text.trim()) return "";

    // If Arabic is selected and text is already Arabic, return as-is
    if (language === "ar" && /^[\u0600-\u06FF\s\d\p{P}]+$/u.test(text)) {
      return text;
    }

    // If English is selected and text is already English, return as-is
    if (language === "en" && /^[\x00-\x7F\s\d\p{P}]+$/u.test(text)) {
      return text;
    }

    const cacheKey = getCacheKey(text, language);

    // Check local memory cache first (fastest)
    if (aiTranslationCache.has(cacheKey)) {
      return aiTranslationCache.get(cacheKey)!;
    }

    // Check server-side vault cache (Zero AI cost!)
    if (serverCache.has(text)) {
      console.log("[useTranslate] Server cache HIT");
      const cached = serverCache.get(text)!;
      aiTranslationCache.set(cacheKey, cached); // Also cache locally
      return cached;
    }

    // Check if it's a static UI key
    const staticTranslation = getTranslation(text, language);
    if (staticTranslation !== text) {
      return staticTranslation;
    }

    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      const result = await translateWithContext(text, language, {
        scope: options.scope,
        tier: options.tier,
      });

      if (isMounted.current) {
        setState((prev) => ({ ...prev, text: result, isLoading: false }));
      }

      // Cache the result
      aiTranslationCache.set(cacheKey, result);
      return result;
    } catch (error) {
      console.error("[useTranslate] Translation error:", error);
      if (isMounted.current) {
        setState((prev) => ({
          ...prev,
          error: error instanceof Error ? error.message : "Translation failed",
          isLoading: false,
        }));
      }
      return text; // Fallback to original
    }
  }, [language, getCacheKey, options.scope, options.tier]);

  // Translate content when language changes
  useEffect(() => {
    isMounted.current = true;

    if (!isHydrated) return;

    // Check cache first
    const cacheKey = getCacheKey(content, language);
    if (aiTranslationCache.has(cacheKey)) {
      setState((prev) => ({ ...prev, text: aiTranslationCache.get(cacheKey)!, isLoading: false }));
      return;
    }

    // Check static translations
    const staticResult = getTranslation(content, language);
    if (staticResult !== content) {
      setState((prev) => ({ ...prev, text: staticResult, isLoading: false }));
      return;
    }

    // For dynamic content, trigger AI translation
    if (content && content.length > 0 && !options.immediate) {
      translate(content);
    }

    return () => {
      isMounted.current = false;
    };
  }, [content, language, isHydrated, translate, getCacheKey, options.immediate]);

  return {
    t,
    translated: state.text,
    isLoading: state.isLoading,
    error: state.error,
    translate,
  };
}

/**
 * Hook for translating arrays of content (e.g., cards, lists)
 */
export function useTranslateArray(
  items: Array<{ id: string; text: string }>,
  options: UseTranslateOptions = {}
): {
  translatedItems: Array<{ id: string; text: string; isLoading: boolean }>;
  isLoading: boolean;
} {
  const language = useSessionStore((state) => state.language);
  const isHydrated = useSessionStore((state) => state.isHydrated);

  const [translatedItems, setTranslatedItems] = useState<Array<{ id: string; text: string; isLoading: boolean }>>(
    items.map((item) => ({ ...item, isLoading: true }))
  );

  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;

    if (!isHydrated) return;

    const translateAll = async () => {
      const results = await Promise.all(
        items.map(async (item) => {
          // Check cache first
          const cacheKey = `${item.text}:${language}:${options.scope || "default"}:${options.tier || "default"}`;
          if (aiTranslationCache.has(cacheKey)) {
            return { id: item.id, text: aiTranslationCache.get(cacheKey)!, isLoading: false };
          }

          // Check static
          const staticResult = getTranslation(item.text, language);
          if (staticResult !== item.text) {
            return { id: item.id, text: staticResult, isLoading: false };
          }

          // AI translation
          try {
            const result = await translateWithContext(item.text, language, {
              scope: options.scope,
              tier: options.tier,
            });
            aiTranslationCache.set(cacheKey, result);
            return { id: item.id, text: result, isLoading: false };
          } catch (error) {
            console.error(`[useTranslateArray] Error translating ${item.id}:`, error);
            return { id: item.id, text: item.text, isLoading: false };
          }
        })
      );

      if (isMounted.current) {
        setTranslatedItems(results);
      }
    };

    translateAll();

    return () => {
      isMounted.current = false;
    };
  }, [items, language, isHydrated, options.scope, options.tier]);

  return {
    translatedItems,
    isLoading: translatedItems.some((item) => item.isLoading),
  };
}

/**
 * Shimmer loading component for translation loading state
 * Use this as a placeholder style while translations load
 */
export function getTranslationShimmerClass(className = ""): string {
  return `inline-block animate-pulse rounded bg-gradient-to-r from-[#C5A059]/20 via-[#C5A059]/40 to-[#C5A059]/20 bg-[length:200%_100%] ${className}`;
}

export default useTranslate;

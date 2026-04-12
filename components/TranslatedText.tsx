"use client";

import { useEffect, useState } from "react";
import useSessionStore from "@/stores/useSessionStore";
import { getTranslation, translateWithContext, type Language } from "@/lib/multilingual-engine";
import { TranslationShimmer } from "./TranslationShimmer";

// Global AI translation cache
const aiTranslationCache = new Map<string, string>();

interface TranslatedTextProps {
  children: string;
  scope?: string;
  tier?: string;
  className?: string;
  as?: "span" | "p" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "div" | "li" | "a";
  showShimmer?: boolean;
  fallback?: string;
}

/**
 * Universal TranslatedText Component
 * Automatically translates any text content based on current language
 * 
 * Features:
 * - Instant static translations for known UI keys
 * - AI-powered translations for dynamic content with caching
 * - Luxury shimmer loading state
 * - Maintains fixed layout (no RTL/LTR changes)
 * - Zero-latency through aggressive caching
 */
export function TranslatedText({
  children,
  scope = "general",
  tier = "luxury",
  className = "",
  as: Component = "span",
  showShimmer = true,
  fallback,
}: TranslatedTextProps) {
  const language = useSessionStore((state) => state.language);
  const isHydrated = useSessionStore((state) => state.isHydrated);

  const [translated, setTranslated] = useState<string>(children);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isHydrated) return;

    const text = children;
    
    // Generate cache key
    const cacheKey = `${text}:${language}:${scope}:${tier}`;

    // Check cache first
    if (aiTranslationCache.has(cacheKey)) {
      setTranslated(aiTranslationCache.get(cacheKey)!);
      setIsLoading(false);
      return;
    }

    // Check static translations
    const staticResult = getTranslation(text, language);
    if (staticResult !== text) {
      setTranslated(staticResult);
      setIsLoading(false);
      return;
    }

    // If text is already in target language, no translation needed
    const isArabic = /[\u0600-\u06FF]/.test(text);
    const isEnglish = /^[\x00-\x7F\s\d\p{P}]+$/u.test(text);

    if (language === "ar" && isArabic && !isEnglish) {
      setTranslated(text);
      return;
    }
    if (language === "en" && isEnglish && !isArabic) {
      setTranslated(text);
      return;
    }

    // Need AI translation
    setIsLoading(true);
    
    translateWithContext(text, language, { scope, tier })
      .then((result) => {
        aiTranslationCache.set(cacheKey, result);
        setTranslated(result);
        setIsLoading(false);
      })
      .catch((error) => {
        console.error("[TranslatedText] Translation failed:", error);
        setTranslated(fallback || text);
        setIsLoading(false);
      });
  }, [children, language, isHydrated, scope, tier, fallback]);

  // Show shimmer while loading
  if (isLoading && showShimmer) {
    return <TranslationShimmer className={className} />;
  }

  return <Component className={className}>{translated}</Component>;
}

/**
 * Hook version for use in other hooks
 */
export function useTranslatedText(
  text: string,
  language: Language,
  scope = "general",
  tier = "luxury"
): { translated: string; isLoading: boolean } {
  const [state, setState] = useState({ translated: text, isLoading: false });

  useEffect(() => {
    const cacheKey = `${text}:${language}:${scope}:${tier}`;

    // Check cache
    if (aiTranslationCache.has(cacheKey)) {
      setState({ translated: aiTranslationCache.get(cacheKey)!, isLoading: false });
      return;
    }

    // Check static
    const staticResult = getTranslation(text, language);
    if (staticResult !== text) {
      setState({ translated: staticResult, isLoading: false });
      return;
    }

    // AI translation needed
    setState((prev) => ({ ...prev, isLoading: true }));
    
    translateWithContext(text, language, { scope, tier })
      .then((result) => {
        aiTranslationCache.set(cacheKey, result);
        setState({ translated: result, isLoading: false });
      })
      .catch(() => {
        setState({ translated: text, isLoading: false });
      });
  }, [text, language, scope, tier]);

  return state;
}

export default TranslatedText;

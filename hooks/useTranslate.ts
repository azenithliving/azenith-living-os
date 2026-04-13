"use client";

import { useTranslations, useLocale } from 'next-intl';

interface UseTranslateOptions {
  namespace?: string;
}

/**
 * Simplified useTranslate hook using next-intl
 * Replaces the old complex translation system
 */
export function useTranslate(
  content: string,
  options: UseTranslateOptions = {}
): {
  t: (key: string) => string;
  translated: string;
  isLoading: boolean;
  error: string | null;
} {
  const locale = useLocale();
  const t = useTranslations(options.namespace || 'HomePage');

  return {
    t: (key: string) => t(key) || key,
    translated: content,
    isLoading: false,
    error: null,
  };
}

/**
 * Hook for translating arrays of content (e.g., cards, lists)
 * Simplified for next-intl
 */
export function useTranslateArray(
  items: Array<{ id: string; text: string }>,
  options: UseTranslateOptions = {}
): {
  translatedItems: Array<{ id: string; text: string; isLoading: boolean }>;
  isLoading: boolean;
} {
  return {
    translatedItems: items.map(item => ({ ...item, isLoading: false })),
    isLoading: false,
  };
}

/**
 * Shimmer loading component for translation loading state
 */
export function getTranslationShimmerClass(className = ""): string {
  return `inline-block animate-pulse rounded bg-gradient-to-r from-[#C5A059]/20 via-[#C5A059]/40 to-[#C5A059]/20 bg-[length:200%_100%] ${className}`;
}

export default useTranslate;

"use client";

interface UseTranslateOptions {
  namespace?: string;
}

/**
 * Simplified useTranslate hook - no translation, returns content as-is
 * Removed next-intl dependency
 */
export function useTranslate(
  content: string,
  _options: UseTranslateOptions = {}
): {
  t: (key: string) => string;
  translated: string;
  isLoading: boolean;
  error: string | null;
} {
  return {
    t: (key: string) => key,
    translated: content,
    isLoading: false,
    error: null,
  };
}

/**
 * Hook for translating arrays of content (e.g., cards, lists)
 * Simplified - no actual translation
 */
export function useTranslateArray(
  items: Array<{ id: string; text: string }>,
  _options: UseTranslateOptions = {}
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

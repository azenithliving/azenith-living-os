"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from 'next-intl';
import { TranslationShimmer } from "./TranslationShimmer";

interface TranslatedTextProps {
  children: string;
  className?: string;
  as?: "span" | "p" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "div" | "li" | "a";
  showShimmer?: boolean;
  fallback?: string;
}

/**
 * Simplified TranslatedText Component using next-intl
 * For static content, just pass the text through
 */
export function TranslatedText({
  children,
  className = "",
  as: Component = "span",
  showShimmer = true,
  fallback,
}: TranslatedTextProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Show shimmer while mounting (for consistency with old behavior)
  if (!mounted && showShimmer) {
    return <TranslationShimmer className={className} />;
  }

  return <Component className={className}>{children}</Component>;
}

/**
 * Hook version using next-intl (simplified)
 * Now just returns the text as-is since translations are handled via next-intl
 */
export function useTranslatedText(
  text: string
): { translated: string; isLoading: boolean } {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return { translated: text, isLoading: !mounted };
}

export default TranslatedText;

"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import useSessionStore from "@/stores/useSessionStore";

/** The two languages this store speaks. */
export type SiteLanguage = "ar" | "en";

/**
 * The customer's language, read from the one place it is kept.
 *
 * Measured 2026-10-09: the elite flow copied the setting into its own state when it mounted and
 * then lived in that copy — so the header switcher changed the store and the page stayed behind,
 * a browser guess could flip the page without telling anyone, and `?lang=` moved only that page
 * while the rest of the site kept the old value. The store's floor is already Arabic for this
 * market, so guessing buys nothing except the chance to overrule him.
 *
 * The rule: the store is the owner, the header switcher writes it, and `?lang=` is the one outside
 * voice — and it says it to the store, not to a single screen.
 */
export function useSiteLanguage(): SiteLanguage {
  const language = useSessionStore((state) => state.language) as SiteLanguage;
  const setLanguage = useSessionStore((state) => state.setLanguage);
  const searchParams = useSearchParams();

  useEffect(() => {
    const wanted = searchParams?.get("lang");
    if ((wanted === "ar" || wanted === "en") && wanted !== language) setLanguage(wanted);
  }, [searchParams, setLanguage, language]);

  return language;
}

/** Is the customer reading right-to-left? The same answer, one step further. */
export function isArabic(language: SiteLanguage): boolean {
  return language !== "en";
}

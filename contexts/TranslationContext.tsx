"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import type { Language } from "@/lib/multilingual-engine";
import useSessionStore from "@/stores/useSessionStore";

interface TranslationContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  isRTL: boolean;
  isLoading: boolean;
  serverCache: Map<string, string>;
  refreshServerCache: () => Promise<void>;
}

const TranslationContext = createContext<TranslationContextType | undefined>(undefined);

export function TranslationProvider({ children }: { children: React.ReactNode }) {
  // Get language from session store
  const storeLanguage = useSessionStore((state) => state.language);
  const storeSetLanguage = useSessionStore((state) => state.setLanguage);
  const isHydrated = useSessionStore((state) => state.isHydrated);

  const [language, setLocalLanguage] = useState<Language>("ar");
  const [isLoading, setIsLoading] = useState(false);
  const [serverCache, setServerCache] = useState<Map<string, string>>(new Map());
  const cacheLoaded = useRef(false);

  // Sync with store once hydrated
  useEffect(() => {
    if (isHydrated) {
      setLocalLanguage(storeLanguage);
    }
  }, [isHydrated, storeLanguage]);

  // Listen to language change events from other components
  useEffect(() => {
    const handleLanguageChange = (e: CustomEvent<Language>) => {
      setLocalLanguage(e.detail);
      setIsLoading(false);
    };

    window.addEventListener("languagechange", handleLanguageChange as EventListener);
    return () => {
      window.removeEventListener("languagechange", handleLanguageChange as EventListener);
    };
  }, []);

  // Fetch all translations from server cache on mount
  const refreshServerCache = useCallback(async () => {
    try {
      const response = await fetch("/api/translations?bulk=true");
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.translations) {
          const cacheMap = new Map<string, string>(Object.entries(data.translations));
          setServerCache(cacheMap);
          console.log(`[TranslationProvider] Loaded ${cacheMap.size} translations from server vault`);
        }
      }
    } catch (err) {
      console.error("[TranslationProvider] Failed to fetch server cache:", err);
    }
  }, []);

  // Load server cache on mount (only once)
  useEffect(() => {
    if (!cacheLoaded.current && typeof window !== "undefined") {
      cacheLoaded.current = true;
      refreshServerCache();
    }
  }, [refreshServerCache]);

  const setLanguage = useCallback((lang: Language) => {
    if (lang === language) return;

    setIsLoading(true);
    setLocalLanguage(lang);

    // Update store
    storeSetLanguage(lang);

    // Dispatch event for components not using context
    window.dispatchEvent(new CustomEvent("languagechange", { detail: lang }));

    // Pre-translated content loads instantly from cache
    setIsLoading(false);
  }, [language, storeSetLanguage]);

  return (
    <TranslationContext.Provider
      value={{
        language,
        setLanguage,
        isRTL: language === "ar",
        isLoading,
        serverCache,
        refreshServerCache,
      }}
    >
      {children}
    </TranslationContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(TranslationContext);
  if (context === undefined) {
    throw new Error("useTranslation must be used within a TranslationProvider");
  }
  return context;
}

export function useLanguage() {
  const context = useContext(TranslationContext);
  if (context === undefined) {
    return { language: "ar" as Language, isRTL: true };
  }
  return { language: context.language, isRTL: context.isRTL };
}

export default TranslationContext;

"use client";

import { useEffect } from "react";

import { createClient } from "@/utils/supabase/client";

const THEME_ACTIONS = new Set(["theme_dark", "theme_classic"]);

function applyTheme(action: string) {
  if (action === "theme_dark") {
    document.documentElement.style.setProperty("--zenith-black", "#050505");
    document.documentElement.style.setProperty("--brand-primary", "#C5A059");
    document.body.style.fontFamily = "'IBM Plex Sans Arabic', sans-serif";
  }

  if (action === "theme_classic") {
    document.documentElement.style.setProperty("--zenith-black", "#1a0f0a");
    document.documentElement.style.setProperty("--brand-primary", "#d4af37");
    document.body.style.fontFamily = "'Playfair Display', serif";
  }
}

/**
 * Applies only benign, visitor-relevant theme preferences. The former provider
 * also processed artificial urgency, fake social proof, and forced overlays;
 * those actions are deliberately ignored and no longer polled.
 */
export default function RealityUIProvider() {
  useEffect(() => {
    const handleMutation = (action: unknown) => {
      if (typeof action === "string" && THEME_ACTIONS.has(action)) applyTheme(action);
    };

    const handleLocalMutation = (event: Event) => {
      handleMutation((event as CustomEvent<{ action?: unknown }>).detail?.action);
    };
    window.addEventListener("azenith_reality_mutation", handleLocalMutation);

    const sessionId = localStorage.getItem("azenith_session_id");
    if (!sessionId) {
      return () => window.removeEventListener("azenith_reality_mutation", handleLocalMutation);
    }

    const supabase = createClient();
    const channel = supabase
      .channel(`theme_${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "reality_mutations",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => handleMutation((payload.new as { action?: unknown }).action)
      )
      .subscribe();

    return () => {
      window.removeEventListener("azenith_reality_mutation", handleLocalMutation);
      void supabase.removeChannel(channel);
    };
  }, []);

  return null;
}

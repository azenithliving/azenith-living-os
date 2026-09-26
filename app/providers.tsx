"use client";

import { useEffect } from "react";

type ProvidersProps = {
  children: React.ReactNode;
};

let analyticsStarted = false;

/**
 * Nothing in this app reads an analytics context — the provider existed only to
 * start pageview capture. Wrapping the tree in it after mount changed the
 * element type of the root, which remounted every page and wiped form state on
 * the first paint (the gate's password field lost what was typed).
 *
 * So the children are returned untouched, and analytics starts in the browser
 * beside them. Same capture, no re-render of the page underneath.
 */
export function Providers({ children }: ProvidersProps) {
  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;

  useEffect(() => {
    if (!apiKey || analyticsStarted) return;
    let cancelled = false;

    import("posthog-js")
      .then((mod) => {
        if (cancelled || analyticsStarted) return;
        const posthog = mod.default;
        posthog.init(apiKey, {
          api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
          capture_pageview: true,
          persistence: "localStorage+cookie",
        });
        analyticsStarted = true;
      })
      .catch(() => {
        /* analytics failing must never take a page down */
      });

    return () => {
      cancelled = true;
    };
  }, [apiKey]);

  return <>{children}</>;
}

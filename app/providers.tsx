"use client";

import { useEffect, useState } from "react";
import { PostHogProvider } from "posthog-js/react";

type ProvidersProps = {
  children: React.ReactNode;
};

export function Providers({ children }: ProvidersProps) {
  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;

  // Analytics lives in browser storage, so its provider mounts with the client.
  // It renders no DOM, so the page is server-rendered either way — the previous
  // version withheld the entire site behind a spinner until mount, which handed
  // every crawler (and every first paint) an empty page.
  const [clientReady, setClientReady] = useState(false);
  useEffect(() => {
    setClientReady(true);
  }, []);

  if (!apiKey || !clientReady) {
    return <>{children}</>;
  }

  return (
    <PostHogProvider
      apiKey={apiKey}
      options={{
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
        capture_pageview: true,
        persistence: "localStorage+cookie",
      }}
    >
      {children}
    </PostHogProvider>
  );
}


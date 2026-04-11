"use client";

import { useEffect, useState } from "react";
import { PostHogProvider } from "posthog-js/react";

// ENVIRONMENT DEBUG: Check if Supabase URL is visible to browser
console.log("[ENV DEBUG] Supabase URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log("[ENV DEBUG] PostHog Key exists:", !!process.env.NEXT_PUBLIC_POSTHOG_KEY);

type ProvidersProps = {
  children: React.ReactNode;
};

export function Providers({ children }: ProvidersProps) {
  // KILL SWITCH: Force loading end after 3 seconds regardless of data status
  const [isLoading, setIsLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
    
    // Kill switch - force end loading after 3 seconds
    const killTimer = setTimeout(() => {
      console.warn("[KILL SWITCH] Forcing loading end after 3s timeout");
      setIsLoading(false);
    }, 3000);
    
    return () => clearTimeout(killTimer);
  }, []);
  
  // HYDRATION FIX: Don't render until mounted to prevent server-client mismatch
  if (!mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050505]">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#C5A059]/30 border-t-[#C5A059]" />
      </div>
    );
  }

  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;

  if (!apiKey) {
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


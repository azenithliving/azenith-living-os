"use client";

/**
 * Supreme Provider - Initializes Azenith Supreme on app startup
 * Wrap your app with this provider to activate the Sovereign consciousness
 */

import { useEffect, useState } from "react";
import { initializeSupreme, isSupremeInitialized } from "../lib/supreme-init";

interface SupremeProviderProps {
  children: React.ReactNode;
  onInitialized?: (result: { success: boolean; message: string }) => void;
}

export function SupremeProvider({ children, onInitialized }: SupremeProviderProps) {
  const [isReady, setIsReady] = useState(false);
  const [initMessage, setInitMessage] = useState<string>("");

  useEffect(() => {
    // Initialize Azenith Supreme on mount
    const init = async () => {
      if (isSupremeInitialized()) {
        setIsReady(true);
        return;
      }

      const result = await initializeSupreme();
      setIsReady(true);
      setInitMessage(result.message);
      
      onInitialized?.(result);
    };

    init();

    // Cleanup on unmount
    return () => {
      // Note: We don't shut down on unmount in production
      // as the user might navigate between pages
    };
  }, [onInitialized]);

  // Show initialization loading state (optional)
  if (!isReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="text-center">
          <div className="mb-4 inline-block h-12 w-12 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
          <p className="text-amber-500">Initializing Azenith Supreme...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Development indicator - remove in production */}
      {process.env.NODE_ENV === "development" && initMessage && (
        <div className="fixed bottom-4 right-4 z-50 rounded-lg bg-amber-500/10 px-4 py-2 text-xs text-amber-500 border border-amber-500/30">
          {initMessage}
        </div>
      )}
      {children}
    </>
  );
}

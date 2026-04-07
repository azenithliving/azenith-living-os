"use client";

/**
 * ADMIN GATE GATEKEEPER
 * Client-side security layer for /admin-gate
 * 
 * CLASSIFICATION: SECURITY
 * - Blocks direct URL access
 * - Only allows access via 5-click logo mechanism
 * - Clears authorization flag after single use
 */

import { useEffect, useState } from "react";
import { redirect } from "next/navigation";

interface AdminGateGatekeeperProps {
  children: React.ReactNode;
}

export function AdminGateGatekeeper({ children }: AdminGateGatekeeperProps) {
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    // Check for the secret flag in sessionStorage
    const sovereignFlag = sessionStorage.getItem("sovereign_access");

    if (sovereignFlag === "granted") {
      // Authorized: clear the flag immediately (one-time access)
      sessionStorage.removeItem("sovereign_access");
      setIsAuthorized(true);
    } else {
      // Not authorized: redirect to home
      window.location.href = "/";
    }
  }, []);

  // Show nothing while checking authorization
  if (isAuthorized === null) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="text-white/40 text-sm">Checking authorization...</div>
      </div>
    );
  }

  // Authorized: render the admin content
  return <>{children}</>;
}

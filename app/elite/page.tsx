/**
 * ELITE ROOT PAGE
 * Entry point with token validation and redirect logic
 * 
 * CLASSIFICATION: ISOLATE
 * Elite-specific entry point handling authentication redirect
 */

import { redirect } from "next/navigation";
import { getEliteSession } from "@/lib/elite/auth";
import { validateEliteToken } from "./actions/elite-actions";
import EliteHomeClient from "./elite-home-client";

interface ElitePageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function ElitePage({ searchParams }: ElitePageProps) {
  const params = await searchParams;
  
  // Check for login token in URL
  if (params.token) {
    const result = await validateEliteToken(params.token);
    
    if (result.success) {
      // Token valid, redirect to elite home (now authenticated)
      redirect("/elite");
    }
    // If token invalid, continue to show home but will redirect to login
  }
  
  // Check existing session
  const session = await getEliteSession();
  
  // Get home data (authenticated or default)
  const { getEliteHomeData } = await import("./actions/elite-actions");
  const homeData = await getEliteHomeData(session?.clientAccessId || null);
  
  return <EliteHomeClient initialData={homeData} isAuthenticated={!!session} />;
}

/**
 * ELITE LOGIN PAGE
 * Server-side login page
 * 
 * CLASSIFICATION: ISOLATE
 * Elite-specific login entry point
 */

import { redirect } from "next/navigation";
import { getEliteSession } from "@/lib/elite/auth";
import { EliteLoginClient } from "@/components/elite/login/elite-login-client";

export default async function EliteLoginPage() {
  // Check if already authenticated
  const session = await getEliteSession();
  
  if (session) {
    // Already logged in, redirect to elite home
    redirect("/elite");
  }
  
  return <EliteLoginClient />;
}

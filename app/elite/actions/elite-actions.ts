/**
 * ELITE SERVER ACTIONS
 * Server-side actions for the Elite Client System
 * 
 * CLASSIFICATION: ISOLATE
 * All actions are namespaced and isolated to elite system
 */

"use server";

import { generateLoginToken, validateTokenAndCreateSession, destroyEliteSession } from "@/lib/elite/auth";
import { getClientAccess, getPermissions } from "@/lib/elite/access-control";
import { getEliteState } from "@/lib/elite/feature-engine";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

/**
 * Initiate WhatsApp login flow
 * Classification: ISOLATE - Elite-specific auth action
 */
export async function initiateWhatsAppLogin(phone: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Normalize phone
    const normalizedPhone = phone.replace(/\D/g, "");
    
    if (normalizedPhone.length < 10) {
      return { success: false, error: "رقم الهاتف غير صحيح" };
    }
    
    // Generate login token
    const token = await generateLoginToken(normalizedPhone);
    
    // In production, this would trigger WhatsApp API
    // For now, we log the login URL (would be sent via WhatsApp)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const loginUrl = `${baseUrl}/elite?token=${token}`;
    
    console.log("[ELITE LOGIN] WhatsApp login link:", loginUrl);
    
    // TODO: Integrate with WhatsApp Business API to send actual message
    // This is a placeholder for the WhatsApp integration
    
    return { success: true };
  } catch (error) {
    console.error("[ELITE LOGIN] Failed to initiate login:", error);
    return { success: false, error: "فشل في إرسال رابط الدخول" };
  }
}

/**
 * Validate login token from URL
 * Classification: ISOLATE - Elite-specific token validation
 */
export async function validateEliteToken(token: string): Promise<{ success: boolean; error?: string }> {
  const result = await validateTokenAndCreateSession(token);
  
  if (result.success) {
    revalidatePath("/elite");
    return { success: true };
  }
  
  return { success: false, error: result.error || "رمز الدخول غير صالح" };
}

/**
 * Logout elite user
 * Classification: ISOLATE - Elite-specific logout
 */
export async function logoutEliteUser(): Promise<void> {
  await destroyEliteSession();
  revalidatePath("/elite");
  redirect("/elite/login");
}

/**
 * Get elite user dashboard data
 * Classification: ISOLATE - Elite-specific data aggregation
 */
export async function getEliteDashboardData(clientAccessId: string) {
  try {
    // Get access details
    const access = await getClientAccess({ id: clientAccessId });
    
    if (!access) {
      throw new Error("Access not found");
    }
    
    // Get permissions
    const permissions = getPermissions(access.accessLevel);
    
    // Get elite state (project, payments, insights, behavior)
    const state = await getEliteState(clientAccessId);
    
    return {
      access,
      permissions,
      ...state,
    };
  } catch (error) {
    console.error("[ELITE DASHBOARD] Failed to load data:", error);
    throw error;
  }
}

/**
 * Check elite authentication status
 * Classification: ISOLATE - Elite-specific auth check
 */
export async function checkEliteAuth(): Promise<{ 
  authenticated: boolean; 
  redirectTo?: string;
  clientAccessId?: string;
}> {
  const { getEliteSession } = await import("@/lib/elite/auth");
  const session = await getEliteSession();
  
  if (!session) {
    return { 
      authenticated: false, 
      redirectTo: "/elite/login" 
    };
  }
  
  return { 
    authenticated: true, 
    clientAccessId: session.clientAccessId 
  };
}

/**
 * Get elite homepage data
 * Classification: ISOLATE - Elite-specific homepage data
 */
export async function getEliteHomeData(clientAccessId: string | null) {
  if (!clientAccessId) {
    // Return default data for non-authenticated users
    return {
      isAuthenticated: false,
      greeting: "أهلاً بك في النخبة",
      primaryCTA: {
        type: "continue_project" as const,
        label: "انضم إلى النخبة",
        description: "جرب تجربة العملاء المميزين",
        priority: 100,
        urgency: false,
      },
      secondaryCTAs: [],
      alertMessage: null,
      encouragementMessage: null,
      showUrgency: false,
      showImpact: false,
      showCelebration: false,
    };
  }
  
  try {
    const state = await getEliteState(clientAccessId);
    
    return {
      isAuthenticated: true,
      ...state.behavior,
      insight: state.insight,
    };
  } catch (error) {
    console.error("[ELITE HOME] Failed to load data:", error);
    return null;
  }
}

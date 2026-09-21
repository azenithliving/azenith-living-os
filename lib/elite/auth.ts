/**
 * ELITE AUTHENTICATION SYSTEM
 * Passwordless WhatsApp-based authentication
 * 
 * CLASSIFICATION: ISOLATE
 * This is an elite-specific authentication layer that operates
 * parallel to the existing auth system without interference.
 */

import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { randomUUID } from "crypto";

const ELITE_SESSION_COOKIE = "elite_session";
const SESSION_DURATION_HOURS = 24;
const TOKEN_EXPIRY_MINUTES = 15;

export type EliteSession = {
  id: string;
  clientAccessId: string;
  phone: string;
  expiresAt: Date;
};

export type AuthResult = {
  success: boolean;
  error?: string;
  session?: EliteSession;
};

/**
 * Issue a one-time link for an existing Elite client.
 *
 * Deliberately requiring a client_access record prevents the public login
 * page from minting access for an arbitrary phone number. Delivery is handled
 * by an administrator until a WhatsApp Business provider is configured.
 */
export async function generateEliteLoginToken(clientAccessId: string) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    throw new Error("Elite invitation service is not configured");
  }
  const { data: clientAccess, error: accessError } = await supabase
    .from("client_access")
    .select("id, phone, access_status")
    .eq("id", clientAccessId)
    .maybeSingle();

  if (accessError || !clientAccess || typeof clientAccess.phone !== "string") {
    throw new Error("Client access record not found");
  }

  if (["suspended", "expired"].includes(String(clientAccess.access_status))) {
    throw new Error("Client access is not eligible for an invitation");
  }

  const token = randomUUID();
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + TOKEN_EXPIRY_MINUTES);

  const { error } = await supabase.from("login_tokens").insert({
    token,
    phone: clientAccess.phone.replace(/\D/g, ""),
    client_access_id: clientAccess.id,
    expires_at: expiresAt.toISOString(),
    used: false,
  });

  if (error) {
    console.error("Failed to create Elite login token:", error);
    throw new Error("Failed to create Elite login token");
  }

  return { token, expiresAt };
}

/**
 * Validate login token and create session
 * Classification: ISOLATE - Elite-specific session creation
 */
export async function validateTokenAndCreateSession(token: string): Promise<AuthResult> {
  const supabase = getSupabaseAdminClient();
  const cookieStore = await cookies();
  
  try {
    if (!supabase) {
      return { success: false, error: "Elite invitation service is not configured" };
    }
    const { data: loginToken, error: tokenError } = await supabase
      .from("login_tokens")
      .select("id, phone, client_access_id, expires_at, used")
      .eq("token", token)
      .maybeSingle();

    if (tokenError || !loginToken) {
      return {
        success: false,
        error: "Invalid or expired token",
      };
    }

    const expiresAt = new Date(loginToken.expires_at);
    if (loginToken.used || Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date()) {
      return {
        success: false,
        error: "Invalid or expired token",
      };
    }

    const clientAccessId = typeof loginToken.client_access_id === "string"
      ? loginToken.client_access_id
      : null;
    if (!clientAccessId) {
      return {
        success: false,
        error: "This invitation is not linked to an Elite client",
      };
    }

    const { data: clientAccess, error: accessError } = await supabase
      .from("client_access")
      .select("id, phone, access_status")
      .eq("id", clientAccessId)
      .maybeSingle();
    if (accessError || !clientAccess || ["suspended", "expired"].includes(String(clientAccess.access_status))) {
      return {
        success: false,
        error: "This client access is not available",
      };
    }

    // Consume the token atomically. If another request consumed it first, no
    // session is created and the caller gets the same safe invalid-token view.
    const { data: consumedToken, error: consumeError } = await supabase
      .from("login_tokens")
      .update({ used: true, used_at: new Date().toISOString() })
      .eq("id", loginToken.id)
      .eq("used", false)
      .select("id")
      .maybeSingle();
    if (consumeError || !consumedToken) {
      return { success: false, error: "Invalid or expired token" };
    }

    // Create session token
    const sessionToken = randomUUID();
    const sessionExpiresAt = new Date();
    sessionExpiresAt.setHours(sessionExpiresAt.getHours() + SESSION_DURATION_HOURS);
    
    // Store session in database
    const { error: sessionError } = await supabase.from("elite_sessions").insert({
      client_access_id: clientAccessId,
      session_token: sessionToken,
      expires_at: sessionExpiresAt.toISOString(),
    });
    
    if (sessionError) {
      console.error("Failed to create session:", sessionError);
      await supabase
        .from("login_tokens")
        .update({ used: false, used_at: null })
        .eq("id", loginToken.id);
      return {
        success: false,
        error: "Failed to create session",
      };
    }
    
    // Set session cookie
    cookieStore.set(ELITE_SESSION_COOKIE, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      expires: sessionExpiresAt,
      path: "/elite",
    });
    
    // Log activity
    await logEliteActivity(clientAccessId, "login", { method: "whatsapp_token" });
    
    return {
      success: true,
      session: {
        id: sessionToken,
        clientAccessId,
        phone: clientAccess.phone,
        expiresAt: sessionExpiresAt,
      },
    };
  } catch (err) {
    console.error("Auth error:", err);
    return {
      success: false,
      error: "Authentication failed",
    };
  }
}

/**
 * Get current elite session from cookie
 * Classification: ISOLATE - Elite-specific session retrieval
 */
export async function getEliteSession(): Promise<EliteSession | null> {
  const cookieStore = await cookies();
  const supabase = await createClient();
  
  const sessionToken = cookieStore.get(ELITE_SESSION_COOKIE)?.value;
  
  if (!sessionToken) {
    return null;
  }
  
  try {
    // Validate session in database
    const { data: session, error } = await supabase
      .from("elite_sessions")
      .select(`
        id,
        session_token,
        client_access_id,
        expires_at,
        client_access:client_access_id (phone)
      `)
      .eq("session_token", sessionToken)
      .gt("expires_at", new Date().toISOString())
      .single();
    
    if (error || !session) {
      return null;
    }
    
    // Update last active
    await supabase
      .from("elite_sessions")
      .update({ last_active_at: new Date().toISOString() })
      .eq("id", session.id);
    
    // Handle the join result properly
    const clientAccess = session.client_access as unknown as { phone: string } | null;
    
    return {
      id: session.session_token,
      clientAccessId: session.client_access_id,
      phone: clientAccess?.phone || "",
      expiresAt: new Date(session.expires_at),
    };
  } catch (err) {
    console.error("Session validation error:", err);
    return null;
  }
}

/**
 * Destroy elite session (logout)
 * Classification: ISOLATE - Elite-specific logout
 */
export async function destroyEliteSession(): Promise<void> {
  const cookieStore = await cookies();
  const supabase = await createClient();
  
  const sessionToken = cookieStore.get(ELITE_SESSION_COOKIE)?.value;
  
  if (sessionToken) {
    // Delete from database
    await supabase.from("elite_sessions").delete().eq("session_token", sessionToken);
    
    // Clear cookie
    cookieStore.delete(ELITE_SESSION_COOKIE);
  }
}

/**
 * Log elite client activity
 * Classification: ISOLATE - Elite-specific analytics
 */
export async function logEliteActivity(
  clientAccessId: string,
  action: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  const supabase = await createClient();
  
  await supabase.from("elite_activity_log").insert({
    client_access_id: clientAccessId,
    action,
    metadata: metadata || {},
  });
}

/**
 * Check if user is authenticated (convenience function)
 * Classification: ISOLATE - Elite-specific auth check
 */
export async function requireEliteAuth(): Promise<EliteSession> {
  const session = await getEliteSession();
  
  if (!session) {
    throw new Error("UNAUTHORIZED");
  }
  
  return session;
}

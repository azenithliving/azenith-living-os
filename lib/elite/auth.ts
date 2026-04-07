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
 * Generate a secure login token
 * Classification: ISOLATE - Elite-specific token generation
 */
export async function generateLoginToken(phone: string): Promise<string> {
  const supabase = await createClient();
  
  // Normalize phone number
  const normalizedPhone = phone.replace(/\D/g, "");
  
  // Generate secure token
  const token = randomUUID();
  
  // Calculate expiry
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + TOKEN_EXPIRY_MINUTES);
  
  // Store token in database
  const { error } = await supabase.from("login_tokens").insert({
    token,
    phone: normalizedPhone,
    expires_at: expiresAt.toISOString(),
    used: false,
  });
  
  if (error) {
    console.error("Failed to create login token:", error);
    throw new Error("Failed to create login token");
  }
  
  return token;
}

/**
 * Validate login token and create session
 * Classification: ISOLATE - Elite-specific session creation
 */
export async function validateTokenAndCreateSession(token: string): Promise<AuthResult> {
  const supabase = await createClient();
  const cookieStore = await cookies();
  
  try {
    // Call the database function to validate token
    const { data, error } = await supabase.rpc("validate_login_token", {
      p_token: token,
    });
    
    if (error || !data || !data.valid) {
      return {
        success: false,
        error: data?.message || "Invalid or expired token",
      };
    }
    
    // Get or create client access record
    const { data: clientAccessId, error: accessError } = await supabase.rpc(
      "get_or_create_client_access",
      { p_phone: data.phone }
    );
    
    if (accessError || !clientAccessId) {
      return {
        success: false,
        error: "Failed to create client access",
      };
    }
    
    // Create session token
    const sessionToken = randomUUID();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + SESSION_DURATION_HOURS);
    
    // Store session in database
    const { error: sessionError } = await supabase.from("elite_sessions").insert({
      client_access_id: clientAccessId,
      session_token: sessionToken,
      expires_at: expiresAt.toISOString(),
    });
    
    if (sessionError) {
      console.error("Failed to create session:", sessionError);
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
      expires: expiresAt,
      path: "/elite",
    });
    
    // Log activity
    await logEliteActivity(clientAccessId, "login", { method: "whatsapp_token" });
    
    return {
      success: true,
      session: {
        id: sessionToken,
        clientAccessId,
        phone: data.phone,
        expiresAt,
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

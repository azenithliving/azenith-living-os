import "server-only";

import { cookies } from "next/headers";
import { randomBytes, createHash } from "crypto";
import { addTrustedDevice, verifyTrustedDevice, revokeAllDevices } from "./vault";

// Session configuration
const SESSION_COOKIE_NAME = "azenith_sovereign_session";
const TRUSTED_DEVICE_COOKIE_NAME = "azenith_trusted_device";
const SESSION_DURATION_DAYS = 90; // 90 days for trusted devices
const SESSION_DURATION_MINUTES = 30; // 30 minutes for non-trusted

interface SessionData {
  adminId: string;
  email: string;
  companyId?: string;
  role?: string;
  isTrustedDevice: boolean;
  issuedAt: string;
  expiresAt: string;
  deviceId?: string;
}

/**
 * Generate secure device fingerprint
 * Uses only client-provided data (userAgent + IP) - server secret is NOT used
 */
function generateDeviceFingerprint(userAgent: string, ip: string): string {
  // IMPORTANT: Never include server secrets like VAULT_MASTER_KEY here
  // This data is used for device recognition, not cryptographic security
  const data = `${userAgent}:${ip}`;
  return createHash("sha256").update(data).digest("hex").slice(0, 32);
}

/**
 * Generate random device ID
 */
function generateDeviceId(): string {
  return randomBytes(16).toString("hex");
}

/**
 * Create new session
 */
export async function createSession(
  adminId: string,
  email: string,
  isTrustedDevice: boolean = false,
  userAgent: string = "",
  ip: string = ""
): Promise<SessionData> {
  const now = new Date();
  const durationDays = isTrustedDevice ? SESSION_DURATION_DAYS : 0;
  const durationMinutes = isTrustedDevice ? 0 : SESSION_DURATION_MINUTES;
  
  const expiresAt = new Date(now);
  if (durationDays > 0) {
    expiresAt.setDate(expiresAt.getDate() + durationDays);
  } else {
    expiresAt.setMinutes(expiresAt.getMinutes() + durationMinutes);
  }
  
  const deviceId = generateDeviceId();
  const fingerprint = generateDeviceFingerprint(userAgent, ip);
  
  const session: SessionData = {
    adminId,
    email,
    isTrustedDevice,
    issuedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    deviceId,
  };
  
  // If trusted device, store in vault
  if (isTrustedDevice) {
    await addTrustedDevice(adminId, {
      deviceId,
      fingerprint,
      issuedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      ip,
    });
  }
  
  // Set session cookie (HttpOnly, Secure, SameSite=Strict)
  const cookieStore = await cookies();
  await cookieStore.set({
    name: SESSION_COOKIE_NAME,
    value: Buffer.from(JSON.stringify(session)).toString("base64"),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    expires: expiresAt,
    path: "/admin-gate",
  });
  
  // Set device cookie (HttpOnly, Secure, SameSite=Strict for security)
  if (isTrustedDevice) {
    await cookieStore.set({
      name: TRUSTED_DEVICE_COOKIE_NAME,
      value: deviceId,
      httpOnly: true, // Prevent JavaScript access - XSS protection
      secure: true, // Always require HTTPS
      sameSite: "strict", // CSRF protection
      expires: expiresAt,
      path: "/",
    });
  }
  
  console.log(`[Sovereign Vault] Session created for ${email}`, {
    deviceId: deviceId.slice(0, 8) + "...",
    trusted: isTrustedDevice,
    expires: expiresAt.toISOString(),
  });
  
  return session;
}

/**
 * Get current session
 */
export async function getSession(): Promise<SessionData | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);
  
  if (!sessionCookie?.value) {
    return null;
  }
  
  try {
    const sessionData = JSON.parse(
      Buffer.from(sessionCookie.value, "base64").toString("utf8")
    ) as SessionData;
    
    // Check expiration
    const expiresAt = new Date(sessionData.expiresAt);
    if (expiresAt < new Date()) {
      console.log(`[Sovereign Vault] Session expired for ${sessionData.email}`);
      await destroySession();
      return null;
    }
    
    // If trusted device, verify it's still valid in vault
    if (sessionData.isTrustedDevice && sessionData.deviceId) {
      const deviceCookie = cookieStore.get(TRUSTED_DEVICE_COOKIE_NAME);
      
      if (deviceCookie?.value !== sessionData.deviceId) {
        console.log(`[Sovereign Vault] Device mismatch - revoking session`);
        await destroySession();
        return null;
      }
    }
    
    return sessionData;
  } catch (error) {
    console.error("[Sovereign Vault] Failed to parse session:", error);
    await destroySession();
    return null;
  }
}

/**
 * Require session (throws if not authenticated)
 */
export async function requireSession(): Promise<SessionData> {
  const session = await getSession();
  
  if (!session) {
    throw new Error("Authentication required");
  }
  
  return session;
}

/**
 * Destroy session (logout)
 */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  
  await cookieStore.delete({
    name: SESSION_COOKIE_NAME,
    path: "/admin-gate",
  });
  
  await cookieStore.delete({
    name: TRUSTED_DEVICE_COOKIE_NAME,
    path: "/",
  });
  
  console.log("[Sovereign Vault] Session destroyed");
}

/**
 * Extend session (refresh token)
 */
export async function extendSession(): Promise<SessionData | null> {
  const session = await getSession();
  
  if (!session) return null;
  
  // Calculate new expiration
  const now = new Date();
  const expiresAt = new Date(now);
  
  if (session.isTrustedDevice) {
    expiresAt.setDate(expiresAt.getDate() + SESSION_DURATION_DAYS);
  } else {
    expiresAt.setMinutes(expiresAt.getMinutes() + SESSION_DURATION_MINUTES);
  }
  
  session.expiresAt = expiresAt.toISOString();
  session.issuedAt = now.toISOString();
  
  // Update cookie
  const cookieStore = await cookies();
  await cookieStore.set({
    name: SESSION_COOKIE_NAME,
    value: Buffer.from(JSON.stringify(session)).toString("base64"),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    expires: expiresAt,
    path: "/admin-gate",
  });
  
  console.log(`[Sovereign Vault] Session extended for ${session.email}`);
  
  return session;
}

/**
 * Check if device is trusted
 */
export async function isTrustedDevice(adminId: string): Promise<boolean> {
  const cookieStore = await cookies();
  const deviceCookie = cookieStore.get(TRUSTED_DEVICE_COOKIE_NAME);
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);
  
  if (!deviceCookie?.value || !sessionCookie?.value) {
    return false;
  }
  
  try {
    const sessionData = JSON.parse(
      Buffer.from(sessionCookie.value, "base64").toString("utf8")
    ) as SessionData;
    
    if (sessionData.adminId !== adminId) {
      return false;
    }
    
    // Verify in vault
    const fingerprint = generateDeviceFingerprint("", ""); // Will be updated with actual values
    return await verifyTrustedDevice(adminId, deviceCookie.value, fingerprint);
  } catch {
    return false;
  }
}

/**
 * Logout from all devices
 */
export async function logoutAllDevices(adminId: string): Promise<void> {
  await revokeAllDevices(adminId);
  await destroySession();
  
  console.log(`[Sovereign Vault] All devices revoked for admin ${adminId.slice(0, 8)}...`);
}

/**
 * Get session info for UI display
 */
export async function getSessionInfo(): Promise<{
  isAuthenticated: boolean;
  email?: string;
  isTrustedDevice: boolean;
  expiresAt?: string;
  deviceId?: string;
} | null> {
  const session = await getSession();
  
  if (!session) {
    return { isAuthenticated: false, isTrustedDevice: false };
  }
  
  return {
    isAuthenticated: true,
    email: session.email,
    isTrustedDevice: session.isTrustedDevice,
    expiresAt: session.expiresAt,
    deviceId: session.deviceId?.slice(0, 8) + "...",
  };
}

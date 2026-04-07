import "server-only";

import { createHash, randomBytes, createCipheriv, createDecipheriv, pbkdf2Sync } from "crypto";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

interface TrustedDevice {
  deviceId: string;
  fingerprint: string;
  issuedAt: string;
  expiresAt: string;
  ip: string;
}

// AES-256-GCM encryption for recovery codes
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;

// Get encryption key from environment
function getEncryptionKey(): Buffer {
  const key = process.env.VAULT_MASTER_KEY;
  if (!key) {
    throw new Error("VAULT_MASTER_KEY not configured");
  }
  // Derive 32-byte key using PBKDF2
  return pbkdf2Sync(key, "azenith_sovereign_salt", 100000, KEY_LENGTH, "sha256");
}

/**
 * Encrypt data using AES-256-GCM
 */
export function encrypt(data: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(data, "utf8", "base64");
  encrypted += cipher.final("base64");
  
  const authTag = cipher.getAuthTag();
  
  // Combine IV + authTag + encrypted data
  const result = Buffer.concat([iv, authTag, Buffer.from(encrypted, "base64")]);
  return result.toString("base64");
}

/**
 * Decrypt data using AES-256-GCM
 */
export function decrypt(encryptedData: string): string {
  const key = getEncryptionKey();
  const data = Buffer.from(encryptedData, "base64");
  
  const iv = data.subarray(0, IV_LENGTH);
  const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted.toString("base64"), "base64", "utf8");
  decrypted += decipher.final("utf8");
  
  return decrypted;
}

/**
 * Generate 10 recovery codes
 * Format: XXXX-XXXX-XXXX (4 groups of 4, hyphenated for readability)
 */
export function generateRecoveryCodes(): string[] {
  const codes: string[] = [];
  for (let i = 0; i < 10; i++) {
    const bytes = randomBytes(8);
    const hex = bytes.toString("hex").toUpperCase();
    // Format as XXXX-XXXX-XXXX
    const formatted = `${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}`;
    codes.push(formatted);
  }
  return codes;
}

/**
 * Hash a recovery code for secure comparison (one-way)
 */
export function hashRecoveryCode(code: string): string {
  // Normalize: remove hyphens, uppercase
  const normalized = code.replace(/-/g, "").toUpperCase();
  return createHash("sha256").update(normalized).digest("hex");
}

/**
 * Initialize vault for new admin user
 */
export async function initializeVault(adminId: string): Promise<{
  recoveryCodes: string[];
  encryptedCodes: string;
}> {
  const supabase = getSupabaseAdminClient();
  
  // Generate recovery codes
  const recoveryCodes = generateRecoveryCodes();
  
  // Store hashed codes for verification
  const hashedCodes = recoveryCodes.map(hashRecoveryCode);
  
  // Encrypt the full codes for storage
  const encryptedCodes = encrypt(JSON.stringify({
    codes: recoveryCodes,
    hashedCodes,
    generatedAt: new Date().toISOString(),
    used: [],
    remaining: 10
  }));
  
  // Generate offline master hash fragment
  const masterHashFragment = createHash("sha256")
    .update(adminId + process.env.VAULT_MASTER_KEY)
    .digest("hex")
    .slice(0, 32); // First 32 chars only
  
  // Create vault record
  const { error } = await supabase.from("recovery_vault").insert({
    admin_id: adminId,
    recovery_codes_encrypted: encryptedCodes,
    master_hash_fragment: masterHashFragment,
    trusted_devices: [],
  });
  
  if (error) {
    throw new Error(`Failed to initialize vault: ${error.message}`);
  }
  
  return { recoveryCodes, encryptedCodes };
}

/**
 * Verify a recovery code
 */
export async function verifyRecoveryCode(adminId: string, code: string): Promise<boolean> {
  const supabase = getSupabaseAdminClient();
  
  const { data: vault } = await supabase
    .from("recovery_vault")
    .select("recovery_codes_encrypted")
    .eq("admin_id", adminId)
    .single();
  
  if (!vault) return false;
  
  const decrypted = decrypt(vault.recovery_codes_encrypted);
  const vaultData = JSON.parse(decrypted);
  
  const normalizedInput = code.replace(/-/g, "").toUpperCase();
  const inputHash = hashRecoveryCode(normalizedInput);
  
  const codeIndex = vaultData.hashedCodes.findIndex((h: string) => h === inputHash);
  
  if (codeIndex === -1) return false;
  if (vaultData.used.includes(codeIndex)) return false;
  
  vaultData.used.push(codeIndex);
  vaultData.remaining = 10 - vaultData.used.length;
  
  const updatedEncrypted = encrypt(JSON.stringify(vaultData));
  
  await supabase
    .from("recovery_vault")
    .update({
      recovery_codes_encrypted: updatedEncrypted,
      updated_at: new Date().toISOString(),
    })
    .eq("admin_id", adminId);
  
  await logAuditEvent(adminId, "recovery_code_used", "auth", adminId, {
    codeIndex,
    remaining: vaultData.remaining,
  });
  
  return true;
}

/**
 * Add trusted device
 */
export async function addTrustedDevice(
  adminId: string,
  device: TrustedDevice
): Promise<void> {
  const supabase = getSupabaseAdminClient();
  
  const { data } = await supabase
    .from("recovery_vault")
    .select("trusted_devices")
    .eq("admin_id", adminId)
    .single();
  
  const devices: TrustedDevice[] = data?.trusted_devices || [];
  
  // Remove expired devices
  const now = new Date().toISOString();
  const validDevices = devices.filter((d) => d.expiresAt > now);
  
  // Add new device (max 5 devices)
  validDevices.unshift(device);
  if (validDevices.length > 5) {
    validDevices.pop();
  }
  
  await supabase
    .from("recovery_vault")
    .update({
      trusted_devices: validDevices,
      updated_at: new Date().toISOString(),
    })
    .eq("admin_id", adminId);
}

/**
 * Verify trusted device
 */
export async function verifyTrustedDevice(
  adminId: string,
  deviceId: string,
  fingerprint: string
): Promise<boolean> {
  const supabase = getSupabaseAdminClient();
  
  const { data } = await supabase
    .from("recovery_vault")
    .select("trusted_devices")
    .eq("admin_id", adminId)
    .single();
  
  if (!data?.trusted_devices) return false;
  
  const now = new Date().toISOString();
  const device = (data.trusted_devices as TrustedDevice[]).find(
    (d) => d.deviceId === deviceId && d.fingerprint === fingerprint && d.expiresAt > now
  );
  
  return !!device;
}

/**
 * Revoke all trusted devices
 */
export async function revokeAllDevices(adminId: string): Promise<void> {
  const supabase = getSupabaseAdminClient();
  
  await supabase
    .from("recovery_vault")
    .update({
      trusted_devices: [],
      updated_at: new Date().toISOString(),
    })
    .eq("admin_id", adminId);
}

/**
 * Verify offline master hash
 */
export function verifyOfflineMasterHash(
  adminId: string,
  clientHash: string,
  serverFragment: string
): boolean {
  // Reconstruct the full hash
  const expectedHash = createHash("sha256")
    .update(adminId + process.env.VAULT_MASTER_KEY)
    .digest("hex");
  
  // Server has first 32 chars, client should have the rest
  const fullClientHash = clientHash + serverFragment;
  
  return fullClientHash === expectedHash;
}

/**
 * Log audit event
 */
async function logAuditEvent(
  actorId: string,
  action: string,
  entityType: string,
  entityId: string,
  payload: Record<string, unknown>
): Promise<void> {
  const supabase = getSupabaseAdminClient();
  
  await supabase.from("sovereign_audit_logs").insert({
    actor_id: actorId,
    actor_type: "user",
    action,
    entity_type: entityType,
    entity_id: entityId,
    payload,
  });
}

/**
 * Check if vault exists for admin
 */
export async function hasVault(adminId: string): Promise<boolean> {
  const supabase = getSupabaseAdminClient();
  
  const { count } = await supabase
    .from("recovery_vault")
    .select("id", { count: "exact", head: true })
    .eq("admin_id", adminId);
  
  return (count || 0) > 0;
}

/**
 * Get remaining recovery codes count
 */
export async function getRemainingRecoveryCodes(adminId: string): Promise<number> {
  const supabase = getSupabaseAdminClient();
  
  const { data } = await supabase
    .from("recovery_vault")
    .select("recovery_codes_encrypted")
    .eq("admin_id", adminId)
    .single();
  
  if (!data) return 0;
  
  try {
    const decrypted = decrypt(data.recovery_codes_encrypted);
    const vaultData = JSON.parse(decrypted);
    return vaultData.remaining || 0;
  } catch {
    return 0;
  }
}

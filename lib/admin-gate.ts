import "server-only";
import {
  getPrimaryAdminEmail,
  isAuthorizedAdminEmail,
  normalizeAdminEmail,
} from "@/lib/admin-access";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export { isAuthorizedAdminEmail, normalizeAdminEmail };

export function getAdminGateEmail(): string {
  const configuredEmail = getPrimaryAdminEmail();
  if (configuredEmail) return configuredEmail;
  throw new Error("ADMIN_GATE_EMAIL is not configured");
}

export function getAdminGatePassword(): string | null {
  const fromEnv = process.env.ADMIN_GATE_PASSWORD?.trim();
  if (fromEnv) return fromEnv;
  return null;
}

export function isAdminGateConfigured(): boolean {
  try {
    getAdminGateEmail();
    return Boolean(getAdminGatePassword());
  } catch {
    return false;
  }
}

export function validateAdminGateCredentials(email: string, password: string): boolean {
  const configuredPassword = getAdminGatePassword();
  if (!configuredPassword) return false;
  try {
    return (
      normalizeAdminEmail(email) === getAdminGateEmail() &&
      password === configuredPassword
    );
  } catch {
    return false;
  }
}

export function getPrimaryAdminLegacy2FASecret(): string | null {
  return process.env.ADMIN_GATE_2FA_SECRET?.trim() || null;
}

/**
 * Whether the gate asks for a verification code after the password.
 *
 * Owner's word 2026-10-19: his phone was lost and the second step locked him out of his own
 * dashboard, so he ordered it off — email and password open the gate. The order lives in the store's
 * own settings row (`admin_gate_2fa_required`) so it can be withdrawn in one sentence, and an
 * environment value still wins over it for any deployment that wants the harder rule. Nothing was
 * deleted here: the code door, the enrolled key and the login alert all stand where they were.
 *
 * A missing row, an unreadable row, or no client at all means the code is required. Losing a settings
 * line must never silently cost a factor — that is the same silence this project keeps closing.
 */
export async function adminGateRequires2FA(): Promise<boolean> {
  const fromEnv = String(process.env.ADMIN_GATE_2FA_REQUIRED ?? "").trim().toLowerCase();
  if (["true", "1", "on", "yes"].includes(fromEnv)) return true;
  if (["false", "0", "off", "no"].includes(fromEnv)) return false;

  const supabase = getSupabaseAdminClient();
  if (!supabase) return true;
  try {
    const { data, error } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", "admin_gate_2fa_required")
      .maybeSingle<{ value: unknown }>();
    if (error || !data) return true;
    return !(data.value === false || String(data.value).trim().toLowerCase() === "false");
  } catch {
    return true;
  }
}

import "server-only";
import {
  getPrimaryAdminEmail,
  isAuthorizedAdminEmail,
  normalizeAdminEmail,
} from "@/lib/admin-access";

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

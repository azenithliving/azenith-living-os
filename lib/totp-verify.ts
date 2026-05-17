import speakeasy from "speakeasy";

/** Strip spaces/dashes; keep first 6 digits only */
export function normalizeTotpToken(raw: string): string {
  return String(raw).replace(/\D/g, "").slice(0, 6);
}

/** Base32 secrets from env/DB may include spaces or mixed case */
export function normalizeBase32Secret(secret: string): string {
  return secret.replace(/\s+/g, "").replace(/-/g, "").toUpperCase();
}

export function collectUniqueTotpSecrets(
  ...candidates: Array<string | null | undefined>
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const candidate of candidates) {
    if (!candidate?.trim()) continue;
    const normalized = normalizeBase32Secret(candidate);
    if (normalized.length < 16) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

export function verifyTotpToken(
  secret: string | null | undefined,
  token: string,
  window = 4
): boolean {
  if (!secret?.trim()) return false;
  const digits = normalizeTotpToken(token);
  if (digits.length !== 6) return false;
  try {
    return speakeasy.totp.verify({
      secret: normalizeBase32Secret(secret),
      encoding: "base32",
      token: digits,
      window,
    });
  } catch {
    return false;
  }
}

/** Try env secret first, then DB — returns which secret matched */
export function verifyTotpAgainstSecrets(
  token: string,
  secrets: string[],
  window = 4
): { verified: boolean; matchedSecret: string | null } {
  for (const secret of secrets) {
    if (verifyTotpToken(secret, token, window)) {
      return { verified: true, matchedSecret: secret };
    }
  }
  return { verified: false, matchedSecret: null };
}

/** Generate current token for tests / diagnostics (never expose in production APIs) */
export function generateTotpToken(secret: string): string {
  return speakeasy.totp({
    secret: normalizeBase32Secret(secret),
    encoding: "base32",
  });
}

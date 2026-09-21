/**
 * Shared, edge-safe admin identity check.
 *
 * Supabase user_metadata is intentionally not used here because a user can
 * change it through the public auth API. Administrative access is instead an
 * explicit server-side email allow-list. The first value is the primary gate
 * account; optional additional accounts are supplied through
 * ADMIN_GATE_ALLOWED_EMAILS as a comma-separated list.
 */

export function normalizeAdminEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function getPrimaryAdminEmail(): string | null {
  const configured = process.env.ADMIN_GATE_EMAIL?.trim();
  if (configured) return normalizeAdminEmail(configured);
  return null;
}

export function getAuthorizedAdminEmails(): string[] {
  const emails = [getPrimaryAdminEmail()];
  const additional = process.env.ADMIN_GATE_ALLOWED_EMAILS?.split(",") ?? [];
  emails.push(...additional.map(normalizeAdminEmail));
  return [...new Set(emails.filter((email): email is string => Boolean(email)))];
}

export function isAuthorizedAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return getAuthorizedAdminEmails().includes(normalizeAdminEmail(email));
}

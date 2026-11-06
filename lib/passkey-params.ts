import "server-only";

import { resolveSiteUrl } from "@/lib/admin-env-resolver";

/**
 * The facts a passkey is bound to, owned in one place.
 *
 * A key is minted for one rpID and one origin and never works on another, so the enrollment doors and
 * the login door must answer with the same two values — a second owner of either is how a key gets
 * enrolled that can never open the dashboard. Both come from the store's own site-url owner.
 */
export function passkeyRpId(): string {
  return new URL(resolveSiteUrl()).hostname;
}

export function passkeyOrigin(): string {
  return resolveSiteUrl();
}

/** Human name the device shows next to the account. */
export const PASSKEY_RP_NAME = "أزينث";

/** How long an unanswered challenge stays valid, and the path all four passkey doors live under. */
export const CHALLENGE_TTL_SECONDS = 300;
export const CHALLENGE_PATH = "/api/admin/passkeys";

export const ENROLL_CHALLENGE_COOKIE = "passkey_enroll_challenge";
export const LOGIN_CHALLENGE_COOKIE = "passkey_login_challenge";

/** The one cookie shape the passkey doors share: unreadable by scripts, first-party only, short. */
export function challengeCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    maxAge: CHALLENGE_TTL_SECONDS,
    path: CHALLENGE_PATH,
  };
}

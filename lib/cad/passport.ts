/**
 * passport.ts — the private address a customer's design sheet is reached by, and the
 * seal that freezes what both sides agreed.
 *
 * The link is the login: 24 characters from the crypto random source, so nobody walks
 * from one customer's floor plan to another's, and the customer never has to remember
 * a password for a five-minute look at their own room.
 *
 * The seal is a hash over exactly the numbers that were agreed. It is not encryption
 * and does not pretend to be: it answers one question later — did the sheet change
 * after he confirmed it — which is the argument the owner asked this whole feature to
 * end.
 */

import { createHash, randomBytes } from "node:crypto";

export function newPassportToken(): string {
  // 18 bytes -> 24 base64url characters, no padding, no symbols that break in chat apps.
  return randomBytes(18).toString("base64url");
}

export function looksLikePassportToken(value: string): boolean {
  return /^[A-Za-z0-9_-]{20,32}$/.test(value);
}

/** The numbers only, ordered, rounded to the centimetre: what the seal is over. */
export function agreedNumbers(dimensions: { meters: number }[]): number[] {
  return dimensions
    .map((d) => Math.round(Number(d.meters) * 100) / 100)
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b);
}

export function freezeHash(dimensions: { meters: number }[]): string {
  return createHash("sha256")
    .update(JSON.stringify(agreedNumbers(dimensions)))
    .digest("hex")
    .slice(0, 32);
}

/** Does the sheet still say what he agreed to? */
export function stillSealed(hash: string | null | undefined, dimensions: { meters: number }[]): boolean {
  if (!hash) return false;
  return freezeHash(dimensions) === hash;
}

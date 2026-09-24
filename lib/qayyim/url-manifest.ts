/**
 * url-manifest.ts — Single source of truth for real, resolvable site paths.
 *
 * Every link the Qayyim swarm shows an admin MUST be verified against this
 * manifest. Hallucinated paths (e.g. the old `/products/sofa-…` pattern that
 * `MasterOrchestrator.formatSuccessResponse` used to whitelist) are either
 * rewritten to a real equivalent or marked "(غير موثق)" — never shown as live.
 */

import { VALID_ROOM_SLUG_LIST, ROOM_ALIAS_SLUG_LIST } from "@/lib/rooms-catalog";

const STATIC_PATHS = new Set([
  "/",
  "/rooms",
  "/furniture",
  "/about",
  "/request",
  "/bookings",
  "/start",
  "/privacy",
  "/terms",
  "/elite",
  "/elite-brief",
  "/elite-intelligence",
]);

const DYNAMIC_PREFIXES = [
  "/furniture/", // search-type page, any query slug renders
  "/pages/", // CMS slug — validated async when DB is reachable
  "/preview/section/",
  "/api/admin/qayyim/preview/",
  "/dashboard",
  "/admin",
];

/** Normalize "/rooms/living/?x=1#y" or full URLs to a bare pathname. */
export function toPath(input: string): string | null {
  let raw = input.trim();
  if (/^https?:\/\//i.test(raw)) {
    try {
      raw = new URL(raw).pathname;
    } catch {
      return null;
    }
  }
  if (!raw.startsWith("/")) return null;
  const path = raw.split("?")[0].split("#")[0];
  if (path.length > 1 && path.endsWith("/")) return path.slice(0, -1);
  return path;
}

/** Synchronous truth check — no network. */
export function isRealPath(candidate: string): boolean {
  const path = toPath(candidate);
  if (path === null) return false;
  if (STATIC_PATHS.has(path)) return true;

  const roomMatch = path.match(/^\/rooms\/([^/]+)$/);
  if (roomMatch) {
    const slug = decodeURIComponent(roomMatch[1]);
    const valid: readonly string[] = [...VALID_ROOM_SLUG_LIST, ...ROOM_ALIAS_SLUG_LIST];
    return valid.includes(slug);
  }

  return DYNAMIC_PREFIXES.some(
    (p) => path.startsWith(p) && path.split("/").slice(1).every(Boolean)
  );
}

/**
 * Best-effort honest rewrite for product mentions: the site has no product
 * detail pages, so a product link must point at its room or the catalog.
 */
export function suggestProductLink(roomSlug?: string | null): string {
  if (roomSlug && isRealPath(`/rooms/${roomSlug}`)) return `/rooms/${roomSlug}`;
  return "/furniture";
}

const LINK_IN_TEXT = /(?:https?:\/\/[^\s)>\]"'،]+|\/[A-Za-z0-9\-_./%]+(?:\?[^\s)>\]"'،]*)?)/g;

/**
 * Scan free text (LLM replies, issue tables) and neutralize any
 * site-origin path that is not real. Returns cleaned text + what was removed.
 */
export function verifyResponseLinks(text: string, siteOrigin?: string): { text: string; removed: string[] } {
  const removed: string[] = [];
  const cleaned = text.replace(LINK_IN_TEXT, (match) => {
    let path = match;
    if (/^https?:\/\//i.test(match)) {
      if (siteOrigin && match.startsWith(siteOrigin)) {
        path = toPath(match) ?? "/";
      } else {
        return match; // external absolute URL — not our manifest's business
      }
    }
    if (isRealPath(path)) return match;
    removed.push(match);
    return "(رابط غير موثق)";
  });
  return { text: cleaned, removed };
}

/** Evidence filter used by the orchestrator's success formatter. */
export function keepRealEvidenceUrls(urls: string[]): string[] {
  return urls.filter((u) => isRealPath(u) || u.startsWith("/#"));
}

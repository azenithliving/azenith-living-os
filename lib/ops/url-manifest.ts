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
  "/seo/", // SEO landing pages linked from the home footer
  "/preview/section/",
  "/api/admin/ops/preview/",
  "/dashboard",
];

/**
 * Admin sections that exist on disk. Deliberately a closed list: the previous
 * rule was "anything under /admin", so an invented `/admin/reports/weekly-pdf`
 * passed the link guard and was shown to the owner as a live page. A real route
 * missing from this list fails visibly ("رابط غير موثق" on a page the swarm just
 * linked); a hallucinated one passing fails silently. Wrong in the loud
 * direction is the cheap direction.
 */
const ADMIN_SECTIONS = new Set([
  "agents",
  "assistant",
  "browser",
  "computer",
  "database",
  "elite",
  "fate",
  "intel",
  "intelligence",
  "manufacturing",
  "owner-dashboard",
  "phone",
  "qayyim",
  "sales",
  "sandbox",
  "settings",
  "system",
  "v2",
  "work",
]);

/**
 * Our own origin. Evidence links are about this shop's pages, so a full URL on
 * somebody else's host is not a path in this manifest — a competitor's `/rooms`
 * used to satisfy `isRealPath` and would have survived as "real evidence".
 */
const FALLBACK_ORIGIN = "https://azenith-living.vercel.app";

function hostOf(absolute: string): string | null {
  try {
    return new URL(absolute).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function isOwnHost(absolute: string): boolean {
  const host = hostOf(absolute);
  if (!host) return false;
  if (host === "localhost" || host === "127.0.0.1") return true;
  const configured = (process.env.NEXT_PUBLIC_SITE_URL || "").trim() || FALLBACK_ORIGIN;
  return host === hostOf(configured);
}

/** Normalize "/rooms/living/?x=1#y" or full URLs to a bare pathname. */
export function toPath(input: string): string | null {
  let raw = input.trim();
  if (/^https?:\/\//i.test(raw)) {
    if (!isOwnHost(raw)) return null;
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

  if (path === "/admin" || path.startsWith("/admin/")) {
    const section = path.split("/")[2];
    return !section || ADMIN_SECTIONS.has(section);
  }

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

const LINK_IN_TEXT = /(?:https?:\/\/[^\s)>\]"'،]+|(?<![\w/])\/[A-Za-z][A-Za-z0-9\-_.%]*(?:\/[A-Za-z0-9\-_.%]*)*)/g;

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

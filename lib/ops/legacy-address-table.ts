/**
 * The retired store addresses, answered at the outer gate.
 *
 * Batch four of the naming retirement moved these out of the pages that used to
 * forward them. A redirect living inside `/admin/v2` meant the new house still
 * knew the old name, and the old house could never be deleted while its own rooms
 * were what answered for it. This table is now the only place a retired address
 * exists — `proxy.ts` reads it, and a guard fails if either side drifts.
 */
import { isOpsKey, legacyToOps } from "@/lib/ops/identity";

export type LegacyAddress = {
  /** The retired address, without a trailing slash. */
  from: string;
  /** The live address of the employee that absorbed it. */
  to: string;
};

export const LEGACY_ADDRESS_REDIRECTS: LegacyAddress[] = [
  { from: "/admin/v2/qayyim", to: "/admin/v2/ops" },
  { from: "/admin/v2/agents/qayyim", to: "/admin/v2/agents/ops" },
  { from: "/admin/qayyim", to: "/admin/v2/ops" },
];

/**
 * Returns the address to bounce to, query included — `?highlight=`, `?agent=` and
 * `?proposal=` are what the owner's bookmarks and his old Telegram messages carry.
 * Null means the gate leaves the request alone.
 */
export function legacyAddressRedirect(pathname: string, search = ""): string | null {
  const clean = pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  const hit = LEGACY_ADDRESS_REDIRECTS.find((entry) => entry.from === clean);
  return hit ? `${hit.to}${search}` : null;
}

/**
 * A retired *tab* inside a page that still ships. The old sales centre keeps four of its
 * own rooms, but the customers tab moved out to the sales office window — and the
 * consultant's Telegram messages still deep-link to `/admin/sales?tab=leads&expand=…`.
 * Erasing the tab without answering that address would break a link the owner already
 * sent himself, so the gate answers it and the old page never learns it had a customer
 * room at all.
 */
export const LEGACY_TAB_REDIRECTS: Array<{ page: string; tab: string; to: string }> = [
  { page: "/admin/sales", tab: "leads", to: "/admin/v2/sales" },
];

/** The address to bounce to with every other parameter kept, or null to leave it alone. */
export function legacyTabRedirect(pathname: string, search = ""): string | null {
  const clean = pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  const hit = LEGACY_TAB_REDIRECTS.find((entry) => entry.page === clean);
  if (!hit) return null;
  const params = new URLSearchParams(search);
  if (params.get("tab") !== hit.tab) return null;
  params.delete("tab");
  const rest = params.toString();
  return `${hit.to}${rest ? `?${rest}` : ""}`;
}

/**
 * A retired *agent key* arriving in a query is the same problem wearing a different
 * hat: the owner's older Telegram messages deep-link with the retired spelling of
 * the leader's key. Translating it inside the new house means the new house knows
 * the old name, so the gate answers it instead and the page only ever sees a live
 * key.
 *
 * A key that is live, unknown, or absent is left exactly as it is — a wrong key is
 * the page's own business (it falls back to the leader), not a rename.
 */
export function retiredAgentQueryRedirect(pathname: string, search = ""): string | null {
  if (!search.includes("agent=")) return null;
  const params = new URLSearchParams(search);
  const sent = params.get("agent");
  if (!sent || isOpsKey(sent)) return null;
  const live = legacyToOps(sent);
  if (!isOpsKey(live) || live === sent) return null;
  params.set("agent", live);
  return `${pathname}?${params.toString()}`;
}

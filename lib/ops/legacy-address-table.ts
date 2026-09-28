/**
 * The retired store addresses, answered at the outer gate.
 *
 * Batch four of the naming retirement moved these out of the pages that used to
 * forward them. A redirect living inside `/admin/v2` meant the new house still
 * knew the old name, and the old house could never be deleted while its own rooms
 * were what answered for it. This table is now the only place a retired address
 * exists — `proxy.ts` reads it, and a guard fails if either side drifts.
 */
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

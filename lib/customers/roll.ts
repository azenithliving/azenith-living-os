/**
 * The customers roll — one human, one line.
 *
 * Seven spaces in this store describe the same buyer separately: the profile written
 * when he first arrived, the consultant's conversation, the quote request, the lead
 * form, the order, the appointment, the conversion. Until now the dashboard counted
 * customers in one place and the chat's tool counted them in another, and both were
 * telling the owner the truth about a different pile.
 *
 * This module is the counting rule, kept pure so it can be tested without a
 * database. The door reads, this decides, the screen shows.
 *
 * The brakes held here: a row with no phone, no email and no name is never a customer
 * — it is counted as anonymous so nothing disappears silently; a name alone is marked
 * weak, because two «أحمد» rows are not one human; and the cold clock is carried from
 * `lib/leads-freshness`, so an unknown date stays unknown instead of looking new.
 */
import { identityOf, phoneKey, type IdentityKind } from "@/lib/customers/identity";
import { freshnessOf, hoursSinceLastTouch, needsReplyNow, type FreshnessKey } from "@/lib/leads-freshness";

export type Space = "profile" | "conversation" | "quote" | "form" | "order" | "appointment" | "conversion" | "paper";

export type RawRow = {
  space: Space;
  phone?: string | null;
  email?: string | null;
  name?: string | null;
  /** The conversation this row belongs to, so a screen can open it instead of guessing. */
  session?: string | null;
  /** The profile row this row speaks for, when one exists. */
  profileId?: string | null;
  at?: string | null;
  tier?: string | null;
  price?: number | string | null;
  paid?: number | string | null;
  budget?: string | null;
  intent?: string | null;
  score?: number | string | null;
  /**
   * What he was looking at, in his own words on the site: the room, the style, when he
   * wants it, and the last page he stood on. This is the difference between a phone number
   * and a caller — and it is stored, not modelled.
   */
  looking?: Looking | null;
};

export type Looking = {
  roomType: string | null;
  style: string | null;
  serviceType: string | null;
  lastPage: string | null;
  /** The area he named for himself in his own conversation, in the store's map spelling. */
  area: string | null;
};

export type CustomerRow = {
  key: string;
  kind: IdentityKind;
  name: string | null;
  phone: string | null;
  email: string | null;
  tier: string | null;
  budget: string | null;
  intent: string | null;
  score: number | null;
  /** The browsing the store kept about him — the first profile row that carried any. */
  looking: Looking | null;
  spaces: Space[];
  /** The conversations that belong to this human, newest unknown until the door reads them. */
  sessions: string[];
  /** The profile rows that carry him. An order can only be attached to one of these. */
  profileIds: string[];
  money: { quoted: number; paid: number };
  lastTouch: string | null;
  hoursSince: number | null;
  freshness: { key: FreshnessKey; label: string };
  needsReply: boolean;
  anonymous: number;
};

const TIER_STRENGTH: Record<string, number> = { diamond: 4, gold: 3, silver: 2, bronze: 1 };

const num = (v: unknown): number => {
  // A boolean is not an amount. `paid: true` summed as 1 would tell the owner he
  // received one pound — the honest answer about a flag is that it is not money.
  if (typeof v === "boolean") return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Only the four metal tiers the store uses. Anything else in that column is not a tier. */
const asTier = (v: unknown): string | null => {
  const s = typeof v === "string" ? v.trim().toLowerCase() : "";
  return TIER_STRENGTH[s] ? s : null;
};

const best = (a: string | null, b: string | null): string | null => a || b || null;

export function rollCustomers(rows: RawRow[], now: Date = new Date()): CustomerRow[] {
  const byKey = new Map<string, CustomerRow>();
  let anonymous = 0;

  for (const row of rows) {
    const id = identityOf({ phone: row.phone, email: row.email, name: row.name });
    if (!id.key) {
      anonymous++;
      continue;
    }
    const phone = phoneKey(row.phone);
    const at = row.at ?? null;
    let line = byKey.get(id.key);
    if (!line) {
      line = {
        key: id.key,
        kind: id.kind,
        name: best(row.name?.trim() ?? null, null),
        phone,
        email: row.email?.trim() ?? null,
        tier: asTier(row.tier),
        budget: row.budget ?? null,
        intent: row.intent ?? null,
        looking: row.looking ?? null,
        score: row.score == null ? null : num(row.score),
        spaces: [],
        sessions: [],
        profileIds: [],
        money: { quoted: 0, paid: 0 },
        lastTouch: at,
        hoursSince: null,
        freshness: { key: "unknown", label: "بدون تاريخ" },
        needsReply: false,
        anonymous: 0,
      };
      byKey.set(id.key, line);
    }
    if (!line.spaces.includes(row.space)) line.spaces.push(row.space);
    if (row.session && !line.sessions.includes(row.session)) line.sessions.push(row.session);
    if (row.profileId && !line.profileIds.includes(row.profileId)) line.profileIds.push(row.profileId);
    line.name = best(line.name, row.name?.trim() ?? null);
    line.phone = line.phone ?? phone;
    line.email = line.email ?? row.email?.trim() ?? null;
    line.budget = line.budget ?? row.budget ?? null;
    line.intent = line.intent ?? row.intent ?? null;
    if (!line.looking && row.looking) line.looking = row.looking;
    if (line.score === null && row.score != null) line.score = num(row.score);
    const tier = asTier(row.tier);
    if (tier && (!line.tier || TIER_STRENGTH[tier] > TIER_STRENGTH[line.tier])) line.tier = tier;
    line.money.quoted += num(row.price);
    line.money.paid += num(row.paid);
    if (at && (!line.lastTouch || Date.parse(at) > Date.parse(line.lastTouch))) line.lastTouch = at;
  }

  const lines = [...byKey.values()];
  for (const line of lines) {
    const hours = hoursSinceLastTouch({ created_at: line.lastTouch ?? undefined, messages: [] }, now);
    line.hoursSince = hours;
    const f = freshnessOf(hours);
    line.freshness = { key: f.key, label: f.label };
    line.needsReply = needsReplyNow(hours);
  }

  // Longest-silenced first: the owner reads this list as a waiting queue, not a gallery.
  lines.sort((a, b) => (b.hoursSince ?? -1) - (a.hoursSince ?? -1));
  if (anonymous > 0) lines.push({
    key: "anonymous", kind: "none", name: null, phone: null, email: null, tier: null, budget: null,
    intent: null, looking: null, score: null, spaces: [], sessions: [], profileIds: [], money: { quoted: 0, paid: 0 }, lastTouch: null, hoursSince: null,
    freshness: { key: "unknown", label: "بدون تاريخ" }, needsReply: false, anonymous,
  });
  return lines;
}

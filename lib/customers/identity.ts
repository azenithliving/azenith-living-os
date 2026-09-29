/**
 * One customer, one key.
 *
 * The same human writes to this store from five places: the consultant's conversation,
 * the quote request, the lead form, the order, the appointment. Each space spells him
 * differently, so the screen and the chat could show two customers where there is one.
 * This module decides when two records are the same person — and says so out loud when
 * it is only a guess.
 *
 * The brake that shapes it: an identity is never invented. No usable contact detail
 * means no key, and a name alone is marked weak, because «أحمد» twice is not the same
 * customer twice.
 */
export type IdentityKind = "phone" | "email" | "weak-name" | "none";
export type Identity = { key: string | null; kind: IdentityKind };

/** Egyptian mobile landlines: +20 1XX XXX XXXX, 0020…, 01…, or the bare national number. */
export function phoneKey(raw: unknown): string | null {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.length === 0) return null;
  let national = digits;
  if (national.startsWith("0020")) national = national.slice(4);
  else if (national.startsWith("20") && national.length >= 12) national = national.slice(2);
  if (national.startsWith("0")) national = national.slice(1);
  // A mobile subscriber number is ten digits starting 1[0125].
  if (!/^1[0125]\d{8}$/.test(national)) return null;
  return national;
}

export function identityOf(record: Record<string, unknown> | null | undefined): Identity {
  if (!record) return { key: null, kind: "none" };
  const phone = phoneKey(record.phone ?? record.contactValue);
  if (phone) return { key: `phone:${phone}`, kind: "phone" };
  const email = String(record.email ?? "").trim().toLowerCase();
  if (email.includes("@")) return { key: `email:${email}`, kind: "email" };
  const name = String(record.name ?? record.customer_name ?? "").replace(/\s+/g, " ").trim();
  if (name) return { key: `name:${name}`, kind: "weak-name" };
  return { key: null, kind: "none" };
}

export type MergedCustomer = {
  key: string;
  kind: IdentityKind;
  name: string | null;
  spaces: string[];
  /** Records with no usable contact detail stay separate rather than joining a guess. */
  anonymous: number;
};

export function mergeByIdentity(rows: Array<Record<string, unknown>>): MergedCustomer[] {
  const byKey = new Map<string, MergedCustomer>();
  let anonymous = 0;
  for (const row of rows) {
    const id = identityOf(row);
    if (!id.key) { anonymous++; continue; }
    const existing = byKey.get(id.key);
    const space = String(row.space ?? "unknown");
    if (!existing) {
      byKey.set(id.key, {
        key: id.key,
        kind: id.kind,
        name: String(row.name ?? row.customer_name ?? "").trim() || null,
        spaces: [space],
        anonymous: 0,
      });
      continue;
    }
    if (!existing.spaces.includes(space)) existing.spaces.push(space);
    if (!existing.name) {
      const candidate = String(row.name ?? row.customer_name ?? "").trim();
      if (candidate) existing.name = candidate;
    }
  }
  const merged = [...byKey.values()];
  if (anonymous > 0) merged.push({ key: "anonymous", kind: "none", name: null, spaces: [], anonymous });
  return merged;
}

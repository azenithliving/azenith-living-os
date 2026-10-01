/**
 * sketch-link.ts — whose paper is this?
 *
 * `room_sketches.customer_key` has existed since the table was created and has never held
 * a value — measured on the published store on 2026-10-01: 12 readings, 0 linked. A reading
 * with no owner on it cannot be handed to a colleague, and when the customer calls back
 * there is nothing to pull up.
 *
 * The stored value is the roll's OWN key (`phone:<national digits>`, `email:<address>`,
 * `name:<text>`, exactly as `lib/customers/identity.ts` forms it) — never a copy of the
 * name or the number. That is what keeps the desk and the roll from disagreeing about who
 * a person is, and it is why nothing here writes to the roll: a paper can point at a
 * customer without becoming a second ledger of customers.
 *
 * The brake: a link is only ever derived from digits or text someone actually handed the
 * store — the owner picking a row off the roll, or the customer typing his own mobile on
 * his own sheet. Nothing is guessed from a photo.
 */
import { phoneKey } from "@/lib/customers/identity";

/** The ceiling the storage column carries. */
export const MAX_LINK_LENGTH = 80;

export type SketchLink = {
  key: string;
  kind: "phone" | "email" | "name";
  /** The address itself: national mobile digits, the lower-cased email, or the name. */
  value: string;
};

const KIND_OF = /^(phone|email|name):([\s\S]*)$/;

/** Arabic-Indic digits as Latin ones — this is what a phone keyboard offers. */
function toLatinDigits(text: string): string {
  return text.replace(/[\u0660-\u0669]/g, (ch) => String(ch.charCodeAt(0) - 0x0660));
}

/**
 * Turn whatever a person typed as his mobile into the roll's key. Accepts `+20`, `0020`,
 * `01…`, spaced or hyphenated groups and Arabic-Indic digits. Returns null for anything
 * that is not an Egyptian mobile: a landline or a half-typed number is not a person, and
 * keying by it would silently merge two strangers into one.
 */
export function linkFromPhone(raw: unknown): SketchLink | null {
  const national = phoneKey(toLatinDigits(String(raw ?? "")));
  if (!national) return null;
  return { key: `phone:${national}`, kind: "phone", value: national };
}

/**
 * Read back a key — one already stored, or one the owner's screen is asking to store.
 * Strict on purpose: a `phone:` prefix over digits that are not a mobile would look like a
 * link to the owner and behave like nothing, so it is refused here rather than downstream.
 */
export function parseSketchLink(raw: unknown): SketchLink | null {
  const text = String(raw ?? "").trim();
  if (!text || text.length > MAX_LINK_LENGTH) return null;
  // A control character or a quote has no business in an identity, whatever it is used for.
  if (/[\u0000-\u001f"\\;<>]/.test(text)) return null;
  const found = KIND_OF.exec(text);
  if (!found) return null;
  const [, kind, rest] = found;

  if (kind === "phone") {
    const national = phoneKey(rest);
    if (!national || `phone:${national}` !== text) return null;
    return { key: text, kind: "phone", value: national };
  }
  if (kind === "email") {
    const email = rest.trim().toLowerCase();
    if (!email.includes("@") || /\s/.test(email)) return null;
    return { key: `email:${email}`, kind: "email", value: email };
  }
  const name = rest.replace(/\s+/g, " ").trim();
  if (!name) return null;
  return { key: `name:${name}`, kind: "name", value: name };
}

/** What the desk says out loud when a reading carries no pointer. */
export const UNLINKED_LABEL = "من غير صاحب";

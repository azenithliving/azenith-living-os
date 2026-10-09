/**
 * The conversation contact capture — the link this store never had.
 *
 * The consultant is instructed to ask for a phone number, and the door already
 * recognises one when it appears. But the number was only ever copied into a
 * Telegram message, so the customer's profile stayed empty and zero conversations
 * matched a customer (measured on the live data, 2026-09-29). This writes what the
 * conversation already knows: a profile attached to the session, and one captured
 * contact per conversation.
 *
 * Three rules keep it honest. A conversation with no way back to the human records
 * nothing. It is safe to run on every message — a second run updates, never duplicates.
 * And it never throws into the customer's reply: if the ledger refuses, the answer is
 * `failed` with the reason, and the conversation continues.
 */
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { phoneKey } from "@/lib/customers/identity";
import { areaFromWords } from "@/lib/regions";
import { roomTypeFor } from "@/lib/cad/sheet-images";
import { styleFromWords, styleKey, roomFromWords } from "@/lib/taste-words";

const EGYPT_PHONE = /(?:\+?20\s?)?0?1[0125][\s-]?\d{4}[\s-]?\d{4}/;
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

export type CaptureOutcome = {
  recorded: boolean;
  phone: string | null;
  email: string | null;
  /** What his own words named — the area, the room and the style. */
  area: string | null;
  style: string | null;
  roomType: string | null;
  /** And what the row really holds after the write, read back from the table. */
  stored: { area: string | null; style: string | null; roomType: string | null };
  reason: "no-contact" | "created" | "attached" | "already-recorded" | "failed";
  detail?: string;
};

export function readContactFrom(text: string): { phone: string | null; email: string | null } {
  const raw = EGYPT_PHONE.exec(text || "")?.[0] ?? null;
  return {
    phone: raw ? phoneKey(raw) : null,
    email: (EMAIL.exec(text || "")?.[0] ?? null)?.toLowerCase() ?? null,
  };
}

export async function captureConversationContact(args: {
  sessionId: string;
  companyId?: string | null;
  text: string;
  name?: string | null;
  /** His own lines, oldest first. The advisor's sentences must never be passed here. */
  ownWords?: string[];
}): Promise<CaptureOutcome> {
  const client = getSupabaseAdminClient();
  const { phone, email } = readContactFrom(args.text ?? "");
  const hisWords = args.ownWords ?? [];
  const area = areaFromWords(hisWords);
  const style = styleFromWords(hisWords);
  const roomType = roomFromWords(hisWords);
  const asked = { area, style, roomType };
  const empty = { area: null, style: null, roomType: null };
  const none: CaptureOutcome = { recorded: false, phone, email, ...asked, stored: empty, reason: "no-contact" };
  if (!client) return { ...none, recorded: false, reason: "failed", detail: "no database client" };
  if (!phone && !email) return none;
  if (!args.sessionId) return { ...none, reason: "failed", detail: "no session id" };

  const value = phone ?? email;
  const method = phone ? "phone" : "email";
  const now = new Date().toISOString();

  try {
    const { data: profile, error: profileError } = await client
      .from("users")
      .select("id,session_id,full_name,email,phone,company_id,area,style,room_type")
      .eq("session_id", args.sessionId)
      .maybeSingle();
    if (profileError) throw new Error(profileError.message);

    let reason: CaptureOutcome["reason"];
    if (profile) {
      const patch: Record<string, unknown> = { updated_at: now };
      if (phone && !profile.phone) patch.phone = value;
      if (email && !profile.email) patch.email = value;
      // His own words go in once and are never rewritten: a customer who later says he meant
      // somewhere else, or wants another style, is a change the store has to see — not overwrite.
      if (area && !profile.area) patch.area = area;
      if (style && !styleKey(profile.style)) patch.style = style;
      if (roomType && !roomTypeFor(profile.room_type)) patch.room_type = roomType;
      if (Object.keys(patch).length > 1) {
        const { error } = await client.from("users").update(patch).eq("id", profile.id);
        if (error) throw new Error(error.message);
      }
      reason = "attached";
    } else {
      const { error } = await client.from("users").insert({
        session_id: args.sessionId,
        company_id: args.companyId ?? null,
        full_name: args.name?.trim() || null,
        phone,
        email,
        area,
        style,
        room_type: roomType,
        created_at: now,
        updated_at: now,
      });
      if (error) throw new Error(error.message);
      reason = "created";
    }

    const { data: existingConversion, error: findError } = await client
      .from("lead_conversions")
      .select("id,contactValue")
      .eq("session_id", args.sessionId)
      .maybeSingle();
    if (findError) throw new Error(findError.message);

    if (existingConversion) {
      if (existingConversion.contactValue !== value) {
        const { error } = await client
          .from("lead_conversions")
          .update({ contactValue: value, contactMethod: method, updated_at: now })
          .eq("id", existingConversion.id);
        if (error) throw new Error(error.message);
      }
      reason = "already-recorded";
    } else {
      const { error } = await client.from("lead_conversions").insert({
        session_id: args.sessionId,
        contactMethod: method,
        contactValue: value,
        status: "pending",
        created_at: now,
        updated_at: now,
      });
      if (error) throw new Error(error.message);
    }

    // Read the row back before reporting it: a desk that answers from its own intention is how a
    // screen ends up showing a taste nobody ever asked for.
    const { data: held } = await client
      .from("users")
      .select("area,style,room_type")
      .eq("session_id", args.sessionId)
      .maybeSingle();
    const stored = {
      area: String(held?.area ?? "") || null,
      style: String(held?.style ?? "") || null,
      roomType: String(held?.room_type ?? "") || null,
    };
    if (area || style || roomType) {
      const say = (label: string, want: string | null, got: string | null) =>
        want ? `${label}: طُلب «${want}» والمحفوظ «${got ?? "فاضي"}»` : null;
      console.log(
        `[Capture] ${args.sessionId} — ${[say("منطقته", area, stored.area), say("طرازه", style, stored.style), say("غرفته", roomType, stored.roomType)]
          .filter(Boolean)
          .join(" · ")}`,
      );
    }
    return { recorded: true, phone, email, ...asked, stored, reason };
  } catch (error) {
    return {
      recorded: false,
      phone,
      email,
      ...asked,
      stored: empty,
      reason: "failed",
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

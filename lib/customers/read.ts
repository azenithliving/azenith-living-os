/**
 * Reading every space a customer can stand in, and rolling it into one line per human.
 *
 * The counting rule itself is `lib/customers/roll.ts` and stays pure. This is the part
 * that talks to the database, kept in one place because two doors used to read the same
 * customers their own way: the roll saw six, the customers screen saw four, and a buyer
 * with a real phone number never reached the owner's eyes. Any surface that lists
 * customers now asks here, so it cannot be built on a smaller pile of truth.
 */
import type { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { rollCustomers, type CustomerRow, type RawRow, type Space } from "@/lib/customers/roll";
import { tallyTastes } from "@/lib/taste-words";

type Client = NonNullable<ReturnType<typeof getSupabaseAdminClient>>;

async function read(client: Client, table: string, columns: string) {
  const { data, error } = await client.from(table).select(columns);
  if (error) return { rows: [], error: `${table}: ${error.message}` };
  return { rows: (data ?? []) as unknown as Record<string, unknown>[], error: null };
}

const str = (v: unknown) => (typeof v === "string" ? v : typeof v === "number" ? String(v) : null);
const at = (row: Record<string, unknown>) => str(row.updated_at) ?? str(row.created_at);

/**
 * What he was looking at, read off the profile that carries him. A space with nothing to
 * say about it stays null — the dossier prints «مفيش» instead of inventing a taste.
 */
function lookingOf(base: Record<string, unknown>, row: Record<string, unknown> = {}) {
  const roomType = str(base.room_type) ?? str(row.room_type);
  const style = str(base.style) ?? str(row.style);
  const serviceType = str(base.service_type) ?? str(row.service_type);
  const lastPage = str(base.last_page) ?? str(row.last_page);
  // His area is his own word from the conversation desk — never the advisor's coverage answer.
  const area = str(base.area) ?? str(row.area);
  return roomType || style || serviceType || lastPage || area ? { roomType, style, serviceType, lastPage, area } : null;
}

/** A flag is not an amount: `deposit_paid` says whether the deposit arrived, `deposit_amount` says how much. */
const money = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

export type CustomersRead = {
  customers: CustomerRow[];
  real: CustomerRow[];
  totals: {
    customers: number;
    bySpace: Record<string, number>;
    needingReply: number;
    anonymous: number;
    rowsRead: number;
    /** Orders whose money has no human attached yet — counted out loud, never dropped. */
    unowned: { orders: number; quoted: number; paid: number };
    /** His taste added up through the store's own reader, with the rows it refused named. */
    taste: { groups: { style: string; count: number }[]; skipped: number };
  };
  failures: string[];
};

export async function readCustomers(client: Client): Promise<CustomersRead> {
  const [profiles, sessions, quotes, forms, orders, appointments, conversions, papers] = await Promise.all([
    read(client, "users", "id,session_id,full_name,email,phone,tier,budget,intent,score,room_type,style,service_type,last_page,area,updated_at,created_at"),
    read(client, "consultant_sessions", "id,session_id,updated_at,created_at"),
    read(client, "requests", "id,user_id,budget,price,paid,updated_at,created_at"),
    read(client, "leads", "id,name,email,phone,status,updated_at,created_at"),
    read(client, "sales_orders", "id,user_id,customer_name,total_amount,deposit_amount,deposit_paid,updated_at,created_at"),
    read(client, "bookings", "id,user_id,status,updated_at,created_at"),
    read(client, "lead_conversions", "id,session_id,contactMethod,contactValue,status,updated_at,created_at"),
    // A photographed paper is a human too. Measured on the published journey 2026-10-07: a customer
    // who reached the store through his own sheet door had a sealed paper, two family votes and a
    // pulse — and the golden pre-call file answered «مفيش حد بهالحرف», because the roll counted six
    // other spaces and not this one.
    read(client, "room_sketches", "id,customer_key,room,area_sqm,customer_city,confirmed_at,created_at"),
  ]);

  const steps = [profiles, sessions, quotes, forms, orders, appointments, conversions, papers];
  const failures = steps.map((step) => step.error).filter(Boolean) as string[];
  if (failures.length > 0) {
    return {
      customers: [],
      real: [],
      totals: { customers: 0, bySpace: {}, needingReply: 0, anonymous: 0, rowsRead: 0, unowned: { orders: 0, quoted: 0, paid: 0 }, taste: { groups: [], skipped: 0 } },
      failures,
    };
  }

  // The spaces that carry no contact of their own borrow it from the profile their
  // key points at. A borrow that finds nothing stays anonymous — it is never guessed.
  const byUserId = new Map<string, Record<string, unknown>>(profiles.rows.map((p) => [String(p.id), p]));
  const bySession = new Map<string, Record<string, unknown>>(
    profiles.rows
      .map((p) => [String(p.session_id ?? ""), p] as [string, Record<string, unknown>])
      .filter(([key]) => key !== ""),
  );

  const rows: RawRow[] = [];
  const push = (space: Space, row: Record<string, unknown>, from?: Record<string, unknown> | null) => {
    const base = from ?? row;
    rows.push({
      space,
      phone: str(row.phone) ?? str(base.phone) ?? (str(base.contactValue)?.includes("@") ? null : str(row.contactValue ?? base.contactValue)),
      email: str(row.email) ?? str(base.email),
      name: str(row.full_name) ?? str(row.name) ?? str(row.customer_name) ?? str(base.full_name) ?? str(base.name),
      session: str(row.session_id) ?? str(base.session_id),
      // A borrowed profile is the only thing that counts as a profile row; a lead form's
      // own id is not one, and calling it that would let an order attach to a form.
      profileId: str(from?.id) ?? (space === "profile" ? str(row.id) : null),
      at: at(row),
      tier: str(row.tier) ?? str(base.tier),
      budget: str(row.budget) ?? str(base.budget),
      intent: str(row.intent) ?? str(base.intent),
      score: (row.score ?? base.score ?? null) as number | string | null,
      looking: lookingOf(base, row),
      price: (row.total_amount ?? row.price ?? null) as number | string | null,
      paid: (row.deposit_paid ?? row.paid ?? null) as number | string | null,
    });
  };

  for (const p of profiles.rows) push("profile", p);
  for (const s of sessions.rows) push("conversation", s, bySession.get(String(s.session_id ?? "")));
  for (const q of quotes.rows) push("quote", q, byUserId.get(String(q.user_id ?? "")));
  for (const f of forms.rows) push("form", f);
  // An order speaks about a human only through its owner. Its free-text name is what a
  // consultant typed on a form, not an identity: two of those lines in a row made one
  // buyer appear twice on the customers screen, once with his number and once without.
  const unowned = { orders: 0, quoted: 0, paid: 0 };
  for (const o of orders.rows) {
    const owner = byUserId.get(String(o.user_id ?? ""));
    const paid = o.deposit_paid === true ? money(o.deposit_amount) : 0;
    if (!owner) {
      unowned.orders++;
      unowned.quoted += money(o.total_amount);
      unowned.paid += paid;
      continue;
    }
    rows.push({
      space: "order",
      phone: str(owner.phone),
      email: str(owner.email),
      name: str(owner.full_name),
      session: str(owner.session_id),
      profileId: str(owner.id),
      at: at(o),
      tier: str(owner.tier),
      budget: str(owner.budget),
      price: money(o.total_amount),
      paid,
      looking: lookingOf(owner, o),
    });
  }
  for (const b of appointments.rows) push("appointment", b, byUserId.get(String(b.user_id ?? "")));
  for (const c of conversions.rows) push("conversion", c, bySession.get(String(c.session_id ?? "")));
  // The paper spells its human in its own key: «phone:1099999991». A key without a contact stays
  // anonymous — the roll never guesses whose sheet it is.
  for (const s of papers.rows) {
    const key = String(s.customer_key ?? "");
    const [kind, value] = key.includes(":") ? [key.slice(0, key.indexOf(":")), key.slice(key.indexOf(":") + 1)] : [null, null];
    push("paper", {
      created_at: s.created_at,
      updated_at: s.confirmed_at ?? s.created_at,
      phone: kind === "phone" ? value : null,
      email: kind === "email" ? value : null,
      room_type: str(s.room),
      last_page: str(s.customer_city) ? `ورقة من ${str(s.customer_city)}` : "ورقته",
    });
  }

  const customers = rollCustomers(rows);
  const real = customers.filter((c) => c.kind !== "none");
  const anonymous = customers.find((c) => c.kind === "none")?.anonymous ?? 0;

  return {
    customers,
    real,
    totals: {
      customers: real.length,
      bySpace: real.reduce<Record<string, number>>((acc, c) => {
        for (const s of c.spaces) acc[s] = (acc[s] ?? 0) + 1;
        return acc;
      }, {}),
      needingReply: real.filter((c) => c.needsReply).length,
      anonymous,
      rowsRead: rows.length,
      unowned,
      // What his customers' taste adds up to, counted through the store's own reader — the roll is
      // where the rows already are, so this asks no second question of the register.
      taste: tallyTastes(real.map((c) => ({ style: c.looking?.style ?? null }))),
    },
    failures: [],
  };
}

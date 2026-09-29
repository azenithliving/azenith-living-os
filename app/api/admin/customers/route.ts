import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { requireAdminApi } from "@/lib/admin-api-guard";
import { rollCustomers, type RawRow, type Space } from "@/lib/customers/roll";

/**
 * The customers roll, read-only.
 *
 * One address that answers «how many customers do I have and where is each one
 * standing» from every space at once: profile, conversation, quote, form, order,
 * appointment, conversion. It writes nothing — the whole point is that the screen and
 * the chat's tool stop keeping two truths about the same buyer.
 *
 * The joins are done here in memory rather than in SQL because the spaces link by
 * different handles (a session key, a user id, a contact value), and a wrong join
 * would silently invent or lose a customer. Each row therefore keeps the space it came
 * from, and rows with no contact detail are counted as anonymous instead of dropped.
 */
type Client = NonNullable<ReturnType<typeof getSupabaseAdminClient>>;

async function read(client: Client, table: string, columns: string) {
  const { data, error } = await client.from(table).select(columns);
  if (error) return { rows: [], error: `${table}: ${error.message}` };
  return { rows: (data ?? []) as unknown as Record<string, unknown>[], error: null };
}

const str = (v: unknown) => (typeof v === "string" ? v : typeof v === "number" ? String(v) : null);
const at = (row: Record<string, unknown>) => str(row.updated_at) ?? str(row.created_at);

export async function GET(): Promise<NextResponse> {
  try {
    const { unauthorized } = await requireAdminApi();
    if (unauthorized) return unauthorized;

    const client = getSupabaseAdminClient();
    if (!client) {
      return NextResponse.json({ error: "الدفتر مش متصل دلوقتى" }, { status: 500 });
    }

    const [profiles, sessions, quotes, forms, orders, appointments, conversions] = await Promise.all([
      read(client, "users", "id,session_id,full_name,email,phone,tier,budget,intent,score,updated_at,created_at"),
      read(client, "consultant_sessions", "id,session_id,updated_at,created_at"),
      read(client, "requests", "id,user_id,budget,price,paid,updated_at,created_at"),
      read(client, "leads", "id,name,email,phone,status,updated_at,created_at"),
      read(client, "sales_orders", "id,customer_name,total_amount,deposit_amount,deposit_paid,updated_at,created_at"),
      read(client, "bookings", "id,user_id,status,updated_at,created_at"),
      read(client, "lead_conversions", "id,session_id,contactMethod,contactValue,status,updated_at,created_at"),
    ]);

    const failures = [profiles, sessions, quotes, forms, orders, appointments, conversions]
      .map((step) => step.error).filter(Boolean) as string[];
    if (failures.length > 0) {
      return NextResponse.json({ error: "الحساب اترفض — الدفتر ما ردّش", failures }, { status: 500 });
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
        at: at(row),
        tier: str(row.tier) ?? str(base.tier),
        budget: str(row.budget) ?? str(base.budget),
        intent: str(row.intent) ?? str(base.intent),
        score: (row.score ?? base.score ?? null) as number | string | null,
        price: (row.total_amount ?? row.price ?? null) as number | string | null,
        paid: (row.deposit_paid ?? row.paid ?? null) as number | string | null,
      });
    };

    for (const p of profiles.rows) push("profile", p);
    for (const s of sessions.rows) push("conversation", s, bySession.get(String(s.session_id ?? "")));
    for (const q of quotes.rows) push("quote", q, byUserId.get(String(q.user_id ?? "")));
    for (const f of forms.rows) push("form", f);
    for (const o of orders.rows) push("order", o);
    for (const b of appointments.rows) push("appointment", b, byUserId.get(String(b.user_id ?? "")));
    for (const c of conversions.rows) push("conversion", c, bySession.get(String(c.session_id ?? "")));

    const customers = rollCustomers(rows);
    const real = customers.filter((c) => c.kind !== "none");
    const anonymous = customers.find((c) => c.kind === "none")?.anonymous ?? 0;

    return NextResponse.json({
      customers: real,
      totals: {
        customers: real.length,
        bySpace: real.reduce<Record<string, number>>((acc, c) => {
          for (const s of c.spaces) acc[s] = (acc[s] ?? 0) + 1;
          return acc;
        }, {}),
        needingReply: real.filter((c) => c.needsReply).length,
        anonymous,
        rowsRead: rows.length,
      },
    });
  } catch (error) {
    console.error("[Customers Roll] API Error:", error);
    return NextResponse.json({ error: "حصل خطأ غير متوقع — الرقم ده مش معناه إن مفيش عملاء" }, { status: 500 });
  }
}

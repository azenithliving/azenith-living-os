import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { requireAdminApi } from "@/lib/admin-api-guard";
import { readCustomers } from "@/lib/customers/read";

/**
 * The door the customers screen reads.
 *
 * It used to decide on its own who is a customer, by walking the conversations and the
 * form requests. That made two truths in one store: this screen showed four buyers while
 * the customers roll saw six, and the two missing were the quiet ones — a profile that
 * filled nothing else, an order with no chat. The list now comes from the same roll the
 * ledger stands on, and this door only adds what a screen needs on top of a name: the
 * conversation, the quote detail, the browsing telemetry.
 *
 * A customer with no conversation is still a customer, so he is shown, and the screen
 * gets `session_id: null` to tell him apart from one it can reply to.
 */
type Detail = {
  session_id: string;
  id: string;
  roomType?: string;
  budget?: string;
  location?: string;
  bestTime?: string;
  summary?: string;
  tier?: string;
  status?: string;
  email?: string;
  phone?: string;
  name?: string;
  created_at?: string;
  messages?: unknown[];
  ui_state?: Record<string, unknown>;
  isFormalRequest?: boolean;
};

export async function GET(_request: NextRequest): Promise<NextResponse> {
  try {
    const { unauthorized } = await requireAdminApi();
    if (unauthorized) return unauthorized;

    const supabase = getSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json({ error: "قاعدة البيانات مش متصلة دلوقتى" }, { status: 500 });
    }

    const [roll, sessionsRes, requestsRes] = await Promise.all([
      readCustomers(supabase),
      supabase.from("consultant_sessions").select("*").order("updated_at", { ascending: false }).limit(100),
      supabase
        .from("requests")
        .select(`id, created_at, status, room_type, budget, style, service_type, quote_snapshot, users ( id, session_id, full_name, email, phone, score, intent )`)
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

    if (roll.failures.length > 0) {
      return NextResponse.json({ error: "الحساب اترفض — الدفتر ما ردّش", failures: roll.failures }, { status: 500 });
    }
    if (sessionsRes.error || requestsRes.error) {
      console.error("[Leads] Detail fetch failed:", sessionsRes.error || requestsRes.error);
      return NextResponse.json({ error: "تفاصيل المحادثات ما ردّتش — القائمة مش معناها إن مفيش عملاء" }, { status: 500 });
    }

    const sessionRows = (sessionsRes.data ?? []) as Record<string, unknown>[];
    const bySessionId = new Map<string, Record<string, unknown>>(
      sessionRows.map((s) => [String(s.session_id), s]),
    );

    const { data: telemetryData } = await supabase
      .from("visitor_telemetry")
      .select("*")
      .in("session_id", sessionRows.map((s) => String(s.session_id)));
    const telemetryMap = new Map<string, unknown>(
      (telemetryData ?? []).map((t: Record<string, unknown>) => [String(t.session_id), t]),
    );

    // One detail card per conversation: the chat first, then the form over it, because a
    // filled form is a firmer statement than a message.
    const detail = new Map<string, Detail>();
    for (const s of sessionRows) {
      const key = String(s.session_id);
      const messages = (s.messages as { role: string; content: string }[] | null) ?? [];
      const insights = (s.insights as Record<string, string> | null) ?? {};
      detail.set(key, {
        session_id: key,
        id: String(s.id),
        name: firstWordName(messages),
        roomType: insights.roomType ?? "غير محدد",
        budget: insights.budget ?? "غير محدد",
        location: insights.location ?? "غير محدد",
        bestTime: insights.bestTime ?? "غير محدد",
        summary: insights.summary ?? "",
        tier: tierOfBudget(insights.budget ?? "", phoneIn(messages)) ?? (phoneIn(messages) ? "gold" : "bronze"),
        status: phoneIn(messages) ? "contacted" : "new",
        created_at: String(s.created_at ?? ""),
        messages,
        ui_state: (s.ui_state as Record<string, unknown>) ?? {},
      });
    }

    for (const req of (requestsRes.data ?? []) as Record<string, unknown>[]) {
      const user = req.users as Record<string, unknown> | null;
      const key = String(user?.session_id ?? "");
      if (!key) continue;
      const snapshot = (req.quote_snapshot as Record<string, unknown> | null) ?? {};
      const contact = (snapshot.contact as Record<string, unknown> | null) ?? {};
      const score = Number(user?.score ?? snapshot.score ?? 0);
      const previous = detail.get(key);
      detail.set(key, {
        ...(previous ?? { session_id: key, id: String(req.id) }),
        session_id: key,
        id: String(req.id),
        name: String(user?.full_name ?? contact.fullName ?? previous?.name ?? "") || "عميل مهتم",
        email: String(user?.email ?? contact.email ?? ""),
        phone: String(user?.phone ?? contact.phone ?? ""),
        roomType: String(req.room_type ?? previous?.roomType ?? "غير محدد"),
        budget: String(req.budget ?? previous?.budget ?? "غير محدد"),
        tier: score >= 80 ? "diamond" : score >= 50 ? "gold" : (previous?.tier ?? "silver"),
        status: "qualified",
        created_at: String(req.created_at ?? previous?.created_at ?? ""),
        isFormalRequest: true,
      });
    }

    const leads = roll.real.map((customer) => {
      const attached = customer.sessions.map((s) => detail.get(s)).filter(Boolean) as Detail[];
      // The newest conversation carries the story; an older one fills what it left blank.
      const card = attached.reduce<Detail | null>((best, d) => {
        if (!best) return d;
        return Date.parse(String(d.created_at)) > Date.parse(String(best.created_at)) ? d : best;
      }, null);
      const dialed = customer.phone ? `0${customer.phone}` : null;

      return {
        id: customer.key,
        session_id: card?.session_id ?? null,
        name: customer.name ?? card?.name ?? "زائر مجهول",
        phone: dialed || card?.phone || "غير متوفر",
        email: customer.email ?? card?.email ?? "",
        roomType: card?.roomType ?? "غير محدد",
        budget: customer.budget ?? card?.budget ?? "غير محدد",
        location: card?.location ?? "غير محدد",
        bestTime: card?.bestTime ?? "غير محدد",
        summary: card?.summary ?? "",
        tier: customer.tier ?? card?.tier ?? "bronze",
        status: customer.spaces.includes("form") ? "qualified" : (card?.status ?? "new"),
        created_at: customer.lastTouch ?? card?.created_at ?? "",
        messages: card?.messages ?? [],
        telemetry: card ? (telemetryMap.get(card.session_id) ?? null) : null,
        ui_state: card?.ui_state ?? {},
        isFormalRequest: Boolean(card?.isFormalRequest) || customer.spaces.includes("form"),
        needsReply: customer.needsReply,
        score: customer.score,
        spaces: customer.spaces,
        money: customer.money,
        freshness: customer.freshness,
      };
    });

    leads.sort((a, b) => new Date(String(b.created_at)).getTime() - new Date(String(a.created_at)).getTime());

    return NextResponse.json({ leads, totals: roll.totals });
  } catch (error) {
    console.error("[Leads] API Error:", error);
    return NextResponse.json({ error: "حصل خطأ غير متوقع — الرقم ده مش معناه إن مفيش عملاء" }, { status: 500 });
  }
}

/** The first word of the first message, when it reads like a name and not a greeting. */
function firstWordName(messages: { role: string; content: string }[]): string {
  const first = messages.find((m) => m.role === "user");
  if (!first) return "زائر مجهول";
  const word = first.content.trim().split(" ")[0] ?? "";
  if (word.length > 1 && !word.includes("احنا") && !word.includes("سلام")) return word;
  return "زائر مجهول";
}

function phoneIn(messages: { role: string; content: string }[]): string | null {
  for (const m of messages) {
    const found = /0[0-9]{10}/.exec(m.content);
    if (found) return found[0];
  }
  return null;
}

function tierOfBudget(budget: string, phone: string | null): string | null {
  if (budget.includes("الف")) {
    const amount = parseInt(budget, 10);
    if (amount > 100) return "diamond";
    if (amount > 50) return "gold";
  }
  return phone ? "gold" : null;
}

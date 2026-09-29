import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { requireAdminApi } from "@/lib/admin-api-guard";
import { readCustomers } from "@/lib/customers/read";

/**
 * The customers roll, read-only.
 *
 * One address that answers «how many customers do I have and where is each one
 * standing» from every space at once: profile, conversation, quote, form, order,
 * appointment, conversion. It writes nothing — the whole point is that the screen and
 * the chat's tool stop keeping two truths about the same buyer.
 *
 * The reading and the counting rule live in `lib/customers/read.ts`, shared with the
 * screen, so no surface can be built on a smaller pile of truth than another.
 */
export async function GET(): Promise<NextResponse> {
  try {
    const { unauthorized } = await requireAdminApi();
    if (unauthorized) return unauthorized;

    const client = getSupabaseAdminClient();
    if (!client) {
      return NextResponse.json({ error: "الدفتر مش متصل دلوقتى" }, { status: 500 });
    }

    const roll = await readCustomers(client);
    if (roll.failures.length > 0) {
      return NextResponse.json({ error: "الحساب اترفض — الدفتر ما ردّش", failures: roll.failures }, { status: 500 });
    }

    return NextResponse.json({
      customers: roll.real,
      totals: roll.totals,
      unownedOrders: roll.unownedOrders,
    });
  } catch (error) {
    console.error("[Customers Roll] API Error:", error);
    return NextResponse.json({ error: "حصل خطأ غير متوقع — الرقم ده مش معناه إن مفيش عملاء" }, { status: 500 });
  }
}

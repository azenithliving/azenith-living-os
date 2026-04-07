import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { getCurrentTenant } from "@/lib/tenant";

export async function getDashboardSnapshot() {
  try {
    const tenant = await getCurrentTenant();

    if (!tenant) {
      return {
        tenant: null,
        leadCount: 0,
        requestCount: 0,
        whatsappCount: 0,
        leads: [],
        setupError: null,
      };
    }

    const supabase = getSupabaseAdminClient();
    const [usersResult, requestsResult, whatsappResult] = await Promise.all([
      supabase.from("users").select("id, room_type, score, intent, service_type, style, created_at", { count: "exact" }).eq("company_id", tenant.id).order("created_at", { ascending: false }).limit(10),
      supabase.from("requests").select("id", { count: "exact", head: true }).eq("company_id", tenant.id),
      supabase.from("events").select("id", { count: "exact", head: true }).eq("company_id", tenant.id).eq("type", "whatsapp_click"),
    ]);

    if (usersResult.error) throw new Error(`Failed to load users: ${usersResult.error.message}`);
    if (requestsResult.error) throw new Error(`Failed to load requests: ${requestsResult.error.message}`);
    if (whatsappResult.error) throw new Error(`Failed to load WhatsApp events: ${whatsappResult.error.message}`);

    return {
      tenant,
      leadCount: usersResult.count ?? 0,
      requestCount: requestsResult.count ?? 0,
      whatsappCount: whatsappResult.count ?? 0,
      leads: (usersResult.data ?? []).map((lead) => ({
        id: lead.id,
        roomType: lead.room_type ?? "غير محدد",
        score: lead.score ?? 0,
        intent: lead.intent ?? "browsing",
        serviceType: lead.service_type ?? "غير محدد",
        style: lead.style ?? "غير محدد",
        createdAt: lead.created_at ?? null,
      })),
      setupError: null,
    };
  } catch (error) {
    return {
      tenant: null,
      leadCount: 0,
      requestCount: 0,
      whatsappCount: 0,
      leads: [],
      setupError: error instanceof Error ? error.message : "Unknown dashboard setup error.",
    };
  }
}

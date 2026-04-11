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
    if (!supabase) throw new Error('Supabase not initialized');
    const [usersResult, requestsResult, whatsappResult, eventsResult] = await Promise.all([
      supabase.from("users").select("id, room_type, score, intent, service_type, style, budget, created_at", { count: "exact" }).eq("company_id", tenant.id).order("created_at", { ascending: false }).limit(20),
      supabase.from("requests").select("id, user_id, room_type, budget, quote_snapshot, created_at", { count: "exact" }).eq("company_id", tenant.id),
      supabase.from("events").select("id", { count: "exact", head: true }).eq("company_id", tenant.id).eq("type", "whatsapp_click"),
      supabase.from("events").select("user_id, type, metadata").eq("company_id", tenant.id).eq("type", "image_view"),
    ]);

    if (usersResult.error) throw new Error(`Failed to load users: ${usersResult.error.message}`);
    if (requestsResult.error) throw new Error(`Failed to load requests: ${requestsResult.error.message}`);
    if (whatsappResult.error) throw new Error(`Failed to load WhatsApp events: ${whatsappResult.error.message}`);

    // Count viewed images per user
    const imageViewsByUser = new Map<string, number>();
    eventsResult.data?.forEach((event) => {
      const userId = event.user_id;
      imageViewsByUser.set(userId, (imageViewsByUser.get(userId) || 0) + 1);
    });

    // Build request lookup for additional data
    const requestsByUser = new Map<string, typeof requestsResult.data extends Array<infer T> ? T : never>();
    requestsResult.data?.forEach((req) => {
      requestsByUser.set(req.user_id, req);
    });

    // Calculate qualification tier and priority
    const calculateQualification = (score: number) => {
      if (score >= 60) return { tier: "Diamond" as const, priority: "urgent" as const };
      if (score >= 45) return { tier: "Gold" as const, priority: "high" as const };
      if (score >= 30) return { tier: "Silver" as const, priority: "medium" as const };
      return { tier: "Silver" as const, priority: "low" as const };
    };

    // Parse style DNA from user style field
    const parseStyleDNA = (styleString: string | null) => {
      if (!styleString) return undefined;
      const styles = styleString.split(",").map((s) => s.trim()).filter(Boolean);
      return {
        dominantStyles: styles.slice(0, 3),
        colorPalette: ["neutral", "elegant"],
        materials: ["premium"],
        moodKeywords: ["sophisticated"],
      };
    };

    return {
      tenant,
      leadCount: usersResult.count ?? 0,
      requestCount: requestsResult.count ?? 0,
      whatsappCount: whatsappResult.count ?? 0,
      leads: (usersResult.data ?? []).map((lead) => {
        const request = requestsByUser.get(lead.id);
        const quoteSnapshot = request?.quote_snapshot as Record<string, { fullName?: string; phone?: string; email?: string }> | null;
        const contact = quoteSnapshot?.contact;
        const qual = calculateQualification(lead.score ?? 0);

        return {
          id: lead.id,
          fullName: contact?.fullName || "Anonymous",
          phone: contact?.phone || "N/A",
          email: contact?.email,
          scope: lead.room_type || request?.room_type || "Not specified",
          budget: lead.budget || request?.budget || "Not specified",
          timeline: lead.service_type || "Not specified",
          score: lead.score ?? 0,
          tier: qual.tier,
          priority: qual.priority,
          intent: lead.intent ?? "browsing",
          styleDNA: parseStyleDNA(lead.style),
          viewedImages: imageViewsByUser.get(lead.id) || 0,
          createdAt: lead.created_at || new Date().toISOString(),
          pdfGenerated: false, // Will be updated when PDF is generated
        };
      }),
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

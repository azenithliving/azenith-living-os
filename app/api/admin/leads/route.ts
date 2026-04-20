import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = getSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json({ error: "Database not initialized" }, { status: 500 });
    }

    // Fetch sessions that have at least some messages
    const { data: sessions, error } = await supabase
      .from("consultant_sessions")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error("[Leads] Error fetching sessions:", error);
      return NextResponse.json({ error: "Failed to fetch leads" }, { status: 500 });
    }

    // Fetch telemetry data
    const sessionIds = sessions.map(s => s.session_id);
    const { data: telemetryData } = await supabase
      .from("visitor_telemetry")
      .select("*")
      .in("session_id", sessionIds);

    const telemetryMap = (telemetryData || []).reduce((acc: any, t: any) => {
      acc[t.session_id] = t;
      return acc;
    }, {});

    const leads = sessions
      .map(session => {
        // Find phone number in messages
        const allText = session.messages ? session.messages.map((m: any) => m.content).join(" ") : "";
        const phoneMatch = allText.match(/0[0-9]{10}/);
        const phone = phoneMatch ? phoneMatch[0] : null;

        // Try to find a name (heuristic: first word of first message, or from insights if we add it)
        let name = "زائر مجهول";
        if (session.messages && session.messages.length > 0) {
          const firstUserMsg = session.messages.find((m: any) => m.role === "user");
          if (firstUserMsg) {
            const firstWord = firstUserMsg.content.trim().split(" ")[0];
            if (firstWord.length > 1 && !firstWord.includes("احنا") && !firstWord.includes("سلام")) {
              name = firstWord;
            }
          }
        }
        
        // If there's no phone, we might not consider it a full lead, but let's include all active sessions for now, or filter
        if (!phone && !session.insights?.roomType) return null; // Skip empty sessions

        // Determine tier based on budget or engagement
        let tier = "bronze";
        if (session.insights?.budget?.includes("الف") && parseInt(session.insights.budget) > 100) tier = "diamond";
        else if (session.insights?.budget?.includes("الف") && parseInt(session.insights.budget) > 50) tier = "gold";
        else if (session.insights?.budget?.includes("الف") && parseInt(session.insights.budget) > 20) tier = "silver";
        else if (phone) tier = "gold"; // Has phone number

        return {
          id: session.id,
          session_id: session.session_id,
          name: name,
          phone: phone || "غير متوفر",
          roomType: session.insights?.roomType || "غير محدد",
          budget: session.insights?.budget || "غير محدد",
          location: session.insights?.location || "غير محدد",
          bestTime: session.insights?.bestTime || "غير محدد",
          summary: session.insights?.summary || "",
          tier: tier,
          status: phone ? "contacted" : "new",
          created_at: session.created_at,
          messages: session.messages || [],
          telemetry: telemetryMap[session.session_id] || null
        };
      })
      .filter(Boolean);

    return NextResponse.json({ leads });
  } catch (error) {
    console.error("[Leads] API Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

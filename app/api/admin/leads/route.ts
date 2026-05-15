import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = getSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json({ error: "Database not initialized" }, { status: 500 });
    }

    // 1. Fetch Chat Sessions
    const { data: chatSessions, error: chatError } = await supabase
      .from("consultant_sessions")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(100);

    // 2. Fetch Form Requests (joined with users)
    const { data: formRequests, error: reqError } = await supabase
      .from("requests")
      .select(`
        id,
        created_at,
        status,
        room_type,
        budget,
        style,
        service_type,
        quote_snapshot,
        users (
          id,
          session_id,
          score,
          intent
        )
      `)
      .order("created_at", { ascending: false })
      .limit(100);

    if (chatError || reqError) {
      console.error("[Leads] Fetch Error:", chatError || reqError);
      return NextResponse.json({ error: "Failed to fetch leads" }, { status: 500 });
    }

    // 3. Fetch Telemetry for context
    const allSessionIds = Array.from(new Set([
      ...(chatSessions?.map(s => s.session_id) || []),
      ...(formRequests?.map(r => (r.users as any)?.session_id).filter(Boolean) || [])
    ]));

    const { data: telemetryData } = await supabase
      .from("visitor_telemetry")
      .select("*")
      .in("session_id", allSessionIds);

    const telemetryMap = (telemetryData || []).reduce((acc: any, t: any) => {
      acc[t.session_id] = t;
      return acc;
    }, {});

    // 4. Unify Leads
    const leadsMap = new Map<string, any>();

    // Add Chat Leads first
    chatSessions?.forEach(session => {
      const allText = session.messages ? session.messages.map((m: any) => m.content).join(" ") : "";
      const phoneMatch = allText.match(/0[0-9]{10}/);
      const phone = phoneMatch ? phoneMatch[0] : null;

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

      let tier = "bronze";
      const budget = session.insights?.budget || "";
      if (budget.includes("الف") && parseInt(budget) > 100) tier = "diamond";
      else if (budget.includes("الف") && parseInt(budget) > 50) tier = "gold";
      else if (phone) tier = "gold";

      leadsMap.set(session.session_id, {
        id: session.id,
        session_id: session.session_id,
        name,
        phone: phone || "غير متوفر",
        roomType: session.insights?.roomType || "غير محدد",
        budget: session.insights?.budget || "غير محدد",
        location: session.insights?.location || "غير محدد",
        bestTime: session.insights?.bestTime || "غير محدد",
        summary: session.insights?.summary || "",
        tier,
        status: phone ? "contacted" : "new",
        created_at: session.created_at,
        messages: session.messages || [],
        telemetry: telemetryMap[session.session_id] || null,
        ui_state: session.ui_state || {}
      });
    });

    // Merge/Overwrite with Form Leads (more accurate info)
    formRequests?.forEach(req => {
      const user = req.users as any;
      if (!user) return;

      const snapshot = req.quote_snapshot as any;
      const name = user.full_name || snapshot?.contact?.fullName || "عميل مهتم";
      const phone = user.phone || snapshot?.contact?.phone || "غير متوفر";
      const email = user.email || snapshot?.contact?.email || "";

      let tier = "silver";
      const score = user.score || snapshot?.score || 0;
      if (score >= 80) tier = "diamond";
      else if (score >= 50) tier = "gold";
      else if (user.tier) tier = user.tier;

      leadsMap.set(user.session_id, {
        ...(leadsMap.get(user.session_id) || {}),
        id: req.id, // Prefer request ID for form submissions
        session_id: user.session_id,
        name,
        phone,
        email,
        roomType: req.room_type || leadsMap.get(user.session_id)?.roomType,
        budget: req.budget || leadsMap.get(user.session_id)?.budget,
        tier,
        status: "qualified",
        created_at: req.created_at,
        telemetry: telemetryMap[user.session_id] || leadsMap.get(user.session_id)?.telemetry,
        isFormalRequest: true
      });
    });

    const leads = Array.from(leadsMap.values()).sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    return NextResponse.json({ leads });
  } catch (error) {
    console.error("[Leads] API Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

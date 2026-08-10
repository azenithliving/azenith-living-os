import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { requireAdminApi } from "@/lib/admin-api-guard";

/**
 * POST /api/admin/leads/release
 * Hand over a chat back to the AI (release) or seize manual control (take).
 *
 * Body: { sessionId: string, active?: boolean }
 *   - active: true  → manual takeover ON (AI stops replying)
 *   - active: false → takeover OFF (AI resumes replying) — used by the release button
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { unauthorized } = await requireAdminApi();
    if (unauthorized) return unauthorized;

    const { sessionId, active } = await request.json();

    if (!sessionId || typeof sessionId !== "string") {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    }

    const takeoverActive = active === true;

    const supabase = getSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json({ error: "Database not configured" }, { status: 500 });
    }

    const { data: session, error: sessionErr } = await supabase
      .from("consultant_sessions")
      .select("ui_state")
      .eq("session_id", sessionId)
      .single();

    if (sessionErr || !session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const currentUiState = (session.ui_state as Record<string, any> | null) || {};
    const now = new Date().toISOString();

    const { error: updateErr } = await supabase
      .from("consultant_sessions")
      .update({
        ui_state: {
          ...currentUiState,
          takeover_active: takeoverActive,
          ...(takeoverActive
            ? { takeover_started_at: currentUiState.takeover_started_at || now }
            : { takeover_ended_at: now }),
        },
        updated_at: now,
      })
      .eq("session_id", sessionId);

    if (updateErr) {
      console.error("[LeadRelease] Error updating takeover state:", updateErr);
      return NextResponse.json({ error: "Failed to update takeover state" }, { status: 500 });
    }

    console.log(
      `[LeadRelease] Session ${sessionId} takeover ${takeoverActive ? "activated" : "released"}`
    );
    return NextResponse.json({ success: true, takeover_active: takeoverActive });
  } catch (error) {
    console.error("[LeadRelease] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { requireAdminApi } from "@/lib/admin-api-guard";

const FATE_ACTIONS = ["THUNDER", "HALLUCINATION", "FREEZE", "QUANTUM_OFFER"] as const;

function getSessionName(session: any): string {
  const name = session?.insights?.userName;
  if (typeof name === "string" && name.trim()) return name.trim();
  return session?.session_id || "زائر مجهول";
}

/**
 * POST /api/admin/fate
 * Trigger a Fate action.
 * Body:
 *   { sessionId, action, payload }            → target one session
 *   { action, payload, global: true }         → broadcast to every active session
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  console.log("[Fate API] Starting fate trigger request...");
  try {
    const { unauthorized } = await requireAdminApi();
    if (unauthorized) return unauthorized;

    const body = await request.json();
    const { sessionId, action, payload, global } = body;

    if (!action || typeof action !== "string" || !FATE_ACTIONS.includes(action as any)) {
      return NextResponse.json({ error: "Missing or invalid action" }, { status: 400 });
    }
    if (!sessionId && global !== true) {
      return NextResponse.json({ error: "Missing sessionId (or pass global: true)" }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json({ error: "Database not initialized" }, { status: 500 });
    }

    const now = new Date().toISOString();
    const buildRow = (sid: string) => ({
      session_id: sid,
      type: "FATE_ACTION",
      action,
      payload: payload || {},
      active: true,
      created_at: now,
    });

    // ── GLOBAL BROADCAST: one mutation per active session ──────────────────
    if (global === true) {
      const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
      const { data: sessionRows } = await supabase
        .from("consultant_sessions")
        .select("session_id")
        .gte("updated_at", sixHoursAgo)
        .limit(500);

      const sessionIds = Array.from(
        new Set((sessionRows || []).map((r: any) => r?.session_id).filter(Boolean))
      );

      if (sessionIds.length === 0) {
        // Record a global marker so the control room history reflects the command.
        const { error: markerErr } = await supabase
          .from("reality_mutations")
          .insert(buildRow("__GLOBAL__"));
        if (markerErr) {
          console.error("[Fate API] Global marker insert error:", markerErr);
          return NextResponse.json({ error: markerErr.message }, { status: 500 });
        }
        return NextResponse.json({ success: true, global: true, targetedSessions: 0 });
      }

      const { error } = await supabase
        .from("reality_mutations")
        .insert(sessionIds.map(buildRow));
      if (error) {
        console.error("[Fate API] Global broadcast error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      console.log(`[Fate API] Global ${action} broadcast to ${sessionIds.length} sessions`);
      return NextResponse.json({ success: true, global: true, targetedSessions: sessionIds.length });
    }

    // ── SINGLE SESSION ─────────────────────────────────────────────────────
    const { data, error } = await supabase
      .from("reality_mutations")
      .insert(buildRow(sessionId))
      .select();

    if (error) {
      console.error("[Fate API] Database Error Details:", error);
      if (error.code === "42P01") {
        return NextResponse.json({ error: "Database table 'reality_mutations' missing. Run migration." }, { status: 500 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log("[Fate API] Fate triggered successfully:", data);
    return NextResponse.json({ success: true, message: `Fate action ${action} triggered.` });
  } catch (error: any) {
    console.error("[Fate API] Global Catch Error:", error);
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}

/**
 * GET /api/admin/fate
 * List Fate mutations (history) and the active sessions available for targeting.
 * Query: scope=active|all, action=THUNDER..., sessionId=..., limit=1..200
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { unauthorized } = await requireAdminApi();
    if (unauthorized) return unauthorized;

    const supabase = getSupabaseAdminClient();
    if (!supabase) return NextResponse.json({ error: "Database not initialized" }, { status: 500 });

    const { searchParams } = new URL(request.url);
    const scope = searchParams.get("scope") || "all";
    const action = searchParams.get("action");
    const sessionId = searchParams.get("sessionId");
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "100", 10) || 100, 1), 200);

    let query = supabase
      .from("reality_mutations")
      .select("id, session_id, type, action, payload, active, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (scope === "active") query = query.eq("active", true);
    if (action) query = query.eq("action", action);
    if (sessionId) query = query.eq("session_id", sessionId);

    const { data, error } = await query;
    if (error) {
      console.error("[Fate API] List error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const mutations = (data || []) as Array<Record<string, any>>;

    // Attach customer names from consultant_sessions.
    const involvedIds = Array.from(new Set(mutations.map((m) => m.session_id).filter(Boolean)));
    let nameMap: Record<string, string> = {};
    if (involvedIds.length > 0) {
      const { data: sessionRows } = await supabase
        .from("consultant_sessions")
        .select("session_id, insights")
        .in("session_id", involvedIds);
      nameMap = ((sessionRows || []) as Array<any>).reduce<Record<string, string>>((acc, s) => {
        acc[s.session_id] = getSessionName(s);
        return acc;
      }, {});
    }

    // Active sessions for the targeting dropdown (touched in the last 6h).
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
    const { data: activeSessionRows } = await supabase
      .from("consultant_sessions")
      .select("session_id, insights, updated_at")
      .gte("updated_at", sixHoursAgo)
      .order("updated_at", { ascending: false })
      .limit(50);

    const sessions = (activeSessionRows || []).map((s: any) => ({
      session_id: s.session_id,
      name: getSessionName(s),
      updated_at: s.updated_at,
    }));

    return NextResponse.json({
      mutations: mutations.map((m) => ({
        ...m,
        name: m.session_id ? nameMap[m.session_id] : undefined,
      })),
      sessions,
    });
  } catch (error: any) {
    console.error("[Fate API] GET error:", error);
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/fate
 * Deactivate (cancel) Fate actions.
 * Body (pick one):
 *   { all: true }                       → emergency stop: deactivate everything active
 *   { id }                              → deactivate one mutation
 *   { sessionId, action? }              → deactivate active mutations for a session (optionally one action)
 *   { action }                          → deactivate all active mutations of that action globally
 */
export async function PATCH(request: NextRequest): Promise<NextResponse> {
  try {
    const { unauthorized } = await requireAdminApi();
    if (unauthorized) return unauthorized;

    const body = await request.json();
    const { id, sessionId, action, all } = body;

    const supabase = getSupabaseAdminClient();
    if (!supabase) return NextResponse.json({ error: "Database not initialized" }, { status: 500 });

    let result;
    if (all === true) {
      result = await supabase.from("reality_mutations").update({ active: false }).eq("active", true);
    } else if (id) {
      result = await supabase.from("reality_mutations").update({ active: false }).eq("id", id);
    } else if (sessionId) {
      let q = supabase
        .from("reality_mutations")
        .update({ active: false })
        .eq("session_id", sessionId)
        .eq("active", true);
      if (action) q = q.eq("action", action);
      result = await q;
    } else if (action) {
      result = await supabase
        .from("reality_mutations")
        .update({ active: false })
        .eq("action", action)
        .eq("active", true);
    } else {
      return NextResponse.json({ error: "Need one of: id, sessionId, action, or all" }, { status: 400 });
    }

    if (result.error) {
      console.error("[Fate API] Deactivate error:", result.error);
      return NextResponse.json({ error: result.error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[Fate API] PATCH error:", error);
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}

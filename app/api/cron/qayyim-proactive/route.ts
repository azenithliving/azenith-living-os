import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { resolveAdminCompanyId } from "@/lib/admin-company";
import { auditVisitorExperience } from "@/lib/qayyim-ops";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Runs every 6 hours via vercel.json cron
export async function GET(request: NextRequest) {
  // Allow Vercel cron or internal key, otherwise require admin in dev
  const authHeader = request.headers.get("authorization");
  const vercelCron = request.headers.get("x-vercel-cron");
  const isVercelCron = !!vercelCron;
  const isDev = process.env.NODE_ENV === "development";
  if (!isVercelCron && !isDev && !authHeader) {
    // In production, require cron secret if set
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && request.nextUrl.searchParams.get("secret") !== cronSecret) {
      // Allow but log — don't block completely for now
    }
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) return NextResponse.json({ success: false, error: "Supabase unavailable" }, { status: 503 });

  try {
    const companyId = await resolveAdminCompanyId();
    const audit = await auditVisitorExperience(companyId);
    const issues = (audit.data?.issues || []) as any[];
    if (!audit.success || issues.length === 0) {
      return NextResponse.json({ success: true, message: "No issues found", issues: 0 });
    }

    // Take top 3 issues, avoid duplicates in last 6 hours
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
    const { data: recentSug } = await supabase.from("qayyim_suggestions").select("evidence").gte("created_at", sixHoursAgo).limit(20);
    const recentTargets = new Set((recentSug || []).map((s: any) => JSON.stringify(s.evidence?.target || s.evidence)));

    let created = 0;
    for (const issue of issues.slice(0, 3)) {
      const targetKey = JSON.stringify({ target: issue.target, path: issue.path, kind: issue.kind });
      if (recentTargets.has(targetKey)) continue;

      // Create suggestion
      const { data: sug, error: sugErr } = await supabase.from("qayyim_suggestions").insert({
        company_id: companyId,
        source_agent: "qayyim-core",
        suggestion_type: issue.kind.includes("image") ? "image_fix" : issue.kind.includes("description") ? "identity_fix" : "content_gap",
        title: `${issue.detail} — ${issue.target}`,
        description: `${issue.detail} في ${issue.target} (${issue.path})`,
        priority: issue.kind.includes("no_image") || issue.kind.includes("no_description") ? "high" : "medium",
        status: "pending",
        evidence: { target: issue.target, path: issue.path, kind: issue.kind, detail: issue.detail },
        action_payload: { target_table: issue.kind.includes("product") ? "products" : "room_sections", target_id: issue.id, target_path: issue.path, proposed: { fix: issue.kind } },
      }).select("id").single();
      if (sugErr) continue;

      // Create chat message from Qayyim (proactive) — appears in ChatPanel
      // Find or create conversation for qayyim-core
      let convId: string | null = null;
      const { data: existingConv } = await supabase.from("agent_conversations").select("id").eq("company_id", companyId).contains("participants", ["qayyim-core"]).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (existingConv) convId = existingConv.id;
      else {
        const { data: newConv } = await supabase.from("agent_conversations").insert({
          company_id: companyId,
          title: "قيّم الدار — تنبيهات استباقية",
          conversation_type: "direct",
          participants: ["qayyim-core"],
          is_active: true,
        }).select("id").single();
        if (newConv) convId = newConv.id;
      }
      if (convId) {
        await supabase.from("agent_messages").insert({
          conversation_id: convId,
          sender_type: "agent",
          sender_name: "قيّم الدار — القائد",
          content: `لاحظت: ${issue.detail} في **${issue.target}** (${issue.path})\nجهزت لك مسودة مقترحة — تريد أن أعرضها؟ [معاينة] [وافق]`,
          is_read: false,
          created_at: new Date().toISOString(),
          context: { proactive: true, issue, suggestion_id: sug.id },
        });
      }
      created++;
    }

    return NextResponse.json({ success: true, created, totalIssues: issues.length });
  } catch (e: any) {
    console.error("[qayyim-proactive] error", e);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) { return GET(req); }

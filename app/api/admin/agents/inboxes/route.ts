/**
 * GET /api/admin/agents/inboxes — every unread badge on the cockpit, in one call.
 *
 * Nine cards used to mean nine doors, each behind a function that may be cold, and the owner's
 * screen waited on the slowest of them. The reads are the same ones the messages door makes — same
 * conversation rule, same unread definition — done once for the whole swarm.
 *
 * A missing table answers zeros rather than an error: a card that looks broken is worse than a card
 * that says nobody wrote to this employee yet.
 */
import { NextRequest, NextResponse } from "next/server";

import { supabaseServer } from "@/lib/dal/unified-supabase";
import { resolveAdminCompanyId } from "@/lib/admin-company";
import { resolveMasterCompanyId } from "@/lib/admin-env-resolver";
import { AGENT_KEYS, legacyToOps } from "@/lib/ops/identity";
import { DEPARTMENT_KEYS } from "@/lib/ops/departments";
import { buildInboxes, conversationFor, type ConversationRow, type MessageRow } from "@/lib/ops/inboxes";

export const dynamic = "force-dynamic";

/** The page the counts come off. Past it the number is asked from the record itself. */
const PAGE_CAP = 1000;

/**
 * The keys someone asked for, kept only if an employee actually stands on the owner's canvas.
 *
 * The swarm's own list is not enough: the sales manager is deliberately not a ninth swarm member
 * (his body is `vanguard`), and a whitelist that knows only the swarm leaves his card waiting
 * forever on a read that never comes for him.
 */
function requestedKeys(raw: string | null): string[] {
  const wanted = String(raw ?? "")
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
  const live = new Set<string>([...DEPARTMENT_KEYS, ...(AGENT_KEYS as readonly string[])]);
  const kept: string[] = [];
  for (const key of wanted) {
    const folded = legacyToOps(key);
    if (live.has(folded) && !kept.includes(folded)) kept.push(folded);
  }
  return kept;
}

export async function GET(request: NextRequest) {
  const keys = requestedKeys(new URL(request.url).searchParams.get("keys"));
  if (!keys.length) {
    return NextResponse.json({ success: false, error: "مرفق keys بمفاتيح الموظفين" }, { status: 400 });
  }

  const empty = Object.fromEntries(keys.map((key) => [key, { unread: 0, teaser: null, exact: true }]));

  try {
    const companyId = (await resolveAdminCompanyId()) || (await resolveMasterCompanyId());

    let convQuery = supabaseServer
      .from("agent_conversations")
      .select("id,title,participants,created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (companyId) convQuery = convQuery.eq("company_id", companyId);
    const { data: conversationRows, error: convError } = await convQuery;
    if (convError) return NextResponse.json({ success: true, inboxes: empty, warning: String(convError.message ?? convError).slice(0, 120) });

    const found = (conversationRows ?? []) as ConversationRow[];
    const conversations = keys.map((key) => conversationFor(key, found));
    const ids = [...new Set(conversations.filter((c): c is ConversationRow => Boolean(c)).map((c) => c.id))];
    if (!ids.length) return NextResponse.json({ success: true, inboxes: empty });

    const [unread, last] = await Promise.all([
      supabaseServer
        .from("agent_messages")
        .select("conversation_id,content,created_at")
        .in("conversation_id", ids)
        .eq("sender_type", "agent")
        .eq("is_read", false)
        .order("created_at", { ascending: false })
        .limit(PAGE_CAP),
      supabaseServer
        .from("agent_messages")
        .select("conversation_id,content,created_at")
        .in("conversation_id", ids)
        .eq("sender_type", "agent")
        .order("created_at", { ascending: false })
        .limit(PAGE_CAP),
    ]);

    const unreadRows = ((unread?.data ?? []) as MessageRow[]) || [];
    const saturated = unreadRows.length >= PAGE_CAP;

    // A full page is not a count. Ask the record for the number, one conversation at a time, and
    // only in the rare case where the page actually filled up.
    let exactCounts: Record<string, number> | null = null;
    if (saturated) {
      exactCounts = {};
      const counts = await Promise.all(
        ids.map(async (id) => {
          const { count } = await supabaseServer
            .from("agent_messages")
            .select("id", { count: "exact", head: true })
            .eq("conversation_id", id)
            .eq("sender_type", "agent")
            .eq("is_read", false);
          return [id, count ?? 0] as const;
        })
      );
      for (const [id, count] of counts) exactCounts[id] = count;
    }

    return NextResponse.json({
      success: true,
      inboxes: buildInboxes({
        keys,
        conversations: found,
        unreadRows,
        lastRows: ((last?.data ?? []) as MessageRow[]) || [],
        saturated,
        exactCounts,
      }),
    });
  } catch (error) {
    console.error("[AgentInboxes] the read failed:", String((error as Error)?.message ?? error).slice(0, 160));
    return NextResponse.json({ success: true, inboxes: empty });
  }
}

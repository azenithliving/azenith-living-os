import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
  gatherObservations,
  listPendingAdminProposals,
  runSovereignMindCycle,
  thinkAndPropose,
} from "@/lib/admin-sovereign-mind";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 }) };
  }
  const { data: user2FA } = await supabase
    .from("user_2fa")
    .select("is_enabled")
    .eq("user_id", user.id)
    .single();
  if (!user2FA?.is_enabled) {
    return {
      error: NextResponse.json(
        { success: false, error: "2FA required" },
        { status: 403 }
      ),
    };
  }
  return { user };
}

export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth && auth.error) return auth.error;

  const [proposals, observations] = await Promise.all([
    listPendingAdminProposals(25),
    gatherObservations(),
  ]);

  return NextResponse.json({
    success: true,
    proposals,
    observations,
    pendingCount: proposals.length,
  });
}

/** Manual mind cycle (owner triggered) */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth && auth.error) return auth.error;
  const { user } = auth as { user: { id: string; email?: string } };

  const body = await req.json().catch(() => ({}));
  const previewOnly = body.preview === true;

  if (previewOnly) {
    const observations = await gatherObservations();
    const { thoughts, proposals } = await thinkAndPropose(observations);
    return NextResponse.json({
      success: true,
      preview: true,
      thoughts,
      proposals,
    });
  }

  const result = await runSovereignMindCycle({
    ownerId: user.id,
    ownerEmail: user.email,
  });

  return NextResponse.json({ success: true, ...result });
}

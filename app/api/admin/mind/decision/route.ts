import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
  approveAdminProposal,
  rejectAdminProposal,
} from "@/lib/admin-approved-executor";

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

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth && auth.error) return auth.error;
  const { user } = auth as { user: { id: string; email?: string } };

  const { requestId, decision, reason } = await req.json();
  if (!requestId || !["approve", "reject"].includes(decision)) {
    return NextResponse.json(
      { success: false, error: "requestId and decision (approve|reject) required" },
      { status: 400 }
    );
  }

  if (decision === "approve") {
    const result = await approveAdminProposal(requestId, user.id);
    return NextResponse.json({
      success: result.success,
      message: result.message,
      error: result.error,
    });
  }

  const result = await rejectAdminProposal(requestId, user.id, reason);
  return NextResponse.json({ success: result.success });
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { delegateToAaca, shouldDelegateToAaca } from "@/lib/aaca-client";

export const maxDuration = 60;

/**
 * POST /api/admin/agents/orchestrate
 * Run the full agent stack from the deployed site (cloud hub on Vercel).
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const message = typeof body.message === "string" ? body.message.trim() : "";
    if (!message) {
      return NextResponse.json(
        { success: false, error: "message required" },
        { status: 400 }
      );
    }

    const createdBy = user.email;
    const prefixed = shouldDelegateToAaca(message) ? message : `/aaca ${message}`;
    const result = await delegateToAaca(prefixed, createdBy);

    return NextResponse.json({
      success: result.delegated,
      ...result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Orchestration failed",
      },
      { status: 500 }
    );
  }
}

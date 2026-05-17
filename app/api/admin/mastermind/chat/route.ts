import { NextRequest, NextResponse } from "next/server";
import { processIntelligentMessage } from "@/lib/mastermind-ai";
import { hasPendingSuggestion, executePendingSuggestion } from "@/lib/command-executor";
import { createClient } from "@/utils/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  try {
    const { message, signature = "dev-bypass" } = await req.json();

    const sessionId =
      req.cookies.get("mastermind_session")?.value || crypto.randomUUID();

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized - Authentication required" },
        { status: 401 }
      );
    }

    const masterEmails =
      process.env.MASTER_ADMIN_EMAILS?.split(",").map((e) => e.trim()) || [];
    const isOwner = !!(user.email && masterEmails.includes(user.email));

    const { data: user2FA, error: faError } = await supabase
      .from("user_2fa")
      .select("is_enabled")
      .eq("user_id", user.id)
      .single();

    if (faError || !user2FA?.is_enabled) {
      return NextResponse.json(
        { success: false, error: "2FA must be enabled to use Mastermind" },
        { status: 403 }
      );
    }

    let bypassAuth = false;
    if (isOwner && signature === "owner-bypass") {
      bypassAuth = true;
    } else if (signature === "dev-bypass" || signature === "test-bypass") {
      bypassAuth = process.env.NODE_ENV !== "production";
    }

    // Pending evolve confirmation (نعم / لا)
    if (hasPendingSuggestion()) {
      const lowerMsg = String(message).toLowerCase().trim();
      const approvalWords = ["yes", "نعم", "أوافق", "موافق", "تطبيق", "apply", "ok", "تمام", "sure"];
      const rejectionWords = ["no", "لا", "رفض", "cancel", "إلغاء", "stop", "أوقف"];
      const isApproval = approvalWords.some((w) => lowerMsg.includes(w));
      const isRejection = rejectionWords.some((w) => lowerMsg.includes(w));

      if (isApproval || isRejection) {
        const supabaseClient = createSupabaseClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
          { auth: { autoRefreshToken: false, persistSession: false } }
        );

        const confirmResult = await executePendingSuggestion(isApproval, {
          supabase: supabaseClient,
          userId: user.id,
          userEmail: user.email || "admin@azenithliving.com",
          bypassRls: bypassAuth,
          isOwner,
        });

        return NextResponse.json({
          success: true,
          result: {
            type: "command",
            message: confirmResult.message,
            command: { name: "evolve_confirm", result: confirmResult },
          },
          mode: "command",
        });
      }
    }

    const result = await processIntelligentMessage(message, {
      sessionId,
      userId: user.id,
      userEmail: user.email || "admin@azenithliving.com",
      userSignature: signature,
      bypassAuth,
      isOwner,
    });

    const response = NextResponse.json({
      success: true,
      result,
      mode: result.type === "mixed" ? "auto" : "ai",
    });

    if (!req.cookies.get("mastermind_session")) {
      response.cookies.set("mastermind_session", sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 60 * 60 * 24 * 7,
      });
    }

    return response;
  } catch (error: unknown) {
    console.error("[Mastermind Chat] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Processing failed",
      },
      { status: 500 }
    );
  }
}

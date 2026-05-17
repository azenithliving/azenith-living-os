import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { processAdminNaturalLanguage } from "@/lib/admin-natural-brain";
import {
  hasPendingSuggestion,
  executePendingSuggestion,
} from "@/lib/command-executor";
import { logAssistantExecution, listAssistantExecutions } from "@/lib/admin-assistant-log";
import { checkAacaHealth } from "@/lib/aaca-client";

export const maxDuration = 60;

const SESSION_COOKIE = "azenith_assistant_session";

async function requireAdminUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 }) };
  }

  const { data: user2FA, error: faError } = await supabase
    .from("user_2fa")
    .select("is_enabled")
    .eq("user_id", user.id)
    .single();

  if (faError || !user2FA?.is_enabled) {
    return {
      error: NextResponse.json(
        {
          success: false,
          error: "2FA must be enabled to use the assistant",
        },
        { status: 403 }
      ),
    };
  }

  const masterEmails =
    process.env.MASTER_ADMIN_EMAILS?.split(",").map((e) => e.trim()) || [];
  const isOwner = !!(user.email && masterEmails.includes(user.email));

  return { user, isOwner };
}

export async function GET(req: NextRequest) {
  const auth = await requireAdminUser();
  if ("error" in auth && auth.error) return auth.error;
  const { user } = auth as { user: { id: string; email?: string }; isOwner: boolean };

  const [executions, agentsHealth] = await Promise.all([
    listAssistantExecutions(user.id, 20),
    checkAacaHealth(),
  ]);

  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: history } = await supabase
    .from("chat_history")
    .select("role, content, command_executed, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(30);

  return NextResponse.json({
    success: true,
    agents: agentsHealth,
    executions,
    history: (history || []).reverse(),
  });
}

export async function POST(req: NextRequest) {
  const start = Date.now();
  const auth = await requireAdminUser();
  if ("error" in auth && auth.error) return auth.error;
  const { user, isOwner } = auth as {
    user: { id: string; email?: string };
    isOwner: boolean;
  };
  const userId = user.id;

  try {
    const body = await req.json();
    const message = typeof body.message === "string" ? body.message.trim() : "";

    if (!message) {
      return NextResponse.json(
        { success: false, error: "message required" },
        { status: 400 }
      );
    }

    const sessionId =
      req.cookies.get(SESSION_COOKIE)?.value ||
      req.cookies.get("mastermind_session")?.value ||
      crypto.randomUUID();

    if (hasPendingSuggestion()) {
      const lower = message.toLowerCase();
      const yes = ["yes", "نعم", "أوافق", "موافق", "ok", "تمام"].some((w) =>
        lower.includes(w)
      );
      const no = ["no", "لا", "رفض", "cancel", "إلغاء"].some((w) =>
        lower.includes(w)
      );

      if (yes || no) {
        const supabaseClient = createSupabaseClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
          { auth: { autoRefreshToken: false, persistSession: false } }
        );
        const confirmResult = await executePendingSuggestion(yes, {
          supabase: supabaseClient,
          userId: user.id,
          userEmail: user.email || "admin@azenithliving.com",
          bypassRls: isOwner,
          isOwner,
        });

        await logAssistantExecution({
          userId: user.id,
          userMessage: message,
          intentKind: "command",
          tool: "evolve_confirm",
          status: confirmResult.success ? "success" : "failure",
          result: confirmResult,
          durationMs: Date.now() - start,
        });

        return NextResponse.json({
          success: true,
          reply: confirmResult.message,
          type: "mixed",
          tool: "evolve_confirm",
        });
      }
    }

    const result = await processAdminNaturalLanguage(message, {
      sessionId,
      userId: user.id,
      userEmail: user.email || "admin@azenithliving.com",
      bypassRls: isOwner,
      isOwner,
      source: "mastermind",
    });

    const tool =
      result.command?.name ||
      (result.type === "mixed" ? "executed" : "conversation");

    const executionId = await logAssistantExecution({
      userId: user.id,
      userMessage: message,
      intentKind: result.type,
      tool,
      status: result.command?.result?.success === false ? "failure" : "success",
      result: result.command?.result ?? { message: result.message },
      durationMs: Date.now() - start,
    });

    const response = NextResponse.json({
      success: true,
      reply: result.message,
      type: result.type,
      command: result.command,
      executionId,
      durationMs: Date.now() - start,
    });

    if (!req.cookies.get(SESSION_COOKIE)) {
      response.cookies.set(SESSION_COOKIE, sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 60 * 60 * 24 * 30,
      });
    }

    return response;
  } catch (error) {
    await logAssistantExecution({
      userId,
      userMessage: "",
      status: "failure",
      durationMs: Date.now() - start,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Processing failed",
      },
      { status: 500 }
    );
  }
}

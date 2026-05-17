/**
 * Smart Agent — natural language only (Egyptian/English).
 * Routes through Admin Natural Brain (keys pool + auto execution).
 */

import { processAdminNaturalLanguageReply } from "@/lib/admin-natural-brain";

export async function POST(req: Request) {
  try {
    const actorId = req.headers.get("x-admin-user-id");
    const actorEmail = req.headers.get("x-admin-user-email") || "admin@azenithliving.com";

    if (!actorId) {
      return Response.json(
        {
          success: false,
          error: "Unauthorized",
          reply: "غير مصرح",
          meta: { route: "admin/agent/smart" },
        },
        { status: 401 }
      );
    }

    const { message } = await req.json();

    if (!message || typeof message !== "string") {
      return Response.json(
        {
          success: false,
          error: "Invalid message",
          reply: "قولّي إيه اللي محتاجه وأنا هنفّذه.",
          meta: { route: "admin/agent/smart", actorId },
        },
        { status: 400 }
      );
    }

    const result = await processAdminNaturalLanguageReply(message, {
      userId: actorId,
      userEmail: actorEmail,
      source: "smart",
    });

    return Response.json({
      success: result.success,
      reply: result.reply,
      action: result.executed ? "auto" : null,
      executed: result.executed,
      data: result.data ?? null,
      meta: { route: "admin/agent/smart", actorId },
    });
  } catch (error) {
    console.error("[SmartAgent] Error:", error);
    return Response.json(
      {
        success: false,
        error: "Internal server error",
        reply: "حصلت مشكلة بسيطة — جرّب تاني.",
      },
      { status: 500 }
    );
  }
}

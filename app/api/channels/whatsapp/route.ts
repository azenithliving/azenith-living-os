/**
 * ────────────────────────────────────────────────────────────────────────────
 * API Route: /api/channels/whatsapp
 * ────────────────────────────────────────────────────────────────────────────
 * Phase 3: Task 8 – WhatsApp webhook endpoint
 * 
 * GET: Webhook verification (Meta requirement)
 * POST: Incoming message webhook
 */

import { NextRequest, NextResponse } from "next/server";
import { createWhatsAppAdapter } from "@/lib/vanguard/channels/whatsapp_adapter";
import { getConversationManager } from "@/lib/vanguard/channels/conversation_manager";
import { logger } from "@/lib/vanguard/observability/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ── GET: Webhook Verification ────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    // WhatsApp webhook verification
    const searchParams = request.nextUrl.searchParams;
    const mode = searchParams.get("hub.mode");
    const token = searchParams.get("hub.verify_token");
    const challenge = searchParams.get("hub.challenge");

    const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

    if (!verifyToken) {
      logger.error("[WhatsApp Webhook] WHATSAPP_VERIFY_TOKEN not configured");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    if (mode === "subscribe" && token === verifyToken) {
      logger.info("[WhatsApp Webhook] Verification successful");
      return new NextResponse(challenge, { status: 200 });
    }

    logger.warn("[WhatsApp Webhook] Verification failed", {
      mode,
      tokenMatch: token === verifyToken,
    });

    return NextResponse.json(
      { error: "Verification failed" },
      { status: 403 }
    );
  } catch (error) {
    logger.error("[WhatsApp Webhook] GET error", { error });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ── POST: Incoming Message Webhook ───────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get("x-hub-signature-256") || "";

    // Verify signature
    const adapter = createWhatsAppAdapter();
    const isValid = adapter.verifyWebhookSignature(body, signature);

    if (!isValid) {
      logger.warn("[WhatsApp Webhook] Invalid signature");
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }

    const payload = JSON.parse(body);

    // Parse incoming messages
    const messages = adapter.parseWebhook(payload);

    if (messages.length === 0) {
      logger.debug("[WhatsApp Webhook] No messages to process");
      return NextResponse.json({ status: "ok" });
    }

    logger.info("[WhatsApp Webhook] Processing messages", {
      count: messages.length,
    });

    // Process each message
    const conversationManager = getConversationManager();

    for (const message of messages) {
      try {
        // Get or create conversation
        const convResult = await conversationManager.getOrCreateConversation(
          "whatsapp",
          message.from
        );

        if (!convResult.ok) {
          logger.error("[WhatsApp Webhook] Failed to get conversation", {
            from: message.from,
            error: convResult.error.message,
          });
          continue;
        }

        const conversation = convResult.value;

        // Add message to conversation
        await conversationManager.addMessage(
          conversation.id,
          {
            channelType: "whatsapp",
            from: message.from,
            text: message.text || "[Media]",
            timestamp: message.timestamp,
            messageId: message.messageId,
            mediaUrl: message.mediaUrl,
            mediaType: message.type === "image" ||
              message.type === "document" ||
              message.type === "audio" ||
              message.type === "video"
                ? message.type
                : undefined,
            metadata: {
              mediaId: message.mediaId,
              mimeType: message.mimeType,
              filename: message.filename,
              caption: message.caption,
            },
          },
          "user"
        );

        // Mark as read
        if (message.messageId) {
          await adapter.markAsRead(message.messageId);
        }

        // TODO: Trigger VANGUARD response (integrate with consciousness_core)
        // This would involve:
        // 1. Get conversation context
        // 2. Generate response using consciousness_core
        // 3. Send response via adapter

        logger.debug("[WhatsApp Webhook] Message processed", {
          conversationId: conversation.id,
          from: message.from,
          messageId: message.messageId,
        });
      } catch (error) {
        logger.error("[WhatsApp Webhook] Message processing error", {
          message: message.messageId,
          error,
        });
      }
    }

    return NextResponse.json({ status: "ok", processed: messages.length });
  } catch (error) {
    logger.error("[WhatsApp Webhook] POST error", { error });
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

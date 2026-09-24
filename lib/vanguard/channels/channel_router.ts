/**
 * ────────────────────────────────────────────────────────────────────────────
 * VANGUARD – Channel Router
 * ────────────────────────────────────────────────────────────────────────────
 * Phase 3: Task 4 – Unified channel abstraction
 * 
 * Routes messages to appropriate adapter, normalizes message format,
 * handles channel-specific logic (media, templates, formatting).
 * 
 * Supports: WhatsApp, Email, Web Chat
 */

import { logger } from "@/lib/vanguard/observability/logger";
import type { Result, VanguardError } from "@/lib/vanguard/types";
import { Ok, Err, makeError } from "@/lib/vanguard/types";
import type { WhatsAppAdapter } from "./whatsapp_adapter";
import type { EmailAdapter } from "./email_adapter";
import type { WebChatAdapter } from "./web_chat_adapter";

// ─── Types ───────────────────────────────────────────────────────────────────

export type ChannelType = "whatsapp" | "email" | "webchat";

export interface UnifiedMessage {
  channelType: ChannelType;
  from: string; // Phone number, email, or session ID
  to?: string; // For outbound messages
  text: string;
  timestamp: number;
  messageId?: string;
  metadata?: Record<string, unknown>;
  // Channel-specific fields
  mediaUrl?: string;
  mediaType?: "image" | "document" | "audio" | "video";
  subject?: string; // Email only
  html?: string; // Email only
}

export interface SendMessageRequest {
  channelType: ChannelType;
  to: string;
  text: string;
  options?: {
    // WhatsApp options
    mediaUrl?: string;
    mediaType?: "image" | "document" | "audio" | "video";
    caption?: string;
    filename?: string;
    // Email options
    subject?: string;
    html?: string;
    attachments?: Array<{
      filename: string;
      content: string;
      contentType?: string;
    }>;
    // Web chat options
    metadata?: Record<string, unknown>;
  };
}

export interface SendMessageResponse {
  channelType: ChannelType;
  messageId: string;
  success: boolean;
}

// ─── Channel Router Class ────────────────────────────────────────────────────

export class ChannelRouter {
  private whatsappAdapter: WhatsAppAdapter | null = null;
  private emailAdapter: EmailAdapter | null = null;
  private webChatAdapter: WebChatAdapter | null = null;

  constructor(adapters?: {
    whatsapp?: WhatsAppAdapter;
    email?: EmailAdapter;
    webchat?: WebChatAdapter;
  }) {
    if (adapters) {
      this.whatsappAdapter = adapters.whatsapp || null;
      this.emailAdapter = adapters.email || null;
      this.webChatAdapter = adapters.webchat || null;
    }
  }

  // ── Register Adapters ────────────────────────────────────────────────────

  registerWhatsApp(adapter: WhatsAppAdapter): void {
    this.whatsappAdapter = adapter;
    logger.debug("[ChannelRouter] WhatsApp adapter registered");
  }

  registerEmail(adapter: EmailAdapter): void {
    this.emailAdapter = adapter;
    logger.debug("[ChannelRouter] Email adapter registered");
  }

  registerWebChat(adapter: WebChatAdapter): void {
    this.webChatAdapter = adapter;
    logger.debug("[ChannelRouter] Web chat adapter registered");
  }

  // ── Send Message (Unified Interface) ─────────────────────────────────────

  async sendMessage(
    request: SendMessageRequest
  ): Promise<Result<SendMessageResponse, VanguardError>> {
    logger.info("[ChannelRouter] Routing message", {
      channelType: request.channelType,
      to: request.to,
      textLength: request.text.length,
    });

    switch (request.channelType) {
      case "whatsapp":
        return this.sendWhatsAppMessage(request);
      case "email":
        return this.sendEmailMessage(request);
      case "webchat":
        return this.sendWebChatMessage(request);
      default:
        return Err(
          makeError("UNSUPPORTED_CHANNEL", `Channel type not supported: ${request.channelType}`)
        );
    }
  }

  // ── Private: Send WhatsApp Message ───────────────────────────────────────

  private async sendWhatsAppMessage(
    request: SendMessageRequest
  ): Promise<Result<SendMessageResponse, VanguardError>> {
    if (!this.whatsappAdapter) {
      return Err(makeError("ADAPTER_NOT_CONFIGURED", "WhatsApp adapter not configured"));
    }

    try {
      // Media message
      if (request.options?.mediaUrl && request.options?.mediaType) {
        const result = await this.whatsappAdapter.sendMediaMessage(
          request.to,
          request.options.mediaType,
          request.options.mediaUrl,
          {
            caption: request.options.caption || request.text,
            filename: request.options.filename,
          }
        );

        if (!result.ok) return Err(result.error);

        return Ok({
          channelType: "whatsapp",
          messageId: result.value.messageId,
          success: true,
        });
      }

      // Text message
      const result = await this.whatsappAdapter.sendTextMessage(request.to, request.text, {
        previewUrl: true,
      });

      if (!result.ok) return Err(result.error);

      return Ok({
        channelType: "whatsapp",
        messageId: result.value.messageId,
        success: true,
      });
    } catch (error) {
      logger.error("[ChannelRouter] WhatsApp send failed", { error });
      return Err(
        makeError("WHATSAPP_SEND_FAILED", "Failed to send WhatsApp message", {
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }

  // ── Private: Send Email Message ──────────────────────────────────────────

  private async sendEmailMessage(
    request: SendMessageRequest
  ): Promise<Result<SendMessageResponse, VanguardError>> {
    if (!this.emailAdapter) {
      return Err(makeError("ADAPTER_NOT_CONFIGURED", "Email adapter not configured"));
    }

    try {
      const result = await this.emailAdapter.sendEmail({
        to: request.to,
        subject: request.options?.subject || "رسالة من VANGUARD",
        html: request.options?.html || this.textToHtml(request.text),
        text: request.text,
        attachments: request.options?.attachments,
      });

      if (!result.ok) return Err(result.error);

      return Ok({
        channelType: "email",
        messageId: result.value.emailId,
        success: true,
      });
    } catch (error) {
      logger.error("[ChannelRouter] Email send failed", { error });
      return Err(
        makeError("EMAIL_SEND_FAILED", "Failed to send email", {
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }

  // ── Private: Send Web Chat Message ───────────────────────────────────────

  private async sendWebChatMessage(
    request: SendMessageRequest
  ): Promise<Result<SendMessageResponse, VanguardError>> {
    if (!this.webChatAdapter) {
      return Err(makeError("ADAPTER_NOT_CONFIGURED", "Web chat adapter not configured"));
    }

    try {
      const result = this.webChatAdapter.sendMessage(request.text, request.options?.metadata);

      if (!result.ok) return Err(result.error);

      return Ok({
        channelType: "webchat",
        messageId: crypto.randomUUID(), // WebSocket doesn't return message ID
        success: true,
      });
    } catch (error) {
      logger.error("[ChannelRouter] Web chat send failed", { error });
      return Err(
        makeError("WEBCHAT_SEND_FAILED", "Failed to send web chat message", {
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }

  // ── Normalize Incoming Message ───────────────────────────────────────────

  normalizeMessage(channelType: ChannelType, rawMessage: unknown): UnifiedMessage | null {
    try {
      switch (channelType) {
        case "whatsapp":
          return this.normalizeWhatsAppMessage(rawMessage);
        case "email":
          return this.normalizeEmailMessage(rawMessage);
        case "webchat":
          return this.normalizeWebChatMessage(rawMessage);
        default:
          logger.warn("[ChannelRouter] Unknown channel type", { channelType });
          return null;
      }
    } catch (error) {
      logger.error("[ChannelRouter] Message normalization failed", { error });
      return null;
    }
  }

  // ── Private: Normalize WhatsApp Message ──────────────────────────────────

  private normalizeWhatsAppMessage(rawMessage: unknown): UnifiedMessage | null {
    const msg = rawMessage as {
      from: string;
      type: string;
      text?: string;
      mediaId?: string;
      mimeType?: string;
      timestamp: number;
      messageId?: string;
    };

    if (!msg.from || !msg.timestamp) return null;

    return {
      channelType: "whatsapp",
      from: msg.from,
      text: msg.text || "[Media]",
      timestamp: msg.timestamp,
      messageId: msg.messageId,
      mediaUrl: undefined, // Will be fetched separately if needed
      mediaType: msg.type === "image" || msg.type === "document" || msg.type === "audio" || msg.type === "video"
        ? (msg.type as UnifiedMessage["mediaType"])
        : undefined,
      metadata: {
        originalType: msg.type,
        mediaId: msg.mediaId,
        mimeType: msg.mimeType,
      },
    };
  }

  // ── Private: Normalize Email Message ─────────────────────────────────────

  private normalizeEmailMessage(rawMessage: unknown): UnifiedMessage | null {
    const msg = rawMessage as {
      from: string;
      subject: string;
      text?: string;
      html?: string;
      timestamp: number;
      messageId?: string;
    };

    if (!msg.from || !msg.timestamp) return null;

    return {
      channelType: "email",
      from: msg.from,
      text: msg.text || this.stripHtml(msg.html || ""),
      timestamp: msg.timestamp,
      messageId: msg.messageId,
      subject: msg.subject,
      html: msg.html,
    };
  }

  // ── Private: Normalize Web Chat Message ──────────────────────────────────

  private normalizeWebChatMessage(rawMessage: unknown): UnifiedMessage | null {
    const msg = rawMessage as {
      sessionId: string;
      text: string;
      timestamp: number;
      metadata?: Record<string, unknown>;
    };

    if (!msg.sessionId || !msg.text || !msg.timestamp) return null;

    return {
      channelType: "webchat",
      from: msg.sessionId,
      text: msg.text,
      timestamp: msg.timestamp,
      metadata: msg.metadata,
    };
  }

  // ── Helper: Detect Channel from Identifier ───────────────────────────────

  detectChannel(identifier: string): ChannelType | null {
    // Phone number (digits only, possibly with +)
    if (/^\+?\d{10,15}$/.test(identifier)) {
      return "whatsapp";
    }

    // Email address
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier)) {
      return "email";
    }

    // Session ID (UUID format)
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier)) {
      return "webchat";
    }

    return null;
  }

  // ── Helper: Convert Plain Text to HTML ───────────────────────────────────

  private textToHtml(text: string): string {
    return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
    <p style="color: #555; font-size: 16px; line-height: 1.6; white-space: pre-wrap;">
      ${this.escapeHtml(text)}
    </p>
    <p style="color: #888; font-size: 14px; text-align: center; margin-top: 30px;">
      VANGUARD — نظام المبيعات الذكي
    </p>
  </div>
</body>
</html>`;
  }

  // ── Helper: Strip HTML Tags ──────────────────────────────────────────────

  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, "").trim();
  }

  // ── Helper: Escape HTML ──────────────────────────────────────────────────

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // ── Get Adapter Status ───────────────────────────────────────────────────

  getAdapterStatus(): {
    whatsapp: boolean;
    email: boolean;
    webchat: boolean;
  } {
    return {
      whatsapp: !!this.whatsappAdapter,
      email: !!this.emailAdapter,
      webchat: !!this.webChatAdapter,
    };
  }
}

// ─── Helper: Create Channel Router ───────────────────────────────────────────

export function createChannelRouter(adapters?: {
  whatsapp?: WhatsAppAdapter;
  email?: EmailAdapter;
  webchat?: WebChatAdapter;
}): ChannelRouter {
  return new ChannelRouter(adapters);
}

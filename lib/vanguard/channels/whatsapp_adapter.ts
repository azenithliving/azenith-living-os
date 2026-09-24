/**
 * ────────────────────────────────────────────────────────────────────────────
 * VANGUARD – WhatsApp Business API Adapter
 * ────────────────────────────────────────────────────────────────────────────
 * Phase 3: Task 1 – WhatsApp message handling
 * 
 * Features:
 * - Send/receive text messages
 * - Media handling (images, documents, audio)
 * - Message templates for notifications
 * - Webhook signature verification
 * - Session management via phone number
 * - Read receipts and typing indicators
 * 
 * Uses WhatsApp Cloud API (Meta)
 */

import { logger } from "@/lib/vanguard/observability/logger";
import { rateLimiter } from "@/lib/vanguard/observability/rate_limiter";
import type { Result, VanguardError } from "@/lib/vanguard/types";
import { Ok, Err, makeError } from "@/lib/vanguard/types";
import crypto from "crypto";

// ─── Configuration ───────────────────────────────────────────────────────────

const WHATSAPP_API_VERSION = "v18.0";
const WHATSAPP_BASE_URL = "https://graph.facebook.com";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface WhatsAppConfig {
  phoneNumberId: string; // WhatsApp Business Phone Number ID
  accessToken: string; // Meta access token
  verifyToken: string; // Webhook verification token
  webhookSecret?: string; // Optional: for signature validation
}

export interface WhatsAppMessage {
  from: string; // Phone number with country code (e.g., "201234567890")
  to?: string; // Optional: for outbound messages
  type: "text" | "image" | "document" | "audio" | "video" | "template";
  text?: string;
  mediaUrl?: string;
  mediaId?: string; // WhatsApp media ID
  mimeType?: string;
  filename?: string;
  caption?: string;
  templateName?: string;
  templateParams?: string[];
  timestamp: number;
  messageId?: string;
}

export interface WhatsAppWebhookPayload {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: string;
        metadata: {
          display_phone_number: string;
          phone_number_id: string;
        };
        contacts?: Array<{
          profile: { name: string };
          wa_id: string;
        }>;
        messages?: Array<{
          from: string;
          id: string;
          timestamp: string;
          type: string;
          text?: { body: string };
          image?: { id: string; mime_type: string; caption?: string };
          document?: { id: string; mime_type: string; filename?: string };
          audio?: { id: string; mime_type: string };
          video?: { id: string; mime_type: string; caption?: string };
        }>;
        statuses?: Array<{
          id: string;
          status: "sent" | "delivered" | "read" | "failed";
          timestamp: string;
          recipient_id: string;
        }>;
      };
      field: string;
    }>;
  }>;
}

export interface SendMessageResponse {
  messageId: string;
  success: boolean;
}

// ─── WhatsApp Adapter Class ──────────────────────────────────────────────────

export class WhatsAppAdapter {
  private config: WhatsAppConfig;
  private baseUrl: string;

  constructor(config: WhatsAppConfig) {
    this.config = config;
    this.baseUrl = `${WHATSAPP_BASE_URL}/${WHATSAPP_API_VERSION}/${config.phoneNumberId}`;
  }

  // ── Send Text Message ──────────────────────────────────────────────────────

  async sendTextMessage(
    to: string,
    text: string,
    options?: {
      previewUrl?: boolean;
    }
  ): Promise<Result<SendMessageResponse, VanguardError>> {
    // Rate limit check
    const canProceed = await rateLimiter.waitAndCheck("whatsapp");
    if (!canProceed) {
      return Err(makeError("RATE_LIMIT_EXCEEDED", "WhatsApp rate limit exceeded"));
    }

    try {
      const response = await fetch(`${this.baseUrl}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: to.replace(/\D/g, ""), // Remove non-digits
          type: "text",
          text: {
            preview_url: options?.previewUrl || false,
            body: text,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        logger.error("[WhatsAppAdapter] Send text failed", {
          status: response.status,
          error: errorData,
        });

        if (response.status === 429) {
          await rateLimiter.handleRateLimitResponse("whatsapp", response.headers);
        }

        return Err(
          makeError("WHATSAPP_SEND_FAILED", `Failed to send WhatsApp message: ${response.status}`, {
            status: response.status,
            error: errorData,
          })
        );
      }

      const data = await response.json();
      logger.info("[WhatsAppAdapter] Message sent", {
        to,
        messageId: data.messages?.[0]?.id,
      });

      return Ok({
        messageId: data.messages?.[0]?.id || "",
        success: true,
      });
    } catch (error) {
      logger.error("[WhatsAppAdapter] Unexpected send error", { error });
      return Err(
        makeError("WHATSAPP_ADAPTER_ERROR", "Failed to send WhatsApp message", {
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }

  // ── Send Media Message ───────────────────────────────────────────────────

  async sendMediaMessage(
    to: string,
    type: "image" | "document" | "audio" | "video",
    mediaUrl: string,
    options?: {
      caption?: string;
      filename?: string;
    }
  ): Promise<Result<SendMessageResponse, VanguardError>> {
    const canProceed = await rateLimiter.waitAndCheck("whatsapp");
    if (!canProceed) {
      return Err(makeError("RATE_LIMIT_EXCEEDED", "WhatsApp rate limit exceeded"));
    }

    try {
      const payload: Record<string, unknown> = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: to.replace(/\D/g, ""),
        type,
        [type]: {
          link: mediaUrl,
        },
      };

      // Add caption for image/video
      if ((type === "image" || type === "video") && options?.caption) {
        (payload[type] as Record<string, unknown>).caption = options.caption;
      }

      // Add filename for document
      if (type === "document" && options?.filename) {
        (payload[type] as Record<string, unknown>).filename = options.filename;
      }

      const response = await fetch(`${this.baseUrl}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        logger.error("[WhatsAppAdapter] Send media failed", {
          status: response.status,
          error: errorData,
        });

        if (response.status === 429) {
          await rateLimiter.handleRateLimitResponse("whatsapp", response.headers);
        }

        return Err(
          makeError("WHATSAPP_SEND_FAILED", `Failed to send media: ${response.status}`, {
            status: response.status,
            error: errorData,
          })
        );
      }

      const data = await response.json();
      logger.info("[WhatsAppAdapter] Media sent", {
        to,
        type,
        messageId: data.messages?.[0]?.id,
      });

      return Ok({
        messageId: data.messages?.[0]?.id || "",
        success: true,
      });
    } catch (error) {
      logger.error("[WhatsAppAdapter] Unexpected media send error", { error });
      return Err(
        makeError("WHATSAPP_ADAPTER_ERROR", "Failed to send media", {
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }

  // ── Send Template Message ────────────────────────────────────────────────

  async sendTemplateMessage(
    to: string,
    templateName: string,
    languageCode: string,
    params: string[]
  ): Promise<Result<SendMessageResponse, VanguardError>> {
    const canProceed = await rateLimiter.waitAndCheck("whatsapp");
    if (!canProceed) {
      return Err(makeError("RATE_LIMIT_EXCEEDED", "WhatsApp rate limit exceeded"));
    }

    try {
      const response = await fetch(`${this.baseUrl}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: to.replace(/\D/g, ""),
          type: "template",
          template: {
            name: templateName,
            language: {
              code: languageCode,
            },
            components: [
              {
                type: "body",
                parameters: params.map((param) => ({
                  type: "text",
                  text: param,
                })),
              },
            ],
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        logger.error("[WhatsAppAdapter] Send template failed", {
          status: response.status,
          error: errorData,
        });

        if (response.status === 429) {
          await rateLimiter.handleRateLimitResponse("whatsapp", response.headers);
        }

        return Err(
          makeError("WHATSAPP_SEND_FAILED", `Failed to send template: ${response.status}`, {
            status: response.status,
            error: errorData,
          })
        );
      }

      const data = await response.json();
      logger.info("[WhatsAppAdapter] Template sent", {
        to,
        templateName,
        messageId: data.messages?.[0]?.id,
      });

      return Ok({
        messageId: data.messages?.[0]?.id || "",
        success: true,
      });
    } catch (error) {
      logger.error("[WhatsAppAdapter] Unexpected template send error", { error });
      return Err(
        makeError("WHATSAPP_ADAPTER_ERROR", "Failed to send template", {
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }

  // ── Mark Message as Read ─────────────────────────────────────────────────

  async markAsRead(messageId: string): Promise<Result<void, VanguardError>> {
    try {
      const response = await fetch(`${this.baseUrl}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          status: "read",
          message_id: messageId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        logger.warn("[WhatsAppAdapter] Mark as read failed", {
          messageId,
          error: errorData,
        });
        return Err(
          makeError("WHATSAPP_MARK_READ_FAILED", "Failed to mark message as read", {
            messageId,
            error: errorData,
          })
        );
      }

      logger.debug("[WhatsAppAdapter] Message marked as read", { messageId });
      return Ok(undefined);
    } catch (error) {
      logger.error("[WhatsAppAdapter] Unexpected mark read error", { error });
      return Err(
        makeError("WHATSAPP_ADAPTER_ERROR", "Failed to mark message as read", {
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }

  // ── Parse Incoming Webhook ───────────────────────────────────────────────

  parseWebhook(payload: WhatsAppWebhookPayload): WhatsAppMessage[] {
    const messages: WhatsAppMessage[] = [];

    try {
      for (const entry of payload.entry) {
        for (const change of entry.changes) {
          const value = change.value;

          if (value.messages) {
            for (const msg of value.messages) {
              const parsed: WhatsAppMessage = {
                from: msg.from,
                type: msg.type as WhatsAppMessage["type"],
                timestamp: parseInt(msg.timestamp) * 1000, // Convert to ms
                messageId: msg.id,
              };

              // Parse based on message type
              if (msg.type === "text" && msg.text) {
                parsed.text = msg.text.body;
              } else if (msg.type === "image" && msg.image) {
                parsed.mediaId = msg.image.id;
                parsed.mimeType = msg.image.mime_type;
                parsed.caption = msg.image.caption;
              } else if (msg.type === "document" && msg.document) {
                parsed.mediaId = msg.document.id;
                parsed.mimeType = msg.document.mime_type;
                parsed.filename = msg.document.filename;
              } else if (msg.type === "audio" && msg.audio) {
                parsed.mediaId = msg.audio.id;
                parsed.mimeType = msg.audio.mime_type;
              } else if (msg.type === "video" && msg.video) {
                parsed.mediaId = msg.video.id;
                parsed.mimeType = msg.video.mime_type;
                parsed.caption = msg.video.caption;
              }

              messages.push(parsed);
            }
          }
        }
      }

      logger.debug("[WhatsAppAdapter] Parsed webhook", {
        messageCount: messages.length,
      });

      return messages;
    } catch (error) {
      logger.error("[WhatsAppAdapter] Failed to parse webhook", { error });
      return [];
    }
  }

  // ── Verify Webhook Signature ─────────────────────────────────────────────

  verifyWebhookSignature(
    payload: string,
    signature: string
  ): boolean {
    if (!this.config.webhookSecret) {
      logger.warn("[WhatsAppAdapter] Webhook secret not configured, skipping verification");
      return true;
    }

    try {
      const expectedSignature = crypto
        .createHmac("sha256", this.config.webhookSecret)
        .update(payload)
        .digest("hex");

      const isValid = crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(`sha256=${expectedSignature}`)
      );

      if (!isValid) {
        logger.warn("[WhatsAppAdapter] Invalid webhook signature");
      }

      return isValid;
    } catch (error) {
      logger.error("[WhatsAppAdapter] Signature verification error", { error });
      return false;
    }
  }

  // ── Get Media URL ────────────────────────────────────────────────────────

  async getMediaUrl(mediaId: string): Promise<Result<string, VanguardError>> {
    try {
      const response = await fetch(`${WHATSAPP_BASE_URL}/${WHATSAPP_API_VERSION}/${mediaId}`, {
        headers: {
          Authorization: `Bearer ${this.config.accessToken}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        logger.error("[WhatsAppAdapter] Get media URL failed", {
          mediaId,
          error: errorData,
        });
        return Err(
          makeError("WHATSAPP_MEDIA_FETCH_FAILED", "Failed to get media URL", {
            mediaId,
            error: errorData,
          })
        );
      }

      const data = await response.json();
      return Ok(data.url);
    } catch (error) {
      logger.error("[WhatsAppAdapter] Unexpected media fetch error", { error });
      return Err(
        makeError("WHATSAPP_ADAPTER_ERROR", "Failed to get media URL", {
          mediaId,
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }
}

// ─── Helper: Create WhatsApp Adapter from Environment ────────────────────────

export function createWhatsAppAdapter(): WhatsAppAdapter {
  const config: WhatsAppConfig = {
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || "",
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN || "",
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || "",
    webhookSecret: process.env.WHATSAPP_WEBHOOK_SECRET,
  };

  if (!config.phoneNumberId || !config.accessToken || !config.verifyToken) {
    throw new Error(
      "[WhatsAppAdapter] Missing required environment variables: WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN, WHATSAPP_VERIFY_TOKEN"
    );
  }

  return new WhatsAppAdapter(config);
}

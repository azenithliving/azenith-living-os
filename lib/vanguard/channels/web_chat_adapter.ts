/**
 * ────────────────────────────────────────────────────────────────────────────
 * VANGUARD – Web Chat Adapter
 * ────────────────────────────────────────────────────────────────────────────
 * Phase 3: Task 3 – WebSocket live chat integration
 * 
 * Features:
 * - Real-time bidirectional messaging
 * - Typing indicators
 * - Presence status (online/offline)
 * - Message history
 * - Connection management
 * - Room/session support
 * 
 * Note: This is the client-side logic. Server implementation in /api/channels/websocket
 */

import { logger } from "@/lib/vanguard/observability/logger";
import type { Result, VanguardError } from "@/lib/vanguard/types";
import { Ok, Err, makeError } from "@/lib/vanguard/types";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface WebChatConfig {
  serverUrl?: string; // WebSocket server URL (default: auto-detect)
  reconnectAttempts?: number; // Max reconnection attempts (default: 5)
  reconnectDelay?: number; // Delay between reconnects in ms (default: 2000)
}

export interface WebChatMessage {
  id: string;
  sessionId: string;
  from: "user" | "agent";
  text: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface TypingIndicator {
  sessionId: string;
  isTyping: boolean;
  user: string;
}

export interface PresenceStatus {
  sessionId: string;
  status: "online" | "offline" | "away";
  lastSeen?: number;
}

export type WebChatEventType =
  | "message"
  | "typing"
  | "presence"
  | "history"
  | "error"
  | "connected"
  | "disconnected";

export interface WebChatEvent {
  type: WebChatEventType;
  data: unknown;
}

// ─── WebSocket Message Protocol ──────────────────────────────────────────────

interface WSMessage {
  type: "auth" | "message" | "typing" | "presence" | "history" | "ping" | "pong";
  sessionId: string;
  data?: unknown;
}

// ─── Web Chat Adapter Class ──────────────────────────────────────────────────

export class WebChatAdapter {
  private config: WebChatConfig;
  private ws: WebSocket | null = null;
  private sessionId: string | null = null;
  private reconnectCount = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private eventHandlers: Map<WebChatEventType, Array<(data: unknown) => void>> = new Map();
  private connected = false;

  constructor(config: WebChatConfig = {}) {
    this.config = {
      reconnectAttempts: config.reconnectAttempts || 5,
      reconnectDelay: config.reconnectDelay || 2000,
      serverUrl: config.serverUrl || this.getDefaultServerUrl(),
    };
  }

  // ── Helper: Get Default Server URL ───────────────────────────────────────

  private getDefaultServerUrl(): string {
    if (typeof window === "undefined") {
      // Server-side
      return "ws://localhost:3000/api/channels/websocket";
    }
    // Client-side: auto-detect from current location
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    return `${protocol}//${host}/api/channels/websocket`;
  }

  // ── Connect ──────────────────────────────────────────────────────────────

  connect(sessionId: string): Promise<Result<void, VanguardError>> {
    return new Promise((resolve) => {
      if (this.connected && this.sessionId === sessionId) {
        logger.debug("[WebChatAdapter] Already connected", { sessionId });
        resolve(Ok(undefined));
        return;
      }

      this.sessionId = sessionId;

      try {
        logger.info("[WebChatAdapter] Connecting", {
          serverUrl: this.config.serverUrl,
          sessionId,
        });

        this.ws = new WebSocket(this.config.serverUrl!);

        this.ws.onopen = () => {
          this.connected = true;
          this.reconnectCount = 0;
          logger.info("[WebChatAdapter] Connected", { sessionId });

          // Send auth message
          this.send({
            type: "auth",
            sessionId: this.sessionId!,
          });

          // Start ping/pong keep-alive
          this.startPingInterval();

          this.emit("connected", { sessionId });
          resolve(Ok(undefined));
        };

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data) as WSMessage;
            this.handleMessage(message);
          } catch (error) {
            logger.error("[WebChatAdapter] Failed to parse message", { error });
          }
        };

        this.ws.onerror = (error) => {
          logger.error("[WebChatAdapter] WebSocket error", { error });
          this.emit("error", { error: "WebSocket connection error" });
        };

        this.ws.onclose = () => {
          this.connected = false;
          this.stopPingInterval();
          logger.warn("[WebChatAdapter] Disconnected", { sessionId });
          this.emit("disconnected", { sessionId });

          // Attempt reconnection
          if (this.reconnectCount < this.config.reconnectAttempts!) {
            this.reconnectCount++;
            logger.info("[WebChatAdapter] Reconnecting", {
              attempt: this.reconnectCount,
              maxAttempts: this.config.reconnectAttempts,
            });

            this.reconnectTimer = setTimeout(() => {
              void this.connect(this.sessionId!);
            }, this.config.reconnectDelay);
          } else {
            logger.error("[WebChatAdapter] Max reconnection attempts reached");
            resolve(
              Err(
                makeError("WEBSOCKET_CONNECTION_FAILED", "Failed to establish WebSocket connection")
              )
            );
          }
        };
      } catch (error) {
        logger.error("[WebChatAdapter] Connection error", { error });
        resolve(
          Err(
            makeError("WEBSOCKET_ADAPTER_ERROR", "Failed to connect", {
              error: error instanceof Error ? error.message : String(error),
            })
          )
        );
      }
    });
  }

  // ── Disconnect ───────────────────────────────────────────────────────────

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.stopPingInterval();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.connected = false;
    this.sessionId = null;
    logger.info("[WebChatAdapter] Disconnected by client");
  }

  // ── Send Message ─────────────────────────────────────────────────────────

  sendMessage(text: string, metadata?: Record<string, unknown>): Result<void, VanguardError> {
    if (!this.connected || !this.ws) {
      return Err(makeError("NOT_CONNECTED", "WebSocket not connected"));
    }

    if (!this.sessionId) {
      return Err(makeError("NO_SESSION", "Session ID not set"));
    }

    try {
      this.send({
        type: "message",
        sessionId: this.sessionId,
        data: {
          text,
          metadata,
          timestamp: Date.now(),
        },
      });

      logger.debug("[WebChatAdapter] Message sent", {
        sessionId: this.sessionId,
        textLength: text.length,
      });

      return Ok(undefined);
    } catch (error) {
      logger.error("[WebChatAdapter] Failed to send message", { error });
      return Err(
        makeError("SEND_MESSAGE_FAILED", "Failed to send message", {
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }

  // ── Send Typing Indicator ────────────────────────────────────────────────

  sendTyping(isTyping: boolean): void {
    if (!this.connected || !this.sessionId) return;

    this.send({
      type: "typing",
      sessionId: this.sessionId,
      data: { isTyping },
    });
  }

  // ── Request Message History ──────────────────────────────────────────────

  requestHistory(limit = 50): void {
    if (!this.connected || !this.sessionId) return;

    this.send({
      type: "history",
      sessionId: this.sessionId,
      data: { limit },
    });
  }

  // ── Event Handlers ───────────────────────────────────────────────────────

  on(event: WebChatEventType, handler: (data: unknown) => void): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  off(event: WebChatEventType, handler: (data: unknown) => void): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  private emit(event: WebChatEventType, data: unknown): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(data);
        } catch (error) {
          logger.error("[WebChatAdapter] Event handler error", { event, error });
        }
      });
    }
  }

  // ── Private: Send Raw Message ────────────────────────────────────────────

  private send(message: WSMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  // ── Private: Handle Incoming Message ─────────────────────────────────────

  private handleMessage(message: WSMessage): void {
    switch (message.type) {
      case "message":
        this.emit("message", message.data);
        break;

      case "typing":
        this.emit("typing", message.data);
        break;

      case "presence":
        this.emit("presence", message.data);
        break;

      case "history":
        this.emit("history", message.data);
        break;

      case "pong":
        // Keep-alive response
        logger.debug("[WebChatAdapter] Pong received");
        break;

      default:
        logger.warn("[WebChatAdapter] Unknown message type", { type: message.type });
    }
  }

  // ── Private: Ping/Pong Keep-Alive ────────────────────────────────────────

  private startPingInterval(): void {
    this.stopPingInterval();
    this.pingTimer = setInterval(() => {
      if (this.connected && this.sessionId) {
        this.send({
          type: "ping",
          sessionId: this.sessionId,
        });
      }
    }, 30000); // Ping every 30 seconds
  }

  private stopPingInterval(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  // ── Status Getters ───────────────────────────────────────────────────────

  isConnected(): boolean {
    return this.connected;
  }

  getSessionId(): string | null {
    return this.sessionId;
  }
}

// ─── Helper: Create Web Chat Adapter ─────────────────────────────────────────

export function createWebChatAdapter(config?: WebChatConfig): WebChatAdapter {
  return new WebChatAdapter(config);
}

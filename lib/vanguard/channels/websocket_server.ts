/**
 * ────────────────────────────────────────────────────────────────────────────
 * VANGUARD – WebSocket Server (Socket.io)
 * ────────────────────────────────────────────────────────────────────────────
 * Phase 3: Task 9 – WebSocket server implementation
 * 
 * This is a reference implementation for Socket.io WebSocket server.
 * To use this, create a custom server.ts file in your project root:
 * 
 * ```typescript
 * import { createServer } from 'http';
 * import { parse } from 'url';
 * import next from 'next';
 * import { setupWebSocketServer } from './lib/vanguard/channels/websocket_server';
 * 
 * const dev = process.env.NODE_ENV !== 'production';
 * const hostname = 'localhost';
 * const port = 3000;
 * 
 * const app = next({ dev, hostname, port });
 * const handle = app.getRequestHandler();
 * 
 * app.prepare().then(() => {
 *   const server = createServer(async (req, res) => {
 *     const parsedUrl = parse(req.url!, true);
 *     await handle(req, res, parsedUrl);
 *   });
 * 
 *   setupWebSocketServer(server);
 * 
 *   server.listen(port, () => {
 *     console.log(`> Ready on http://${hostname}:${port}`);
 *   });
 * });
 * ```
 * 
 * Then install Socket.io: npm install socket.io
 */

import type { Server as HTTPServer } from "http";
import { logger } from "@/lib/vanguard/observability/logger";

// Types for Socket.io (dynamic import to avoid build errors if not installed)
type Socket = {
  id: string;
  handshake: {
    auth: Record<string, unknown>;
    query: Record<string, string>;
  };
  join: (room: string) => void;
  leave: (room: string) => void;
  emit: (event: string, ...args: unknown[]) => void;
  on: (event: string, handler: (...args: unknown[]) => void) => void;
  disconnect: () => void;
  data: Record<string, unknown>;
};

type Server = {
  on: (event: string, handler: (socket: Socket) => void) => void;
  to: (room: string) => {
    emit: (event: string, ...args: unknown[]) => void;
  };
  emit: (event: string, ...args: unknown[]) => void;
};

// ─── Session Management ──────────────────────────────────────────────────────

const activeSessions = new Map<
  string,
  {
    socketId: string;
    sessionId: string;
    connectedAt: number;
    lastActivity: number;
  }
>();

// ─── Setup WebSocket Server ──────────────────────────────────────────────────

export async function setupWebSocketServer(httpServer: HTTPServer): Promise<void> {
  try {
    // Dynamic import Socket.io (only if installed)
    const { Server } = await import("socket.io");

    const io: Server = new Server(httpServer, {
      path: "/socket",
      cors: {
        origin: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true,
      },
      transports: ["websocket", "polling"],
    }) as unknown as Server;

    logger.info("[WebSocket Server] Socket.io initialized");

    // Connection handler
    io.on("connection", async (socket: Socket) => {
      const sessionId = socket.handshake.query.sessionId || socket.id;

      logger.info("[WebSocket Server] Client connected", {
        socketId: socket.id,
        sessionId,
      });

      // Store session
      activeSessions.set(socket.id, {
        socketId: socket.id,
        sessionId,
        connectedAt: Date.now(),
        lastActivity: Date.now(),
      });

      // Join session room
      socket.join(sessionId);
      socket.data.sessionId = sessionId;

      // Send connection confirmation
      socket.emit("connected", {
        sessionId,
        timestamp: Date.now(),
      });

      // Handle authentication
      socket.on("auth", async (data: unknown) => {
        const authData = data as { sessionId: string };
        logger.debug("[WebSocket Server] Auth received", {
          socketId: socket.id,
          sessionId: authData.sessionId,
        });

        const session = activeSessions.get(socket.id);
        if (session) {
          session.sessionId = authData.sessionId;
          session.lastActivity = Date.now();
        }

        // Update room membership
        socket.leave(sessionId);
        socket.join(authData.sessionId);
        socket.data.sessionId = authData.sessionId;
      });

      // Handle messages
      socket.on("message", async (data: unknown) => {
        const msgData = data as { text: string; metadata?: Record<string, unknown> };
        const currentSessionId = (socket.data.sessionId || sessionId) as string;

        logger.debug("[WebSocket Server] Message received", {
          socketId: socket.id,
          sessionId: currentSessionId,
          textLength: msgData.text?.length,
        });

        try {
          // Update last activity
          const session = activeSessions.get(socket.id);
          if (session) {
            session.lastActivity = Date.now();
          }

          // Get conversation manager
          const { getConversationManager } = await import("./conversation_manager");
          const conversationManager = getConversationManager();

          // Get or create conversation
          const convResult = await conversationManager.getOrCreateConversation(
            "webchat",
            currentSessionId
          );

          if (!convResult.ok) {
            logger.error("[WebSocket Server] Failed to get conversation", {
              error: convResult.error.message,
            });
            socket.emit("error", { message: "Failed to create conversation" } as unknown);
            return;
          }

          const conversation = convResult.value;

          // Add user message to conversation
          await conversationManager.addMessage(
            conversation.id,
            {
              channelType: "webchat",
              from: currentSessionId,
              text: msgData.text,
              timestamp: Date.now(),
              metadata: msgData.metadata,
            },
            "user"
          );

          // TODO: Generate VANGUARD response
          // This would involve:
          // 1. Get conversation context
          // 2. Use consciousness_core to generate response
          // 3. Send response back via socket

          // Echo message back (placeholder - replace with actual AI response)
          socket.emit("message", {
            from: "agent",
            text: msgData.text, // Replace with AI-generated response
            timestamp: Date.now(),
            sessionId: currentSessionId,
          } as unknown);

          logger.debug("[WebSocket Server] Message processed", {
            conversationId: conversation.id,
          });
        } catch (error) {
          logger.error("[WebSocket Server] Message handling error", { error });
          socket.emit("error", {
            message: "Failed to process message",
            error: error instanceof Error ? error.message : String(error),
          } as unknown);
        }
      });

      // Handle typing indicators
      socket.on("typing", (data: unknown) => {
        const typingData = data as { isTyping: boolean };
        const currentSessionId = socket.data.sessionId || sessionId;

        // Broadcast typing status to room
        socket.emit("typing", {
          sessionId: currentSessionId,
          isTyping: typingData.isTyping,
          user: "agent",
        } as unknown);

        logger.debug("[WebSocket Server] Typing indicator", {
          sessionId: currentSessionId,
          isTyping: typingData.isTyping,
        });
      });

      // Handle history request
      socket.on("history", async (data: unknown) => {
        const histData = data as { limit?: number };
        const currentSessionId = (socket.data.sessionId || sessionId) as string;

        try {
          const { getConversationManager } = await import("./conversation_manager");
          const conversationManager = getConversationManager();

          const convResult = await conversationManager.getOrCreateConversation(
            "webchat",
            currentSessionId
          );

          if (convResult.ok) {
            const history = conversationManager.getHistory(
              convResult.value.id,
              histData.limit || 50
            );

            socket.emit("history", {
              messages: history,
              sessionId: currentSessionId,
            } as unknown);

            logger.debug("[WebSocket Server] History sent", {
              sessionId: currentSessionId,
              messageCount: history.length,
            });
          }
        } catch (error) {
          logger.error("[WebSocket Server] History fetch error", { error });
        }
      });

      // Handle ping/pong
      socket.on("ping", () => {
        socket.emit("pong");

        const session = activeSessions.get(socket.id);
        if (session) {
          session.lastActivity = Date.now();
        }
      });

      // Handle disconnection
      socket.on("disconnect", () => {
        logger.info("[WebSocket Server] Client disconnected", {
          socketId: socket.id,
          sessionId: socket.data.sessionId || sessionId,
        });

        activeSessions.delete(socket.id);
      });
    });

    // Periodic cleanup of stale sessions
    setInterval(() => {
      const now = Date.now();
      const staleThreshold = 5 * 60 * 1000; // 5 minutes

      for (const [socketId, session] of activeSessions.entries()) {
        if (now - session.lastActivity > staleThreshold) {
          logger.info("[WebSocket Server] Cleaning stale session", {
            socketId,
            sessionId: session.sessionId,
            idleMinutes: Math.round((now - session.lastActivity) / 60000),
          });
          activeSessions.delete(socketId);
        }
      }
    }, 60000); // Check every minute

    logger.info("[WebSocket Server] Setup complete", {
      path: "/socket",
      transports: ["websocket", "polling"],
    });
  } catch (error) {
    logger.error("[WebSocket Server] Setup failed", {
      error: error instanceof Error ? error.message : String(error),
      hint: "Make sure socket.io is installed: npm install socket.io",
    });
  }
}

// ─── Get Active Sessions Stats ───────────────────────────────────────────────

export function getActiveSessionsStats(): {
  total: number;
  sessions: Array<{
    socketId: string;
    sessionId: string;
    connectedMinutes: number;
    idleMinutes: number;
  }>;
} {
  const now = Date.now();
  const sessions = Array.from(activeSessions.values()).map((session) => ({
    socketId: session.socketId,
    sessionId: session.sessionId,
    connectedMinutes: Math.round((now - session.connectedAt) / 60000),
    idleMinutes: Math.round((now - session.lastActivity) / 60000),
  }));

  return {
    total: sessions.length,
    sessions,
  };
}

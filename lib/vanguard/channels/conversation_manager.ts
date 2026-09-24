/**
 * ────────────────────────────────────────────────────────────────────────────
 * VANGUARD – Conversation Manager
 * ────────────────────────────────────────────────────────────────────────────
 * Phase 3: Task 5 – Multi-channel session tracking
 * 
 * Features:
 * - Merge conversations across channels
 * - Maintain conversation context
 * - Detect channel switching
 * - Track conversation history
 * - Session timeout management
 * - Cross-channel user identification
 */

import { logger } from "@/lib/vanguard/observability/logger";
import { createServiceRoleClient } from "@/lib/vanguard/memory/supabase_persistence";
import type { Result, VanguardError } from "@/lib/vanguard/types";
import { Ok, Err, makeError } from "@/lib/vanguard/types";
import type { ChannelType, UnifiedMessage } from "./channel_router";

// ─── Configuration ───────────────────────────────────────────────────────────

const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const MAX_HISTORY_LENGTH = 100; // Max messages per conversation

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Conversation {
  id: string; // Unique conversation ID
  userId: string; // User identifier (can be phone/email/session)
  channels: Set<ChannelType>; // Channels used in this conversation
  currentChannel: ChannelType; // Most recent channel
  messages: ConversationMessage[];
  metadata: {
    leadId?: string | undefined;
    customerName?: string | undefined;
    tags?: string[] | undefined;
    lastChannelSwitch?: number | undefined;
    [key: string]: unknown;
  };
  createdAt: number;
  lastActivityAt: number;
  status: "active" | "idle" | "closed";
}

export interface ConversationMessage {
  id: string;
  conversationId: string;
  channelType: ChannelType;
  from: "user" | "agent";
  identifier: string; // Phone number, email, or session ID
  text: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface ChannelIdentity {
  channelType: ChannelType;
  identifier: string; // Phone, email, or session ID
  userId: string; // Normalized user ID
  verified: boolean;
  linkedAt: number;
}

// ─── Conversation Manager Class ──────────────────────────────────────────────

export class ConversationManager {
  private conversations: Map<string, Conversation> = new Map();
  private identityMap: Map<string, string> = new Map(); // identifier → userId
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Start periodic cleanup of idle sessions
    this.startCleanupTimer();
  }

  // ── Get or Create Conversation ───────────────────────────────────────────

  async getOrCreateConversation(
    channelType: ChannelType,
    identifier: string
  ): Promise<Result<Conversation, VanguardError>> {
    try {
      // Normalize identifier
      const normalizedId = this.normalizeIdentifier(identifier, channelType);

      // Check if user has existing conversation
      let userId = this.identityMap.get(`${channelType}:${normalizedId}`);

      if (!userId) {
        // Try to link to existing user via cross-channel matching
        userId = await this.findLinkedUser(channelType, normalizedId) || undefined;

        if (!userId) {
          // Create new user ID
          userId = crypto.randomUUID();
        }

        // Store identity mapping
        this.identityMap.set(`${channelType}:${normalizedId}`, userId);
        await this.persistIdentity(channelType, normalizedId, userId);
      }

      // Find active conversation for this user
      let conversation = Array.from(this.conversations.values()).find(
        (conv) => conv.userId === userId && conv.status === "active"
      );

      if (!conversation) {
        // Create new conversation
        conversation = {
          id: crypto.randomUUID(),
          userId,
          channels: new Set([channelType]),
          currentChannel: channelType,
          messages: [],
          metadata: {},
          createdAt: Date.now(),
          lastActivityAt: Date.now(),
          status: "active",
        };

        this.conversations.set(conversation.id, conversation);
        await this.persistConversation(conversation);

        logger.info("[ConversationManager] New conversation created", {
          conversationId: conversation.id,
          userId,
          channelType,
        });
      } else {
        // Update existing conversation
        const channelChanged = conversation.currentChannel !== channelType;

        if (channelChanged) {
          conversation.metadata.lastChannelSwitch = Date.now();
          logger.info("[ConversationManager] Channel switch detected", {
            conversationId: conversation.id,
            from: conversation.currentChannel,
            to: channelType,
          });
        }

        conversation.channels.add(channelType);
        conversation.currentChannel = channelType;
        conversation.lastActivityAt = Date.now();
        conversation.status = "active";
      }

      return Ok(conversation);
    } catch (error) {
      logger.error("[ConversationManager] Failed to get/create conversation", { error });
      return Err(
        makeError("CONVERSATION_ERROR", "Failed to get or create conversation", {
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }

  // ── Add Message to Conversation ──────────────────────────────────────────

  async addMessage(
    conversationId: string,
    message: UnifiedMessage,
    from: "user" | "agent" = "user"
  ): Promise<Result<void, VanguardError>> {
    const conversation = this.conversations.get(conversationId);

    if (!conversation) {
      return Err(
        makeError("CONVERSATION_NOT_FOUND", `Conversation not found: ${conversationId}`)
      );
    }

    try {
      const conversationMessage: ConversationMessage = {
        id: message.messageId || crypto.randomUUID(),
        conversationId,
        channelType: message.channelType,
        from,
        identifier: message.from,
        text: message.text,
        timestamp: message.timestamp,
        metadata: message.metadata,
      };

      // Add to in-memory conversation
      conversation.messages.push(conversationMessage);
      conversation.lastActivityAt = Date.now();

      // Trim old messages if exceeds limit
      if (conversation.messages.length > MAX_HISTORY_LENGTH) {
        conversation.messages = conversation.messages.slice(-MAX_HISTORY_LENGTH);
      }

      // Persist to database
      await this.persistMessage(conversationMessage);

      logger.debug("[ConversationManager] Message added", {
        conversationId,
        messageId: conversationMessage.id,
        from,
        channelType: message.channelType,
      });

      return Ok(undefined);
    } catch (error) {
      logger.error("[ConversationManager] Failed to add message", { error });
      return Err(
        makeError("ADD_MESSAGE_FAILED", "Failed to add message to conversation", {
          conversationId,
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }

  // ── Get Conversation History ─────────────────────────────────────────────

  getHistory(conversationId: string, limit = 50): ConversationMessage[] {
    const conversation = this.conversations.get(conversationId);

    if (!conversation) {
      logger.warn("[ConversationManager] Conversation not found for history", {
        conversationId,
      });
      return [];
    }

    return conversation.messages.slice(-limit);
  }

  // ── Get Conversation Context ─────────────────────────────────────────────

  getContext(conversationId: string): Record<string, unknown> {
    const conversation = this.conversations.get(conversationId);

    if (!conversation) {
      return {};
    }

    const recentMessages = conversation.messages.slice(-10);

    return {
      conversationId: conversation.id,
      userId: conversation.userId,
      channels: Array.from(conversation.channels),
      currentChannel: conversation.currentChannel,
      messageCount: conversation.messages.length,
      recentMessages: recentMessages.map((m) => ({
        from: m.from,
        text: m.text.slice(0, 100),
        channelType: m.channelType,
        timestamp: m.timestamp,
      })),
      metadata: conversation.metadata,
      createdAt: conversation.createdAt,
      lastActivityAt: conversation.lastActivityAt,
      durationMinutes: Math.round((Date.now() - conversation.createdAt) / 60000),
    };
  }

  // ── Close Conversation ───────────────────────────────────────────────────

  async closeConversation(conversationId: string): Promise<Result<void, VanguardError>> {
    const conversation = this.conversations.get(conversationId);

    if (!conversation) {
      return Err(
        makeError("CONVERSATION_NOT_FOUND", `Conversation not found: ${conversationId}`)
      );
    }

    conversation.status = "closed";
    await this.persistConversation(conversation);

    logger.info("[ConversationManager] Conversation closed", {
      conversationId,
      messageCount: conversation.messages.length,
      duration: Date.now() - conversation.createdAt,
    });

    return Ok(undefined);
  }

  // ── Link Identities Across Channels ──────────────────────────────────────

  async linkIdentities(
    identity1: { channelType: ChannelType; identifier: string },
    identity2: { channelType: ChannelType; identifier: string }
  ): Promise<Result<void, VanguardError>> {
    try {
      const key1 = `${identity1.channelType}:${this.normalizeIdentifier(identity1.identifier, identity1.channelType)}`;
      const key2 = `${identity2.channelType}:${this.normalizeIdentifier(identity2.identifier, identity2.channelType)}`;

      const userId1 = this.identityMap.get(key1);
      const userId2 = this.identityMap.get(key2);

      if (userId1 && userId2 && userId1 !== userId2) {
        // Merge conversations
        await this.mergeUsers(userId1, userId2);
      } else if (userId1) {
        this.identityMap.set(key2, userId1);
        await this.persistIdentity(identity2.channelType, identity2.identifier, userId1);
      } else if (userId2) {
        this.identityMap.set(key1, userId2);
        await this.persistIdentity(identity1.channelType, identity1.identifier, userId2);
      } else {
        // Both new, create link
        const userId = crypto.randomUUID();
        this.identityMap.set(key1, userId);
        this.identityMap.set(key2, userId);
        await this.persistIdentity(identity1.channelType, identity1.identifier, userId);
        await this.persistIdentity(identity2.channelType, identity2.identifier, userId);
      }

      logger.info("[ConversationManager] Identities linked", {
        identity1: key1,
        identity2: key2,
      });

      return Ok(undefined);
    } catch (error) {
      logger.error("[ConversationManager] Failed to link identities", { error });
      return Err(
        makeError("LINK_IDENTITIES_FAILED", "Failed to link identities", {
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }

  // ── Private: Normalize Identifier ────────────────────────────────────────

  private normalizeIdentifier(identifier: string, channelType: ChannelType): string {
    switch (channelType) {
      case "whatsapp":
        // Remove non-digits from phone number
        return identifier.replace(/\D/g, "");
      case "email":
        // Lowercase email
        return identifier.toLowerCase().trim();
      case "webchat":
        // Session ID as-is
        return identifier;
      default:
        return identifier;
    }
  }

  // ── Private: Find Linked User ────────────────────────────────────────────

  private async findLinkedUser(
    channelType: ChannelType,
    identifier: string
  ): Promise<string | null> {
    try {
      const supabase = createServiceRoleClient();

      const { data, error } = await supabase
        .from("vanguard_channel_identities")
        .select("user_id")
        .eq("channel_type", channelType)
        .eq("identifier", identifier)
        .single();

      if (error || !data) {
        return null;
      }

      return data.user_id as string;
    } catch (error) {
      logger.error("[ConversationManager] Failed to find linked user", { error });
      return null;
    }
  }

  // ── Private: Merge Users ─────────────────────────────────────────────────

  private async mergeUsers(userId1: string, userId2: string): Promise<void> {
    logger.info("[ConversationManager] Merging users", { userId1, userId2 });

    // Keep userId1, migrate userId2 conversations
    for (const conversation of this.conversations.values()) {
      if (conversation.userId === userId2) {
        conversation.userId = userId1;
      }
    }

    // Update identity map
    for (const [key, userId] of this.identityMap.entries()) {
      if (userId === userId2) {
        this.identityMap.set(key, userId1);
      }
    }

    // Update database (would need migration query)
    // Skipped for now - handle in production with proper migration
  }

  // ── Private: Persistence Helpers ─────────────────────────────────────────

  private async persistConversation(conversation: Conversation): Promise<void> {
    try {
      const supabase = createServiceRoleClient();

      await supabase.from("vanguard_conversations").upsert({
        id: conversation.id,
        user_id: conversation.userId,
        channels: Array.from(conversation.channels),
        current_channel: conversation.currentChannel,
        metadata: conversation.metadata,
        created_at: new Date(conversation.createdAt).toISOString(),
        last_activity_at: new Date(conversation.lastActivityAt).toISOString(),
        status: conversation.status,
      });
    } catch (error) {
      logger.error("[ConversationManager] Failed to persist conversation", { error });
    }
  }

  private async persistMessage(message: ConversationMessage): Promise<void> {
    try {
      const supabase = createServiceRoleClient();

      await supabase.from("vanguard_conversation_messages").insert({
        id: message.id,
        conversation_id: message.conversationId,
        channel_type: message.channelType,
        from_type: message.from,
        identifier: message.identifier,
        text: message.text,
        timestamp: new Date(message.timestamp).toISOString(),
        metadata: message.metadata || {},
      });
    } catch (error) {
      logger.error("[ConversationManager] Failed to persist message", { error });
    }
  }

  private async persistIdentity(
    channelType: ChannelType,
    identifier: string,
    userId: string
  ): Promise<void> {
    try {
      const supabase = createServiceRoleClient();

      await supabase.from("vanguard_channel_identities").upsert({
        channel_type: channelType,
        identifier,
        user_id: userId,
        verified: false,
        linked_at: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("[ConversationManager] Failed to persist identity", { error });
    }
  }

  // ── Private: Cleanup Idle Sessions ───────────────────────────────────────

  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      let cleanedCount = 0;

      for (const [id, conversation] of this.conversations.entries()) {
        if (
          conversation.status === "active" &&
          now - conversation.lastActivityAt > SESSION_TIMEOUT_MS
        ) {
          conversation.status = "idle";
          void this.persistConversation(conversation);
          cleanedCount++;
        }
      }

      if (cleanedCount > 0) {
        logger.info("[ConversationManager] Cleaned up idle sessions", {
          count: cleanedCount,
        });
      }
    }, 5 * 60 * 1000); // Check every 5 minutes
  }

  // ── Cleanup ──────────────────────────────────────────────────────────────

  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  // ── Stats ────────────────────────────────────────────────────────────────

  getStats(): {
    totalConversations: number;
    activeConversations: number;
    totalUsers: number;
    channelDistribution: Record<ChannelType, number>;
  } {
    const stats = {
      totalConversations: this.conversations.size,
      activeConversations: 0,
      totalUsers: new Set(Array.from(this.conversations.values()).map((c) => c.userId)).size,
      channelDistribution: {
        whatsapp: 0,
        email: 0,
        webchat: 0,
      } as Record<ChannelType, number>,
    };

    for (const conversation of this.conversations.values()) {
      if (conversation.status === "active") {
        stats.activeConversations++;
      }

      conversation.channels.forEach((channel) => {
        stats.channelDistribution[channel]++;
      });
    }

    return stats;
  }
}

// ─── Helper: Create Conversation Manager ─────────────────────────────────────

let _conversationManager: ConversationManager | null = null;

export function getConversationManager(): ConversationManager {
  if (!_conversationManager) {
    _conversationManager = new ConversationManager();
  }
  return _conversationManager;
}

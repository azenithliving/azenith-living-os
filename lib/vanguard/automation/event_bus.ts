/**
 * VANGUARD Event Bus
 * 
 * ناقل الأحداث - نظام pub/sub للأحداث الداخلية
 * Event-driven architecture for reactive automation
 */

import { createServiceRoleClient } from '@/lib/vanguard/memory/supabase_persistence';

// ============================================================================
// Event Types
// ============================================================================

export type VanguardEventType =
  // Lead events
  | 'lead:created'
  | 'lead:updated'
  | 'lead:qualified'
  | 'lead:quoted'
  | 'lead:won'
  | 'lead:lost'
  | 'lead:score_changed'
  | 'lead:tier_changed'
  | 'lead:assigned'
  | 'lead:unassigned'
  
  // Conversation events
  | 'conversation:started'
  | 'conversation:ended'
  | 'conversation:message_received'
  | 'conversation:message_sent'
  | 'conversation:idle'
  | 'conversation:escalated'
  
  // Goal events
  | 'goal:created'
  | 'goal:completed'
  | 'goal:failed'
  | 'goal:progress'
  
  // Tool/Action events
  | 'tool:executed'
  | 'tool:failed'
  | 'pipeline:completed'
  | 'pipeline:failed'
  
  // Knowledge events
  | 'knowledge:learned'
  | 'knowledge:corrected'
  | 'memory:stored'
  | 'memory:recalled'
  
  // System events
  | 'system:awakened'
  | 'system:sleeping'
  | 'system:error'
  | 'system:anomaly_detected'
  
  // Workflow events
  | 'workflow:started'
  | 'workflow:completed'
  | 'workflow:failed'
  | 'workflow:step_completed'
  
  // Task events
  | 'task:scheduled'
  | 'task:started'
  | 'task:completed'
  | 'task:failed'
  | 'task:retrying';

// ============================================================================
// Event Payload Types
// ============================================================================

export interface VanguardEvent<T = unknown> {
  id: string;
  type: VanguardEventType;
  timestamp: string;
  source: string; // Component that emitted the event
  sessionId?: string;
  userId?: string;
  payload: T;
  metadata?: Record<string, unknown>;
}

// Lead event payloads
export interface LeadCreatedPayload {
  leadId: string;
  sessionId: string;
  stage: string;
  score: number;
  tier?: string;
}

export interface LeadUpdatedPayload {
  leadId: string;
  sessionId: string;
  changes: Record<string, { old: unknown; new: unknown }>;
  previousStage?: string;
  currentStage?: string;
}

export interface LeadScoreChangedPayload {
  leadId: string;
  sessionId: string;
  oldScore: number;
  newScore: number;
  reason?: string;
}

// Conversation event payloads
export interface ConversationStartedPayload {
  conversationId: string;
  channel: 'whatsapp' | 'email' | 'webchat';
  externalId: string;
  userId?: string;
}

export interface MessageReceivedPayload {
  conversationId: string;
  messageId: string;
  from: string;
  text: string;
  channel: string;
  timestamp: number;
}

// Tool event payloads
export interface ToolExecutedPayload {
  toolId: string;
  toolName: string;
  input: unknown;
  output?: unknown;
  success: boolean;
  executionTimeMs: number;
  verificationStatus?: 'passed' | 'warning' | 'failed';
}

// System event payloads
export interface AnomalyDetectedPayload {
  type: 'high_failure_rate' | 'slow_execution' | 'sudden_spike' | 'repeated_error';
  toolId?: string;
  severity: 'low' | 'medium' | 'high';
  message: string;
  details: Record<string, unknown>;
}

// ============================================================================
// Event Subscriber
// ============================================================================

export type EventHandler<T = unknown> = (event: VanguardEvent<T>) => void | Promise<void>;

export interface EventSubscription {
  id: string;
  eventType: VanguardEventType | VanguardEventType[];
  handler: EventHandler;
  filter?: (event: VanguardEvent) => boolean;
  priority?: number; // Higher priority handlers execute first
  once?: boolean; // Auto-unsubscribe after first execution
}

// ============================================================================
// Event Bus
// ============================================================================

export class EventBus {
  private static instance: EventBus;
  private subscriptions: Map<string, EventSubscription> = new Map();
  private eventHistory: VanguardEvent[] = [];
  private maxHistorySize = 1000;
  private persistEvents = true;

  private constructor() {}

  static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  /**
   * Subscribe to events
   */
  subscribe<T = unknown>(
    eventType: VanguardEventType | VanguardEventType[],
    handler: EventHandler<T>,
    options?: {
      filter?: (event: VanguardEvent<T>) => boolean;
      priority?: number;
      once?: boolean;
    }
  ): string {
    const subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    
    const subscription: EventSubscription = {
      id: subscriptionId,
      eventType,
      handler: handler as EventHandler,
      filter: options?.filter as ((event: VanguardEvent) => boolean) | undefined,
      priority: options?.priority ?? 0,
      once: options?.once
    };

    this.subscriptions.set(subscriptionId, subscription);

    const types = Array.isArray(eventType) ? eventType.join(', ') : eventType;
    console.log(`[EventBus] Subscribed: ${subscriptionId} to ${types}`);

    return subscriptionId;
  }

  /**
   * Unsubscribe from events
   */
  unsubscribe(subscriptionId: string): boolean {
    const deleted = this.subscriptions.delete(subscriptionId);
    if (deleted) {
      console.log(`[EventBus] Unsubscribed: ${subscriptionId}`);
    }
    return deleted;
  }

  /**
   * Publish an event
   */
  async publish<T = unknown>(
    type: VanguardEventType,
    payload: T,
    options?: {
      source?: string;
      sessionId?: string;
      userId?: string;
      metadata?: Record<string, unknown>;
    }
  ): Promise<void> {
    const event: VanguardEvent<T> = {
      id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      type,
      timestamp: new Date().toISOString(),
      source: options?.source || 'vanguard',
      sessionId: options?.sessionId,
      userId: options?.userId,
      payload,
      metadata: options?.metadata
    };

    // Add to history
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory = this.eventHistory.slice(-this.maxHistorySize);
    }

    // Persist to database
    if (this.persistEvents) {
      await this.persistEvent(event);
    }

    console.log(`[EventBus] Published: ${type}`, {
      eventId: event.id,
      source: event.source,
      sessionId: event.sessionId
    });

    // Find matching subscriptions
    const matchingSubscriptions = Array.from(this.subscriptions.values())
      .filter(sub => {
        const types = Array.isArray(sub.eventType) ? sub.eventType : [sub.eventType];
        return types.includes(type);
      })
      .filter(sub => !sub.filter || sub.filter(event))
      .sort((a, b) => (b.priority || 0) - (a.priority || 0)); // Higher priority first

    // Execute handlers
    const handlerPromises = matchingSubscriptions.map(async (sub) => {
      try {
        await sub.handler(event);

        // Auto-unsubscribe if once=true
        if (sub.once) {
          this.unsubscribe(sub.id);
        }
      } catch (error) {
        console.error(`[EventBus] Handler error for ${type}:`, error);
      }
    });

    await Promise.all(handlerPromises);
  }

  /**
   * Publish multiple events in batch
   */
  async publishBatch(events: Array<{
    type: VanguardEventType;
    payload: unknown;
    options?: {
      source?: string;
      sessionId?: string;
      userId?: string;
      metadata?: Record<string, unknown>;
    };
  }>): Promise<void> {
    for (const event of events) {
      await this.publish(event.type, event.payload, event.options);
    }
  }

  /**
   * Get event history
   */
  getHistory(options?: {
    type?: VanguardEventType;
    source?: string;
    sessionId?: string;
    limit?: number;
    since?: string;
  }): VanguardEvent[] {
    let filtered = this.eventHistory;

    if (options?.type) {
      filtered = filtered.filter(e => e.type === options.type);
    }

    if (options?.source) {
      filtered = filtered.filter(e => e.source === options.source);
    }

    if (options?.sessionId) {
      filtered = filtered.filter(e => e.sessionId === options.sessionId);
    }

    if (options?.since) {
      const sinceDate = new Date(options.since);
      filtered = filtered.filter(e => new Date(e.timestamp) >= sinceDate);
    }

    const limit = options?.limit || filtered.length;
    return filtered.slice(-limit);
  }

  /**
   * Get event count by type
   */
  getEventCounts(): Record<VanguardEventType, number> {
    const counts: Partial<Record<VanguardEventType, number>> = {};
    
    for (const event of this.eventHistory) {
      counts[event.type] = (counts[event.type] || 0) + 1;
    }

    return counts as Record<VanguardEventType, number>;
  }

  /**
   * Get active subscriptions
   */
  getSubscriptions(): Array<{
    id: string;
    eventType: VanguardEventType | VanguardEventType[];
    priority: number;
    once: boolean;
  }> {
    return Array.from(this.subscriptions.values()).map(sub => ({
      id: sub.id,
      eventType: sub.eventType,
      priority: sub.priority || 0,
      once: sub.once || false
    }));
  }

  /**
   * Clear event history
   */
  clearHistory(): void {
    this.eventHistory = [];
    console.log('[EventBus] Event history cleared');
  }

  /**
   * Persist event to database
   */
  private async persistEvent(event: VanguardEvent): Promise<void> {
    try {
      const supabase = createServiceRoleClient();

      // Store in a simple events log table (we'll use vanguard_api_usage for now)
      await supabase.from('vanguard_api_usage').insert({
        api_name: 'event_bus',
        endpoint: event.type,
        method: 'EVENT',
        status_code: 200,
        latency_ms: 0,
        tokens_used: 0,
        cost_usd: 0,
        model: event.source,
        session_id: event.sessionId,
        metadata: {
          event_id: event.id,
          payload: event.payload,
          metadata: event.metadata,
          user_id: event.userId
        }
      });
    } catch (error) {
      console.error('[EventBus] Failed to persist event:', error);
      // Don't throw - persistence failure shouldn't break event processing
    }
  }

  /**
   * Query events from database
   */
  async queryEvents(options: {
    type?: VanguardEventType;
    sessionId?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
  }): Promise<VanguardEvent[]> {
    try {
      const supabase = createServiceRoleClient();

      let query = supabase
        .from('vanguard_api_usage')
        .select('*')
        .eq('api_name', 'event_bus')
        .order('created_at', { ascending: false });

      if (options.type) {
        query = query.eq('endpoint', options.type);
      }

      if (options.sessionId) {
        query = query.eq('session_id', options.sessionId);
      }

      if (options.startDate) {
        query = query.gte('created_at', options.startDate);
      }

      if (options.endDate) {
        query = query.lte('created_at', options.endDate);
      }

      const limit = options.limit || 100;
      query = query.limit(limit);

      const { data, error } = await query;

      if (error || !data) {
        console.error('[EventBus] Failed to query events:', error);
        return [];
      }

      return data.map(row => ({
        id: row.metadata?.event_id || row.id,
        type: row.endpoint as VanguardEventType,
        timestamp: row.created_at,
        source: row.model || 'vanguard',
        sessionId: row.session_id || undefined,
        userId: row.metadata?.user_id,
        payload: row.metadata?.payload,
        metadata: row.metadata?.metadata
      }));
    } catch (error) {
      console.error('[EventBus] Query events exception:', error);
      return [];
    }
  }

  /**
   * Enable/disable event persistence
   */
  setPersistence(enabled: boolean): void {
    this.persistEvents = enabled;
    console.log(`[EventBus] Event persistence ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalEvents: number;
    totalSubscriptions: number;
    eventCounts: Record<string, number>;
    topEventTypes: Array<{ type: string; count: number }>;
  } {
    const eventCounts = this.getEventCounts();
    const topEventTypes = Object.entries(eventCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([type, count]) => ({ type, count }));

    return {
      totalEvents: this.eventHistory.length,
      totalSubscriptions: this.subscriptions.size,
      eventCounts,
      topEventTypes
    };
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const eventBus = EventBus.getInstance();

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Wait for a specific event
 */
export function waitForEvent<T = unknown>(
  eventType: VanguardEventType,
  options?: {
    filter?: (event: VanguardEvent<T>) => boolean;
    timeout?: number;
  }
): Promise<VanguardEvent<T>> {
  return new Promise((resolve, reject) => {
    const timeoutMs = options?.timeout || 30000; // 30 seconds default

    const timeoutId = setTimeout(() => {
      eventBus.unsubscribe(subscriptionId);
      reject(new Error(`Timeout waiting for event: ${eventType}`));
    }, timeoutMs);

    const subscriptionId = eventBus.subscribe<T>(
      eventType,
      (event) => {
        clearTimeout(timeoutId);
        resolve(event);
      },
      {
        filter: options?.filter,
        once: true
      }
    );
  });
}

/**
 * Create an event listener that executes a callback
 */
export function onEvent<T = unknown>(
  eventType: VanguardEventType | VanguardEventType[],
  callback: (event: VanguardEvent<T>) => void | Promise<void>,
  options?: {
    filter?: (event: VanguardEvent<T>) => boolean;
    priority?: number;
  }
): () => void {
  const subscriptionId = eventBus.subscribe(eventType, callback, options);
  return () => eventBus.unsubscribe(subscriptionId);
}

/**
 * Emit a typed event (helper)
 */
export async function emit<T = unknown>(
  type: VanguardEventType,
  payload: T,
  options?: {
    source?: string;
    sessionId?: string;
    userId?: string;
  }
): Promise<void> {
  await eventBus.publish(type, payload, options);
}

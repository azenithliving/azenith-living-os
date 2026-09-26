/**
 * SyncLayer - Real-time synchronization for shared context across agents
 * Uses PostgreSQL LISTEN/NOTIFY for pub/sub (no Redis needed)
 */

import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { resolveAdminCompanyId } from "@/lib/admin-company";

export type SyncEventType = 
  | 'context_update' 
  | 'draft_created' 
  | 'draft_updated' 
  | 'draft_published' 
  | 'draft_rejected' 
  | 'draft_rolled_back'
  | 'audit_completed'
  | 'learning_created'
  | 'learning_updated'
  | 'agent_task_started'
  | 'agent_task_completed'
  | 'agent_task_failed'
  | 'market_update'
  | 'anomaly_detected'
  | 'self_audit_completed'
  | 'quality_gate_passed'
  | 'quality_gate_failed'
  | 'identity_violation'
  | 'scope_violation';

export interface SyncEvent {
  id: string;
  event_type: SyncEventType;
  source_agent: string;
  target_agents: string[]; // empty = broadcast to all
  payload: Record<string, any>;
  company_id: string;
  created_at: string;
}

export interface SyncSubscription {
  eventTypes: SyncEventType[];
  agentKey: string;
  callback: (event: SyncEvent) => void;
  filter?: (event: SyncEvent) => boolean;
}

export interface AdvisoryLock {
  lockId: number;
  acquired: boolean;
  expiresAt?: Date;
}

export class SyncLayer {
  private supabase: any;
  private companyId: string | null = null;
  private subscriptions: Map<string, SyncSubscription[]> = new Map();
  private notificationChannel: string = 'qayyim_sync';
  private listening = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor() {
    this.supabase = getSupabaseAdminClient();
  }

  async initialize(companyId?: string) {
    this.companyId = await resolveAdminCompanyId(companyId);
    if (!this.companyId) {
      throw new Error('Company ID not resolved');
    }
    await this.startListening();
  }

  /**
   * Start listening for PostgreSQL NOTIFY events
   */
  private async startListening() {
    if (this.listening) return;

    try {
      // Create a persistent connection for LISTEN
      // Note: Supabase doesn't support LISTEN/NOTIFY directly on pooled connections
      // We'll use a polling fallback with a sync_events table
      this.listening = true;
      this.startPolling();
      console.log('[SyncLayer] Started sync polling for company:', this.companyId);
    } catch (e) {
      console.error('[SyncLayer] Failed to start listening:', e);
      this.listening = false;
    }
  }

  /**
   * Polling fallback for sync events (works with Supabase pooler)
   */
  private pollInterval: NodeJS.Timeout | null = null;
  private lastProcessedId: string | null = null;

  private startPolling() {
    if (this.pollInterval) clearInterval(this.pollInterval);
    
    this.pollInterval = setInterval(async () => {
      try {
        await this.processNewEvents();
      } catch (e) {
        console.error('[SyncLayer] Polling error:', e);
        this.handleReconnect();
      }
    }, 2000); // Poll every 2 seconds
    // Serverless hosts keep an invocation open until the event loop drains. An
    // interval that never stops turns a scheduled function into a timeout, so the
    // timer must not be what holds the process up.
    (this.pollInterval as any)?.unref?.();
  }

  private async processNewEvents() {
    if (!this.companyId) return;

    try {
      let query = this.supabase
        .from('qayyim_sync_events')
        .select('*')
        .eq('company_id', this.companyId)
        .order('created_at', { ascending: true })
        .limit(50);

      if (this.lastProcessedId) {
        query = query.gt('id', this.lastProcessedId);
      }

      const { data, error } = await query;
      if (error) {
        // Table might not exist yet or connection issue
        return;
      }
      if (!data || data.length === 0) return;

      for (const event of data) {
        this.lastProcessedId = event.id;
        await this.dispatchEvent(event);
      }
    } catch {
      // Graceful silence for polling
    }
  }

  private async dispatchEvent(event: SyncEvent) {
    const subs = this.subscriptions.get(event.event_type) || [];
    const allSubs = this.subscriptions.get('*') || [];
    
    const relevantSubs = [...subs, ...allSubs].filter(sub => {
      if (sub.agentKey && event.target_agents.length > 0 && !event.target_agents.includes(sub.agentKey)) {
        return false;
      }
      if (sub.filter && !sub.filter(event)) return false;
      return true;
    });

    for (const sub of relevantSubs) {
      try {
        sub.callback(event);
      } catch (e) {
        console.error(`[SyncLayer] Callback error for ${event.event_type}:`, e);
      }
    }
  }

  private handleReconnect() {
    this.reconnectAttempts++;
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[SyncLayer] Max reconnect attempts reached');
      return;
    }
    console.log(`[SyncLayer] Reconnecting... attempt ${this.reconnectAttempts}`);
    setTimeout(() => this.startPolling(), 5000 * this.reconnectAttempts);
  }

  // ============================================
  // Public API
  // ============================================

  /**
   * Subscribe to sync events
   */
  subscribe(subscription: SyncSubscription): () => void {
    const key = `${subscription.agentKey}:${subscription.eventTypes.join(',')}`;
    const existing = this.subscriptions.get(key) || [];
    existing.push(subscription);
    this.subscriptions.set(key, existing);

    // Return unsubscribe function
    return () => {
      const subs = this.subscriptions.get(key) || [];
      const filtered = subs.filter(s => s !== subscription);
      if (filtered.length === 0) {
        this.subscriptions.delete(key);
      } else {
        this.subscriptions.set(key, filtered);
      }
    };
  }

  /**
   * Subscribe to all events for an agent
   */
  subscribeAll(agentKey: string, callback: (event: SyncEvent) => void): () => void {
    return this.subscribe({
      eventTypes: ['*'] as any,
      agentKey,
      callback,
    });
  }

  /**
   * Publish a sync event
   */
  async publish(event: Omit<SyncEvent, 'id' | 'company_id' | 'created_at'>): Promise<string> {
    try {
      if (!this.companyId) await this.initialize();

      const { data, error } = await this.supabase
        .from('qayyim_sync_events')
        .insert({
          company_id: this.companyId,
          event_type: event.event_type,
          source_agent: event.source_agent,
          target_agents: event.target_agents,
          payload: event.payload,
        })
        .select('id')
        .single();

      if (!error && data?.id) {
        return data.id;
      }
    } catch {
      // Safe fallback
    }

    return `evt_${Date.now()}`;
  }

  /**
   * Publish draft update
   */
  async publishDraftUpdate(
    sourceAgent: string,
    draftId: string,
    action: 'created' | 'updated' | 'published' | 'rejected' | 'rolled_back',
    payload: Record<string, any>
  ): Promise<string> {
    const eventTypeMap: Record<string, SyncEventType> = {
      created: 'draft_created',
      updated: 'draft_updated',
      published: 'draft_published',
      rejected: 'draft_rejected',
      rolled_back: 'draft_rolled_back',
    };

    return this.publish({
      event_type: eventTypeMap[action],
      source_agent: sourceAgent,
      target_agents: [], // broadcast
      payload: { draftId, action, ...payload },
    });
  }

  /**
   * Publish audit completion
   */
  async publishAuditCompleted(
    sourceAgent: string,
    auditId: string,
    results: Record<string, any>
  ): Promise<string> {
    return this.publish({
      event_type: 'audit_completed',
      source_agent: sourceAgent,
      target_agents: [],
      payload: { auditId, results },
    });
  }

  /**
   * Publish learning created
   */
  async publishLearningCreated(
    sourceAgent: string,
    learningId: string,
    domain: string,
    targetAgents: string[]
  ): Promise<string> {
    return this.publish({
      event_type: 'learning_created',
      source_agent: sourceAgent,
      target_agents: targetAgents,
      payload: { learningId, domain },
    });
  }

  /**
   * Publish agent task status
   */
  async publishTaskStatus(
    sourceAgent: string,
    taskId: string,
    status: 'started' | 'completed' | 'failed',
    payload: Record<string, any>
  ): Promise<string> {
    const eventTypeMap: Record<string, SyncEventType> = {
      started: 'agent_task_started',
      completed: 'agent_task_completed',
      failed: 'agent_task_failed',
    };

    return this.publish({
      event_type: eventTypeMap[status],
      source_agent: sourceAgent,
      target_agents: [],
      payload: { taskId, status, ...payload },
    });
  }

  /**
   * Publish quality gate result
   */
  async publishQualityGate(
    sourceAgent: string,
    draftId: string,
    passed: boolean,
    violations: any[]
  ): Promise<string> {
    return this.publish({
      event_type: passed ? 'quality_gate_passed' : 'quality_gate_failed',
      source_agent: sourceAgent,
      target_agents: [],
      payload: { draftId, passed, violations },
    });
  }

  /**
   * Publish identity/scope violation
   */
  async publishViolation(
    sourceAgent: string,
    violationType: 'identity' | 'scope',
    details: Record<string, any>
  ): Promise<string> {
    return this.publish({
      event_type: violationType === 'identity' ? 'identity_violation' : 'scope_violation',
      source_agent: sourceAgent,
      target_agents: [],
      payload: { violationType, ...details },
    });
  }

  /**
   * Advisory locks for distributed coordination
   */
  async acquireLock(lockName: string, timeoutMs: number = 30000): Promise<AdvisoryLock> {
    if (!this.companyId) await this.initialize();

    const lockId = this.hashString(lockName);

    try {
      // Try to acquire advisory lock
      const { data, error } = await this.supabase.rpc('pg_try_advisory_lock', {
        lock_id: lockId,
      });

      if (error || !data) {
        return { lockId, acquired: false };
      }

      // Set expiration
      const expiresAt = new Date(Date.now() + timeoutMs);
      
      // Store lock info for monitoring
      await this.supabase
        .from('qayyim_locks')
        .upsert({
          lock_id: lockId,
          lock_name: lockName,
          company_id: this.companyId,
          acquired_at: new Date().toISOString(),
          expires_at: expiresAt.toISOString(),
          acquired_by: 'system',
        });

      return { lockId, acquired: true, expiresAt };
    } catch (e) {
      console.error('[SyncLayer] Lock acquisition failed:', e);
      return { lockId, acquired: false };
    }
  }

  async releaseLock(lockName: string): Promise<boolean> {
    if (!this.companyId) return false;

    const lockId = this.hashString(lockName);

    try {
      await this.supabase.rpc('pg_advisory_unlock', { lock_id: lockId });
      
      await this.supabase
        .from('qayyim_locks')
        .delete()
        .eq('lock_id', lockId)
        .eq('company_id', this.companyId);

      return true;
    } catch (e) {
      console.error('[SyncLayer] Lock release failed:', e);
      return false;
    }
  }

  /**
   * Execute with lock
   */
  async withLock<T>(lockName: string, fn: () => Promise<T>, timeoutMs: number = 30000): Promise<T> {
    const lock = await this.acquireLock(lockName, timeoutMs);
    if (!lock.acquired) {
      throw new Error(`Could not acquire lock: ${lockName}`);
    }

    try {
      return await fn();
    } finally {
      await this.releaseLock(lockName);
    }
  }

  /**
   * Initialize sync events table
   */
  static async createTables(supabase: any): Promise<void> {
    await supabase.rpc('exec_sql', {
      sql_query: `
        CREATE TABLE IF NOT EXISTS public.qayyim_sync_events (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id UUID,
          event_type TEXT NOT NULL,
          source_agent TEXT NOT NULL,
          target_agents TEXT[] DEFAULT '{}',
          payload JSONB DEFAULT '{}',
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_sync_events_company ON public.qayyim_sync_events(company_id);
        CREATE INDEX IF NOT EXISTS idx_sync_events_type ON public.qayyim_sync_events(event_type);
        CREATE INDEX IF NOT EXISTS idx_sync_events_source ON public.qayyim_sync_events(source_agent);
        CREATE INDEX IF NOT EXISTS idx_sync_events_created ON public.qayyim_sync_events(created_at);
        
        -- Locks table for advisory lock monitoring
        CREATE TABLE IF NOT EXISTS public.qayyim_locks (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id UUID,
          lock_id BIGINT NOT NULL,
          lock_name TEXT NOT NULL,
          acquired_at TIMESTAMPTZ DEFAULT NOW(),
          expires_at TIMESTAMPTZ,
          acquired_by TEXT,
          UNIQUE(company_id, lock_id)
        );
        
        CREATE INDEX IF NOT EXISTS idx_locks_company ON public.qayyim_locks(company_id);
        CREATE INDEX IF NOT EXISTS idx_locks_expires ON public.qayyim_locks(expires_at);
      `
    });

    // Notification function (best effort)
    await supabase.rpc('exec_sql', {
      sql_query: `
        CREATE OR REPLACE FUNCTION notify_sync_event(
          p_event_type TEXT,
          p_payload JSONB
        ) RETURNS VOID LANGUAGE plpgsql AS $$
        BEGIN
          PERFORM pg_notify('qayyim_sync', jsonb_build_object(
            'event_type', p_event_type,
            'payload', p_payload,
            'timestamp', NOW()
          )::TEXT);
        END;
        $$ LANGUAGE plpgsql;
      `
    });
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  shutdown() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this.listening = false;
  }
}

export const syncLayer = new SyncLayer();

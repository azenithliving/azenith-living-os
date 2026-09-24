/**
 * VANGUARD Trigger Engine
 * 
 * محرك المحفزات - تنفيذ تلقائي بناءً على الأحداث والشروط
 * Automatic execution based on events, schedules, and conditions
 */

import { eventBus, VanguardEventType, VanguardEvent } from './event_bus';
import { createServiceRoleClient } from '@/lib/vanguard/memory/supabase_persistence';

// ============================================================================
// Types
// ============================================================================

export type TriggerType = 
  | 'event'       // Triggered by events
  | 'schedule'    // Triggered by schedule (cron)
  | 'threshold'   // Triggered when metric crosses threshold
  | 'composite';  // Triggered by combination of conditions

export type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'greater_than'
  | 'less_than'
  | 'greater_than_or_equal'
  | 'less_than_or_equal'
  | 'contains'
  | 'not_contains'
  | 'in'
  | 'not_in'
  | 'matches'  // Regex
  | 'exists'
  | 'not_exists';

export interface TriggerCondition {
  field: string;
  operator: ConditionOperator;
  value: unknown;
  type?: 'string' | 'number' | 'boolean' | 'date' | 'array';
}

export interface LogicalCondition {
  operator: 'and' | 'or' | 'not';
  conditions: (TriggerCondition | LogicalCondition)[];
}

export interface TriggerDefinition {
  id: string;
  name: string;
  nameAr: string;
  description?: string;
  descriptionAr?: string;
  type: TriggerType;
  enabled: boolean;
  priority: number; // Higher priority triggers execute first
  
  // Event trigger
  eventType?: VanguardEventType | VanguardEventType[];
  eventFilter?: TriggerCondition | LogicalCondition;
  
  // Schedule trigger
  schedule?: {
    cron?: string;  // Cron expression
    interval?: number;  // Interval in ms
    startDate?: string;
    endDate?: string;
  };
  
  // Threshold trigger
  threshold?: {
    metric: string;
    operator: 'greater_than' | 'less_than' | 'equals';
    value: number;
    window?: number;  // Time window in ms
  };
  
  // Composite trigger
  composite?: {
    operator: 'and' | 'or';
    triggers: string[];  // IDs of other triggers
  };
  
  // Conditions (evaluated after trigger fires)
  conditions?: TriggerCondition | LogicalCondition;
  
  // Actions to execute
  actions: TriggerAction[];
  
  // Rate limiting
  rateLimit?: {
    maxExecutions: number;
    windowMs: number;
  };
  
  // Metadata
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  lastExecutedAt?: string;
  executionCount: number;
}

export interface TriggerAction {
  type: 'workflow' | 'pipeline' | 'notification' | 'webhook' | 'script';
  config: Record<string, unknown>;
}

export interface TriggerExecutionResult {
  triggerId: string;
  success: boolean;
  executedAt: string;
  executionTimeMs: number;
  actionsExecuted: number;
  actionsFailed: number;
  error?: {
    code: string;
    message: string;
  };
}

// ============================================================================
// Trigger Engine
// ============================================================================

export class TriggerEngine {
  private static instance: TriggerEngine;
  private triggers: Map<string, TriggerDefinition> = new Map();
  private eventSubscriptions: Map<string, string> = new Map(); // triggerId -> subscriptionId
  private scheduleTimers: Map<string, NodeJS.Timeout> = new Map();
  private executionHistory: Map<string, number[]> = new Map(); // triggerId -> timestamps

  private constructor() {
    console.log('[TriggerEngine] Initialized');
  }

  static getInstance(): TriggerEngine {
    if (!TriggerEngine.instance) {
      TriggerEngine.instance = new TriggerEngine();
    }
    return TriggerEngine.instance;
  }

  /**
   * Register a trigger
   */
  async registerTrigger(definition: Omit<TriggerDefinition, 'id' | 'createdAt' | 'updatedAt' | 'executionCount'>): Promise<string> {
    const triggerId = `trigger_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    
    const trigger: TriggerDefinition = {
      ...definition,
      id: triggerId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      executionCount: 0
    };

    this.triggers.set(triggerId, trigger);

    // Activate trigger if enabled
    if (trigger.enabled) {
      await this.activateTrigger(triggerId);
    }

    console.log(`[TriggerEngine] Registered trigger: ${triggerId} (${trigger.nameAr})`);

    // Persist to database
    await this.persistTrigger(trigger);

    return triggerId;
  }

  /**
   * Update a trigger
   */
  async updateTrigger(triggerId: string, updates: Partial<TriggerDefinition>): Promise<boolean> {
    const trigger = this.triggers.get(triggerId);
    if (!trigger) {
      return false;
    }

    // Deactivate old trigger
    await this.deactivateTrigger(triggerId);

    // Apply updates
    const updatedTrigger = {
      ...trigger,
      ...updates,
      id: triggerId, // Ensure ID doesn't change
      updatedAt: new Date().toISOString()
    };

    this.triggers.set(triggerId, updatedTrigger);

    // Reactivate if enabled
    if (updatedTrigger.enabled) {
      await this.activateTrigger(triggerId);
    }

    console.log(`[TriggerEngine] Updated trigger: ${triggerId}`);

    // Persist changes
    await this.persistTrigger(updatedTrigger);

    return true;
  }

  /**
   * Delete a trigger
   */
  async deleteTrigger(triggerId: string): Promise<boolean> {
    const trigger = this.triggers.get(triggerId);
    if (!trigger) {
      return false;
    }

    // Deactivate
    await this.deactivateTrigger(triggerId);

    // Delete
    this.triggers.delete(triggerId);
    this.executionHistory.delete(triggerId);

    console.log(`[TriggerEngine] Deleted trigger: ${triggerId}`);

    // Remove from database
    try {
      const supabase = createServiceRoleClient();
      await supabase
        .from('vanguard_background_tasks')
        .delete()
        .eq('task_type', 'trigger')
        .eq('task_key', triggerId);
    } catch (error) {
      console.error('[TriggerEngine] Failed to delete from database:', error);
    }

    return true;
  }

  /**
   * Enable a trigger
   */
  async enableTrigger(triggerId: string): Promise<boolean> {
    const trigger = this.triggers.get(triggerId);
    if (!trigger) {
      return false;
    }

    trigger.enabled = true;
    trigger.updatedAt = new Date().toISOString();

    await this.activateTrigger(triggerId);

    console.log(`[TriggerEngine] Enabled trigger: ${triggerId}`);
    return true;
  }

  /**
   * Disable a trigger
   */
  async disableTrigger(triggerId: string): Promise<boolean> {
    const trigger = this.triggers.get(triggerId);
    if (!trigger) {
      return false;
    }

    trigger.enabled = false;
    trigger.updatedAt = new Date().toISOString();

    await this.deactivateTrigger(triggerId);

    console.log(`[TriggerEngine] Disabled trigger: ${triggerId}`);
    return true;
  }

  /**
   * Activate a trigger (set up subscriptions/timers)
   */
  private async activateTrigger(triggerId: string): Promise<void> {
    const trigger = this.triggers.get(triggerId);
    if (!trigger) {
      return;
    }

    switch (trigger.type) {
      case 'event':
        await this.activateEventTrigger(trigger);
        break;
      case 'schedule':
        await this.activateScheduleTrigger(trigger);
        break;
      case 'threshold':
        await this.activateThresholdTrigger(trigger);
        break;
      case 'composite':
        await this.activateCompositeTrigger(trigger);
        break;
    }
  }

  /**
   * Deactivate a trigger (clean up subscriptions/timers)
   */
  private async deactivateTrigger(triggerId: string): Promise<void> {
    // Unsubscribe from events
    const subscriptionId = this.eventSubscriptions.get(triggerId);
    if (subscriptionId) {
      eventBus.unsubscribe(subscriptionId);
      this.eventSubscriptions.delete(triggerId);
    }

    // Clear schedule timer
    const timer = this.scheduleTimers.get(triggerId);
    if (timer) {
      clearTimeout(timer);
      this.scheduleTimers.delete(triggerId);
    }
  }

  /**
   * Activate event-based trigger
   */
  private async activateEventTrigger(trigger: TriggerDefinition): Promise<void> {
    if (!trigger.eventType) {
      return;
    }

    const subscriptionId = eventBus.subscribe(
      trigger.eventType,
      async (event) => {
        // Check event filter
        if (trigger.eventFilter && !this.evaluateCondition(trigger.eventFilter, event.payload)) {
          return;
        }

        // Check additional conditions
        if (trigger.conditions && !this.evaluateCondition(trigger.conditions, event.payload)) {
          return;
        }

        // Check rate limit
        if (trigger.rateLimit && !this.checkRateLimit(trigger.id, trigger.rateLimit)) {
          console.log(`[TriggerEngine] Rate limit exceeded for trigger: ${trigger.id}`);
          return;
        }

        // Execute trigger
        await this.executeTrigger(trigger, { event });
      },
      {
        priority: trigger.priority
      }
    );

    this.eventSubscriptions.set(trigger.id, subscriptionId);
  }

  /**
   * Activate schedule-based trigger
   */
  private async activateScheduleTrigger(trigger: TriggerDefinition): Promise<void> {
    if (!trigger.schedule) {
      return;
    }

    const { interval, startDate, endDate } = trigger.schedule;

    // Simple interval-based scheduling (for production, use a proper cron library)
    if (interval) {
      const scheduleExecution = () => {
        // Check if we're within the date range
        const now = new Date();
        if (startDate && now < new Date(startDate)) {
          return;
        }
        if (endDate && now > new Date(endDate)) {
          this.disableTrigger(trigger.id);
          return;
        }

        // Execute trigger
        this.executeTrigger(trigger, { scheduledAt: now.toISOString() });

        // Schedule next execution
        const timer = setTimeout(scheduleExecution, interval);
        this.scheduleTimers.set(trigger.id, timer);
      };

      // Start first execution
      const timer = setTimeout(scheduleExecution, interval);
      this.scheduleTimers.set(trigger.id, timer);
    }
  }

  /**
   * Activate threshold-based trigger
   */
  private async activateThresholdTrigger(trigger: TriggerDefinition): Promise<void> {
    // Subscribe to relevant events that might affect the metric
    // This is a simplified implementation
    const subscriptionId = eventBus.subscribe(
      ['lead:score_changed', 'tool:executed', 'system:anomaly_detected'] as VanguardEventType[],
      async (event) => {
        if (!trigger.threshold) return;

        // Get current metric value (simplified - in production, query from database)
        const metricValue = await this.getMetricValue(trigger.threshold.metric);

        // Check threshold
        const crossed = this.checkThreshold(
          metricValue,
          trigger.threshold.operator,
          trigger.threshold.value
        );

        if (crossed) {
          await this.executeTrigger(trigger, { metric: trigger.threshold.metric, value: metricValue });
        }
      }
    );

    this.eventSubscriptions.set(trigger.id, subscriptionId);
  }

  /**
   * Activate composite trigger
   */
  private async activateCompositeTrigger(trigger: TriggerDefinition): Promise<void> {
    // Composite triggers are checked when their component triggers fire
    // This is handled in executeTrigger
  }

  /**
   * Execute a trigger
   */
  private async executeTrigger(
    trigger: TriggerDefinition,
    context: Record<string, unknown>
  ): Promise<TriggerExecutionResult> {
    const startTime = Date.now();

    console.log(`[TriggerEngine] Executing trigger: ${trigger.id} (${trigger.nameAr})`);

    try {
      let actionsExecuted = 0;
      let actionsFailed = 0;

      // Execute actions
      for (const action of trigger.actions) {
        try {
          await this.executeAction(action, context);
          actionsExecuted++;
        } catch (error) {
          console.error(`[TriggerEngine] Action failed:`, error);
          actionsFailed++;
        }
      }

      // Update execution stats
      const executedTrigger = this.triggers.get(trigger.id);
      if (executedTrigger) {
        executedTrigger.executionCount++;
        executedTrigger.lastExecutedAt = new Date().toISOString();
      }

      // Record execution time
      const executionTimes = this.executionHistory.get(trigger.id) || [];
      executionTimes.push(Date.now());
      this.executionHistory.set(trigger.id, executionTimes);

      const result: TriggerExecutionResult = {
        triggerId: trigger.id,
        success: actionsFailed === 0,
        executedAt: new Date().toISOString(),
        executionTimeMs: Date.now() - startTime,
        actionsExecuted,
        actionsFailed
      };

      console.log(`[TriggerEngine] Trigger executed: ${trigger.id} (${result.executionTimeMs}ms)`);

      return result;
    } catch (error) {
      return {
        triggerId: trigger.id,
        success: false,
        executedAt: new Date().toISOString(),
        executionTimeMs: Date.now() - startTime,
        actionsExecuted: 0,
        actionsFailed: trigger.actions.length,
        error: {
          code: 'TRIGGER_EXECUTION_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  /**
   * Execute an action
   */
  private async executeAction(action: TriggerAction, context: Record<string, unknown>): Promise<void> {
    switch (action.type) {
      case 'workflow':
        // Start workflow (will be implemented in workflow_engine)
        console.log('[TriggerEngine] Starting workflow:', action.config);
        break;

      case 'pipeline':
        // Execute pipeline
        console.log('[TriggerEngine] Executing pipeline:', action.config);
        break;

      case 'notification':
        // Send notification
        console.log('[TriggerEngine] Sending notification:', action.config);
        break;

      case 'webhook':
        // Call webhook
        const webhookUrl = action.config.url as string;
        if (webhookUrl) {
          await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ context, action: action.config })
          });
        }
        break;

      case 'script':
        // Execute custom script (eval with caution!)
        console.log('[TriggerEngine] Executing script:', action.config);
        break;
    }
  }

  /**
   * Evaluate a condition
   */
  private evaluateCondition(
    condition: TriggerCondition | LogicalCondition,
    data: unknown
  ): boolean {
    // Check if it's a logical condition
    if ('operator' in condition && (condition.operator === 'and' || condition.operator === 'or' || condition.operator === 'not')) {
      return this.evaluateLogicalCondition(condition as LogicalCondition, data);
    }

    // Single condition
    const cond = condition as TriggerCondition;
    const value = this.getFieldValue(data, cond.field);

    switch (cond.operator) {
      case 'equals':
        return value === cond.value;
      case 'not_equals':
        return value !== cond.value;
      case 'greater_than':
        return typeof value === 'number' && typeof cond.value === 'number' && value > cond.value;
      case 'less_than':
        return typeof value === 'number' && typeof cond.value === 'number' && value < cond.value;
      case 'greater_than_or_equal':
        return typeof value === 'number' && typeof cond.value === 'number' && value >= cond.value;
      case 'less_than_or_equal':
        return typeof value === 'number' && typeof cond.value === 'number' && value <= cond.value;
      case 'contains':
        return typeof value === 'string' && typeof cond.value === 'string' && value.includes(cond.value);
      case 'not_contains':
        return typeof value === 'string' && typeof cond.value === 'string' && !value.includes(cond.value);
      case 'in':
        return Array.isArray(cond.value) && cond.value.includes(value);
      case 'not_in':
        return Array.isArray(cond.value) && !cond.value.includes(value);
      case 'matches':
        return typeof value === 'string' && typeof cond.value === 'string' && new RegExp(cond.value).test(value);
      case 'exists':
        return value !== undefined && value !== null;
      case 'not_exists':
        return value === undefined || value === null;
      default:
        return false;
    }
  }

  /**
   * Evaluate logical condition
   */
  private evaluateLogicalCondition(condition: LogicalCondition, data: unknown): boolean {
    const results = condition.conditions.map(c => this.evaluateCondition(c, data));

    switch (condition.operator) {
      case 'and':
        return results.every(r => r);
      case 'or':
        return results.some(r => r);
      case 'not':
        return !results[0];
      default:
        return false;
    }
  }

  /**
   * Get field value from data object
   */
  private getFieldValue(data: unknown, field: string): unknown {
    if (!data || typeof data !== 'object') {
      return undefined;
    }

    const parts = field.split('.');
    let current: any = data;

    for (const part of parts) {
      if (current === undefined || current === null) {
        return undefined;
      }
      current = current[part];
    }

    return current;
  }

  /**
   * Check rate limit
   */
  private checkRateLimit(triggerId: string, rateLimit: { maxExecutions: number; windowMs: number }): boolean {
    const executions = this.executionHistory.get(triggerId) || [];
    const now = Date.now();
    const windowStart = now - rateLimit.windowMs;

    // Filter executions within window
    const recentExecutions = executions.filter(time => time >= windowStart);
    
    // Update history
    this.executionHistory.set(triggerId, recentExecutions);

    return recentExecutions.length < rateLimit.maxExecutions;
  }

  /**
   * Check threshold
   */
  private checkThreshold(value: number, operator: string, threshold: number): boolean {
    switch (operator) {
      case 'greater_than':
        return value > threshold;
      case 'less_than':
        return value < threshold;
      case 'equals':
        return value === threshold;
      default:
        return false;
    }
  }

  /**
   * Get metric value (simplified - in production, query from actual metrics)
   */
  private async getMetricValue(metric: string): Promise<number> {
    // This is a placeholder - implement actual metric retrieval
    return 0;
  }

  /**
   * Get all triggers
   */
  getTriggers(options?: {
    enabled?: boolean;
    type?: TriggerType;
  }): TriggerDefinition[] {
    let triggers = Array.from(this.triggers.values());

    if (options?.enabled !== undefined) {
      triggers = triggers.filter(t => t.enabled === options.enabled);
    }

    if (options?.type) {
      triggers = triggers.filter(t => t.type === options.type);
    }

    return triggers.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Get trigger by ID
   */
  getTrigger(triggerId: string): TriggerDefinition | undefined {
    return this.triggers.get(triggerId);
  }

  /**
   * Persist trigger to database
   */
  private async persistTrigger(trigger: TriggerDefinition): Promise<void> {
    try {
      const supabase = createServiceRoleClient();

      await supabase.from('vanguard_background_tasks').upsert({
        task_type: 'trigger',
        task_key: trigger.id,
        status: trigger.enabled ? 'pending' : 'paused',
        payload: trigger,
        priority: trigger.priority,
        scheduled_for: trigger.schedule?.startDate || new Date().toISOString()
      });
    } catch (error) {
      console.error('[TriggerEngine] Failed to persist trigger:', error);
    }
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalTriggers: number;
    enabledTriggers: number;
    disabledTriggers: number;
    triggersByType: Record<TriggerType, number>;
    totalExecutions: number;
  } {
    const triggers = Array.from(this.triggers.values());
    const enabledCount = triggers.filter(t => t.enabled).length;
    const triggersByType: Record<TriggerType, number> = {
      event: 0,
      schedule: 0,
      threshold: 0,
      composite: 0
    };

    for (const trigger of triggers) {
      triggersByType[trigger.type]++;
    }

    const totalExecutions = triggers.reduce((sum, t) => sum + t.executionCount, 0);

    return {
      totalTriggers: triggers.length,
      enabledTriggers: enabledCount,
      disabledTriggers: triggers.length - enabledCount,
      triggersByType,
      totalExecutions
    };
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const triggerEngine = TriggerEngine.getInstance();

// ============================================================================
// Template Triggers
// ============================================================================

/**
 * Create a lead scoring trigger
 */
export async function createLeadScoringTrigger(): Promise<string> {
  return triggerEngine.registerTrigger({
    name: 'Lead Scoring Trigger',
    nameAr: 'محفز تصنيف العميل المحتمل',
    description: 'Automatically updates lead tier based on score',
    descriptionAr: 'يحدث تصنيف العميل تلقائياً بناءً على النقاط',
    type: 'event',
    enabled: true,
    priority: 10,
    eventType: 'lead:score_changed',
    conditions: {
      field: 'newScore',
      operator: 'greater_than',
      value: 70
    },
    actions: [
      {
        type: 'pipeline',
        config: {
          pipelineId: 'update_lead_tier',
          input: {
            tier: 'gold'
          }
        }
      }
    ]
  });
}

/**
 * Create a follow-up reminder trigger
 */
export async function createFollowUpTrigger(): Promise<string> {
  return triggerEngine.registerTrigger({
    name: 'Follow-up Reminder',
    nameAr: 'تذكير المتابعة',
    description: 'Reminds to follow up with leads after 24 hours',
    descriptionAr: 'يذكر بالمتابعة مع العملاء بعد 24 ساعة',
    type: 'schedule',
    enabled: true,
    priority: 5,
    schedule: {
      interval: 24 * 60 * 60 * 1000 // 24 hours
    },
    actions: [
      {
        type: 'notification',
        config: {
          channel: 'email',
          template: 'followup_reminder'
        }
      }
    ]
  });
}

/**
 * Create an escalation trigger
 */
export async function createEscalationTrigger(): Promise<string> {
  return triggerEngine.registerTrigger({
    name: 'High-Value Lead Escalation',
    nameAr: 'تصعيد العميل عالي القيمة',
    description: 'Escalates high-value leads to managers',
    descriptionAr: 'يصعّد العملاء ذوي القيمة العالية للمديرين',
    type: 'event',
    enabled: true,
    priority: 20,
    eventType: 'lead:created',
    conditions: {
      operator: 'and',
      conditions: [
        {
          field: 'score',
          operator: 'greater_than',
          value: 85
        },
        {
          field: 'tier',
          operator: 'in',
          value: ['diamond', 'gold']
        }
      ]
    },
    actions: [
      {
        type: 'notification',
        config: {
          channel: 'email',
          recipients: ['manager@example.com'],
          template: 'high_value_lead'
        }
      },
      {
        type: 'workflow',
        config: {
          workflowId: 'manager_assignment'
        }
      }
    ]
  });
}

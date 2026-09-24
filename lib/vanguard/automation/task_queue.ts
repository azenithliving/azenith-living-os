/**
 * VANGUARD Task Queue
 * 
 * قائمة انتظار المهام - جدولة وتنفيذ المهام في الخلفية
 * Background task scheduling and execution with priority queue
 */

import { createServiceRoleClient } from '@/lib/vanguard/memory/supabase_persistence';
import { eventBus } from './event_bus';

// ============================================================================
// Types
// ============================================================================

export type TaskPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type TaskStatus = 
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'paused';

export type TaskType =
  | 'workflow'
  | 'pipeline'
  | 'notification'
  | 'data_processing'
  | 'cleanup'
  | 'sync'
  | 'analytics'
  | 'custom';

export interface TaskDefinition {
  id: string;
  type: TaskType;
  name: string;
  nameAr: string;
  priority: TaskPriority;
  
  // Task payload
  payload: Record<string, unknown>;
  
  // Scheduling
  scheduledFor: string; // ISO timestamp
  recurring?: {
    cron?: string; // Cron expression
    interval?: number; // Interval in ms
    endDate?: string;
  };
  
  // Execution settings
  timeout?: number; // Task timeout in ms
  retryPolicy?: {
    maxAttempts: number;
    backoffMs: number; // Initial backoff
    backoffMultiplier?: number; // Exponential backoff multiplier
    maxBackoffMs?: number; // Maximum backoff
  };
  
  // Dependencies
  dependsOn?: string[]; // Task IDs that must complete first
  
  // Metadata
  createdBy?: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
  
  // Tracking
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  status: TaskStatus;
  attempts: number;
  lastError?: {
    code: string;
    message: string;
    timestamp: string;
  };
  result?: unknown;
}

export interface TaskExecutionContext {
  taskId: string;
  attempt: number;
  scheduledFor: string;
  startedAt: string;
  metadata?: Record<string, unknown>;
}

export type TaskHandler = (
  payload: Record<string, unknown>,
  context: TaskExecutionContext
) => Promise<unknown>;

// ============================================================================
// Task Queue
// ============================================================================

export class TaskQueue {
  private static instance: TaskQueue;
  private handlers: Map<TaskType, TaskHandler> = new Map();
  private running = false;
  private workers: Map<string, Promise<void>> = new Map();
  private maxWorkers = 5;
  private pollIntervalMs = 5000; // Check for new tasks every 5 seconds
  private pollTimer: NodeJS.Timeout | null = null;

  private constructor() {
    console.log('[TaskQueue] Initialized');
  }

  static getInstance(): TaskQueue {
    if (!TaskQueue.instance) {
      TaskQueue.instance = new TaskQueue();
    }
    return TaskQueue.instance;
  }

  /**
   * Register a task handler
   */
  registerHandler(type: TaskType, handler: TaskHandler): void {
    this.handlers.set(type, handler);
    console.log(`[TaskQueue] Registered handler for type: ${type}`);
  }

  /**
   * Schedule a task
   */
  async scheduleTask(
    type: TaskType,
    payload: Record<string, unknown>,
    options?: {
      name?: string;
      nameAr?: string;
      priority?: TaskPriority;
      scheduledFor?: Date | string;
      recurring?: {
        cron?: string;
        interval?: number;
        endDate?: string;
      };
      timeout?: number;
      retryPolicy?: {
        maxAttempts: number;
        backoffMs: number;
        backoffMultiplier?: number;
        maxBackoffMs?: number;
      };
      dependsOn?: string[];
      sessionId?: string;
      createdBy?: string;
      metadata?: Record<string, unknown>;
    }
  ): Promise<string> {
    const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    
    const scheduledFor = options?.scheduledFor
      ? (options.scheduledFor instanceof Date ? options.scheduledFor : new Date(options.scheduledFor))
      : new Date();

    const task: TaskDefinition = {
      id: taskId,
      type,
      name: options?.name || `${type}_task`,
      nameAr: options?.nameAr || `مهمة ${type}`,
      priority: options?.priority || 'MEDIUM',
      payload,
      scheduledFor: scheduledFor.toISOString(),
      recurring: options?.recurring,
      timeout: options?.timeout,
      retryPolicy: options?.retryPolicy || {
        maxAttempts: 3,
        backoffMs: 1000,
        backoffMultiplier: 2,
        maxBackoffMs: 60000
      },
      dependsOn: options?.dependsOn,
      createdBy: options?.createdBy,
      sessionId: options?.sessionId,
      metadata: options?.metadata,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'pending',
      attempts: 0
    };

    // Persist to database
    await this.persistTask(task);

    console.log(`[TaskQueue] Scheduled task: ${taskId} (${task.nameAr}) at ${task.scheduledFor}`);

    // Publish event
    await eventBus.publish('task:scheduled', {
      taskId,
      taskType: type,
      taskName: task.name,
      scheduledFor: task.scheduledFor
    }, {
      source: 'task_queue',
      sessionId: options?.sessionId
    });

    return taskId;
  }

  /**
   * Start processing tasks
   */
  async start(): Promise<void> {
    if (this.running) {
      console.log('[TaskQueue] Already running');
      return;
    }

    this.running = true;
    console.log('[TaskQueue] Starting task processing...');

    // Start polling for tasks
    this.pollTimer = setInterval(() => {
      this.processTasks().catch(error => {
        console.error('[TaskQueue] Processing error:', error);
      });
    }, this.pollIntervalMs);

    // Process immediately
    await this.processTasks();
  }

  /**
   * Stop processing tasks
   */
  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }

    this.running = false;
    console.log('[TaskQueue] Stopping task processing...');

    // Clear poll timer
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }

    // Wait for active workers to finish
    await Promise.all(Array.from(this.workers.values()));
    
    console.log('[TaskQueue] Stopped');
  }

  /**
   * Process pending tasks
   */
  private async processTasks(): Promise<void> {
    if (!this.running) {
      return;
    }

    // Check if we have available workers
    if (this.workers.size >= this.maxWorkers) {
      return;
    }

    // Fetch pending tasks from database
    const tasks = await this.fetchPendingTasks(this.maxWorkers - this.workers.size);

    for (const task of tasks) {
      // Check dependencies
      if (task.dependsOn && task.dependsOn.length > 0) {
        const depsCompleted = await this.checkDependencies(task.dependsOn);
        if (!depsCompleted) {
          continue; // Skip this task for now
        }
      }

      // Start worker
      const worker = this.executeTask(task);
      this.workers.set(task.id, worker);

      // Clean up when done
      worker.finally(() => {
        this.workers.delete(task.id);
      });
    }
  }

  /**
   * Execute a single task
   */
  private async executeTask(task: TaskDefinition): Promise<void> {
    const startTime = Date.now();
    
    console.log(`[TaskQueue] Executing task: ${task.id} (${task.nameAr}) - attempt ${task.attempts + 1}`);

    // Update task status
    task.status = 'running';
    task.startedAt = new Date().toISOString();
    task.attempts++;
    task.updatedAt = new Date().toISOString();
    await this.updateTask(task);

    // Publish event
    await eventBus.publish('task:started', {
      taskId: task.id,
      taskType: task.type,
      taskName: task.name
    }, {
      source: 'task_queue',
      sessionId: task.sessionId
    });

    // Get handler
    const handler = this.handlers.get(task.type);
    if (!handler) {
      await this.failTask(task, {
        code: 'NO_HANDLER',
        message: `No handler registered for task type: ${task.type}`
      });
      return;
    }

    // Execute with timeout
    const timeoutMs = task.timeout || 300000; // 5 minutes default
    
    try {
      const context: TaskExecutionContext = {
        taskId: task.id,
        attempt: task.attempts,
        scheduledFor: task.scheduledFor,
        startedAt: task.startedAt!,
        metadata: task.metadata
      };

      const result = await Promise.race([
        handler(task.payload, context),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Task timeout')), timeoutMs)
        )
      ]);

      // Task completed successfully
      await this.completeTask(task, result);

      const executionTime = Date.now() - startTime;
      console.log(`[TaskQueue] Task completed: ${task.id} (${executionTime}ms)`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Check if we should retry
      const shouldRetry = task.retryPolicy && task.attempts < task.retryPolicy.maxAttempts;

      if (shouldRetry) {
        // Calculate backoff
        const backoff = this.calculateBackoff(task);
        const nextScheduledFor = new Date(Date.now() + backoff);

        task.status = 'pending';
        task.scheduledFor = nextScheduledFor.toISOString();
        task.lastError = {
          code: 'TASK_ERROR',
          message: errorMessage,
          timestamp: new Date().toISOString()
        };
        task.updatedAt = new Date().toISOString();

        await this.updateTask(task);

        console.log(`[TaskQueue] Task failed, will retry: ${task.id} in ${backoff}ms`);

        // Publish event
        await eventBus.publish('task:retrying', {
          taskId: task.id,
          taskType: task.type,
          attempt: task.attempts,
          nextAttemptAt: task.scheduledFor
        }, {
          source: 'task_queue',
          sessionId: task.sessionId
        });

      } else {
        // Fail permanently
        await this.failTask(task, {
          code: 'TASK_FAILED',
          message: errorMessage
        });
      }
    }

    // Handle recurring tasks - check after potential completion
    if ((task.status as TaskStatus) === 'completed' && task.recurring) {
      await this.scheduleRecurringTask(task);
    }
  }

  /**
   * Complete a task
   */
  private async completeTask(task: TaskDefinition, result: unknown): Promise<void> {
    task.status = 'completed';
    task.completedAt = new Date().toISOString();
    task.updatedAt = new Date().toISOString();
    task.result = result;

    await this.updateTask(task);

    // Publish event
    await eventBus.publish('task:completed', {
      taskId: task.id,
      taskType: task.type,
      taskName: task.name,
      result
    }, {
      source: 'task_queue',
      sessionId: task.sessionId
    });
  }

  /**
   * Fail a task
   */
  private async failTask(task: TaskDefinition, error: { code: string; message: string }): Promise<void> {
    task.status = 'failed';
    task.completedAt = new Date().toISOString();
    task.updatedAt = new Date().toISOString();
    task.lastError = {
      ...error,
      timestamp: new Date().toISOString()
    };

    await this.updateTask(task);

    console.error(`[TaskQueue] Task failed: ${task.id}`, error);

    // Publish event
    await eventBus.publish('task:failed', {
      taskId: task.id,
      taskType: task.type,
      taskName: task.name,
      error
    }, {
      source: 'task_queue',
      sessionId: task.sessionId
    });
  }

  /**
   * Cancel a task
   */
  async cancelTask(taskId: string): Promise<boolean> {
    const supabase = createServiceRoleClient();

    const { data, error } = await supabase
      .from('vanguard_background_tasks')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('task_key', taskId)
      .eq('task_type', 'task')
      .select()
      .single();

    if (error || !data) {
      return false;
    }

    console.log(`[TaskQueue] Task cancelled: ${taskId}`);
    return true;
  }

  /**
   * Calculate backoff for retry
   */
  private calculateBackoff(task: TaskDefinition): number {
    if (!task.retryPolicy) {
      return 1000;
    }

    const { backoffMs, backoffMultiplier = 2, maxBackoffMs = 60000 } = task.retryPolicy;
    const backoff = backoffMs * Math.pow(backoffMultiplier, task.attempts - 1);
    
    return Math.min(backoff, maxBackoffMs);
  }

  /**
   * Schedule recurring task
   */
  private async scheduleRecurringTask(task: TaskDefinition): Promise<void> {
    if (!task.recurring) {
      return;
    }

    // Check end date
    if (task.recurring.endDate && new Date() > new Date(task.recurring.endDate)) {
      console.log(`[TaskQueue] Recurring task ended: ${task.id}`);
      return;
    }

    // Calculate next execution time
    let nextExecution: Date;
    
    if (task.recurring.interval) {
      nextExecution = new Date(Date.now() + task.recurring.interval);
    } else {
      // For cron, we'd need a cron parser library
      // For now, just schedule 1 day later as placeholder
      nextExecution = new Date(Date.now() + 24 * 60 * 60 * 1000);
    }

    // Schedule next occurrence
    await this.scheduleTask(task.type, task.payload, {
      name: task.name,
      nameAr: task.nameAr,
      priority: task.priority,
      scheduledFor: nextExecution,
      recurring: task.recurring,
      timeout: task.timeout,
      retryPolicy: task.retryPolicy,
      sessionId: task.sessionId,
      createdBy: task.createdBy,
      metadata: task.metadata
    });
  }

  /**
   * Check if dependencies are completed
   */
  private async checkDependencies(taskIds: string[]): Promise<boolean> {
    const supabase = createServiceRoleClient();

    const { data, error } = await supabase
      .from('vanguard_background_tasks')
      .select('status')
      .in('task_key', taskIds)
      .eq('task_type', 'task');

    if (error || !data) {
      return false;
    }

    return data.every(task => task.status === 'completed');
  }

  /**
   * Fetch pending tasks from database
   */
  private async fetchPendingTasks(limit: number): Promise<TaskDefinition[]> {
    const supabase = createServiceRoleClient();

    const { data, error } = await supabase
      .from('vanguard_background_tasks')
      .select('*')
      .eq('task_type', 'task')
      .eq('status', 'pending')
      .lte('scheduled_for', new Date().toISOString())
      .order('priority', { ascending: false })
      .order('scheduled_for', { ascending: true })
      .limit(limit);

    if (error || !data) {
      return [];
    }

    return data.map(row => ({
      id: row.task_key,
      type: row.payload.type,
      name: row.payload.name,
      nameAr: row.payload.nameAr,
      priority: row.priority as TaskPriority,
      payload: row.payload.payload,
      scheduledFor: row.scheduled_for,
      recurring: row.payload.recurring,
      timeout: row.payload.timeout,
      retryPolicy: row.payload.retryPolicy,
      dependsOn: row.payload.dependsOn,
      createdBy: row.payload.createdBy,
      sessionId: row.payload.sessionId,
      metadata: row.payload.metadata,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      startedAt: row.payload.startedAt,
      completedAt: row.payload.completedAt,
      status: row.status as TaskStatus,
      attempts: row.payload.attempts || 0,
      lastError: row.payload.lastError,
      result: row.payload.result
    }));
  }

  /**
   * Persist task to database
   */
  private async persistTask(task: TaskDefinition): Promise<void> {
    const supabase = createServiceRoleClient();

    const priorityMap: Record<TaskPriority, number> = {
      CRITICAL: 1000,
      HIGH: 100,
      MEDIUM: 10,
      LOW: 1
    };

    await supabase.from('vanguard_background_tasks').insert({
      task_type: 'task',
      task_key: task.id,
      status: task.status,
      priority: priorityMap[task.priority],
      scheduled_for: task.scheduledFor,
      payload: task
    });
  }

  /**
   * Update task in database
   */
  private async updateTask(task: TaskDefinition): Promise<void> {
    const supabase = createServiceRoleClient();

    await supabase
      .from('vanguard_background_tasks')
      .update({
        status: task.status,
        scheduled_for: task.scheduledFor,
        updated_at: task.updatedAt,
        payload: task
      })
      .eq('task_key', task.id)
      .eq('task_type', 'task');
  }

  /**
   * Get task by ID
   */
  async getTask(taskId: string): Promise<TaskDefinition | null> {
    const supabase = createServiceRoleClient();

    const { data, error } = await supabase
      .from('vanguard_background_tasks')
      .select('*')
      .eq('task_key', taskId)
      .eq('task_type', 'task')
      .single();

    if (error || !data) {
      return null;
    }

    return data.payload as TaskDefinition;
  }

  /**
   * Get statistics
   */
  async getStats(): Promise<{
    pendingTasks: number;
    runningTasks: number;
    completedTasks: number;
    failedTasks: number;
    activeWorkers: number;
  }> {
    const supabase = createServiceRoleClient();

    const { data, error } = await supabase
      .from('vanguard_background_tasks')
      .select('status')
      .eq('task_type', 'task');

    if (error || !data) {
      return {
        pendingTasks: 0,
        runningTasks: 0,
        completedTasks: 0,
        failedTasks: 0,
        activeWorkers: this.workers.size
      };
    }

    const stats = data.reduce((acc, row) => {
      acc[row.status] = (acc[row.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      pendingTasks: stats['pending'] || 0,
      runningTasks: stats['running'] || 0,
      completedTasks: stats['completed'] || 0,
      failedTasks: stats['failed'] || 0,
      activeWorkers: this.workers.size
    };
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const taskQueue = TaskQueue.getInstance();

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Schedule an immediate task
 */
export async function scheduleImmediateTask(
  type: TaskType,
  payload: Record<string, unknown>,
  options?: {
    priority?: TaskPriority;
    timeout?: number;
  }
): Promise<string> {
  return taskQueue.scheduleTask(type, payload, {
    ...options,
    scheduledFor: new Date()
  });
}

/**
 * Schedule a delayed task
 */
export async function scheduleDelayedTask(
  type: TaskType,
  payload: Record<string, unknown>,
  delayMs: number,
  options?: {
    priority?: TaskPriority;
    timeout?: number;
  }
): Promise<string> {
  return taskQueue.scheduleTask(type, payload, {
    ...options,
    scheduledFor: new Date(Date.now() + delayMs)
  });
}

/**
 * Schedule a recurring task
 */
export async function scheduleRecurringTask(
  type: TaskType,
  payload: Record<string, unknown>,
  intervalMs: number,
  options?: {
    priority?: TaskPriority;
    endDate?: string;
  }
): Promise<string> {
  return taskQueue.scheduleTask(type, payload, {
    ...options,
    scheduledFor: new Date(),
    recurring: {
      interval: intervalMs,
      endDate: options?.endDate
    }
  });
}

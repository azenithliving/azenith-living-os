import { Job } from 'bullmq';
import { EventBus } from '../events/event-bus';
import { QueueManager } from '../queues/queue-manager';
import { Logger } from '../utils/logger';
import { prisma } from '../database/prisma-client';
import { TaskType, TaskStatus, TaskPriority } from '../types';

/**
 * TaskWorker - The bridge between Queue System and Event System
 * 
 * This worker listens to the task queue and triggers appropriate
 * event handlers based on task type. It acts as the "nervous system"
 * that routes tasks to the correct agent via events.
 */

interface TaskWorkerConfig {
  concurrency?: number;
  maxAttempts?: number;
  backoffDelay?: number;
}

const DEFAULT_CONFIG: TaskWorkerConfig = {
  concurrency: 5,
  maxAttempts: 3,
  backoffDelay: 2000
};

export class TaskWorker {
  private queueManager: QueueManager;
  private eventBus: EventBus;
  private logger: Logger;
  private config: TaskWorkerConfig;
  private isRunning: boolean = false;
  private processedCount: number = 0;
  private failedCount: number = 0;

  constructor(
    queueManager: QueueManager,
    eventBus: EventBus,
    config: Partial<TaskWorkerConfig> = {}
  ) {
    this.queueManager = queueManager;
    this.eventBus = eventBus;
    this.logger = new Logger('TaskWorker');
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Start the TaskWorker
   * Registers workers for all agent queues
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('TaskWorker already running');
      return;
    }

    this.logger.info('Starting TaskWorker...', this.config as Record<string, unknown>);

    // Register workers for each agent type
    await this.registerAgentWorkers();

    // Subscribe to task lifecycle events
    await this.subscribeToEvents();

    this.isRunning = true;
    this.logger.info('TaskWorker started successfully');

    // Publish startup event
    await this.eventBus.publish({
      type: 'worker:started',
      source: 'task-worker',
      payload: {
        timestamp: new Date().toISOString(),
        config: this.config
      }
    });
  }

  /**
   * Stop the TaskWorker gracefully
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.logger.info('Stopping TaskWorker...');
    this.isRunning = false;

    // Publish shutdown event
    await this.eventBus.publish({
      type: 'worker:stopped',
      source: 'task-worker',
      payload: {
        timestamp: new Date().toISOString(),
        stats: this.getStats()
      }
    });

    this.logger.info('TaskWorker stopped');
  }

  /**
   * Register workers for each agent queue
   */
  private async registerAgentWorkers(): Promise<void> {
    const agentQueues = [
      { name: 'dev-agent', concurrency: 2 },
      { name: 'ops-agent', concurrency: 2 },
      { name: 'security-agent', concurrency: 1 },
      { name: 'qa-agent', concurrency: 2 },
      { name: 'communication-agent', concurrency: 3 },
      { name: 'evolution-agent', concurrency: 1 },
      { name: 'execution', concurrency: 2 }
    ];

    for (const { name, concurrency } of agentQueues) {
      await this.queueManager.addWorker(
        name,
        async (job) => this.processAgentJob(name, job),
        concurrency
      );
      
      this.logger.info(`Registered worker for ${name} queue`, { concurrency });
    }
  }

  /**
   * Process a job from an agent queue
   */
  private async processAgentJob(queueName: string, job: Job): Promise<unknown> {
    const { taskId, type, payload, title } = job.data;
    const startTime = Date.now();

    this.logger.info(`Processing job from ${queueName}`, {
      jobId: job.id,
      taskId,
      type,
      title
    });

    try {
      // Update task status
      await this.updateTaskStatus(taskId, TaskStatus.IN_PROGRESS);

      // Publish job:processing event
      await this.eventBus.publish({
        type: `job:processing`,
        source: queueName,
        payload: {
          jobId: job.id,
          taskId,
          type,
          queue: queueName,
          startedAt: new Date().toISOString()
        }
      });

      // Route to appropriate agent via event
      const routingEvent = this.getRoutingEvent(queueName, type);
      
      await this.eventBus.publish({
        type: routingEvent,
        source: 'task-worker',
        payload: {
          jobId: job.id,
          taskId,
          type,
          title,
          payload,
          queue: queueName,
          correlationId: this.generateCorrelationId()
        }
      });

      // Wait for agent completion (via event subscription)
      const result = await this.waitForAgentCompletion(taskId, 30000);

      // Update task with result
      await this.updateTaskStatus(taskId, TaskStatus.COMPLETED, result);

      // Publish completion event
      await this.eventBus.publish({
        type: 'job:completed',
        source: queueName,
        payload: {
          jobId: job.id,
          taskId,
          type,
          result,
          durationMs: Date.now() - startTime,
          completedAt: new Date().toISOString()
        }
      });

      this.processedCount++;

      this.logger.info(`Job completed from ${queueName}`, {
        jobId: job.id,
        taskId,
        durationMs: Date.now() - startTime
      });

      return result;

    } catch (error) {
      this.failedCount++;
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.logger.error(`Job failed from ${queueName}`, {
        jobId: job.id,
        taskId,
        error: errorMessage
      });

      // Update task status
      await this.updateTaskStatus(taskId, TaskStatus.FAILED, undefined, errorMessage);

      // Publish failure event
      await this.eventBus.publish({
        type: 'job:failed',
        source: queueName,
        payload: {
          jobId: job.id,
          taskId,
          type,
          error: errorMessage,
          failedAt: new Date().toISOString()
        }
      });

      throw error;
    }
  }

  /**
   * Get the routing event type based on queue and task type
   */
  private getRoutingEvent(queueName: string, taskType: string): string {
    const routingMap: Record<string, string> = {
      'dev-agent': 'agent:dev:process',
      'ops-agent': 'agent:ops:process',
      'security-agent': 'agent:security:process',
      'qa-agent': 'agent:qa:process',
      'communication-agent': 'agent:communication:process',
      'evolution-agent': 'agent:evolution:process',
      'execution': 'execution:process'
    };

    return routingMap[queueName] || `agent:${queueName}:process`;
  }

  /**
   * Subscribe to task lifecycle events
   */
  private async subscribeToEvents(): Promise<void> {
    // Subscribe to task:created events
    await this.eventBus.subscribe('task:created', {
      eventType: 'task:created',
      handler: async (event) => {
        const { taskId, type, priority } = event.payload as Record<string, unknown>;
        
        this.logger.info('Task created event received', { taskId, type });

        // Auto-queue high priority tasks
        if (priority === TaskPriority.CRITICAL || priority === TaskPriority.HIGH) {
          await this.queueManager.addJob(
            'orchestrator',
            'auto-queue',
            { taskId, type, priority, auto: true },
            { priority: priority === TaskPriority.CRITICAL ? 1 : 2 }
          );
        }
      }
    });

    // Subscribe to agent:complete events
    await this.eventBus.subscribe('agent:complete', {
      eventType: 'agent:complete',
      handler: async (event) => {
        const { taskId, result } = event.payload as Record<string, unknown>;
        
        this.logger.info('Agent completed event received', { taskId });
        
        // Store completion in memory for waitForAgentCompletion
        this.agentResults.set(taskId as string, { status: 'completed', result });
      }
    });

    // Subscribe to agent:error events
    await this.eventBus.subscribe('agent:error', {
      eventType: 'agent:error',
      handler: async (event) => {
        const { taskId, error } = event.payload as Record<string, unknown>;
        
        this.logger.error('Agent error event received', { taskId, error });
        
        // Store error in memory
        this.agentResults.set(taskId as string, { status: 'error', error });
      }
    });

    this.logger.info('Subscribed to task lifecycle events');
  }

  /**
   * In-memory store for agent results (for correlation)
   */
  private agentResults: Map<string, { status: string; result?: unknown; error?: string }> = new Map();

  /**
   * Wait for agent completion via events
   */
  private async waitForAgentCompletion(taskId: string, timeoutMs: number): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const checkInterval = setInterval(() => {
        const result = this.agentResults.get(taskId);
        
        if (result) {
          clearInterval(checkInterval);
          this.agentResults.delete(taskId);
          
          if (result.status === 'completed') {
            resolve(result.result);
          } else {
            reject(new Error(result.error || 'Agent processing failed'));
          }
          return;
        }

        if (Date.now() - startTime > timeoutMs) {
          clearInterval(checkInterval);
          reject(new Error(`Timeout waiting for agent completion: ${taskId}`));
        }
      }, 100);
    });
  }

  /**
   * Update task status in database
   */
  private async updateTaskStatus(
    taskId: string,
    status: TaskStatus,
    result?: unknown,
    error?: string
  ): Promise<void> {
    const updateData: Record<string, unknown> = { status };

    if (result !== undefined) {
      updateData.result = result;
    }

    if (error) {
      updateData.error = error;
    }

    if (status === TaskStatus.IN_PROGRESS) {
      updateData.startedAt = new Date();
    }

    if (status === TaskStatus.COMPLETED || status === TaskStatus.FAILED) {
      updateData.completedAt = new Date();
    }

    await prisma.aITask.update({
      where: { id: taskId },
      data: updateData
    });

    // Publish task status change event
    await this.eventBus.publish({
      type: `task:${status.toLowerCase()}`,
      source: 'task-worker',
      payload: {
        taskId,
        status,
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Get worker statistics
   */
  getStats(): {
    isRunning: boolean;
    processedCount: number;
    failedCount: number;
    successRate: number;
  } {
    const total = this.processedCount + this.failedCount;
    return {
      isRunning: this.isRunning,
      processedCount: this.processedCount,
      failedCount: this.failedCount,
      successRate: total > 0 ? (this.processedCount / total) * 100 : 0
    };
  }

  /**
   * Generate unique correlation ID
   */
  private generateCorrelationId(): string {
    return `corr-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Singleton instance
let taskWorkerInstance: TaskWorker | null = null;

export function getTaskWorker(
  queueManager: QueueManager,
  eventBus: EventBus,
  config?: Partial<TaskWorkerConfig>
): TaskWorker {
  if (!taskWorkerInstance) {
    taskWorkerInstance = new TaskWorker(queueManager, eventBus, config);
  }
  return taskWorkerInstance;
}

export function resetTaskWorker(): void {
  taskWorkerInstance = null;
}

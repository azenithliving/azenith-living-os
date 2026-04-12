import { Queue, Worker, Job, QueueScheduler } from 'bullmq';
import IORedis from 'ioredis';
import { QueueJob, LogLevel, TaskPriority } from '../types';
import { Logger } from '../utils/logger';
import { EventBus } from '../events/event-bus';

interface QueueConfig {
  name: string;
  redisConnection: IORedis;
  defaultJobOptions?: {
    attempts?: number;
    backoff?: {
      type: 'fixed' | 'exponential';
      delay: number;
    };
    removeOnComplete?: boolean | number;
    removeOnFail?: boolean | number;
  };
}

interface WorkerConfig {
  queueName: string;
  concurrency?: number;
  limiter?: {
    max: number;
    duration: number;
  };
}

type JobProcessor = (job: Job) => Promise<unknown>;

export class QueueManager {
  private queues: Map<string, Queue> = new Map();
  private workers: Map<string, Worker> = new Map();
  private schedulers: Map<string, QueueScheduler> = new Map();
  private processors: Map<string, JobProcessor> = new Map();
  private redisConnection: IORedis;
  private logger: Logger;
  private eventBus: EventBus;

  constructor(redisUrl: string, eventBus: EventBus) {
    this.redisConnection = new IORedis(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false
    });
    this.logger = new Logger('QueueManager');
    this.eventBus = eventBus;
  }

  async initialize(): Promise<void> {
    this.logger.info('QueueManager initialized');
    
    // Setup default queues
    await this.createQueue('orchestrator', {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 }
    });
    
    await this.createQueue('dev-agent', {
      attempts: 2,
      backoff: { type: 'fixed', delay: 5000 }
    });
    
    await this.createQueue('ops-agent', {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 }
    });
    
    await this.createQueue('security-agent', {
      attempts: 2,
      backoff: { type: 'fixed', delay: 3000 }
    });
    
    await this.createQueue('qa-agent', {
      attempts: 2,
      backoff: { type: 'exponential', delay: 5000 }
    });
    
    await this.createQueue('communication-agent', {
      attempts: 5,
      backoff: { type: 'fixed', delay: 1000 },
      removeOnComplete: 100,
      removeOnFail: 50
    });
    
    await this.createQueue('evolution-agent', {
      attempts: 1,
      backoff: { type: 'fixed', delay: 10000 }
    });
    
    await this.createQueue('execution', {
      attempts: 1,
      backoff: { type: 'fixed', delay: 1000 }
    });
    
    await this.createQueue('approval', {
      attempts: 5,
      backoff: { type: 'exponential', delay: 60000 },
      removeOnComplete: 200,
      removeOnFail: 100
    });

    this.logger.info('All queues created successfully');
  }

  async createQueue(
    name: string, 
    defaultJobOptions?: QueueConfig['defaultJobOptions']
  ): Promise<Queue> {
    if (this.queues.has(name)) {
      return this.queues.get(name)!;
    }

    const queue = new Queue(name, {
      connection: this.redisConnection,
      defaultJobOptions: {
        attempts: defaultJobOptions?.attempts ?? 3,
        backoff: defaultJobOptions?.backoff ?? { type: 'exponential', delay: 2000 },
        removeOnComplete: defaultJobOptions?.removeOnComplete ?? 100,
        removeOnFail: defaultJobOptions?.removeOnFail ?? 50
      }
    });

    // Add queue event listeners
    queue.on('waiting', (jobId) => {
      this.logger.debug('Job waiting', { queue: name, jobId });
    });

    queue.on('active', (job) => {
      this.logger.debug('Job active', { queue: name, jobId: job.id });
      this.publishQueueEvent('job:started', name, job);
    });

    queue.on('completed', (job, result) => {
      this.logger.info('Job completed', { queue: name, jobId: job.id });
      this.publishQueueEvent('job:completed', name, job, result);
    });

    queue.on('failed', (job, err) => {
      this.logger.error('Job failed', { 
        queue: name, 
        jobId: job?.id,
        error: err.message,
        attempts: job?.attemptsMade 
      });
      this.publishQueueEvent('job:failed', name, job, undefined, err.message);
    });

    queue.on('stalled', (jobId) => {
      this.logger.warn('Job stalled', { queue: name, jobId });
      this.publishQueueEvent('job:stalled', name, { id: jobId } as Job);
    });

    this.queues.set(name, queue);
    this.logger.info('Queue created', { name });
    
    return queue;
  }

  async addWorker(
    queueName: string, 
    processor: JobProcessor, 
    concurrency: number = 1
  ): Promise<Worker> {
    if (this.workers.has(queueName)) {
      this.logger.warn('Worker already exists', { queueName });
      return this.workers.get(queueName)!;
    }

    this.processors.set(queueName, processor);

    const worker = new Worker(
      queueName,
      async (job) => {
        this.logger.info('Processing job', { 
          queue: queueName, 
          jobId: job.id,
          name: job.name 
        });

        try {
          const result = await processor(job);
          
          this.logger.info('Job processed successfully', { 
            queue: queueName, 
            jobId: job.id 
          });
          
          return result;
        } catch (error) {
          this.logger.error('Job processing error', {
            queue: queueName,
            jobId: job.id,
            error: error instanceof Error ? error.message : String(error)
          });
          throw error;
        }
      },
      {
        connection: this.redisConnection,
        concurrency,
        lockDuration: 30000,
        stalledInterval: 30000,
        maxStalledCount: 3
      }
    );

    worker.on('error', (err) => {
      this.logger.error('Worker error', { 
        queue: queueName, 
        error: err.message 
      });
    });

    this.workers.set(queueName, worker);
    this.logger.info('Worker added', { queueName, concurrency });
    
    return worker;
  }

  async addJob(
    queueName: string, 
    name: string, 
    data: Record<string, unknown>, 
    options?: {
      priority?: number;
      delay?: number;
      attempts?: number;
      backoff?: { type: 'fixed' | 'exponential'; delay: number };
      jobId?: string;
      removeOnComplete?: boolean | number;
      removeOnFail?: boolean | number;
    }
  ): Promise<Job> {
    const queue = this.queues.get(queueName);
    
    if (!queue) {
      throw new Error(`Queue ${queueName} does not exist`);
    }

    const job = await queue.add(name, data, {
      priority: options?.priority,
      delay: options?.delay,
      attempts: options?.attempts,
      backoff: options?.backoff,
      jobId: options?.jobId,
      removeOnComplete: options?.removeOnComplete,
      removeOnFail: options?.removeOnFail
    });

    this.logger.info('Job added to queue', { 
      queue: queueName, 
      jobId: job.id,
      name 
    });

    return job;
  }

  async getJob(queueName: string, jobId: string): Promise<Job | undefined> {
    const queue = this.queues.get(queueName);
    if (!queue) return undefined;
    return queue.getJob(jobId);
  }

  async removeJob(queueName: string, jobId: string): Promise<void> {
    const job = await this.getJob(queueName, jobId);
    if (job) {
      await job.remove();
      this.logger.info('Job removed', { queue: queueName, jobId });
    }
  }

  async pauseQueue(queueName: string): Promise<void> {
    const queue = this.queues.get(queueName);
    if (queue) {
      await queue.pause();
      this.logger.info('Queue paused', { queueName });
    }
  }

  async resumeQueue(queueName: string): Promise<void> {
    const queue = this.queues.get(queueName);
    if (queue) {
      await queue.resume();
      this.logger.info('Queue resumed', { queueName });
    }
  }

  async getQueueStatus(queueName: string): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    paused: boolean;
  }> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} does not exist`);
    }

    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount()
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
      paused: await queue.isPaused()
    };
  }

  async cleanQueue(
    queueName: string, 
    gracePeriodMs: number, 
    status: 'completed' | 'failed' = 'completed'
  ): Promise<string[]> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} does not exist`);
    }

    return queue.clean(gracePeriodMs, 0, status);
  }

  async close(): Promise<void> {
    this.logger.info('Closing QueueManager...');

    // Close all workers
    for (const [name, worker] of this.workers) {
      await worker.close();
      this.logger.debug('Worker closed', { name });
    }

    // Close all queues
    for (const [name, queue] of this.queues) {
      await queue.close();
      this.logger.debug('Queue closed', { name });
    }

    // Disconnect Redis
    await this.redisConnection.quit();
    
    this.logger.info('QueueManager closed');
  }

  private publishQueueEvent(
    eventType: string, 
    queueName: string, 
    job: Job, 
    result?: unknown,
    error?: string
  ): void {
    this.eventBus.publish({
      type: `queue:${eventType}`,
      source: 'queue-manager',
      payload: {
        queue: queueName,
        jobId: job.id,
        jobName: job.name,
        data: job.data,
        result,
        error,
        timestamp: new Date().toISOString()
      }
    }).catch(err => {
      this.logger.error('Failed to publish queue event', { error: err.message });
    });
  }

  getQueueNames(): string[] {
    return Array.from(this.queues.keys());
  }

  getWorkerNames(): string[] {
    return Array.from(this.workers.keys());
  }
}

// Singleton instance
let queueManagerInstance: QueueManager | null = null;

export function getQueueManager(redisUrl: string, eventBus: EventBus): QueueManager {
  if (!queueManagerInstance) {
    queueManagerInstance = new QueueManager(redisUrl, eventBus);
  }
  return queueManagerInstance;
}

export function resetQueueManager(): void {
  queueManagerInstance = null;
}

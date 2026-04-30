import { Job, Worker, Job as BullMQJob } from 'bullmq';
import { IORedis } from 'ioredis';
import { databaseService } from '../database/database-service';
import { EventBus } from '../events/event-bus';
import { Logger } from '../utils/logger';
import { TaskPriority, LogLevel } from '../types';

interface WorkerConfig {
  queueName: string;
  concurrency?: number;
  limiter?: {
    max: number;
    duration: number;
  };
  lockDuration?: number;
  stalledInterval?: number;
  maxStalledCount?: number;
}

interface JobContext {
  jobId: string;
  queueName: string;
  attempt: number;
  startTime: Date;
  traceId: string;
}

interface JobResult {
  success: boolean;
  output?: Record<string, unknown>;
  error?: string;
  durationMs: number;
}

abstract class BaseWorker {
  protected worker: Worker | null = null;
  protected logger: Logger;
  protected queueName: string;
  protected concurrency: number;
  protected redisConnection: IORedis;
  protected eventBus: EventBus;
  protected isRunning: boolean = false;

  constructor(
    config: WorkerConfig,
    redisConnection: IORedis,
    eventBus: EventBus
  ) {
    this.queueName = config.queueName;
    this.concurrency = config.concurrency ?? 1;
    this.redisConnection = redisConnection;
    this.eventBus = eventBus;
    this.logger = new Logger(`Worker:${this.queueName}`);
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Worker already running');
      return;
    }

    this.worker = new Worker(
      this.queueName,
      async (job: Job) => this.processJobWrapper(job),
      {
        connection: this.redisConnection,
        concurrency: this.concurrency,
        lockDuration: 30000,
        stalledInterval: 30000,
        maxStalledCount: 3
      }
    );

    this.setupEventHandlers();
    this.isRunning = true;

    this.logger.info('Worker started', {
      queue: this.queueName,
      concurrency: this.concurrency
    });

    await this.logWorkerEvent('worker:started', {
      queueName: this.queueName,
      concurrency: this.concurrency
    });
  }

  async stop(): Promise<void> {
    if (!this.isRunning || !this.worker) {
      return;
    }

    await this.worker.close();
    this.isRunning = false;

    this.logger.info('Worker stopped', { queue: this.queueName });

    await this.logWorkerEvent('worker:stopped', {
      queueName: this.queueName
    });
  }

  protected abstract processJob(
    job: Job,
    context: JobContext
  ): Promise<JobResult>;

  private async processJobWrapper(job: Job): Promise<unknown> {
    const context: JobContext = {
      jobId: job.id ?? 'unknown',
      queueName: this.queueName,
      attempt: job.attemptsMade + 1,
      startTime: new Date(),
      traceId: `trace-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
    };

    this.logger.info('Processing job', {
      jobId: context.jobId,
      name: job.name,
      attempt: context.attempt,
      traceId: context.traceId
    });

    await this.logJobLifecycle(job, 'started', context);

    try {
      const result = await this.processJob(job, context);
      const durationMs = Date.now() - context.startTime.getTime();

      if (result.success) {
        this.logger.info('Job completed successfully', {
          jobId: context.jobId,
          durationMs,
          traceId: context.traceId
        });

        await this.logJobLifecycle(job, 'completed', context, result, durationMs);
        await this.publishJobEvent('job:completed', job, result, context, durationMs);

        return result.output;
      } else {
        throw new Error(result.error ?? 'Job processing failed');
      }
    } catch (error) {
      const durationMs = Date.now() - context.startTime.getTime();
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.logger.error('Job processing failed', {
        jobId: context.jobId,
        error: errorMessage,
        attempt: context.attempt,
        traceId: context.traceId
      });

      await this.logJobLifecycle(job, 'failed', context, undefined, durationMs, errorMessage);
      await this.publishJobEvent('job:failed', job, undefined, context, durationMs, errorMessage);

      throw error;
    }
  }

  private setupEventHandlers(): void {
    if (!this.worker) return;

    this.worker.on('error', (err: Error) => {
      this.logger.error('Worker error', {
        error: err.message,
        queue: this.queueName
      });
    });

    this.worker.on('failed', (job: BullMQJob | undefined, err: Error) => {
      this.logger.error('Job failed in worker', {
        jobId: job?.id,
        error: err.message,
        queue: this.queueName
      });
    });

    this.worker.on('stalled', (jobId: string) => {
      this.logger.warn('Job stalled', {
        jobId,
        queue: this.queueName
      });

      this.logWorkerEvent('job:stalled', { jobId, queueName: this.queueName }).catch(() => {
        // Silent fail
      });
    });
  }

  private async logJobLifecycle(
    job: Job,
    status: 'started' | 'completed' | 'failed',
    context: JobContext,
    result?: JobResult,
    durationMs?: number,
    error?: string
  ): Promise<void> {
    try {
      const prisma = databaseService.getClient();

      await prisma.jobQueue.create({
        data: {
          name: job.name,
          queueType: this.queueName,
          config: {
            jobId: context.jobId,
            status,
            attempt: context.attempt,
            traceId: context.traceId,
            data: job.data,
            result: result?.output ?? null,
            error: error ?? null,
            durationMs: durationMs ?? null,
            timestamp: new Date().toISOString()
          }
        }
      });
    } catch (err) {
      this.logger.error('Failed to log job lifecycle', {
        error: err instanceof Error ? err.message : String(err),
        jobId: context.jobId
      });
    }
  }

  private async logWorkerEvent(
    eventType: string,
    payload: Record<string, unknown>
  ): Promise<void> {
    try {
      await this.eventBus.publish({
        type: `worker:${eventType}`,
        source: this.queueName,
        payload: {
          ...payload,
          timestamp: new Date().toISOString()
        }
      });
    } catch (err) {
      this.logger.error('Failed to publish worker event', {
        error: err instanceof Error ? err.message : String(err)
      });
    }
  }

  private async publishJobEvent(
    eventType: 'job:completed' | 'job:failed',
    job: Job,
    result: JobResult | undefined,
    context: JobContext,
    durationMs: number,
    error?: string
  ): Promise<void> {
    try {
      await this.eventBus.publish({
        type: eventType,
        source: this.queueName,
        payload: {
          jobId: context.jobId,
          jobName: job.name,
          queueName: this.queueName,
          attempt: context.attempt,
          traceId: context.traceId,
          data: job.data,
          result: result?.output ?? null,
          error: error ?? null,
          durationMs,
          timestamp: new Date().toISOString()
        }
      });
    } catch (err) {
      this.logger.error('Failed to publish job event', {
        error: err instanceof Error ? err.message : String(err),
        jobId: context.jobId
      });
    }
  }

  isHealthy(): boolean {
    return this.isRunning && this.worker !== null;
  }

  getQueueName(): string {
    return this.queueName;
  }

  getConcurrency(): number {
    return this.concurrency;
  }
}

export { BaseWorker };
export type { WorkerConfig, JobContext, JobResult };
export default BaseWorker;

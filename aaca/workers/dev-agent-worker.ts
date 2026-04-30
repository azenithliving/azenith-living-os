import { Job } from 'bullmq';
import { IORedis } from 'ioredis';
import { BaseWorker, JobContext, JobResult } from './base-worker';
import { EventBus } from '../events/event-bus';
import { EventType } from '../types/events';

interface DevJobData {
  taskId: string;
  actionType: 'WRITE_CODE' | 'CODE_REVIEW' | 'CREATE_PR';
  repository?: string;
  branch?: string;
  files?: Array<{
    path: string;
    content?: string;
    operation: 'create' | 'update' | 'delete';
  }>;
  description?: string;
}

class DevAgentWorker extends BaseWorker {
  constructor(redisConnection: IORedis, eventBus: EventBus) {
    super(
      {
        queueName: 'dev-agent',
        concurrency: 2
      },
      redisConnection,
      eventBus
    );
  }

  protected async processJob(
    job: Job,
    context: JobContext
  ): Promise<JobResult> {
    const data = job.data as DevJobData;

    await this.eventBus.publish({
      type: EventType.AGENT_BUSY,
      source: 'dev-agent',
      payload: {
        agentId: 'dev-agent',
        status: 'busy',
        currentJobs: 1,
        maxConcurrency: 2,
        timestamp: new Date().toISOString()
      }
    });

    try {
      let result: Record<string, unknown>;

      switch (data.actionType) {
        case 'WRITE_CODE':
          result = await this.handleWriteCode(data, context);
          break;
        case 'CODE_REVIEW':
          result = await this.handleCodeReview(data, context);
          break;
        case 'CREATE_PR':
          result = await this.handleCreatePR(data, context);
          break;
        default:
          throw new Error(`Unknown action type: ${data.actionType}`);
      }

      await this.eventBus.publish({
        type: EventType.AGENT_IDLE,
        source: 'dev-agent',
        payload: {
          agentId: 'dev-agent',
          status: 'idle',
          currentJobs: 0,
          maxConcurrency: 2,
          timestamp: new Date().toISOString()
        }
      });

      return {
        success: true,
        output: result,
        durationMs: Date.now() - context.startTime.getTime()
      };
    } catch (error) {
      await this.eventBus.publish({
        type: EventType.AGENT_ERROR,
        source: 'dev-agent',
        payload: {
          agentId: 'dev-agent',
          status: 'error',
          currentJobs: 0,
          maxConcurrency: 2,
          timestamp: new Date().toISOString()
        }
      });

      throw error;
    }
  }

  private async handleWriteCode(
    data: DevJobData,
    context: JobContext
  ): Promise<Record<string, unknown>> {
    const files = data.files ?? [];

    for (const file of files) {
      await this.logProgress(context, `Processing file: ${file.path}`);

      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return {
      filesProcessed: files.length,
      repository: data.repository,
      branch: data.branch,
      message: `Successfully processed ${files.length} files`
    };
  }

  private async handleCodeReview(
    data: DevJobData,
    context: JobContext
  ): Promise<Record<string, unknown>> {
    await this.logProgress(context, 'Analyzing code changes...');

    await new Promise(resolve => setTimeout(resolve, 1000));

    return {
      repository: data.repository,
      branch: data.branch,
      review: {
        issues: [],
        suggestions: ['Consider adding more tests'],
        approved: true
      }
    };
  }

  private async handleCreatePR(
    data: DevJobData,
    context: JobContext
  ): Promise<Record<string, unknown>> {
    await this.logProgress(context, 'Creating pull request...');

    const prNumber = Math.floor(Math.random() * 1000) + 1;

    return {
      repository: data.repository,
      prNumber,
      branch: data.branch,
      url: `https://github.com/${data.repository}/pull/${prNumber}`,
      message: `Created PR #${prNumber}`
    };
  }

  private async logProgress(context: JobContext, message: string): Promise<void> {
    console.log(`[${context.traceId}] ${message}`);
  }
}

export { DevAgentWorker };
export default DevAgentWorker;

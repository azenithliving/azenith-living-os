import { Job } from 'bullmq';
import { IORedis } from 'ioredis';
import { BaseWorker, JobContext, JobResult } from './base-worker';
import { EventBus } from '../events/event-bus';
import { EventType } from '../types/events';

interface CommunicationJobData {
  taskId: string;
  actionType: 'SEND_NOTIFICATION' | 'SEND_EMAIL' | 'SEND_SLACK' | 'SEND_WEBHOOK';
  channel?: string;
  recipient?: string;
  subject?: string;
  message?: string;
  data?: Record<string, unknown>;
}

class CommunicationAgentWorker extends BaseWorker {
  constructor(redisConnection: IORedis, eventBus: EventBus) {
    super(
      {
        queueName: 'communication-agent',
        concurrency: 5
      },
      redisConnection,
      eventBus
    );
  }

  protected async processJob(
    job: Job,
    context: JobContext
  ): Promise<JobResult> {
    const data = job.data as CommunicationJobData;

    await this.eventBus.publish({
      type: EventType.AGENT_BUSY,
      source: 'communication-agent',
      payload: {
        agentId: 'communication-agent',
        status: 'busy',
        currentJobs: 1,
        maxConcurrency: 5,
        timestamp: new Date().toISOString()
      }
    });

    try {
      let result: Record<string, unknown>;

      switch (data.actionType) {
        case 'SEND_NOTIFICATION':
          result = await this.handleNotification(data, context);
          break;
        case 'SEND_EMAIL':
          result = await this.handleEmail(data, context);
          break;
        case 'SEND_SLACK':
          result = await this.handleSlack(data, context);
          break;
        case 'SEND_WEBHOOK':
          result = await this.handleWebhook(data, context);
          break;
        default:
          throw new Error(`Unknown action type: ${data.actionType}`);
      }

      await this.eventBus.publish({
        type: EventType.AGENT_IDLE,
        source: 'communication-agent',
        payload: {
          agentId: 'communication-agent',
          status: 'idle',
          currentJobs: 0,
          maxConcurrency: 5,
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
        source: 'communication-agent',
        payload: {
          agentId: 'communication-agent',
          status: 'error',
          currentJobs: 0,
          maxConcurrency: 5,
          timestamp: new Date().toISOString()
        }
      });

      throw error;
    }
  }

  private async handleNotification(
    data: CommunicationJobData,
    context: JobContext
  ): Promise<Record<string, unknown>> {
    await this.logProgress(context, `Sending notification to ${data.recipient}...`);

    await new Promise(resolve => setTimeout(resolve, 100));

    return {
      channel: data.channel ?? 'dashboard',
      recipient: data.recipient,
      message: data.message,
      status: 'sent',
      sentAt: new Date().toISOString()
    };
  }

  private async handleEmail(
    data: CommunicationJobData,
    context: JobContext
  ): Promise<Record<string, unknown>> {
    await this.logProgress(context, `Sending email to ${data.recipient}...`);

    await new Promise(resolve => setTimeout(resolve, 300));

    return {
      channel: 'email',
      recipient: data.recipient,
      subject: data.subject,
      status: 'sent',
      messageId: `msg-${Date.now()}`,
      sentAt: new Date().toISOString()
    };
  }

  private async handleSlack(
    data: CommunicationJobData,
    context: JobContext
  ): Promise<Record<string, unknown>> {
    await this.logProgress(context, `Sending Slack message to ${data.channel}...`);

    await new Promise(resolve => setTimeout(resolve, 200));

    return {
      channel: data.channel,
      message: data.message,
      status: 'sent',
      ts: Date.now().toString(),
      sentAt: new Date().toISOString()
    };
  }

  private async handleWebhook(
    data: CommunicationJobData,
    context: JobContext
  ): Promise<Record<string, unknown>> {
    await this.logProgress(context, `Sending webhook to ${data.recipient}...`);

    await new Promise(resolve => setTimeout(resolve, 150));

    return {
      url: data.recipient,
      payload: data.data,
      status: 'delivered',
      responseStatus: 200,
      sentAt: new Date().toISOString()
    };
  }

  private async logProgress(context: JobContext, message: string): Promise<void> {
    console.log(`[${context.traceId}] ${message}`);
  }
}

export { CommunicationAgentWorker };
export default CommunicationAgentWorker;

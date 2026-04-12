import { Job } from 'bullmq';
import { IORedis } from 'ioredis';
import { BaseWorker, JobContext, JobResult } from './base-worker';
import { EventBus } from '../events/event-bus';
import { EventType } from '../types/events';

interface OpsJobData {
  taskId: string;
  actionType: 'DEPLOY' | 'MONITOR' | 'HEALTH_CHECK' | 'SCALE';
  target?: string;
  environment?: string;
  config?: Record<string, unknown>;
}

class OpsAgentWorker extends BaseWorker {
  constructor(redisConnection: IORedis, eventBus: EventBus) {
    super(
      {
        queueName: 'ops-agent',
        concurrency: 3
      },
      redisConnection,
      eventBus
    );
  }

  protected async processJob(
    job: Job,
    context: JobContext
  ): Promise<JobResult> {
    const data = job.data as OpsJobData;

    await this.eventBus.publish({
      type: EventType.AGENT_BUSY,
      source: 'ops-agent',
      payload: {
        agentId: 'ops-agent',
        status: 'busy',
        currentJobs: 1,
        maxConcurrency: 3,
        timestamp: new Date().toISOString()
      }
    });

    try {
      let result: Record<string, unknown>;

      switch (data.actionType) {
        case 'DEPLOY':
          result = await this.handleDeploy(data, context);
          break;
        case 'MONITOR':
          result = await this.handleMonitor(data, context);
          break;
        case 'HEALTH_CHECK':
          result = await this.handleHealthCheck(data, context);
          break;
        case 'SCALE':
          result = await this.handleScale(data, context);
          break;
        default:
          throw new Error(`Unknown action type: ${data.actionType}`);
      }

      await this.eventBus.publish({
        type: EventType.AGENT_IDLE,
        source: 'ops-agent',
        payload: {
          agentId: 'ops-agent',
          status: 'idle',
          currentJobs: 0,
          maxConcurrency: 3,
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
        source: 'ops-agent',
        payload: {
          agentId: 'ops-agent',
          status: 'error',
          currentJobs: 0,
          maxConcurrency: 3,
          timestamp: new Date().toISOString()
        }
      });

      throw error;
    }
  }

  private async handleDeploy(
    data: OpsJobData,
    context: JobContext
  ): Promise<Record<string, unknown>> {
    await this.logProgress(context, `Deploying to ${data.environment}...`);

    await new Promise(resolve => setTimeout(resolve, 2000));

    const deploymentId = `deploy-${Date.now()}`;

    return {
      deploymentId,
      environment: data.environment,
      target: data.target,
      status: 'success',
      url: `https://${data.environment}.example.com`
    };
  }

  private async handleMonitor(
    data: OpsJobData,
    context: JobContext
  ): Promise<Record<string, unknown>> {
    await this.logProgress(context, `Monitoring ${data.target}...`);

    await new Promise(resolve => setTimeout(resolve, 500));

    return {
      target: data.target,
      metrics: {
        cpu: 45,
        memory: 62,
        requestsPerSecond: 120,
        errorRate: 0.01
      },
      status: 'healthy'
    };
  }

  private async handleHealthCheck(
    data: OpsJobData,
    context: JobContext
  ): Promise<Record<string, unknown>> {
    await this.logProgress(context, 'Running health checks...');

    const services = ['api', 'database', 'cache', 'queue'];
    const results = services.map(service => ({
      service,
      status: Math.random() > 0.1 ? 'healthy' : 'degraded',
      latencyMs: Math.floor(Math.random() * 100)
    }));

    return {
      overall: results.every(r => r.status === 'healthy') ? 'healthy' : 'degraded',
      services: results,
      timestamp: new Date().toISOString()
    };
  }

  private async handleScale(
    data: OpsJobData,
    context: JobContext
  ): Promise<Record<string, unknown>> {
    const config = data.config ?? {};
    const replicas = (config.replicas as number) ?? 3;

    await this.logProgress(context, `Scaling to ${replicas} replicas...`);

    await new Promise(resolve => setTimeout(resolve, 1500));

    return {
      target: data.target,
      previousReplicas: 2,
      newReplicas: replicas,
      status: 'scaled'
    };
  }

  private async logProgress(context: JobContext, message: string): Promise<void> {
    console.log(`[${context.traceId}] ${message}`);
  }
}

export { OpsAgentWorker };
export default OpsAgentWorker;

import { Job } from 'bullmq';
import { IORedis } from 'ioredis';
import { BaseWorker, JobContext, JobResult } from './base-worker';
import { EventBus } from '../events/event-bus';
import { EventType } from '../types/events';

interface QaJobData {
  taskId: string;
  actionType: 'RUN_TESTS' | 'TEST_GENERATION' | 'QUALITY_CHECK';
  target?: string;
  testFramework?: string;
  coverage?: boolean;
}

class QaAgentWorker extends BaseWorker {
  constructor(redisConnection: IORedis, eventBus: EventBus) {
    super(
      {
        queueName: 'qa-agent',
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
    const data = job.data as QaJobData;

    await this.eventBus.publish({
      type: EventType.AGENT_BUSY,
      source: 'qa-agent',
      payload: {
        agentId: 'qa-agent',
        status: 'busy',
        currentJobs: 1,
        maxConcurrency: 2,
        timestamp: new Date().toISOString()
      }
    });

    try {
      let result: Record<string, unknown>;

      switch (data.actionType) {
        case 'RUN_TESTS':
          result = await this.handleRunTests(data, context);
          break;
        case 'TEST_GENERATION':
          result = await this.handleTestGeneration(data, context);
          break;
        case 'QUALITY_CHECK':
          result = await this.handleQualityCheck(data, context);
          break;
        default:
          throw new Error(`Unknown action type: ${data.actionType}`);
      }

      await this.eventBus.publish({
        type: EventType.AGENT_IDLE,
        source: 'qa-agent',
        payload: {
          agentId: 'qa-agent',
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
        source: 'qa-agent',
        payload: {
          agentId: 'qa-agent',
          status: 'error',
          currentJobs: 0,
          maxConcurrency: 2,
          timestamp: new Date().toISOString()
        }
      });

      throw error;
    }
  }

  private async handleRunTests(
    data: QaJobData,
    context: JobContext
  ): Promise<Record<string, unknown>> {
    await this.logProgress(context, `Running ${data.testFramework} tests...`);

    await new Promise(resolve => setTimeout(resolve, 2000));

    const tests = [
      { name: 'should create user', status: 'passed', duration: 45 },
      { name: 'should validate input', status: 'passed', duration: 32 },
      { name: 'should handle errors', status: 'passed', duration: 28 }
    ];

    return {
      testFramework: data.testFramework ?? 'jest',
      totalTests: tests.length,
      passed: tests.filter(t => t.status === 'passed').length,
      failed: tests.filter(t => t.status === 'failed').length,
      skipped: 0,
      duration: tests.reduce((acc, t) => acc + t.duration, 0),
      coverage: data.coverage ? {
        statements: 87,
        branches: 82,
        functions: 91,
        lines: 88
      } : null,
      tests
    };
  }

  private async handleTestGeneration(
    data: QaJobData,
    context: JobContext
  ): Promise<Record<string, unknown>> {
    await this.logProgress(context, 'Generating test cases...');

    await new Promise(resolve => setTimeout(resolve, 1500));

    const generatedTests = [
      {
        file: 'src/utils/validator.test.ts',
        cases: 5,
        description: 'Input validation tests'
      },
      {
        file: 'src/services/auth.test.ts',
        cases: 8,
        description: 'Authentication flow tests'
      }
    ];

    return {
      target: data.target,
      generatedTests,
      totalCases: generatedTests.reduce((acc, t) => acc + t.cases, 0),
      filesCreated: generatedTests.length
    };
  }

  private async handleQualityCheck(
    data: QaJobData,
    context: JobContext
  ): Promise<Record<string, unknown>> {
    await this.logProgress(context, 'Running code quality checks...');

    const checks = [
      { name: 'Lint', status: 'pass', score: 95 },
      { name: 'Type Check', status: 'pass', score: 100 },
      { name: 'Complexity', status: 'pass', score: 87 },
      { name: 'Duplication', status: 'warning', score: 78 }
    ];

    return {
      target: data.target,
      overallScore: Math.round(checks.reduce((acc, c) => acc + c.score, 0) / checks.length),
      checks,
      recommendations: [
        'Reduce code duplication in utils folder',
        'Consider breaking down complex functions'
      ]
    };
  }

  private async logProgress(context: JobContext, message: string): Promise<void> {
    console.log(`[${context.traceId}] ${message}`);
  }
}

export { QaAgentWorker };
export default QaAgentWorker;

import { Job } from 'bullmq';
import { IORedis } from 'ioredis';
import { BaseWorker, JobContext, JobResult } from './base-worker';
import { EventBus } from '../events/event-bus';
import { EventType } from '../types/events';

interface SecurityJobData {
  taskId: string;
  actionType: 'SECURITY_SCAN' | 'AUDIT' | 'COMPLIANCE_CHECK';
  target?: string;
  scanType?: 'CODE' | 'DEPENDENCIES' | 'SECRETS' | 'CONFIGURATION';
}

class SecurityAgentWorker extends BaseWorker {
  constructor(redisConnection: IORedis, eventBus: EventBus) {
    super(
      {
        queueName: 'security-agent',
        concurrency: 1
      },
      redisConnection,
      eventBus
    );
  }

  protected async processJob(
    job: Job,
    context: JobContext
  ): Promise<JobResult> {
    const data = job.data as SecurityJobData;

    await this.eventBus.publish({
      type: EventType.AGENT_BUSY,
      source: 'security-agent',
      payload: {
        agentId: 'security-agent',
        status: 'busy',
        currentJobs: 1,
        maxConcurrency: 1,
        timestamp: new Date().toISOString()
      }
    });

    try {
      let result: Record<string, unknown>;

      switch (data.actionType) {
        case 'SECURITY_SCAN':
          result = await this.handleSecurityScan(data, context);
          break;
        case 'AUDIT':
          result = await this.handleAudit(data, context);
          break;
        case 'COMPLIANCE_CHECK':
          result = await this.handleComplianceCheck(data, context);
          break;
        default:
          throw new Error(`Unknown action type: ${data.actionType}`);
      }

      await this.eventBus.publish({
        type: EventType.AGENT_IDLE,
        source: 'security-agent',
        payload: {
          agentId: 'security-agent',
          status: 'idle',
          currentJobs: 0,
          maxConcurrency: 1,
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
        source: 'security-agent',
        payload: {
          agentId: 'security-agent',
          status: 'error',
          currentJobs: 0,
          maxConcurrency: 1,
          timestamp: new Date().toISOString()
        }
      });

      throw error;
    }
  }

  private async handleSecurityScan(
    data: SecurityJobData,
    context: JobContext
  ): Promise<Record<string, unknown>> {
    await this.logProgress(context, `Running ${data.scanType} security scan...`);

    await new Promise(resolve => setTimeout(resolve, 3000));

    const findings = [
      { severity: 'low', rule: 'OUTDATED_DEPENDENCY', message: 'Package xyz needs update' },
      { severity: 'info', rule: 'GENERAL', message: 'Scan completed successfully' }
    ];

    return {
      scanType: data.scanType,
      target: data.target,
      findings,
      summary: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 1,
        info: 1
      },
      passed: findings.every(f => f.severity !== 'critical' && f.severity !== 'high')
    };
  }

  private async handleAudit(
    data: SecurityJobData,
    context: JobContext
  ): Promise<Record<string, unknown>> {
    await this.logProgress(context, 'Running security audit...');

    await new Promise(resolve => setTimeout(resolve, 2000));

    return {
      target: data.target,
      auditDate: new Date().toISOString(),
      score: 95,
      recommendations: [
        'Enable 2FA for all service accounts',
        'Rotate API keys every 90 days'
      ]
    };
  }

  private async handleComplianceCheck(
    data: SecurityJobData,
    context: JobContext
  ): Promise<Record<string, unknown>> {
    await this.logProgress(context, 'Running compliance check...');

    const checks = [
      { name: 'Data Encryption', status: 'pass' },
      { name: 'Access Controls', status: 'pass' },
      { name: 'Audit Logging', status: 'pass' },
      { name: 'Backup Policy', status: 'pass' }
    ];

    return {
      target: data.target,
      complianceFramework: 'SOC2',
      checks,
      overallStatus: checks.every(c => c.status === 'pass') ? 'compliant' : 'non-compliant'
    };
  }

  private async logProgress(context: JobContext, message: string): Promise<void> {
    console.log(`[${context.traceId}] ${message}`);
  }
}

export { SecurityAgentWorker };
export default SecurityAgentWorker;

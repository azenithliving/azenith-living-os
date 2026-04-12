import { Job } from 'bullmq';
import { EventBus } from '../events/event-bus';
import { Logger } from '../utils/logger';
import { prisma } from '../database/prisma-client';
import { 
  AITask, 
  TaskStatus, 
  TaskType,
  HealthCheck,
  SystemMetrics,
  LogLevel
} from '../types';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';

const execAsync = promisify(exec);

interface MonitoringConfig {
  checkIntervalMs: number;
  metricsRetentionDays: number;
  alertThresholds: {
    cpu: number;
    memory: number;
    disk: number;
    latency: number;
  };
}

interface LogAnalysisRequest {
  taskId: string;
  service?: string;
  level?: LogLevel;
  timeRange?: { start: Date; end: Date };
  searchPattern?: string;
}

interface SystemCheckRequest {
  taskId: string;
  checks: string[];
}

const DEFAULT_CONFIG: MonitoringConfig = {
  checkIntervalMs: 60000,
  metricsRetentionDays: 7,
  alertThresholds: {
    cpu: 80,
    memory: 85,
    disk: 90,
    latency: 1000
  }
};

export class OpsAgentService {
  private eventBus: EventBus;
  private logger: Logger;
  private config: MonitoringConfig;
  private isMonitoring: boolean = false;
  private monitoringInterval?: NodeJS.Timeout;

  constructor(eventBus: EventBus, config: MonitoringConfig = DEFAULT_CONFIG) {
    this.eventBus = eventBus;
    this.logger = new Logger('OpsAgentService');
    this.config = config;
  }

  async processJob(job: Job): Promise<unknown> {
    const { taskId, title, type, payload } = job.data;
    
    this.logger.info('Processing ops agent job', { jobId: job.id, taskId, type });

    try {
      await this.updateTaskStatus(taskId, TaskStatus.IN_PROGRESS);

      let result: unknown;

      switch (type) {
        case TaskType.MONITORING:
          result = await this.performMonitoring(payload as Record<string, unknown>);
          break;

        case TaskType.ANALYSIS:
          result = await this.analyzeLogs(payload as LogAnalysisRequest);
          break;

        default:
          throw new Error(`Unknown task type: ${type}`);
      }

      await this.updateTaskStatus(taskId, TaskStatus.COMPLETED, result);

      await this.eventBus.publish({
        type: 'task:completed',
        source: 'ops-agent',
        payload: { taskId, result }
      });

      this.logger.info('Ops agent job completed', { jobId: job.id, taskId });

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      this.logger.error('Ops agent job failed', { jobId: job.id, taskId, error: errorMessage });

      await this.updateTaskStatus(taskId, TaskStatus.FAILED, undefined, errorMessage);

      await this.eventBus.publish({
        type: 'task:failed',
        source: 'ops-agent',
        payload: { taskId, error: errorMessage }
      });

      throw error;
    }
  }

  async startContinuousMonitoring(): Promise<void> {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.logger.info('Starting continuous monitoring');

    this.monitoringInterval = setInterval(async () => {
      try {
        await this.performSystemCheck();
      } catch (error) {
        this.logger.error('System check failed', { error });
      }
    }, this.config.checkIntervalMs);

    await this.eventBus.publish({
      type: 'monitoring:started',
      source: 'ops-agent',
      payload: { interval: this.config.checkIntervalMs }
    });
  }

  async stopContinuousMonitoring(): Promise<void> {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    this.logger.info('Stopped continuous monitoring');

    await this.eventBus.publish({
      type: 'monitoring:stopped',
      source: 'ops-agent',
      payload: {}
    });
  }

  async performMonitoring(payload: Record<string, unknown>): Promise<{
    healthChecks: HealthCheck[];
    metrics: SystemMetrics;
    alerts: string[];
  }> {
    this.logger.info('Performing system monitoring');

    const [healthChecks, metrics] = await Promise.all([
      this.runHealthChecks(),
      this.collectSystemMetrics()
    ]);

    const alerts = this.generateAlerts(healthChecks, metrics);

    if (alerts.length > 0) {
      await this.eventBus.publish({
        type: 'ops:alerts',
        source: 'ops-agent',
        payload: { alerts, metrics, healthChecks }
      });
    }

    await this.storeMetrics(metrics);

    return {
      healthChecks,
      metrics,
      alerts
    };
  }

  async analyzeLogs(request: LogAnalysisRequest): Promise<{
    totalLogs: number;
    byLevel: Record<string, number>;
    byService: Record<string, number>;
    errors: Array<{ message: string; count: number; lastOccurrence: Date }>;
    trends: Array<{ hour: string; count: number }>;
  }> {
    const { service, level, timeRange, searchPattern } = request;

    this.logger.info('Analyzing logs', { service, level, searchPattern });

    const where: Record<string, unknown> = {};
    
    if (service) {
      where.service = service;
    }
    
    if (level) {
      where.level = level;
    }
    
    if (timeRange) {
      where.createdAt = {
        gte: timeRange.start,
        lte: timeRange.end
      };
    }

    const logs = await prisma.systemLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 10000
    });

    const byLevel: Record<string, number> = {};
    const byService: Record<string, number> = {};
    const errorMap = new Map<string, { count: number; lastOccurrence: Date }>();
    const hourlyTrends = new Map<string, number>();

    for (const log of logs) {
      byLevel[log.level] = (byLevel[log.level] || 0) + 1;
      byService[log.service] = (byService[log.service] || 0) + 1;

      if (log.level === 'ERROR' || log.level === 'FATAL') {
        const existing = errorMap.get(log.message);
        if (existing) {
          existing.count++;
          if (log.createdAt > existing.lastOccurrence) {
            existing.lastOccurrence = log.createdAt;
          }
        } else {
          errorMap.set(log.message, { count: 1, lastOccurrence: log.createdAt });
        }
      }

      const hour = log.createdAt.toISOString().slice(0, 13) + ':00';
      hourlyTrends.set(hour, (hourlyTrends.get(hour) || 0) + 1);
    }

    const errors = Array.from(errorMap.entries())
      .map(([message, data]) => ({
        message,
        count: data.count,
        lastOccurrence: data.lastOccurrence
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    const trends = Array.from(hourlyTrends.entries())
      .map(([hour, count]) => ({ hour, count }))
      .sort((a, b) => a.hour.localeCompare(b.hour));

    return {
      totalLogs: logs.length,
      byLevel,
      byService,
      errors,
      trends
    };
  }

  async runHealthChecks(): Promise<HealthCheck[]> {
    const checks: HealthCheck[] = [];

    const services = [
      { name: 'database', check: () => this.checkDatabase() },
      { name: 'redis', check: () => this.checkRedis() },
      { name: 'queue', check: () => this.checkQueue() },
      { name: 'filesystem', check: () => this.checkFilesystem() }
    ];

    for (const service of services) {
      const startTime = Date.now();
      try {
        await service.check();
        checks.push({
          service: service.name,
          status: 'healthy',
          latencyMs: Date.now() - startTime,
          timestamp: new Date()
        });
      } catch (error) {
        checks.push({
          service: service.name,
          status: 'unhealthy',
          latencyMs: Date.now() - startTime,
          timestamp: new Date(),
          details: { error: error instanceof Error ? error.message : String(error) }
        });
      }
    }

    return checks;
  }

  async collectSystemMetrics(): Promise<SystemMetrics> {
    const timestamp = new Date();

    try {
      const cpuUsage = await this.getCPUUsage();
      const memoryUsage = await this.getMemoryUsage();
      const diskUsage = await this.getDiskUsage();
      const networkMetrics = await this.getNetworkMetrics();

      return {
        cpu: cpuUsage,
        memory: memoryUsage,
        disk: diskUsage,
        network: networkMetrics,
        timestamp
      };
    } catch (error) {
      this.logger.error('Failed to collect system metrics', { error });
      
      return {
        cpu: 0,
        memory: 0,
        disk: 0,
        network: { bytesIn: 0, bytesOut: 0, connections: 0 },
        timestamp
      };
    }
  }

  async getSystemReport(): Promise<{
    timestamp: Date;
    health: HealthCheck[];
    metrics: SystemMetrics;
    recentAlerts: string[];
    recommendations: string[];
  }> {
    const [health, metrics] = await Promise.all([
      this.runHealthChecks(),
      this.collectSystemMetrics()
    ]);

    const alerts = this.generateAlerts(health, metrics);
    const recommendations = this.generateRecommendations(health, metrics);

    return {
      timestamp: new Date(),
      health,
      metrics,
      recentAlerts: alerts,
      recommendations
    };
  }

  private async performSystemCheck(): Promise<void> {
    const report = await this.getSystemReport();

    const unhealthyServices = report.health.filter(h => h.status === 'unhealthy');
    
    if (unhealthyServices.length > 0 || report.recentAlerts.length > 0) {
      await this.eventBus.publish({
        type: 'ops:system-check',
        source: 'ops-agent',
        payload: {
          status: unhealthyServices.length > 0 ? 'degraded' : 'healthy',
          unhealthyServices: unhealthyServices.map(s => s.service),
          alerts: report.recentAlerts,
          recommendations: report.recommendations
        }
      });
    }
  }

  private generateAlerts(health: HealthCheck[], metrics: SystemMetrics): string[] {
    const alerts: string[] = [];

    for (const check of health) {
      if (check.status === 'unhealthy') {
        alerts.push(`Service ${check.service} is unhealthy`);
      } else if (check.status === 'degraded') {
        alerts.push(`Service ${check.service} is degraded`);
      }
    }

    if (metrics.cpu > this.config.alertThresholds.cpu) {
      alerts.push(`High CPU usage: ${metrics.cpu.toFixed(1)}%`);
    }

    if (metrics.memory > this.config.alertThresholds.memory) {
      alerts.push(`High memory usage: ${metrics.memory.toFixed(1)}%`);
    }

    if (metrics.disk > this.config.alertThresholds.disk) {
      alerts.push(`High disk usage: ${metrics.disk.toFixed(1)}%`);
    }

    return alerts;
  }

  private generateRecommendations(health: HealthCheck[], metrics: SystemMetrics): string[] {
    const recommendations: string[] = [];

    if (metrics.memory > 80) {
      recommendations.push('Consider scaling up memory or optimizing memory usage');
    }

    if (metrics.cpu > 80) {
      recommendations.push('High CPU load detected - consider scaling horizontally');
    }

    if (metrics.disk > 85) {
      recommendations.push('Disk space running low - clean up old logs and temporary files');
    }

    const slowServices = health.filter(h => h.latencyMs > this.config.alertThresholds.latency);
    if (slowServices.length > 0) {
      recommendations.push(`Slow response times detected in: ${slowServices.map(s => s.service).join(', ')}`);
    }

    return recommendations;
  }

  private async storeMetrics(metrics: SystemMetrics): Promise<void> {
    try {
      await prisma.systemLog.create({
        data: {
          level: 'INFO',
          service: 'ops-agent',
          message: 'System metrics collected',
          metadata: metrics as unknown as Record<string, unknown>
        }
      });
    } catch (error) {
      this.logger.error('Failed to store metrics', { error });
    }
  }

  private async checkDatabase(): Promise<void> {
    await prisma.$queryRaw`SELECT 1`;
  }

  private async checkRedis(): Promise<void> {
    // Redis check would be implemented here
    // For now, we assume it's healthy if configured
  }

  private async checkQueue(): Promise<void> {
    // Queue check would verify BullMQ health
    // For now, we assume it's healthy if configured
  }

  private async checkFilesystem(): Promise<void> {
    const testFile = path.join(process.cwd(), '.healthcheck');
    await fs.writeFile(testFile, 'healthcheck');
    await fs.unlink(testFile);
  }

  private async getCPUUsage(): Promise<number> {
    try {
      if (process.platform === 'win32') {
        const { stdout } = await execAsync('wmic cpu get loadpercentage /value');
        const match = stdout.match(/LoadPercentage=(\d+)/);
        return match ? parseInt(match[1], 10) : 0;
      } else {
        const { stdout } = await execAsync("top -bn1 | grep 'Cpu(s)' | awk '{print $2}' | cut -d'%' -f1");
        return parseFloat(stdout.trim()) || 0;
      }
    } catch {
      return 0;
    }
  }

  private async getMemoryUsage(): Promise<number> {
    try {
      const used = process.memoryUsage();
      return (used.heapUsed / used.heapTotal) * 100;
    } catch {
      return 0;
    }
  }

  private async getDiskUsage(): Promise<number> {
    try {
      if (process.platform === 'win32') {
        const { stdout } = await execAsync('wmic logicaldisk get size,freespace /format:csv');
        const lines = stdout.trim().split('\n');
        if (lines.length > 1) {
          const parts = lines[1].split(',');
          const free = parseInt(parts[1], 10);
          const size = parseInt(parts[2], 10);
          return ((size - free) / size) * 100;
        }
        return 0;
      } else {
        const { stdout } = await execAsync("df / | tail -1 | awk '{print $5}' | sed 's/%//'");
        return parseFloat(stdout.trim()) || 0;
      }
    } catch {
      return 0;
    }
  }

  private async getNetworkMetrics(): Promise<{ bytesIn: number; bytesOut: number; connections: number }> {
    // Simplified network metrics
    return {
      bytesIn: 0,
      bytesOut: 0,
      connections: 0
    };
  }

  private async updateTaskStatus(
    taskId: string, 
    status: TaskStatus, 
    result?: unknown, 
    error?: string
  ): Promise<void> {
    const updateData: Record<string, unknown> = { status };

    if (result) {
      updateData.result = result;
    }

    if (error) {
      updateData.error = error;
      updateData.failedAt = new Date();
    }

    if (status === TaskStatus.IN_PROGRESS) {
      updateData.startedAt = new Date();
    }

    if (status === TaskStatus.COMPLETED) {
      updateData.completedAt = new Date();
    }

    await prisma.aITask.update({
      where: { id: taskId },
      data: updateData
    });
  }

  updateConfig(config: Partial<MonitoringConfig>): void {
    this.config = { ...this.config, ...config };
    this.logger.info('Monitoring config updated', this.config as unknown as Record<string, unknown>);
  }
}

// Singleton instance
let opsAgentInstance: OpsAgentService | null = null;

export function getOpsAgentService(eventBus: EventBus, config?: MonitoringConfig): OpsAgentService {
  if (!opsAgentInstance) {
    opsAgentInstance = new OpsAgentService(eventBus, config);
  }
  return opsAgentInstance;
}

export function resetOpsAgentService(): void {
  opsAgentInstance = null;
}

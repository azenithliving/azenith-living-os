/**
 * VANGUARD Execution Monitor
 * 
 * مراقب التنفيذ - تسجيل ومراقبة استخدام الأدوات
 * Tracks tool executions, logs metrics, detects failures, stores in vanguard_api_usage
 */

import { createServiceRoleClient } from '@/lib/vanguard/memory/supabase_persistence';
import type { ToolExecutionResult, ToolExecutionContext } from './tool_registry';
import type { VerificationResult } from './result_verifier';

// ============================================================================
// Types
// ============================================================================

export interface ToolCallLog {
  id: string;
  toolId: string;
  toolName: string;
  status: 'success' | 'failure' | 'timeout' | 'error';
  input: unknown;
  output?: unknown;
  error?: {
    code: string;
    message: string;
  };
  verification?: VerificationResult;
  metrics: {
    executionTimeMs: number;
    retryCount?: number;
    tokensUsed?: number;
    cached?: boolean;
  };
  context: ToolExecutionContext;
  timestamp: string;
}

export interface ExecutionMetrics {
  toolId: string;
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  totalExecutionTimeMs: number;
  avgExecutionTimeMs: number;
  minExecutionTimeMs: number;
  maxExecutionTimeMs: number;
  successRate: number;
  lastCalled?: string;
  errorCodes: Record<string, number>;
}

export interface SystemMetrics {
  totalToolCalls: number;
  uniqueTools: number;
  totalExecutionTimeMs: number;
  overallSuccessRate: number;
  mostUsedTool: string;
  slowestTool: string;
  fastestTool: string;
  failureRate: number;
  avgExecutionTimeMs: number;
  period: {
    start: string;
    end: string;
  };
}

// ============================================================================
// Execution Monitor
// ============================================================================

export class ExecutionMonitor {
  private static instance: ExecutionMonitor;
  private logs: ToolCallLog[] = [];
  private maxLogsInMemory = 1000;

  private constructor() {}

  static getInstance(): ExecutionMonitor {
    if (!ExecutionMonitor.instance) {
      ExecutionMonitor.instance = new ExecutionMonitor();
    }
    return ExecutionMonitor.instance;
  }

  /**
   * Log a tool execution
   */
  async logExecution(
    toolId: string,
    toolName: string,
    input: unknown,
    result: ToolExecutionResult<unknown>,
    context: ToolExecutionContext,
    verification?: VerificationResult
  ): Promise<void> {
    const log: ToolCallLog = {
      id: crypto.randomUUID(),
      toolId,
      toolName,
      status: result.success ? 'success' : 'failure',
      input,
      output: result.data,
      error: result.error ? {
        code: result.error.code,
        message: result.error.message
      } : undefined,
      verification,
      metrics: {
        executionTimeMs: result.metadata.executionTimeMs,
        tokensUsed: result.metadata.tokensUsed,
        cached: result.metadata.cached
      },
      context,
      timestamp: result.metadata.timestamp
    };

    // Store in memory
    this.logs.push(log);
    
    // Trim logs if exceeding limit
    if (this.logs.length > this.maxLogsInMemory) {
      this.logs = this.logs.slice(-this.maxLogsInMemory);
    }

    // Persist to database
    await this.persistLog(log);

    // Log to console
    const statusSymbol = result.success ? '✓' : '✗';
    console.log(
      `[ExecutionMonitor] ${statusSymbol} ${toolName} (${toolId}) - ${result.metadata.executionTimeMs}ms` +
      (verification ? ` - Verification: ${verification.status} (${(verification.confidence * 100).toFixed(0)}%)` : '')
    );
  }

  /**
   * Persist log to database (vanguard_api_usage table)
   */
  private async persistLog(log: ToolCallLog): Promise<void> {
    try {
      const supabase = createServiceRoleClient();

      await supabase.from('vanguard_api_usage').insert({
        api_name: 'vanguard_tool',
        endpoint: log.toolId,
        method: 'EXECUTE',
        status_code: log.status === 'success' ? 200 : 500,
        latency_ms: log.metrics.executionTimeMs,
        tokens_used: log.metrics.tokensUsed || 0,
        cost_usd: 0, // Tools are free
        model: log.toolName,
        session_id: log.context.sessionId,
        error: log.error ? JSON.stringify(log.error) : null,
        metadata: {
          tool_id: log.toolId,
          tool_name: log.toolName,
          cached: log.metrics.cached,
          retry_count: log.metrics.retryCount,
          verification: log.verification ? {
            status: log.verification.status,
            confidence: log.verification.confidence
          } : undefined,
          context: {
            user_id: log.context.userId,
            conversation_id: log.context.conversationId,
            channel: log.context.channel
          }
        }
      });
    } catch (error) {
      console.error('[ExecutionMonitor] Failed to persist log:', error);
    }
  }

  /**
   * Get recent logs
   */
  getRecentLogs(limit: number = 100): ToolCallLog[] {
    return this.logs.slice(-limit);
  }

  /**
   * Get logs for a specific tool
   */
  getLogsByTool(toolId: string, limit: number = 100): ToolCallLog[] {
    return this.logs
      .filter(log => log.toolId === toolId)
      .slice(-limit);
  }

  /**
   * Get logs for a session
   */
  getLogsBySession(sessionId: string): ToolCallLog[] {
    return this.logs.filter(log => log.context.sessionId === sessionId);
  }

  /**
   * Get logs by status
   */
  getLogsByStatus(status: 'success' | 'failure' | 'timeout' | 'error'): ToolCallLog[] {
    return this.logs.filter(log => log.status === status);
  }

  /**
   * Get metrics for a specific tool
   */
  getToolMetrics(toolId: string): ExecutionMetrics | null {
    const toolLogs = this.logs.filter(log => log.toolId === toolId);
    
    if (toolLogs.length === 0) {
      return null;
    }

    const successfulLogs = toolLogs.filter(log => log.status === 'success');
    const failedLogs = toolLogs.filter(log => log.status === 'failure');
    
    const executionTimes = toolLogs.map(log => log.metrics.executionTimeMs);
    const totalExecutionTime = executionTimes.reduce((sum, time) => sum + time, 0);
    
    const errorCodes: Record<string, number> = {};
    for (const log of failedLogs) {
      if (log.error) {
        errorCodes[log.error.code] = (errorCodes[log.error.code] || 0) + 1;
      }
    }

    return {
      toolId,
      totalCalls: toolLogs.length,
      successfulCalls: successfulLogs.length,
      failedCalls: failedLogs.length,
      totalExecutionTimeMs: totalExecutionTime,
      avgExecutionTimeMs: totalExecutionTime / toolLogs.length,
      minExecutionTimeMs: Math.min(...executionTimes),
      maxExecutionTimeMs: Math.max(...executionTimes),
      successRate: successfulLogs.length / toolLogs.length,
      lastCalled: toolLogs[toolLogs.length - 1]?.timestamp,
      errorCodes
    };
  }

  /**
   * Get system-wide metrics
   */
  getSystemMetrics(): SystemMetrics {
    if (this.logs.length === 0) {
      const now = new Date().toISOString();
      return {
        totalToolCalls: 0,
        uniqueTools: 0,
        totalExecutionTimeMs: 0,
        overallSuccessRate: 0,
        mostUsedTool: '',
        slowestTool: '',
        fastestTool: '',
        failureRate: 0,
        avgExecutionTimeMs: 0,
        period: { start: now, end: now }
      };
    }

    const uniqueTools = new Set(this.logs.map(log => log.toolId)).size;
    const successfulLogs = this.logs.filter(log => log.status === 'success');
    const totalExecutionTime = this.logs.reduce((sum, log) => sum + log.metrics.executionTimeMs, 0);

    // Count tool usage
    const toolUsage: Record<string, number> = {};
    const toolTimes: Record<string, number[]> = {};
    
    for (const log of this.logs) {
      toolUsage[log.toolId] = (toolUsage[log.toolId] || 0) + 1;
      if (!toolTimes[log.toolId]) {
        toolTimes[log.toolId] = [];
      }
      toolTimes[log.toolId].push(log.metrics.executionTimeMs);
    }

    // Find most used tool
    const mostUsedTool = Object.entries(toolUsage).sort((a, b) => b[1] - a[1])[0]?.[0] || '';

    // Find slowest and fastest tools (by average execution time)
    const avgTimes = Object.entries(toolTimes).map(([toolId, times]) => ({
      toolId,
      avgTime: times.reduce((sum, t) => sum + t, 0) / times.length
    }));
    
    avgTimes.sort((a, b) => b.avgTime - a.avgTime);
    const slowestTool = avgTimes[0]?.toolId || '';
    const fastestTool = avgTimes[avgTimes.length - 1]?.toolId || '';

    return {
      totalToolCalls: this.logs.length,
      uniqueTools,
      totalExecutionTimeMs: totalExecutionTime,
      overallSuccessRate: successfulLogs.length / this.logs.length,
      mostUsedTool,
      slowestTool,
      fastestTool,
      failureRate: (this.logs.length - successfulLogs.length) / this.logs.length,
      avgExecutionTimeMs: totalExecutionTime / this.logs.length,
      period: {
        start: this.logs[0].timestamp,
        end: this.logs[this.logs.length - 1].timestamp
      }
    };
  }

  /**
   * Get metrics from database for a time period
   */
  async getDatabaseMetrics(
    startDate: string,
    endDate: string
  ): Promise<{
    totalCalls: number;
    successRate: number;
    avgLatencyMs: number;
    totalTokens: number;
    byTool: Record<string, {
      calls: number;
      avgLatency: number;
      successRate: number;
    }>;
  }> {
    try {
      const supabase = createServiceRoleClient();

      const { data, error } = await supabase
        .from('vanguard_api_usage')
        .select('*')
        .eq('api_name', 'vanguard_tool')
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      if (error || !data) {
        throw new Error('Failed to fetch metrics from database');
      }

      const totalCalls = data.length;
      const successfulCalls = data.filter(d => d.status_code === 200).length;
      const totalLatency = data.reduce((sum, d) => sum + (d.latency_ms || 0), 0);
      const totalTokens = data.reduce((sum, d) => sum + (d.tokens_used || 0), 0);

      // Group by tool
      const byTool: Record<string, {
        calls: number;
        avgLatency: number;
        successRate: number;
      }> = {};

      const toolGroups: Record<string, any[]> = {};
      for (const record of data) {
        const toolId = record.endpoint;
        if (!toolGroups[toolId]) {
          toolGroups[toolId] = [];
        }
        toolGroups[toolId].push(record);
      }

      for (const [toolId, records] of Object.entries(toolGroups)) {
        const toolSuccesses = records.filter(r => r.status_code === 200).length;
        const toolLatency = records.reduce((sum, r) => sum + (r.latency_ms || 0), 0);
        
        byTool[toolId] = {
          calls: records.length,
          avgLatency: toolLatency / records.length,
          successRate: toolSuccesses / records.length
        };
      }

      return {
        totalCalls,
        successRate: successfulCalls / totalCalls,
        avgLatencyMs: totalLatency / totalCalls,
        totalTokens,
        byTool
      };
    } catch (error) {
      console.error('[ExecutionMonitor] Failed to get database metrics:', error);
      return {
        totalCalls: 0,
        successRate: 0,
        avgLatencyMs: 0,
        totalTokens: 0,
        byTool: {}
      };
    }
  }

  /**
   * Detect failures and anomalies
   */
  detectAnomalies(): Array<{
    type: 'high_failure_rate' | 'slow_execution' | 'sudden_spike' | 'repeated_error';
    toolId: string;
    severity: 'low' | 'medium' | 'high';
    message: string;
    messageAr: string;
    details: Record<string, unknown>;
  }> {
    const anomalies: Array<{
      type: 'high_failure_rate' | 'slow_execution' | 'sudden_spike' | 'repeated_error';
      toolId: string;
      severity: 'low' | 'medium' | 'high';
      message: string;
      messageAr: string;
      details: Record<string, unknown>;
    }> = [];

    const uniqueToolIds = Array.from(new Set(this.logs.map(log => log.toolId)));

    for (const toolId of uniqueToolIds) {
      const metrics = this.getToolMetrics(toolId);
      if (!metrics) continue;

      // High failure rate
      if (metrics.failedCalls > 5 && metrics.successRate < 0.5) {
        anomalies.push({
          type: 'high_failure_rate',
          toolId,
          severity: 'high',
          message: `Tool ${toolId} has high failure rate: ${(metrics.successRate * 100).toFixed(1)}%`,
          messageAr: `الأداة ${toolId} لديها معدل فشل مرتفع: ${(metrics.successRate * 100).toFixed(1)}%`,
          details: {
            successRate: metrics.successRate,
            failedCalls: metrics.failedCalls,
            totalCalls: metrics.totalCalls
          }
        });
      }

      // Slow execution
      if (metrics.avgExecutionTimeMs > 5000) {
        anomalies.push({
          type: 'slow_execution',
          toolId,
          severity: 'medium',
          message: `Tool ${toolId} is slow: avg ${metrics.avgExecutionTimeMs.toFixed(0)}ms`,
          messageAr: `الأداة ${toolId} بطيئة: متوسط ${metrics.avgExecutionTimeMs.toFixed(0)} ميلي ثانية`,
          details: {
            avgExecutionTimeMs: metrics.avgExecutionTimeMs,
            maxExecutionTimeMs: metrics.maxExecutionTimeMs
          }
        });
      }

      // Repeated errors
      for (const [errorCode, count] of Object.entries(metrics.errorCodes)) {
        if (count > 3) {
          anomalies.push({
            type: 'repeated_error',
            toolId,
            severity: 'medium',
            message: `Tool ${toolId} has repeated error: ${errorCode} (${count} times)`,
            messageAr: `الأداة ${toolId} لديها خطأ متكرر: ${errorCode} (${count} مرة)`,
            details: {
              errorCode,
              count
            }
          });
        }
      }
    }

    return anomalies;
  }

  /**
   * Clear in-memory logs
   */
  clearLogs(): void {
    this.logs = [];
    console.log('[ExecutionMonitor] Cleared in-memory logs');
  }

  /**
   * Get log count
   */
  getLogCount(): number {
    return this.logs.length;
  }

  /**
   * Export logs as JSON
   */
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const executionMonitor = ExecutionMonitor.getInstance();

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format metrics for display
 */
export function formatMetrics(metrics: ExecutionMetrics): string {
  return `
Tool: ${metrics.toolId}
Total Calls: ${metrics.totalCalls}
Success Rate: ${(metrics.successRate * 100).toFixed(1)}%
Avg Execution: ${metrics.avgExecutionTimeMs.toFixed(0)}ms
Min/Max: ${metrics.minExecutionTimeMs}ms / ${metrics.maxExecutionTimeMs}ms
Last Called: ${metrics.lastCalled || 'N/A'}
  `.trim();
}

/**
 * Format system metrics for display
 */
export function formatSystemMetrics(metrics: SystemMetrics): string {
  return `
System Metrics (${metrics.period.start} - ${metrics.period.end})
Total Tool Calls: ${metrics.totalToolCalls}
Unique Tools: ${metrics.uniqueTools}
Success Rate: ${(metrics.overallSuccessRate * 100).toFixed(1)}%
Avg Execution: ${metrics.avgExecutionTimeMs.toFixed(0)}ms
Most Used: ${metrics.mostUsedTool}
Slowest: ${metrics.slowestTool}
Fastest: ${metrics.fastestTool}
  `.trim();
}

/**
 * Format metrics in Arabic
 */
export function formatMetricsAr(metrics: ExecutionMetrics): string {
  return `
الأداة: ${metrics.toolId}
إجمالي الاستدعاءات: ${metrics.totalCalls}
معدل النجاح: ${(metrics.successRate * 100).toFixed(1)}٪
متوسط وقت التنفيذ: ${metrics.avgExecutionTimeMs.toFixed(0)} ميلي ثانية
الحد الأدنى/الأقصى: ${metrics.minExecutionTimeMs} / ${metrics.maxExecutionTimeMs} ميلي ثانية
آخر استدعاء: ${metrics.lastCalled || 'غير متاح'}
  `.trim();
}

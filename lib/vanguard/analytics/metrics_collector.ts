/**
 * VANGUARD Phase 6: Analytics & Intelligence Layer
 * Real-time Metrics Collector
 * 
 * جامع المقاييس في الوقت الفعلي
 * Collects, aggregates, and stores metrics in real-time from various sources
 */

import { EventBus, VanguardEvent, VanguardEventType } from '../automation/event_bus';
import { createServiceRoleClient } from '@/lib/vanguard/memory/supabase_persistence';

// ============================================================================
// Types
// ============================================================================

export interface MetricPoint {
  metric: string;
  value: number;
  timestamp: string;
  dimensions?: Record<string, string | number>;
  tags?: string[];
}

export interface AggregatedMetric {
  metric: string;
  period: 'minute' | 'hour' | 'day' | 'week' | 'month';
  timestamp: string;
  count: number;
  sum: number;
  avg: number;
  min: number;
  max: number;
  dimensions?: Record<string, string | number>;
}

export interface MetricBuffer {
  metrics: MetricPoint[];
  flushInterval: number;
  lastFlush: number;
}

// ============================================================================
// Metrics Collector
// ============================================================================

export class MetricsCollector {
  private static instance: MetricsCollector;
  private eventBus: EventBus;
  private buffer: Map<string, MetricPoint[]> = new Map();
  private aggregates: Map<string, AggregatedMetric> = new Map();
  private flushInterval: NodeJS.Timeout | null = null;
  private readonly BUFFER_SIZE = 100;
  private readonly FLUSH_INTERVAL_MS = 10000; // 10 seconds
  private subscriptions: string[] = [];

  private constructor() {
    this.eventBus = EventBus.getInstance();
  }

  static getInstance(): MetricsCollector {
    if (!MetricsCollector.instance) {
      MetricsCollector.instance = new MetricsCollector();
    }
    return MetricsCollector.instance;
  }

  /**
   * Start collecting metrics
   */
  async start(): Promise<void> {
    console.log('[MetricsCollector] Starting real-time metrics collection...');

    // Subscribe to all relevant events
    this.subscribeToEvents();

    // Start periodic flush
    this.flushInterval = setInterval(() => {
      this.flushMetrics().catch(err => {
        console.error('[MetricsCollector] Flush error:', err);
      });
    }, this.FLUSH_INTERVAL_MS);

    console.log('[MetricsCollector] ✅ Metrics collection started');
  }

  /**
   * Stop collecting metrics
   */
  async stop(): Promise<void> {
    console.log('[MetricsCollector] Stopping metrics collection...');

    // Unsubscribe from events
    this.subscriptions.forEach(id => this.eventBus.unsubscribe(id));
    this.subscriptions = [];

    // Stop flush interval
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }

    // Final flush
    await this.flushMetrics();

    console.log('[MetricsCollector] ✅ Metrics collection stopped');
  }

  /**
   * Subscribe to automation events
   */
  private subscribeToEvents(): void {
    // Lead events
    const leadCreated = this.eventBus.subscribe('lead:created', (event) => {
      this.recordMetric('leads.created', 1, {
        dimensions: {
          stage: (event.payload as any).stage || 'new',
          tier: (event.payload as any).tier || 'unknown',
        },
      });
    });
    this.subscriptions.push(leadCreated);

    const leadUpdated = this.eventBus.subscribe('lead:updated', (event) => {
      this.recordMetric('leads.updated', 1, {
        dimensions: {
          stage: (event.payload as any).currentStage || 'unknown',
        },
      });
    });
    this.subscriptions.push(leadUpdated);

    const leadQualified = this.eventBus.subscribe('lead:qualified', (event) => {
      this.recordMetric('leads.qualified', 1);
    });
    this.subscriptions.push(leadQualified);

    const leadWon = this.eventBus.subscribe('lead:won', (event) => {
      this.recordMetric('leads.won', 1);
      this.recordMetric('revenue.amount', (event.payload as any).amount || 0);
    });
    this.subscriptions.push(leadWon);

    const leadScoreChanged = this.eventBus.subscribe('lead:score_changed', (event) => {
      const payload = event.payload as any;
      this.recordMetric('leads.score_avg', payload.newScore || 0);
      this.recordMetric('leads.score_change', (payload.newScore || 0) - (payload.oldScore || 0));
    });
    this.subscriptions.push(leadScoreChanged);

    // Workflow events
    const workflowStarted = this.eventBus.subscribe('workflow:started', (event) => {
      this.recordMetric('workflows.started', 1, {
        dimensions: {
          workflow_id: (event.payload as any).workflowId || 'unknown',
        },
      });
    });
    this.subscriptions.push(workflowStarted);

    const workflowCompleted = this.eventBus.subscribe('workflow:completed', (event) => {
      const payload = event.payload as any;
      this.recordMetric('workflows.completed', 1, {
        dimensions: {
          workflow_id: payload.workflowId || 'unknown',
        },
      });

      // Calculate duration if available
      if (payload.startedAt && payload.completedAt) {
        const duration = new Date(payload.completedAt).getTime() - new Date(payload.startedAt).getTime();
        this.recordMetric('workflows.duration_ms', duration, {
          dimensions: {
            workflow_id: payload.workflowId || 'unknown',
          },
        });
      }
    });
    this.subscriptions.push(workflowCompleted);

    const workflowFailed = this.eventBus.subscribe('workflow:failed', (event) => {
      this.recordMetric('workflows.failed', 1, {
        dimensions: {
          workflow_id: (event.payload as any).workflowId || 'unknown',
          error_code: (event.payload as any).errorCode || 'unknown',
        },
      });
    });
    this.subscriptions.push(workflowFailed);

    const workflowStepCompleted = this.eventBus.subscribe('workflow:step_completed', (event) => {
      const payload = event.payload as any;
      this.recordMetric('workflows.steps_completed', 1, {
        dimensions: {
          workflow_id: payload.workflowId || 'unknown',
          step_type: payload.stepType || 'unknown',
        },
      });
    });
    this.subscriptions.push(workflowStepCompleted);

    // Task events
    const taskScheduled = this.eventBus.subscribe('task:scheduled', (event) => {
      this.recordMetric('tasks.scheduled', 1, {
        dimensions: {
          task_type: (event.payload as any).taskType || 'unknown',
          priority: (event.payload as any).priority || 'MEDIUM',
        },
      });
    });
    this.subscriptions.push(taskScheduled);

    const taskStarted = this.eventBus.subscribe('task:started', (event) => {
      this.recordMetric('tasks.started', 1, {
        dimensions: {
          task_type: (event.payload as any).taskType || 'unknown',
        },
      });
    });
    this.subscriptions.push(taskStarted);

    const taskCompleted = this.eventBus.subscribe('task:completed', (event) => {
      const payload = event.payload as any;
      this.recordMetric('tasks.completed', 1, {
        dimensions: {
          task_type: payload.taskType || 'unknown',
        },
      });

      // Calculate duration
      if (payload.startedAt && payload.completedAt) {
        const duration = new Date(payload.completedAt).getTime() - new Date(payload.startedAt).getTime();
        this.recordMetric('tasks.duration_ms', duration, {
          dimensions: {
            task_type: payload.taskType || 'unknown',
          },
        });
      }
    });
    this.subscriptions.push(taskCompleted);

    const taskFailed = this.eventBus.subscribe('task:failed', (event) => {
      this.recordMetric('tasks.failed', 1, {
        dimensions: {
          task_type: (event.payload as any).taskType || 'unknown',
          error_code: (event.payload as any).errorCode || 'unknown',
        },
      });
    });
    this.subscriptions.push(taskFailed);

    const taskRetrying = this.eventBus.subscribe('task:retrying', (event) => {
      this.recordMetric('tasks.retries', 1, {
        dimensions: {
          task_type: (event.payload as any).taskType || 'unknown',
          attempt: (event.payload as any).attempt || 1,
        },
      });
    });
    this.subscriptions.push(taskRetrying);

    // Tool execution events
    const toolExecuted = this.eventBus.subscribe('tool:executed', (event) => {
      const payload = event.payload as any;
      this.recordMetric('tools.executed', 1, {
        dimensions: {
          tool_name: payload.toolName || 'unknown',
          success: payload.success ? 'true' : 'false',
        },
      });

      if (payload.executionTimeMs) {
        this.recordMetric('tools.execution_time_ms', payload.executionTimeMs, {
          dimensions: {
            tool_name: payload.toolName || 'unknown',
          },
        });
      }
    });
    this.subscriptions.push(toolExecuted);

    const toolFailed = this.eventBus.subscribe('tool:failed', (event) => {
      this.recordMetric('tools.failed', 1, {
        dimensions: {
          tool_name: (event.payload as any).toolName || 'unknown',
        },
      });
    });
    this.subscriptions.push(toolFailed);

    // System events
    const systemError = this.eventBus.subscribe('system:error', (event) => {
      this.recordMetric('system.errors', 1, {
        dimensions: {
          error_type: (event.payload as any).type || 'unknown',
        },
      });
    });
    this.subscriptions.push(systemError);

    const anomalyDetected = this.eventBus.subscribe('system:anomaly_detected', (event) => {
      const payload = event.payload as any;
      this.recordMetric('system.anomalies', 1, {
        dimensions: {
          anomaly_type: payload.type || 'unknown',
          severity: payload.severity || 'low',
        },
      });
    });
    this.subscriptions.push(anomalyDetected);

    console.log(`[MetricsCollector] Subscribed to ${this.subscriptions.length} event types`);
  }

  /**
   * Record a metric point
   */
  recordMetric(
    metric: string,
    value: number,
    options?: {
      dimensions?: Record<string, string | number>;
      tags?: string[];
    }
  ): void {
    const point: MetricPoint = {
      metric,
      value,
      timestamp: new Date().toISOString(),
      dimensions: options?.dimensions,
      tags: options?.tags,
    };

    // Add to buffer
    if (!this.buffer.has(metric)) {
      this.buffer.set(metric, []);
    }

    const buffer = this.buffer.get(metric)!;
    buffer.push(point);

    // Flush if buffer is full
    if (buffer.length >= this.BUFFER_SIZE) {
      this.flushMetric(metric).catch(err => {
        console.error(`[MetricsCollector] Error flushing metric ${metric}:`, err);
      });
    }

    // Update real-time aggregates
    this.updateAggregate(point);
  }

  /**
   * Update real-time aggregates
   */
  private updateAggregate(point: MetricPoint): void {
    const now = new Date();
    const minuteKey = `${point.metric}:minute:${now.toISOString().slice(0, 16)}`;
    const hourKey = `${point.metric}:hour:${now.toISOString().slice(0, 13)}`;

    // Update minute aggregate
    this.addToAggregate(minuteKey, 'minute', point);

    // Update hour aggregate
    this.addToAggregate(hourKey, 'hour', point);
  }

  /**
   * Add point to aggregate
   */
  private addToAggregate(key: string, period: AggregatedMetric['period'], point: MetricPoint): void {
    let agg = this.aggregates.get(key);

    if (!agg) {
      agg = {
        metric: point.metric,
        period,
        timestamp: point.timestamp,
        count: 0,
        sum: 0,
        avg: 0,
        min: point.value,
        max: point.value,
        dimensions: point.dimensions,
      };
      this.aggregates.set(key, agg);
    }

    agg.count++;
    agg.sum += point.value;
    agg.avg = agg.sum / agg.count;
    agg.min = Math.min(agg.min, point.value);
    agg.max = Math.max(agg.max, point.value);
  }

  /**
   * Flush all metrics to database
   */
  private async flushMetrics(): Promise<void> {
    const metrics = Array.from(this.buffer.keys());
    
    if (metrics.length === 0) {
      return;
    }

    console.log(`[MetricsCollector] Flushing ${metrics.length} metric types...`);

    await Promise.all(
      metrics.map(metric => this.flushMetric(metric))
    );

    // Also flush aggregates periodically
    await this.flushAggregates();
  }

  /**
   * Flush a specific metric
   */
  private async flushMetric(metric: string): Promise<void> {
    const points = this.buffer.get(metric);
    
    if (!points || points.length === 0) {
      return;
    }

    const supabase = createServiceRoleClient();

    try {
      // Store raw metric points
      const { error } = await supabase
        .from('vanguard_metrics')
        .insert(
          points.map(p => ({
            metric: p.metric,
            value: p.value,
            timestamp: p.timestamp,
            dimensions: p.dimensions || {},
            tags: p.tags || [],
          }))
        );

      if (error) {
        console.error(`[MetricsCollector] Error storing metrics:`, error);
      } else {
        console.log(`[MetricsCollector] Flushed ${points.length} points for ${metric}`);
        this.buffer.set(metric, []); // Clear buffer
      }
    } catch (error) {
      console.error(`[MetricsCollector] Error flushing metric ${metric}:`, error);
    }
  }

  /**
   * Flush aggregated metrics
   */
  private async flushAggregates(): Promise<void> {
    const aggregates = Array.from(this.aggregates.values());
    
    if (aggregates.length === 0) {
      return;
    }

    const supabase = createServiceRoleClient();

    try {
      const { error } = await supabase
        .from('vanguard_metric_aggregates')
        .upsert(
          aggregates.map(agg => ({
            metric: agg.metric,
            period: agg.period,
            timestamp: agg.timestamp,
            count: agg.count,
            sum: agg.sum,
            avg: agg.avg,
            min: agg.min,
            max: agg.max,
            dimensions: agg.dimensions || {},
          })),
          {
            onConflict: 'metric,period,timestamp',
          }
        );

      if (error) {
        console.error('[MetricsCollector] Error storing aggregates:', error);
      } else {
        console.log(`[MetricsCollector] Flushed ${aggregates.length} aggregates`);
      }
    } catch (error) {
      console.error('[MetricsCollector] Error flushing aggregates:', error);
    }
  }

  /**
   * Get current buffer size
   */
  getBufferSize(): number {
    let total = 0;
    this.buffer.forEach(points => {
      total += points.length;
    });
    return total;
  }

  /**
   * Get real-time aggregate for a metric
   */
  getRealtimeAggregate(metric: string, period: 'minute' | 'hour'): AggregatedMetric | null {
    const now = new Date();
    const key = period === 'minute'
      ? `${metric}:minute:${now.toISOString().slice(0, 16)}`
      : `${metric}:hour:${now.toISOString().slice(0, 13)}`;

    return this.aggregates.get(key) || null;
  }

  /**
   * Get all current aggregates
   */
  getAllAggregates(): AggregatedMetric[] {
    return Array.from(this.aggregates.values());
  }

  /**
   * Clear old aggregates (older than 1 hour)
   */
  clearOldAggregates(): void {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    this.aggregates.forEach((agg, key) => {
      if (new Date(agg.timestamp) < oneHourAgo) {
        this.aggregates.delete(key);
      }
    });
  }

  /**
   * Get statistics
   */
  getStats(): {
    bufferSize: number;
    aggregatesCount: number;
    subscriptions: number;
    isRunning: boolean;
  } {
    return {
      bufferSize: this.getBufferSize(),
      aggregatesCount: this.aggregates.size,
      subscriptions: this.subscriptions.length,
      isRunning: this.flushInterval !== null,
    };
  }
}

// Export singleton instance
export const metricsCollector = MetricsCollector.getInstance();

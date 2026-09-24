/**
 * VANGUARD Phase 6: Analytics & Intelligence Layer
 * Analytics Engine - Core metrics calculation and KPIs
 * 
 * محرك التحليلات - حساب المقاييس ومؤشرات الأداء الرئيسية
 */

import { createServiceRoleClient } from '@/lib/vanguard/memory/supabase_persistence';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface MetricDefinition {
  id: string;
  name: string;
  nameAr: string;
  description: string;
  descriptionAr: string;
  category: MetricCategory;
  aggregation: AggregationType;
  unit: MetricUnit;
  target?: number; // Target value for the metric
  threshold?: {
    warning: number;
    critical: number;
  };
}

export type MetricCategory = 
  | 'conversion'
  | 'performance'
  | 'productivity'
  | 'quality'
  | 'efficiency'
  | 'engagement';

export type AggregationType = 
  | 'sum'
  | 'avg'
  | 'min'
  | 'max'
  | 'count'
  | 'rate'
  | 'percentage';

export type MetricUnit = 
  | 'number'
  | 'percentage'
  | 'currency'
  | 'duration'
  | 'rate';

export type TimeRange = 
  | '1h'
  | '24h'
  | '7d'
  | '30d'
  | '90d'
  | 'custom';

export interface TimeRangeFilter {
  range: TimeRange;
  startDate?: Date;
  endDate?: Date;
}

export interface MetricValue {
  metricId: string;
  value: number;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface KPI {
  id: string;
  name: string;
  nameAr: string;
  value: number;
  previousValue?: number;
  change?: number; // Percentage change
  trend: 'up' | 'down' | 'stable';
  status: 'good' | 'warning' | 'critical';
  unit: MetricUnit;
  category: MetricCategory;
}

export interface AnalyticsSnapshot {
  timestamp: string;
  timeRange: TimeRange;
  kpis: KPI[];
  metrics: Record<string, MetricValue[]>;
  summary: {
    totalLeads: number;
    totalConversions: number;
    totalRevenue: number;
    avgLeadScore: number;
    conversionRate: number;
    leadVelocity: number; // Leads per day
  };
}

// ============================================================================
// Metric Definitions
// ============================================================================

export const METRIC_DEFINITIONS: Record<string, MetricDefinition> = {
  // Conversion Metrics
  lead_conversion_rate: {
    id: 'lead_conversion_rate',
    name: 'Lead Conversion Rate',
    nameAr: 'معدل تحويل العملاء المحتملين',
    description: 'Percentage of leads that convert to customers',
    descriptionAr: 'نسبة العملاء المحتملين الذين يتحولون إلى عملاء',
    category: 'conversion',
    aggregation: 'percentage',
    unit: 'percentage',
    target: 25, // 25% target
    threshold: {
      warning: 15,
      critical: 10,
    },
  },
  
  workflow_success_rate: {
    id: 'workflow_success_rate',
    name: 'Workflow Success Rate',
    nameAr: 'معدل نجاح سير العمل',
    description: 'Percentage of workflows completed successfully',
    descriptionAr: 'نسبة سير العمل المكتملة بنجاح',
    category: 'quality',
    aggregation: 'percentage',
    unit: 'percentage',
    target: 95,
    threshold: {
      warning: 85,
      critical: 75,
    },
  },

  // Performance Metrics
  avg_workflow_duration: {
    id: 'avg_workflow_duration',
    name: 'Average Workflow Duration',
    nameAr: 'متوسط مدة سير العمل',
    description: 'Average time to complete a workflow',
    descriptionAr: 'متوسط الوقت لإكمال سير العمل',
    category: 'performance',
    aggregation: 'avg',
    unit: 'duration',
    target: 300000, // 5 minutes in ms
    threshold: {
      warning: 600000, // 10 minutes
      critical: 900000, // 15 minutes
    },
  },

  avg_task_completion_time: {
    id: 'avg_task_completion_time',
    name: 'Average Task Completion Time',
    nameAr: 'متوسط وقت إنجاز المهام',
    description: 'Average time to complete a task',
    descriptionAr: 'متوسط الوقت لإنجاز المهمة',
    category: 'performance',
    aggregation: 'avg',
    unit: 'duration',
    target: 60000, // 1 minute
    threshold: {
      warning: 180000, // 3 minutes
      critical: 300000, // 5 minutes
    },
  },

  // Productivity Metrics
  tasks_completed_per_day: {
    id: 'tasks_completed_per_day',
    name: 'Tasks Completed Per Day',
    nameAr: 'المهام المنجزة يومياً',
    description: 'Number of tasks completed per day',
    descriptionAr: 'عدد المهام المنجزة يومياً',
    category: 'productivity',
    aggregation: 'avg',
    unit: 'number',
    target: 50,
    threshold: {
      warning: 30,
      critical: 20,
    },
  },

  workflows_executed_per_day: {
    id: 'workflows_executed_per_day',
    name: 'Workflows Executed Per Day',
    nameAr: 'سير العمل المنفذة يومياً',
    description: 'Number of workflows executed per day',
    descriptionAr: 'عدد سير العمل المنفذة يومياً',
    category: 'productivity',
    aggregation: 'avg',
    unit: 'number',
    target: 20,
  },

  // Efficiency Metrics
  automation_coverage: {
    id: 'automation_coverage',
    name: 'Automation Coverage',
    nameAr: 'تغطية الأتمتة',
    description: 'Percentage of processes automated',
    descriptionAr: 'نسبة العمليات المؤتمتة',
    category: 'efficiency',
    aggregation: 'percentage',
    unit: 'percentage',
    target: 80,
    threshold: {
      warning: 60,
      critical: 40,
    },
  },

  notification_delivery_rate: {
    id: 'notification_delivery_rate',
    name: 'Notification Delivery Rate',
    nameAr: 'معدل تسليم الإشعارات',
    description: 'Percentage of notifications successfully delivered',
    descriptionAr: 'نسبة الإشعارات المسلمة بنجاح',
    category: 'quality',
    aggregation: 'percentage',
    unit: 'percentage',
    target: 98,
    threshold: {
      warning: 95,
      critical: 90,
    },
  },

  // Engagement Metrics
  avg_lead_score: {
    id: 'avg_lead_score',
    name: 'Average Lead Score',
    nameAr: 'متوسط نقاط العملاء',
    description: 'Average scoring of all leads',
    descriptionAr: 'متوسط تقييم جميع العملاء المحتملين',
    category: 'engagement',
    aggregation: 'avg',
    unit: 'number',
    target: 70,
    threshold: {
      warning: 50,
      critical: 30,
    },
  },

  lead_velocity: {
    id: 'lead_velocity',
    name: 'Lead Velocity',
    nameAr: 'سرعة توليد العملاء',
    description: 'Rate of new leads per day',
    descriptionAr: 'معدل العملاء الجدد يومياً',
    category: 'engagement',
    aggregation: 'rate',
    unit: 'rate',
    target: 10, // 10 leads per day
  },
};

// ============================================================================
// Analytics Engine
// ============================================================================

export class AnalyticsEngine {
  private static instance: AnalyticsEngine;
  private cache: Map<string, { value: unknown; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 300000; // 5 minutes

  private constructor() {}

  static getInstance(): AnalyticsEngine {
    if (!AnalyticsEngine.instance) {
      AnalyticsEngine.instance = new AnalyticsEngine();
    }
    return AnalyticsEngine.instance;
  }

  /**
   * Get analytics snapshot for a time range
   */
  async getSnapshot(timeRange: TimeRangeFilter): Promise<AnalyticsSnapshot> {
    const { startDate, endDate } = this.resolveTimeRange(timeRange);

    // Calculate all KPIs in parallel
    const [
      conversionMetrics,
      performanceMetrics,
      productivityMetrics,
      qualityMetrics,
      engagementMetrics,
    ] = await Promise.all([
      this.calculateConversionMetrics(startDate, endDate),
      this.calculatePerformanceMetrics(startDate, endDate),
      this.calculateProductivityMetrics(startDate, endDate),
      this.calculateQualityMetrics(startDate, endDate),
      this.calculateEngagementMetrics(startDate, endDate),
    ]);

    const allKPIs = [
      ...conversionMetrics,
      ...performanceMetrics,
      ...productivityMetrics,
      ...qualityMetrics,
      ...engagementMetrics,
    ];

    // Build summary
    const summary = await this.buildSummary(startDate, endDate);

    return {
      timestamp: new Date().toISOString(),
      timeRange: timeRange.range,
      kpis: allKPIs,
      metrics: {}, // Time series data would go here
      summary,
    };
  }

  /**
   * Calculate conversion metrics
   */
  private async calculateConversionMetrics(
    startDate: Date,
    endDate: Date
  ): Promise<KPI[]> {
    const supabase = createServiceRoleClient();

    // Lead conversion rate
    const { data: totalLeads } = await supabase
      .from('vanguard_leads')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    const { data: convertedLeads } = await supabase
      .from('vanguard_leads')
      .select('id', { count: 'exact', head: true })
      .eq('stage', 'won')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    const totalCount = (totalLeads as any)?.count || 0;
    const convertedCount = (convertedLeads as any)?.count || 0;
    const conversionRate = totalCount > 0 ? (convertedCount / totalCount) * 100 : 0;

    const conversionRateKPI = this.buildKPI(
      'lead_conversion_rate',
      conversionRate,
      undefined
    );

    // Workflow success rate
    const { data: totalWorkflows } = await supabase
      .from('vanguard_workflow_executions')
      .select('id', { count: 'exact', head: true })
      .gte('started_at', startDate.toISOString())
      .lte('started_at', endDate.toISOString());

    const { data: successfulWorkflows } = await supabase
      .from('vanguard_workflow_executions')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'completed')
      .gte('started_at', startDate.toISOString())
      .lte('started_at', endDate.toISOString());

    const totalWF = (totalWorkflows as any)?.count || 0;
    const successWF = (successfulWorkflows as any)?.count || 0;
    const successRate = totalWF > 0 ? (successWF / totalWF) * 100 : 0;

    const workflowSuccessKPI = this.buildKPI(
      'workflow_success_rate',
      successRate,
      undefined
    );

    return [conversionRateKPI, workflowSuccessKPI];
  }

  /**
   * Calculate performance metrics
   */
  private async calculatePerformanceMetrics(
    startDate: Date,
    endDate: Date
  ): Promise<KPI[]> {
    const supabase = createServiceRoleClient();

    // Average workflow duration
    const { data: workflows } = await supabase
      .from('vanguard_workflow_executions')
      .select('started_at, completed_at')
      .eq('status', 'completed')
      .gte('started_at', startDate.toISOString())
      .lte('started_at', endDate.toISOString())
      .not('completed_at', 'is', null);

    let avgWorkflowDuration = 0;
    if (workflows && workflows.length > 0) {
      const durations = workflows.map((w: any) => {
        const start = new Date(w.started_at).getTime();
        const end = new Date(w.completed_at).getTime();
        return end - start;
      });
      avgWorkflowDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    }

    const workflowDurationKPI = this.buildKPI(
      'avg_workflow_duration',
      avgWorkflowDuration,
      undefined
    );

    // Average task completion time
    const { data: tasks } = await supabase
      .from('vanguard_background_tasks')
      .select('started_at, completed_at')
      .eq('status', 'completed')
      .gte('started_at', startDate.toISOString())
      .lte('started_at', endDate.toISOString())
      .not('completed_at', 'is', null);

    let avgTaskDuration = 0;
    if (tasks && tasks.length > 0) {
      const durations = tasks.map((t: any) => {
        const start = new Date(t.started_at).getTime();
        const end = new Date(t.completed_at).getTime();
        return end - start;
      });
      avgTaskDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    }

    const taskDurationKPI = this.buildKPI(
      'avg_task_completion_time',
      avgTaskDuration,
      undefined
    );

    return [workflowDurationKPI, taskDurationKPI];
  }

  /**
   * Calculate productivity metrics
   */
  private async calculateProductivityMetrics(
    startDate: Date,
    endDate: Date
  ): Promise<KPI[]> {
    const supabase = createServiceRoleClient();

    const daysDiff = Math.max(
      1,
      Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    );

    // Tasks per day
    const { data: completedTasks } = await supabase
      .from('vanguard_background_tasks')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'completed')
      .gte('completed_at', startDate.toISOString())
      .lte('completed_at', endDate.toISOString());

    const tasksCount = (completedTasks as any)?.count || 0;
    const tasksPerDay = tasksCount / daysDiff;

    const tasksPerDayKPI = this.buildKPI(
      'tasks_completed_per_day',
      tasksPerDay,
      undefined
    );

    // Workflows per day
    const { data: completedWorkflows } = await supabase
      .from('vanguard_workflow_executions')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'completed')
      .gte('completed_at', startDate.toISOString())
      .lte('completed_at', endDate.toISOString());

    const workflowsCount = (completedWorkflows as any)?.count || 0;
    const workflowsPerDay = workflowsCount / daysDiff;

    const workflowsPerDayKPI = this.buildKPI(
      'workflows_executed_per_day',
      workflowsPerDay,
      undefined
    );

    return [tasksPerDayKPI, workflowsPerDayKPI];
  }

  /**
   * Calculate quality metrics
   */
  private async calculateQualityMetrics(
    startDate: Date,
    endDate: Date
  ): Promise<KPI[]> {
    const supabase = createServiceRoleClient();

    // Notification delivery rate
    const { data: totalNotifications } = await supabase
      .from('vanguard_notifications')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    const { data: deliveredNotifications } = await supabase
      .from('vanguard_notifications')
      .select('id', { count: 'exact', head: true })
      .in('status', ['sent', 'delivered', 'read'])
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    const totalNotif = (totalNotifications as any)?.count || 0;
    const deliveredNotif = (deliveredNotifications as any)?.count || 0;
    const deliveryRate = totalNotif > 0 ? (deliveredNotif / totalNotif) * 100 : 0;

    const deliveryRateKPI = this.buildKPI(
      'notification_delivery_rate',
      deliveryRate,
      undefined
    );

    return [deliveryRateKPI];
  }

  /**
   * Calculate engagement metrics
   */
  private async calculateEngagementMetrics(
    startDate: Date,
    endDate: Date
  ): Promise<KPI[]> {
    const supabase = createServiceRoleClient();

    // Average lead score
    const { data: leads } = await supabase
      .from('vanguard_leads')
      .select('score')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    let avgLeadScore = 0;
    if (leads && leads.length > 0) {
      const scores = leads.map((l: any) => l.score || 0);
      avgLeadScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    }

    const avgScoreKPI = this.buildKPI('avg_lead_score', avgLeadScore, undefined);

    // Lead velocity
    const { data: newLeads } = await supabase
      .from('vanguard_leads')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    const daysDiff = Math.max(
      1,
      Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    );

    const leadsCount = (newLeads as any)?.count || 0;
    const leadVelocity = leadsCount / daysDiff;

    const velocityKPI = this.buildKPI('lead_velocity', leadVelocity, undefined);

    return [avgScoreKPI, velocityKPI];
  }

  /**
   * Build summary object
   */
  private async buildSummary(
    startDate: Date,
    endDate: Date
  ): Promise<AnalyticsSnapshot['summary']> {
    const supabase = createServiceRoleClient();

    const [
      { data: totalLeads },
      { data: convertedLeads },
      { data: leads },
    ] = await Promise.all([
      supabase
        .from('vanguard_leads')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString()),
      
      supabase
        .from('vanguard_leads')
        .select('id', { count: 'exact', head: true })
        .eq('stage', 'won')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString()),
      
      supabase
        .from('vanguard_leads')
        .select('score')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString()),
    ]);

    const totalCount = (totalLeads as any)?.count || 0;
    const convertedCount = (convertedLeads as any)?.count || 0;
    const conversionRate = totalCount > 0 ? (convertedCount / totalCount) * 100 : 0;

    let avgLeadScore = 0;
    if (leads && leads.length > 0) {
      const scores = leads.map((l: any) => l.score || 0);
      avgLeadScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    }

    const daysDiff = Math.max(
      1,
      Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    );
    const leadVelocity = totalCount / daysDiff;

    return {
      totalLeads: totalCount,
      totalConversions: convertedCount,
      totalRevenue: 0, // Would calculate from sales data
      avgLeadScore,
      conversionRate,
      leadVelocity,
    };
  }

  /**
   * Build KPI object from metric definition
   */
  private buildKPI(
    metricId: string,
    value: number,
    previousValue?: number
  ): KPI {
    const definition = METRIC_DEFINITIONS[metricId];
    if (!definition) {
      throw new Error(`Unknown metric: ${metricId}`);
    }

    let change: number | undefined;
    let trend: 'up' | 'down' | 'stable' = 'stable';

    if (previousValue !== undefined && previousValue !== 0) {
      change = ((value - previousValue) / previousValue) * 100;
      if (Math.abs(change) < 1) {
        trend = 'stable';
      } else {
        trend = change > 0 ? 'up' : 'down';
      }
    }

    let status: 'good' | 'warning' | 'critical' = 'good';
    if (definition.threshold) {
      if (value < definition.threshold.critical) {
        status = 'critical';
      } else if (value < definition.threshold.warning) {
        status = 'warning';
      }
    }

    return {
      id: definition.id,
      name: definition.name,
      nameAr: definition.nameAr,
      value: Math.round(value * 100) / 100, // Round to 2 decimals
      previousValue,
      change,
      trend,
      status,
      unit: definition.unit,
      category: definition.category,
    };
  }

  /**
   * Resolve time range to start/end dates
   */
  private resolveTimeRange(filter: TimeRangeFilter): { startDate: Date; endDate: Date } {
    const now = new Date();
    let startDate: Date;
    let endDate: Date = filter.endDate || now;

    if (filter.range === 'custom' && filter.startDate) {
      startDate = filter.startDate;
    } else {
      switch (filter.range) {
        case '1h':
          startDate = new Date(now.getTime() - 60 * 60 * 1000);
          break;
        case '24h':
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case '7d':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '90d':
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      }
    }

    return { startDate, endDate };
  }

  /**
   * Get metric by ID
   */
  getMetricDefinition(metricId: string): MetricDefinition | undefined {
    return METRIC_DEFINITIONS[metricId];
  }

  /**
   * Get all metric definitions
   */
  getAllMetricDefinitions(): MetricDefinition[] {
    return Object.values(METRIC_DEFINITIONS);
  }

  /**
   * Get metrics by category
   */
  getMetricsByCategory(category: MetricCategory): MetricDefinition[] {
    return Object.values(METRIC_DEFINITIONS).filter(m => m.category === category);
  }
}

// Export singleton instance
export const analyticsEngine = AnalyticsEngine.getInstance();

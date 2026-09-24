/**
 * VANGUARD Phase 5: Automation Integration with Consciousness Core
 * 
 * دمج نظام الأتمتة مع Consciousness Core
 * Integrates automation system (workflows, triggers, notifications, routing) with AI consciousness
 */

import { ConsciousnessCore } from './consciousness_core';
import { WorkflowEngine } from '../automation/workflow_engine';
import { TriggerEngine } from '../automation/trigger_engine';
import { TaskQueue } from '../automation/task_queue';
import { EventBus } from '../automation/event_bus';
import { smartRouter, agentLoader } from '../automation/routing';
import { notificationEngine } from '../automation/notifications';
import { createFromTemplate, getWorkflowTemplate } from '../automation/templates';
import type { Goal, Memory, Belief } from '../types';
import { GoalStatus, GoalPriority, MemoryType, makeMemory, makeGoal } from '../types';
import { logger } from '../observability/logger';

// ============================================================================
// Automation-Enhanced Consciousness
// ============================================================================

/**
 * Extends ConsciousnessCore with automation capabilities
 */
export class AutomationIntegratedConsciousness {
  private consciousness: ConsciousnessCore;
  private workflowEngine: WorkflowEngine;
  private triggerEngine: TriggerEngine;
  private taskQueue: TaskQueue;
  private eventBus: EventBus;
  private initialized = false;

  constructor(consciousness: ConsciousnessCore) {
    this.consciousness = consciousness;
    this.workflowEngine = WorkflowEngine.getInstance();
    this.triggerEngine = TriggerEngine.getInstance();
    this.taskQueue = TaskQueue.getInstance();
    this.eventBus = EventBus.getInstance();
  }

  /**
   * Initialize automation systems
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      logger.info('[AutomationIntegration] Already initialized');
      return;
    }

    logger.info('[AutomationIntegration] Initializing automation systems...');

    try {
      // 1. Load agents for routing
      await agentLoader.loadAgents();
      agentLoader.startSync(60000); // Sync every minute

      // 2. Start notification processing
      notificationEngine.startProcessing();

      // 3. Start task queue workers
      await this.taskQueue.start();

      // 4. Subscribe to automation events
      this.subscribeToAutomationEvents();

      // 5. Register default triggers
      await this.registerDefaultTriggers();

      // 6. Load workflow templates
      this.loadWorkflowTemplates();

      this.initialized = true;
      logger.info('[AutomationIntegration] ✅ Automation systems initialized');
    } catch (error) {
      logger.error('[AutomationIntegration] Initialization failed:', error as any);
      throw error;
    }
  }

  /**
   * Shutdown automation systems gracefully
   */
  async shutdown(): Promise<void> {
    logger.info('[AutomationIntegration] Shutting down automation systems...');

    try {
      agentLoader.stopSync();
      notificationEngine.stopProcessing();
      await this.taskQueue.stop();
      
      this.initialized = false;
      logger.info('[AutomationIntegration] ✅ Automation systems shut down');
    } catch (error) {
      logger.error('[AutomationIntegration] Shutdown error:', error as any);
    }
  }

  // ============================================================================
  // Workflow Management
  // ============================================================================

  /**
   * Start a workflow
   */
  async startWorkflow(
    workflowIdOrTemplate: string,
    variables: Record<string, any>,
    options?: {
      sessionId?: string;
      userId?: string;
      triggeredBy?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<string> {
    logger.info(`[AutomationIntegration] Starting workflow: ${workflowIdOrTemplate}`);

    try {
      // Check if it's a template
      const template = getWorkflowTemplate(workflowIdOrTemplate);
      
      let workflowId: string;
      
      if (template) {
        // Create from template
        const workflow = createFromTemplate(workflowIdOrTemplate, variables);
        workflowId = await this.workflowEngine.registerWorkflow(workflow);
      } else {
        // Use existing workflow
        workflowId = workflowIdOrTemplate;
      }

      // Start execution
      const executionId = await this.workflowEngine.startWorkflow(
        workflowId,
        variables,
        options as Record<string, unknown> | undefined
      );

      // Store as memory in consciousness
      await this.consciousness.storeMemory(makeMemory({
        id: `workflow_${executionId}`,
        type: MemoryType.EPISODIC,
        content: `Started workflow: ${workflowIdOrTemplate}`,
        context: {
          workflowId,
          executionId,
          variables,
          ...options,
        },
        importance: 0.7,
      }));

      logger.info(`[AutomationIntegration] ✅ Workflow started: ${executionId}`);
      return executionId;
    } catch (error) {
      logger.error('[AutomationIntegration] Failed to start workflow:', error as any);
      throw error;
    }
  }

  /**
   * Pause a running workflow
   */
  async pauseWorkflow(executionId: string): Promise<void> {
    await this.workflowEngine.pauseExecution(executionId);
    logger.info(`[AutomationIntegration] Workflow paused: ${executionId}`);
  }

  /**
   * Resume a paused workflow
   */
  async resumeWorkflow(executionId: string): Promise<void> {
    await this.workflowEngine.resumeExecution(executionId);
    logger.info(`[AutomationIntegration] Workflow resumed: ${executionId}`);
  }

  /**
   * Cancel a workflow
   */
  async cancelWorkflow(executionId: string): Promise<void> {
    await this.workflowEngine.cancelExecution(executionId);
    logger.info(`[AutomationIntegration] Workflow cancelled: ${executionId}`);
  }

  // ============================================================================
  // Task Management
  // ============================================================================

  /**
   * Schedule a background task
   */
  async scheduleTask(
    taskType: string,
    data: Record<string, any>,
    options?: {
      priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      scheduledFor?: Date;
      recurring?: {
        cronExpression: string;
        endDate?: Date;
      };
    }
  ): Promise<string> {
    logger.info(`[AutomationIntegration] Scheduling task: ${taskType}`);

    const taskId = await this.taskQueue.scheduleTask(
      taskType as any,
      data,
      {
        priority: options?.priority as any || 'MEDIUM',
        retryPolicy: {
          maxAttempts: 3,
          backoffMs: 1000,
        },
        scheduledFor: options?.scheduledFor,
      }
    );

    // Store as goal in consciousness if it's an important task
    if (options?.priority === 'HIGH' || options?.priority === 'CRITICAL') {
      await this.consciousness.addGoal(makeGoal({
        id: `task_goal_${taskId}`,
        description: `Complete task: ${taskType} | إنجاز المهمة: ${taskType}`,
        priority: options.priority === 'CRITICAL' ? GoalPriority.CRITICAL : GoalPriority.HIGH,
        status: GoalStatus.ACTIVE,
        deadline: options.scheduledFor ? (typeof options.scheduledFor === 'string' ? options.scheduledFor : options.scheduledFor.toISOString()) : null,
        metadata: {
          taskId,
          taskType,
          taskData: data,
        },
      }));
    }

    logger.info(`[AutomationIntegration] ✅ Task scheduled: ${taskId}`);
    return taskId;
  }

  /**
   * Get task status
   */
  async getTaskStatus(taskId: string): Promise<any> {
    return await this.taskQueue.getTask(taskId);
  }

  // ============================================================================
  // Event & Trigger Management
  // ============================================================================

  /**
   * Publish an event to the event bus
   */
  async publishEvent(
    eventType: string,
    data: any,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.eventBus.publish(
      eventType as any,
      data,
      { metadata }
    );

    logger.info(`[AutomationIntegration] Event published: ${eventType}`);
  }

  /**
   * Subscribe to events
   */
  subscribeToEvent(
    eventType: string,
    handler: (event: any) => void | Promise<void>
  ): string {
    return this.eventBus.subscribe(eventType as any, handler);
  }

  /**
   * Add a trigger
   */
  async addTrigger(trigger: any): Promise<void> {
    await this.triggerEngine.registerTrigger(trigger);
    logger.info(`[AutomationIntegration] Trigger added: ${trigger.id || 'new trigger'}`);
  }

  // ============================================================================
  // Notification Management
  // ============================================================================

  /**
   * Send notification
   */
  async sendNotification(params: {
    channel: 'push' | 'email' | 'sms' | 'whatsapp' | 'in_app';
    recipient: string;
    title: string;
    body: string;
    priority?: 'low' | 'normal' | 'high' | 'urgent';
    scheduledFor?: Date;
  }): Promise<string> {
    const notificationId = await notificationEngine.send(params);
    logger.info(`[AutomationIntegration] Notification sent: ${notificationId}`);
    return notificationId;
  }

  /**
   * Send notification from template
   */
  async sendTemplateNotification(params: {
    templateId: string;
    recipient: string;
    templateData: Record<string, any>;
    priority?: 'low' | 'normal' | 'high' | 'urgent';
    scheduledFor?: Date;
  }): Promise<string> {
    const notificationId = await notificationEngine.sendFromTemplate(params);
    logger.info(`[AutomationIntegration] Template notification sent: ${notificationId}`);
    return notificationId;
  }

  // ============================================================================
  // Smart Routing
  // ============================================================================

  /**
   * Route a lead to best agent
   */
  async routeLead(params: {
    leadId: string;
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    requiredSkills?: string[];
    preferredLanguage?: string;
  }): Promise<{ agentId?: string; success: boolean; reason?: string }> {
    const result = await smartRouter.route({
      type: 'lead',
      entityId: params.leadId,
      priority: params.priority || 'medium',
      requiredSkills: params.requiredSkills,
      preferredLanguage: params.preferredLanguage,
    });

    if (result.success && result.agentId) {
      logger.info(`[AutomationIntegration] Lead ${params.leadId} routed to agent ${result.agentId}`);
    } else {
      logger.warn(`[AutomationIntegration] Failed to route lead ${params.leadId}: ${result.reason}`);
    }

    return result;
  }

  /**
   * Get routing statistics
   */
  getRoutingStats() {
    return smartRouter.getRoutingStats();
  }

  // ============================================================================
  // Event Subscriptions
  // ============================================================================

  /**
   * Subscribe to automation events and integrate with consciousness
   */
  private subscribeToAutomationEvents(): void {
    // Workflow events
    this.eventBus.subscribe('workflow:started', async (event) => {
      const payload = event.payload as any;
      await this.consciousness.storeMemory(makeMemory({
        id: `workflow_start_${payload.executionId}`,
        type: MemoryType.EPISODIC,
        content: `Workflow started: ${payload.workflowName}`,
        context: payload,
        importance: 0.6,
      }));
    });

    this.eventBus.subscribe('workflow:completed', async (event) => {
      const payload = event.payload as any;
      await this.consciousness.storeMemory(makeMemory({
        id: `workflow_complete_${payload.executionId}`,
        type: MemoryType.EPISODIC,
        content: `Workflow completed: ${payload.workflowName}`,
        context: payload,
        importance: 0.7,
      }));

      // Mark related goal as completed
      const goals = this.consciousness.getActiveGoals();
      const relatedGoal = goals.find(g => 
        g.metadata?.executionId === payload.executionId
      );
      
      if (relatedGoal) {
        relatedGoal.status = GoalStatus.COMPLETED;
        relatedGoal.completedAt = new Date().toISOString();
      }
    });

    this.eventBus.subscribe('workflow:failed', async (event) => {
      const payload = event.payload as any;
      await this.consciousness.storeMemory(makeMemory({
        id: `workflow_failed_${payload.executionId}`,
        type: MemoryType.EPISODIC,
        content: `Workflow failed: ${payload.workflowName} - ${payload.error}`,
        context: payload,
        importance: 0.8,
      }));
    });

    // Lead events
    this.eventBus.subscribe('lead:created', async (event) => {
      // Auto-trigger lead nurturing workflow for new leads
      if (event.payload && ((event.payload as any).source === 'whatsapp' || (event.payload as any).source === 'website')) {
        const payload = event.payload as any;
        await this.startWorkflow('lead_nurturing', {
          leadId: payload.leadId,
          leadName: payload.name,
          leadEmail: payload.email,
          leadPhone: payload.phone,
          initialScore: 50,
          source: payload.source,
        }, {
          triggeredBy: 'auto_nurture_trigger',
        });
      }
    });

    // Routing events
    this.eventBus.subscribe('lead:assigned', async (event) => {
      const payload = event.payload as any;
      await this.consciousness.storeMemory(makeMemory({
        id: `routing_${payload.entityId}`,
        type: MemoryType.EPISODIC,
        content: `${payload.entityType} routed to agent ${payload.agentId}`,
        context: payload,
        importance: 0.5,
      }));
    });

    // Task events
    this.eventBus.subscribe('task:completed', async (event) => {
      // Update related goals
      const payload = event.payload as any;
      const goals = this.consciousness.getActiveGoals();
      const taskGoal = goals.find(g => 
        g.metadata?.taskId === payload.taskId
      );
      
      if (taskGoal) {
        taskGoal.status = GoalStatus.COMPLETED;
        taskGoal.completedAt = new Date().toISOString();
      }
    });

    logger.info('[AutomationIntegration] ✅ Subscribed to automation events');
  }

  // ============================================================================
  // Default Triggers
  // ============================================================================

  /**
   * Register default automation triggers
   */
  private async registerDefaultTriggers(): Promise<void> {
    // Trigger 1: Lead scoring threshold
    await this.triggerEngine.registerTrigger({
      name: 'High Score Lead Auto-Route',
      nameAr: 'توجيه تلقائي للعملاء ذوي النقاط العالية',
      type: 'threshold',
      enabled: true,
      priority: 80,
      
      threshold: {
        metric: 'lead_score',
        operator: 'greater_than',
        value: 80,
      },
      
      actions: [
        {
          type: 'workflow',
          config: {
            workflowId: 'lead_qualification',
            variables: {
              leadId: '{{leadId}}',
              leadScore: '{{score}}',
            },
          },
        },
      ],
    });

    // Trigger 2: Task overdue
    await this.triggerEngine.registerTrigger({
      name: 'Overdue Task Escalation',
      nameAr: 'تصعيد المهام المتأخرة',
      type: 'schedule',
      enabled: true,
      priority: 90,
      
      schedule: {
        cron: '0 */6 * * *', // Every 6 hours
      },
      
      actions: [
        {
          type: 'workflow',
          config: {
            workflowId: 'task_escalation',
          },
        },
      ],
    });

    // Trigger 3: New customer onboarding
    await this.triggerEngine.registerTrigger({
      name: 'Auto Onboard New Customers',
      nameAr: 'إعداد تلقائي للعملاء الجدد',
      type: 'event',
      enabled: true,
      priority: 100,
      
      eventType: 'lead:created' as any,
      
      actions: [
        {
          type: 'workflow',
          config: {
            workflowId: 'customer_onboarding',
            variables: {
              customerId: '{{event.data.customerId}}',
              customerName: '{{event.data.name}}',
              customerEmail: '{{event.data.email}}',
              customerPhone: '{{event.data.phone}}',
              planType: '{{event.data.planType}}',
            },
          },
        },
      ],
    });

    logger.info('[AutomationIntegration] ✅ Default triggers registered');
  }

  // ============================================================================
  // Workflow Templates
  // ============================================================================

  /**
   * Load and register workflow templates
   */
  private loadWorkflowTemplates(): void {
    // Templates are already available via import
    // Just log their availability
    logger.info('[AutomationIntegration] ✅ Workflow templates available: lead_nurturing, follow_up_automation, lead_qualification, customer_onboarding, task_escalation');
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Get consciousness instance
   */
  getConsciousness(): ConsciousnessCore {
    return this.consciousness;
  }

  /**
   * Get workflow engine
   */
  getWorkflowEngine(): WorkflowEngine {
    return this.workflowEngine;
  }

  /**
   * Get trigger engine
   */
  getTriggerEngine(): TriggerEngine {
    return this.triggerEngine;
  }

  /**
   * Get task queue
   */
  getTaskQueue(): TaskQueue {
    return this.taskQueue;
  }

  /**
   * Get event bus
   */
  getEventBus(): EventBus {
    return this.eventBus;
  }

  /**
   * Check if initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create automation-integrated consciousness
 */
export async function createAutomationIntegratedConsciousness(
  consciousness: ConsciousnessCore
): Promise<AutomationIntegratedConsciousness> {
  const integrated = new AutomationIntegratedConsciousness(consciousness);
  await integrated.initialize();
  return integrated;
}

// ============================================================================
// Singleton Instance
// ============================================================================

let automationConsciousnessInstance: AutomationIntegratedConsciousness | null = null;

/**
 * Get or create automation-integrated consciousness singleton
 */
export async function getAutomationConsciousness(
  consciousness: ConsciousnessCore
): Promise<AutomationIntegratedConsciousness> {
  if (!automationConsciousnessInstance) {
    automationConsciousnessInstance = await createAutomationIntegratedConsciousness(consciousness);
  }
  return automationConsciousnessInstance;
}

/**
 * Reset singleton (for testing)
 */
export function resetAutomationConsciousness(): void {
  if (automationConsciousnessInstance) {
    automationConsciousnessInstance.shutdown();
    automationConsciousnessInstance = null;
  }
}

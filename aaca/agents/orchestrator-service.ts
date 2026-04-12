import { QueueManager } from '../queues/queue-manager';
import { EventBus } from '../events/event-bus';
import { Logger } from '../utils/logger';
import { prisma } from '../database/prisma-client';
import { 
  AITask, 
  TaskType, 
  TaskStatus, 
  TaskPriority,
  Workflow,
  WorkflowNode,
  AgentType,
  Event
} from '../types';

interface TaskRequest {
  title: string;
  description?: string;
  type: TaskType;
  priority?: TaskPriority;
  payload?: Record<string, unknown>;
  createdBy: string;
  workflowId?: string;
  parentTaskId?: string;
}

interface WorkflowRequest {
  name: string;
  description?: string;
  definition: WorkflowDefinition;
}

interface WorkflowDefinition {
  nodes: WorkflowNode[];
  edges: { from: string; to: string; condition?: string }[];
}

interface TaskAssignment {
  taskId: string;
  agent: AgentType;
  queue: string;
  priority: number;
}

export class OrchestratorService {
  private queueManager: QueueManager;
  private eventBus: EventBus;
  private logger: Logger;
  private isRunning: boolean = false;
  private taskHandlers: Map<TaskType, AgentType> = new Map();

  constructor(queueManager: QueueManager, eventBus: EventBus) {
    this.queueManager = queueManager;
    this.eventBus = eventBus;
    this.logger = new Logger('OrchestratorService');
    this.initializeTaskHandlers();
  }

  private initializeTaskHandlers(): void {
    // Map task types to agent types
    this.taskHandlers.set(TaskType.CODE_GENERATION, AgentType.DEV);
    this.taskHandlers.set(TaskType.CODE_REVIEW, AgentType.DEV);
    this.taskHandlers.set(TaskType.DEPLOYMENT, AgentType.DEV);
    this.taskHandlers.set(TaskType.ANALYSIS, AgentType.DEV);
    this.taskHandlers.set(TaskType.MONITORING, AgentType.OPS);
    this.taskHandlers.set(TaskType.SECURITY_SCAN, AgentType.SECURITY);
    this.taskHandlers.set(TaskType.TESTING, AgentType.QA);
    this.taskHandlers.set(TaskType.NOTIFICATION, AgentType.COMMUNICATION);
    this.taskHandlers.set(TaskType.EVOLUTION, AgentType.EVOLUTION);
    this.taskHandlers.set(TaskType.CUSTOM, AgentType.ORCHESTRATOR);
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.logger.info('Orchestrator Service started');

    // Subscribe to task completion events
    await this.eventBus.subscribe('task:completed', {
      eventType: 'task:completed',
      handler: this.handleTaskCompleted.bind(this)
    });

    await this.eventBus.subscribe('task:failed', {
      eventType: 'task:failed',
      handler: this.handleTaskFailed.bind(this)
    });

    // Subscribe to workflow events
    await this.eventBus.subscribe('workflow:step:completed', {
      eventType: 'workflow:step:completed',
      handler: this.handleWorkflowStepCompleted.bind(this)
    });
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    this.logger.info('Orchestrator Service stopped');
  }

  async createTask(request: TaskRequest): Promise<AITask> {
    const { 
      title, 
      description, 
      type, 
      priority = TaskPriority.MEDIUM, 
      payload,
      createdBy,
      workflowId,
      parentTaskId
    } = request;

    // Create task in database
    const task = await prisma.aITask.create({
      data: {
        title,
        description,
        type,
        status: TaskStatus.PENDING,
        priority,
        payload,
        createdById: createdBy,
        workflowId,
        parentTaskId
      }
    }) as AITask;

    this.logger.info('Task created', {
      taskId: task.id,
      type,
      priority,
      createdBy
    });

    // Publish task created event
    await this.eventBus.publish({
      type: 'task:created',
      source: 'orchestrator',
      payload: {
        taskId: task.id,
        type,
        priority,
        createdBy,
        workflowId
      }
    });

    return task;
  }

  async queueTask(taskId: string): Promise<void> {
    const task = await prisma.aITask.findUnique({
      where: { id: taskId }
    });

    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    // Determine which agent should handle this task
    const assignment = this.determineAssignment(task as AITask);

    // Update task status
    await prisma.aITask.update({
      where: { id: taskId },
      data: { 
        status: TaskStatus.QUEUED,
        assignedTo: assignment.agent
      }
    });

    // Add to appropriate queue
    await this.queueManager.addJob(
      assignment.queue,
      task.type,
      {
        taskId: task.id,
        title: task.title,
        type: task.type,
        priority: task.priority,
        payload: task.payload,
        createdBy: task.createdById
      },
      {
        priority: assignment.priority,
        jobId: task.id
      }
    );

    this.logger.info('Task queued', {
      taskId,
      queue: assignment.queue,
      agent: assignment.agent
    });

    // Publish task queued event
    await this.eventBus.publish({
      type: 'task:queued',
      source: 'orchestrator',
      payload: {
        taskId,
        queue: assignment.queue,
        agent: assignment.agent
      }
    });
  }

  async createWorkflow(request: WorkflowRequest): Promise<Workflow> {
    const { name, description, definition } = request;

    // Validate workflow definition
    this.validateWorkflowDefinition(definition);

    const workflow = await prisma.workflow.create({
      data: {
        name,
        description,
        definition: definition as unknown as Record<string, unknown>,
        status: 'DRAFT'
      }
    }) as Workflow;

    this.logger.info('Workflow created', {
      workflowId: workflow.id,
      name,
      nodeCount: definition.nodes.length
    });

    return workflow;
    }

  async executeWorkflow(workflowId: string, createdBy: string, input?: Record<string, unknown>): Promise<AITask> {
    const workflow = await prisma.workflow.findUnique({
      where: { id: workflowId }
    });

    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    const definition = workflow.definition as unknown as WorkflowDefinition;
    const startNode = definition.nodes.find(n => n.type === 'start');

    if (!startNode) {
      throw new Error('Workflow must have a start node');
    }

    // Create parent task for the workflow
    const workflowTask = await this.createTask({
      title: `Workflow: ${workflow.name}`,
      description: workflow.description || undefined,
      type: TaskType.CUSTOM,
      createdBy,
      workflowId,
      payload: {
        workflowId,
        input,
        currentNode: startNode.id,
        completedNodes: []
      }
    });

    // Queue the first step
    await this.queueNextWorkflowStep(workflowTask.id, startNode.id, definition);

    return workflowTask;
  }

  private determineAssignment(task: AITask): TaskAssignment {
    const agent = this.taskHandlers.get(task.type) || AgentType.ORCHESTRATOR;
    
    // Map agent type to queue name
    const queueMap: Record<AgentType, string> = {
      [AgentType.ORCHESTRATOR]: 'orchestrator',
      [AgentType.DEV]: 'dev-agent',
      [AgentType.OPS]: 'ops-agent',
      [AgentType.SECURITY]: 'security-agent',
      [AgentType.QA]: 'qa-agent',
      [AgentType.COMMUNICATION]: 'communication-agent',
      [AgentType.EVOLUTION]: 'evolution-agent'
    };

    // Calculate priority (lower number = higher priority in BullMQ)
    const priorityMap: Record<TaskPriority, number> = {
      [TaskPriority.CRITICAL]: 1,
      [TaskPriority.HIGH]: 3,
      [TaskPriority.MEDIUM]: 5,
      [TaskPriority.LOW]: 10
    };

    return {
      taskId: task.id,
      agent,
      queue: queueMap[agent],
      priority: priorityMap[task.priority]
    };
  }

  private async handleTaskCompleted(event: Event): Promise<void> {
    const { taskId, workflowId } = event.payload as Record<string, string>;

    this.logger.info('Task completed event received', { taskId, workflowId });

    // Update task status
    await prisma.aITask.update({
      where: { id: taskId },
      data: { 
        status: TaskStatus.COMPLETED,
        completedAt: new Date()
      }
    });

    // If part of a workflow, trigger next step
    if (workflowId) {
      const task = await prisma.aITask.findUnique({
        where: { id: taskId }
      });

      if (task?.parentTaskId) {
        await this.checkWorkflowCompletion(task.parentTaskId);
      }
    }
  }

  private async handleTaskFailed(event: Event): Promise<void> {
    const { taskId, error, workflowId } = event.payload as Record<string, string>;

    this.logger.error('Task failed event received', { taskId, error, workflowId });

    // Update task status
    await prisma.aITask.update({
      where: { id: taskId },
      data: { 
        status: TaskStatus.FAILED,
        error,
        failedAt: new Date()
      }
    });

    // Check for retry policy
    const task = await prisma.aITask.findUnique({
      where: { id: taskId }
    });

    if (task && task.retries < task.maxRetries) {
      this.logger.info('Retrying task', { taskId, attempt: task.retries + 1 });
      
      await prisma.aITask.update({
        where: { id: taskId },
        data: { 
          retries: { increment: 1 },
          status: TaskStatus.RETRYING
        }
      });

      // Re-queue with delay
      await this.queueManager.addJob(
        this.determineAssignment(task as AITask).queue,
        task.type,
        {
          taskId: task.id,
          title: task.title,
          type: task.type,
          priority: task.priority,
          payload: task.payload,
          createdBy: task.createdById
        },
        {
          delay: Math.pow(2, task.retries) * 1000, // Exponential backoff
          priority: this.determineAssignment(task as AITask).priority
        }
      );
    }
  }

  private async handleWorkflowStepCompleted(event: Event): Promise<void> {
    const { workflowTaskId, completedNodeId, nextNodeId, definition } = event.payload as {
      workflowTaskId: string;
      completedNodeId: string;
      nextNodeId?: string;
      definition: WorkflowDefinition;
    };

    if (nextNodeId) {
      await this.queueNextWorkflowStep(workflowTaskId, nextNodeId, definition);
    } else {
      // Workflow completed
      await this.completeWorkflow(workflowTaskId);
    }
  }

  private async queueNextWorkflowStep(
    workflowTaskId: string, 
    nodeId: string, 
    definition: WorkflowDefinition
  ): Promise<void> {
    const node = definition.nodes.find(n => n.id === nodeId);
    
    if (!node) {
      throw new Error(`Node ${nodeId} not found in workflow`);
    }

    // Create sub-task for this workflow step
    const stepTask = await this.createTask({
      title: `Workflow Step: ${node.type}`,
      type: this.mapNodeTypeToTaskType(node.type),
      priority: TaskPriority.HIGH,
      createdBy: 'system',
      parentTaskId: workflowTaskId,
      payload: {
        nodeId,
        nodeType: node.type,
        config: node.config
      }
    });

    // Queue the step task
    await this.queueTask(stepTask.id);
  }

  private async checkWorkflowCompletion(workflowTaskId: string): Promise<void> {
    const subTasks = await prisma.aITask.findMany({
      where: { parentTaskId: workflowTaskId }
    });

    const allCompleted = subTasks.every((t: any) => t.status === TaskStatus.COMPLETED);
    const anyFailed = subTasks.some((t: any) => t.status === TaskStatus.FAILED);

    if (allCompleted) {
      await this.completeWorkflow(workflowTaskId);
    } else if (anyFailed) {
      await this.failWorkflow(workflowTaskId, 'One or more workflow steps failed');
    }
  }

  private async completeWorkflow(workflowTaskId: string): Promise<void> {
    await prisma.aITask.update({
      where: { id: workflowTaskId },
      data: { 
        status: TaskStatus.COMPLETED,
        completedAt: new Date(),
        result: { completed: true }
      }
    });

    this.logger.info('Workflow completed', { workflowTaskId });

    await this.eventBus.publish({
      type: 'workflow:completed',
      source: 'orchestrator',
      payload: { workflowTaskId }
    });
  }

  private async failWorkflow(workflowTaskId: string, error: string): Promise<void> {
    await prisma.aITask.update({
      where: { id: workflowTaskId },
      data: { 
        status: TaskStatus.FAILED,
        failedAt: new Date(),
        error
      }
    });

    this.logger.error('Workflow failed', { workflowTaskId, error });

    await this.eventBus.publish({
      type: 'workflow:failed',
      source: 'orchestrator',
      payload: { workflowTaskId, error }
    });
  }

  private validateWorkflowDefinition(definition: WorkflowDefinition): void {
    if (!definition.nodes || definition.nodes.length === 0) {
      throw new Error('Workflow must have at least one node');
    }

    const nodeIds = new Set(definition.nodes.map(n => n.id));
    
    // Check all edges reference valid nodes
    for (const edge of definition.edges) {
      if (!nodeIds.has(edge.from)) {
        throw new Error(`Edge references unknown node: ${edge.from}`);
      }
      if (!nodeIds.has(edge.to)) {
        throw new Error(`Edge references unknown node: ${edge.to}`);
      }
    }

    // Check for start node
    const startNodes = definition.nodes.filter(n => n.type === 'start');
    if (startNodes.length !== 1) {
      throw new Error('Workflow must have exactly one start node');
    }
  }

  private mapNodeTypeToTaskType(nodeType: string): TaskType {
    const mapping: Record<string, TaskType> = {
      'code': TaskType.CODE_GENERATION,
      'deploy': TaskType.DEPLOYMENT,
      'test': TaskType.TESTING,
      'security': TaskType.SECURITY_SCAN,
      'notify': TaskType.NOTIFICATION,
      'analyze': TaskType.ANALYSIS,
      'monitor': TaskType.MONITORING,
      'evolve': TaskType.EVOLUTION
    };

    return mapping[nodeType] || TaskType.CUSTOM;
  }

  async getTaskStatus(taskId: string): Promise<{
    task: AITask | null;
    subTasks: AITask[];
  }> {
    const task = await prisma.aITask.findUnique({
      where: { id: taskId }
    }) as AITask | null;

    const subTasks = await prisma.aITask.findMany({
      where: { parentTaskId: taskId }
    }) as AITask[];

    return { task, subTasks };
  }

  async cancelTask(taskId: string): Promise<void> {
    await prisma.aITask.update({
      where: { id: taskId },
      data: { status: TaskStatus.CANCELLED }
    });

    // Cancel any queued jobs
    await this.queueManager.removeJob('orchestrator', taskId);
    await this.queueManager.removeJob('dev-agent', taskId);
    await this.queueManager.removeJob('ops-agent', taskId);
    await this.queueManager.removeJob('security-agent', taskId);
    await this.queueManager.removeJob('qa-agent', taskId);
    await this.queueManager.removeJob('communication-agent', taskId);
    await this.queueManager.removeJob('evolution-agent', taskId);

    this.logger.info('Task cancelled', { taskId });
  }

  async getSystemStats(): Promise<{
    tasks: Record<string, number>;
    workflows: Record<string, number>;
    queues: string[];
  }> {
    const [
      totalTasks,
      pendingTasks,
      inProgressTasks,
      completedTasks,
      failedTasks,
      totalWorkflows,
      activeWorkflows
    ] = await Promise.all([
      prisma.aITask.count(),
      prisma.aITask.count({ where: { status: TaskStatus.PENDING } }),
      prisma.aITask.count({ where: { status: TaskStatus.IN_PROGRESS } }),
      prisma.aITask.count({ where: { status: TaskStatus.COMPLETED } }),
      prisma.aITask.count({ where: { status: TaskStatus.FAILED } }),
      prisma.workflow.count(),
      prisma.workflow.count({ where: { status: 'ACTIVE' } })
    ]);

    return {
      tasks: {
        total: totalTasks,
        pending: pendingTasks,
        inProgress: inProgressTasks,
        completed: completedTasks,
        failed: failedTasks
      },
      workflows: {
        total: totalWorkflows,
        active: activeWorkflows
      },
      queues: this.queueManager.getQueueNames()
    };
  }
}

// Singleton instance
let orchestratorInstance: OrchestratorService | null = null;

export function getOrchestratorService(
  queueManager: QueueManager, 
  eventBus: EventBus
): OrchestratorService {
  if (!orchestratorInstance) {
    orchestratorInstance = new OrchestratorService(queueManager, eventBus);
  }
  return orchestratorInstance;
}

export function resetOrchestratorService(): void {
  orchestratorInstance = null;
}

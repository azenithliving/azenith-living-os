import { Job } from 'bullmq';
import { EventBus } from '../events/event-bus';
import { Logger } from '../utils/logger';
import { prisma } from '../database/prisma-client';
import { 
  AITask, 
  TaskStatus, 
  TaskType,
  Capability,
  CapabilityStatus,
  CapabilityManifest,
  AIAction,
  ActionType
} from '../types';

interface EvolutionConfig {
  autoPropose: boolean;
  simulationDepth: number;
  requireApproval: boolean;
  maxProposalsPerDay: number;
}

interface FeatureProposal {
  taskId: string;
  name: string;
  description: string;
  purpose: string;
  targetModule: string;
  estimatedImpact: 'low' | 'medium' | 'high';
}

interface CapabilityDefinition {
  name: string;
  description: string;
  version: string;
  code: string;
  manifest: CapabilityManifest;
  dependencies: string[];
}

const DEFAULT_CONFIG: EvolutionConfig = {
  autoPropose: false,
  simulationDepth: 3,
  requireApproval: true,
  maxProposalsPerDay: 5
};

export class EvolutionAgentService {
  private eventBus: EventBus;
  private logger: Logger;
  private config: EvolutionConfig;
  private proposalsToday: number = 0;
  private lastProposalReset: Date = new Date();

  constructor(eventBus: EventBus, config: EvolutionConfig = DEFAULT_CONFIG) {
    this.eventBus = eventBus;
    this.logger = new Logger('EvolutionAgentService');
    this.config = config;
  }

  async processJob(job: Job): Promise<unknown> {
    const { taskId, title, type, payload } = job.data;
    
    this.logger.info('Processing evolution agent job', { jobId: job.id, taskId, type });

    try {
      await this.updateTaskStatus(taskId, TaskStatus.IN_PROGRESS);

      let result: unknown;

      switch (type) {
        case TaskType.EVOLUTION:
          result = await this.processEvolution(payload as Record<string, unknown>);
          break;

        case TaskType.ANALYSIS:
          result = await this.analyzeSystemForImprovements(payload as Record<string, unknown>);
          break;

        default:
          throw new Error(`Unknown task type: ${type}`);
      }

      await this.updateTaskStatus(taskId, TaskStatus.COMPLETED, result);

      await this.eventBus.publish({
        type: 'task:completed',
        source: 'evolution-agent',
        payload: { taskId, result }
      });

      this.logger.info('Evolution agent job completed', { jobId: job.id, taskId });

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      this.logger.error('Evolution agent job failed', { jobId: job.id, taskId, error: errorMessage });

      await this.updateTaskStatus(taskId, TaskStatus.FAILED, undefined, errorMessage);

      await this.eventBus.publish({
        type: 'task:failed',
        source: 'evolution-agent',
        payload: { taskId, error: errorMessage }
      });

      throw error;
    }
  }

  async proposeFeature(proposal: FeatureProposal): Promise<{
    capability: Capability;
    simulation: {
      passed: boolean;
      issues: string[];
      recommendations: string[];
    };
    requiresApproval: boolean;
  }> {
    this.checkProposalLimit();

    this.logger.info('Proposing new feature', { 
      name: proposal.name, 
      targetModule: proposal.targetModule 
    });

    // Generate capability definition
    const definition = await this.generateCapabilityDefinition(proposal);

    // Create capability record
    const capability = await prisma.capability.create({
      data: {
        name: definition.name,
        description: definition.description,
        version: definition.version,
        status: CapabilityStatus.DRAFT,
        proposedBy: 'evolution-agent',
        code: definition.code,
        manifest: definition.manifest as unknown as Record<string, unknown>,
        dependencies: definition.dependencies
      }
    }) as Capability;

    // Run simulation
    if (!capability.code) {
      throw new Error('Capability code is required for simulation');
    }
    const simulation = await this.simulateCapability(capability as Capability & { code: string });

    // Update capability with simulation results
    await prisma.capability.update({
      where: { id: capability.id },
      data: {
        status: simulation.passed ? CapabilityStatus.IN_SIMULATION : CapabilityStatus.DRAFT,
        simulationResult: {
          passed: simulation.passed,
          issues: simulation.issues,
          recommendations: simulation.recommendations,
          timestamp: new Date().toISOString()
        } as Record<string, unknown>
      }
    });

    this.proposalsToday++;

    // Publish proposal event
    await this.eventBus.publish({
      type: 'evolution:feature-proposed',
      source: 'evolution-agent',
      payload: {
        capabilityId: capability.id,
        name: capability.name,
        simulationPassed: simulation.passed,
        requiresApproval: this.config.requireApproval
      }
    });

    return {
      capability,
      simulation,
      requiresApproval: this.config.requireApproval
    };
  }

  async submitForSecurityReview(capabilityId: string): Promise<{
    submitted: boolean;
    reviewId: string;
  }> {
    this.logger.info('Submitting capability for security review', { capabilityId });

    const capability = await prisma.capability.findUnique({
      where: { id: capabilityId }
    });

    if (!capability) {
      throw new Error(`Capability ${capabilityId} not found`);
    }

    // Update status
    await prisma.capability.update({
      where: { id: capabilityId },
      data: { status: CapabilityStatus.SECURITY_REVIEW }
    });

    // Request security review via event
    await this.eventBus.publish({
      type: 'evolution:security-review-requested',
      source: 'evolution-agent',
      payload: {
        capabilityId,
        code: capability.code,
        manifest: capability.manifest
      }
    });

    return {
      submitted: true,
      reviewId: `review-${capabilityId}`
    };
  }

  async activateCapability(capabilityId: string, approvedBy: string): Promise<{
    activated: boolean;
    actionId?: string;
  }> {
    this.logger.info('Activating capability', { capabilityId, approvedBy });

    const capability = await prisma.capability.findUnique({
      where: { id: capabilityId }
    });

    if (!capability) {
      throw new Error(`Capability ${capabilityId} not found`);
    }

    if (capability.status !== CapabilityStatus.APPROVED && 
        capability.status !== CapabilityStatus.SECURITY_REVIEW) {
      throw new Error(`Capability must be approved before activation. Current status: ${capability.status}`);
    }

    // Update capability status
    await prisma.capability.update({
      where: { id: capabilityId },
      data: {
        status: CapabilityStatus.ACTIVE,
        approvedById: approvedBy,
        approvedAt: new Date(),
        activatedAt: new Date()
      }
    });

    // Create action for capability installation
    const action = await prisma.aIAction.create({
      data: {
        taskId: capability.proposedBy,
        type: ActionType.CUSTOM,
        status: 'PENDING' as any,
        payload: {
          capabilityId,
          action: 'install',
          code: capability.code
        },
        requiresApproval: false
      }
    });

    // Publish activation event
    await this.eventBus.publish({
      type: 'evolution:capability-activated',
      source: 'evolution-agent',
      payload: {
        capabilityId,
        name: capability.name,
        approvedBy,
        actionId: action.id
      }
    });

    return {
      activated: true,
      actionId: action.id
    };
  }

  async deprecateCapability(capabilityId: string, reason: string): Promise<void> {
    this.logger.info('Deprecating capability', { capabilityId, reason });

    await prisma.capability.update({
      where: { id: capabilityId },
      data: {
        status: CapabilityStatus.DEPRECATED,
        deactivatedAt: new Date()
      }
    });

    await this.eventBus.publish({
      type: 'evolution:capability-deprecated',
      source: 'evolution-agent',
      payload: { capabilityId, reason }
    });
  }

  async analyzeSystemForImprovements(payload: Record<string, unknown>): Promise<{
    opportunities: Array<{
      area: string;
      currentState: string;
      proposedImprovement: string;
      expectedBenefit: string;
      priority: 'low' | 'medium' | 'high';
    }>;
    recommendations: string[];
  }> {
    this.logger.info('Analyzing system for improvement opportunities');

    // Get system metrics
    const taskStats = await prisma.aITask.groupBy({
      by: ['status'],
      _count: { id: true }
    });

    const failedTasks = taskStats.find((s: { status: string }) => s.status === 'FAILED')?._count.id || 0;
    const totalTasks = taskStats.reduce((sum: number, s: { _count: { id: number } }) => sum + s._count.id, 0);
    const failureRate = totalTasks > 0 ? failedTasks / totalTasks : 0;

    const opportunities: Array<{
      area: string;
      currentState: string;
      proposedImprovement: string;
      expectedBenefit: string;
      priority: 'low' | 'medium' | 'high';
    }> = [];

    // Analyze failure patterns
    if (failureRate > 0.1) {
      opportunities.push({
        area: 'Reliability',
        currentState: `High failure rate: ${(failureRate * 100).toFixed(1)}%`,
        proposedImprovement: 'Implement better error handling and retry mechanisms',
        expectedBenefit: 'Reduce task failures by 50%',
        priority: 'high'
      });
    }

    // Check for pending approvals
    const pendingApprovals = await prisma.approval.count({
      where: { status: 'PENDING' }
    });

    if (pendingApprovals > 10) {
      opportunities.push({
        area: 'Workflow',
        currentState: `${pendingApprovals} pending approvals causing delays`,
        proposedImprovement: 'Auto-approve low-risk actions and batch similar requests',
        expectedBenefit: 'Reduce approval backlog by 70%',
        priority: 'medium'
      });
    }

    // Check notification backlog
    const failedNotifications = await prisma.notification.count({
      where: { status: 'FAILED' }
    });

    if (failedNotifications > 5) {
      opportunities.push({
        area: 'Communication',
        currentState: `${failedNotifications} failed notifications`,
        proposedImprovement: 'Implement notification retry with exponential backoff',
        expectedBenefit: 'Improve notification reliability to 99.9%',
        priority: 'medium'
      });
    }

    const recommendations: string[] = [
      'Consider implementing predictive scaling based on task queue depth',
      'Add more comprehensive health checks for external dependencies',
      'Implement automated security scanning for all code changes'
    ];

    return {
      opportunities: opportunities.sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      }),
      recommendations
    };
  }

  async getCapabilities(status?: CapabilityStatus): Promise<Capability[]> {
    const where = status ? { status } : {};
    
    const capabilities = await prisma.capability.findMany({
      where,
      orderBy: { proposedAt: 'desc' }
    });

    return capabilities as Capability[];
  }

  async getCapabilityById(capabilityId: string): Promise<Capability | null> {
    const capability = await prisma.capability.findUnique({
      where: { id: capabilityId }
    });

    return capability as Capability | null;
  }

  private async processEvolution(payload: Record<string, unknown>): Promise<{
    processed: boolean;
    proposals?: FeatureProposal[];
  }> {
    // This handles general evolution tasks
    const mode = payload.mode as string;

    if (mode === 'auto-propose') {
      if (!this.config.autoPropose) {
        return { processed: true, proposals: [] };
      }

      const analysis = await this.analyzeSystemForImprovements({});
      const proposals: FeatureProposal[] = [];

      for (const opp of analysis.opportunities.filter(o => o.priority === 'high').slice(0, 3)) {
        if (this.proposalsToday < this.config.maxProposalsPerDay) {
          proposals.push({
            taskId: 'auto-evolution',
            name: `Auto-improvement: ${opp.area}`,
            description: opp.proposedImprovement,
            purpose: opp.expectedBenefit,
            targetModule: opp.area.toLowerCase(),
            estimatedImpact: opp.priority
          });
        }
      }

      return { processed: true, proposals };
    }

    return { processed: true };
  }

  private async generateCapabilityDefinition(proposal: FeatureProposal): Promise<CapabilityDefinition> {
    // Generate code based on proposal
    const code = this.generateCapabilityCode(proposal);

    const manifest: CapabilityManifest = {
      entryPoint: `capabilities/${proposal.name.toLowerCase().replace(/\s+/g, '-')}.ts`,
      exports: ['initialize', 'execute', 'cleanup'],
      requiredPermissions: ['task:read', 'task:write'],
      configSchema: {
        type: 'object',
        properties: {
          enabled: { type: 'boolean' }
        }
      }
    };

    return {
      name: proposal.name,
      description: proposal.description,
      version: '1.0.0',
      code,
      manifest: manifest as CapabilityManifest,
      dependencies: []
    };
  }

  private generateCapabilityCode(proposal: FeatureProposal): string {
    const className = proposal.name.replace(/\s+/g, '') + 'Capability';
    
    return `
// Auto-generated capability: ${proposal.name}
// Purpose: ${proposal.purpose}

import { EventBus } from '../events/event-bus';
import { Logger } from '../utils/logger';

export class ${className} {
  private eventBus: EventBus;
  private logger: Logger;
  private config: Record<string, unknown>;

  constructor(eventBus: EventBus, config: Record<string, unknown> = {}) {
    this.eventBus = eventBus;
    this.logger = new Logger('${className}');
    this.config = config;
  }

  async initialize(): Promise<void> {
    this.logger.info('Initializing ${proposal.name}');
    // Initialization logic here
  }

  async execute(payload: Record<string, unknown>): Promise<unknown> {
    this.logger.info('Executing ${proposal.name}', payload);
    
    try {
      // Main capability logic here
      const result = await this.process(payload);
      
      await this.eventBus.publish({
        type: 'capability:${proposal.name.toLowerCase().replace(/\s+/g, '-')}:completed',
        source: '${className}',
        payload: { result }
      });

      return result;
    } catch (error) {
      this.logger.error('Execution failed', { error });
      throw error;
    }
  }

  private async process(payload: Record<string, unknown>): Promise<unknown> {
    // Implementation for: ${proposal.description}
    return { success: true, processed: payload };
  }

  async cleanup(): Promise<void> {
    this.logger.info('Cleaning up ${proposal.name}');
    // Cleanup logic here
  }
}

export default ${className};
`;
  }

  private async simulateCapability(capability: Capability & { code: string }): Promise<{
    passed: boolean;
    issues: string[];
    recommendations: string[];
  }> {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Syntax check (basic)
    if (!capability.code.includes('export class') && !capability.code.includes('export function')) {
      issues.push('Capability code does not export any classes or functions');
    }

    // Check for required methods
    const requiredMethods = ['initialize', 'execute', 'cleanup'];
    for (const method of requiredMethods) {
      if (!capability.code.includes(`async ${method}`)) {
        issues.push(`Missing required method: ${method}`);
      }
    }

    // Check dependencies
    if (capability.dependencies.length > 10) {
      recommendations.push('Consider reducing dependencies for better maintainability');
    }

    // Check code size
    const lines = capability.code.split('\n').length;
    if (lines > 500) {
      recommendations.push('Large codebase - consider splitting into modules');
    }

    // Check for security patterns
    const dangerousPatterns = ['eval(', 'Function(', 'child_process'];
    for (const pattern of dangerousPatterns) {
      if (capability.code.includes(pattern)) {
        issues.push(`Potentially dangerous pattern detected: ${pattern}`);
      }
    }

    return {
      passed: issues.length === 0,
      issues,
      recommendations
    };
  }

  private checkProposalLimit(): void {
    const now = new Date();
    const isNewDay = now.getDate() !== this.lastProposalReset.getDate() ||
                     now.getMonth() !== this.lastProposalReset.getMonth() ||
                     now.getFullYear() !== this.lastProposalReset.getFullYear();

    if (isNewDay) {
      this.proposalsToday = 0;
      this.lastProposalReset = now;
    }

    if (this.proposalsToday >= this.config.maxProposalsPerDay) {
      throw new Error(`Daily proposal limit (${this.config.maxProposalsPerDay}) reached`);
    }
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

  updateConfig(config: Partial<EvolutionConfig>): void {
    this.config = { ...this.config, ...config };
    this.logger.info('Evolution config updated', this.config as unknown as Record<string, unknown>);
  }
}

// Singleton instance
let evolutionAgentInstance: EvolutionAgentService | null = null;

export function getEvolutionAgentService(
  eventBus: EventBus, 
  config?: EvolutionConfig
): EvolutionAgentService {
  if (!evolutionAgentInstance) {
    evolutionAgentInstance = new EvolutionAgentService(eventBus, config);
  }
  return evolutionAgentInstance;
}

export function resetEvolutionAgentService(): void {
  evolutionAgentInstance = null;
}

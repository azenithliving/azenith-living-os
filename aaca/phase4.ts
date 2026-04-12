/**
 * AACA Phase 4: Full System Integration
 *
 * Integrates all phases into a cohesive system:
 * - Phase 1: Database & Foundation
 * - Phase 2: Queue & Event System (Nervous System)
 * - Phase 3: Multi-Agent Services (The Brains)
 * - Phase 4: Execution Engine, Approval System & API
 */

import { startBrains, shutdownBrains, Brains } from './phase3';
import { getApprovalSystem, ApprovalSystem } from './approval/approval-system';
import { getExecutionEngine, ExecutionEngine } from './execution/execution-engine';
import { Logger } from './utils/logger';
import { EventBus } from './events/event-bus';
import { QueueManager } from './queues/queue-manager';
import { Job } from 'bullmq';
import { TaskPriority, TaskType } from './types';

const logger = new Logger('Phase4-Integration');

interface Phase4Config {
  redisUrl: string;
  databaseUrl: string;
  port?: number;
}

const DEFAULT_CONFIG: Phase4Config = {
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  databaseUrl: process.env.DATABASE_URL || 'postgresql://localhost:5432/aaca',
  port: parseInt(process.env.AACA_PORT || '3001', 10)
};

class FullIntegration {
  private brains!: Brains;
  private approvalSystem!: ApprovalSystem;
  private executionEngine!: ExecutionEngine;
  private config: Phase4Config;
  private isRunning: boolean = false;

  constructor(config: Partial<Phase4Config> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize all 4 phases
   */
  async initialize(): Promise<void> {
    logger.info('═══════════════════════════════════════════════════════════');
    logger.info('  AZENITH AUTONOMOUS COMPANY AI SYSTEM (AACA) v1.0.0');
    logger.info('═══════════════════════════════════════════════════════════');
    logger.info('');

    try {
      // Phase 3: Start The Brains (includes Phase 1 & 2)
      logger.info('🧠 Starting Phase 3: The Brains...');
      this.brains = await startBrains({
        redisUrl: this.config.redisUrl,
        databaseUrl: this.config.databaseUrl
      });
      logger.info('✅ Brains initialized');

      // Get services from Brains
      const { nervousSystem } = this.brains.getServices();
      const { eventBus, queueManager } = nervousSystem.getServices();

      // Phase 4: Initialize Approval System
      logger.info('✅ Initializing Approval System...');
      this.approvalSystem = getApprovalSystem(eventBus);
      logger.info('✅ Approval System ready');

      // Phase 4: Initialize Execution Engine
      logger.info('⚙️ Initializing Execution Engine...');
      this.executionEngine = getExecutionEngine(eventBus, this.approvalSystem);
      logger.info('✅ Execution Engine ready');

      // Setup execution workers
      await this.setupExecutionWorkers(eventBus);

      this.isRunning = true;

      logger.info('');
      logger.info('🚀🚀🚀 PHASE 4: FULL INTEGRATION READY 🚀🚀🚀');
      logger.info('');
      logger.info('All 4 Phases Operational:');
      logger.info('  📦 Phase 1: Foundation (Database)');
      logger.info('  🔌 Phase 2: Nervous System (Queue & Events)');
      logger.info('  🧠 Phase 3: The Brains (7 Agents)');
      logger.info('  ⚙️ Phase 4: Execution & Control');
      logger.info('');
      logger.info('═══════════════════════════════════════════════════════════');

      // Publish system ready event
      await eventBus.publish({
        type: 'system:ready',
        source: 'phase4',
        payload: {
          timestamp: new Date().toISOString(),
          phases: [1, 2, 3, 4],
          agents: 7,
          status: 'operational'
        }
      });
    } catch (error) {
      logger.error('❌ Failed to initialize Phase 4', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Setup execution queue workers
   */
  private async setupExecutionWorkers(eventBus: EventBus): Promise<void> {
    const { nervousSystem } = this.brains.getServices();
    const { queueManager } = nervousSystem.getServices();

    // Execution worker for running actions
    await queueManager.addWorker('execution', async (job: Job) => {
      const { actionId, context } = job.data;

      const { prisma } = await import('./database/prisma-client');
      const action = await prisma.aIAction.findUnique({
        where: { id: actionId }
      });

      if (!action) {
        throw new Error(`Action ${actionId} not found`);
      }

      return this.executionEngine.executeAction(action, context);
    }, 2);

    // Approval worker for handling approval workflows
    await queueManager.addWorker('approval', async (job: Job) => {
      const { approvalId } = job.data;
      logger.info('Processing approval workflow', { approvalId });
      return { processed: true, approvalId };
    }, 1);

    logger.info('✅ Execution workers configured');
  }

  /**
   * Get all services for API layer
   */
  getServices(): {
    brains: Brains;
    approvalSystem: ApprovalSystem;
    executionEngine: ExecutionEngine;
  } {
    return {
      brains: this.brains,
      approvalSystem: this.approvalSystem,
      executionEngine: this.executionEngine
    };
  }

  /**
   * Create a task through the orchestrator
   */
  async createTask(task: {
    title: string;
    description?: string;
    type: TaskType;
    priority?: TaskPriority;
    payload?: Record<string, unknown>;
    createdBy: string;
  }): Promise<{ id: string; status: string }> {
    if (!this.isRunning) {
      throw new Error('Phase 4 not initialized');
    }

    return this.brains.createTask(task);
  }

  /**
   * Execute a workflow
   */
  async executeWorkflow(workflowId: string, createdBy: string): Promise<{ id: string }> {
    if (!this.isRunning) {
      throw new Error('Phase 4 not initialized');
    }

    return this.brains.executeWorkflow(workflowId, createdBy);
  }

  /**
   * Get system stats
   */
  async getStats(): Promise<{
    brains: Awaited<ReturnType<Brains['getStats']>>;
    phases: number[];
    status: string;
  }> {
    if (!this.isRunning) {
      throw new Error('Phase 4 not initialized');
    }

    const brainStats = await this.brains.getStats();

    return {
      brains: brainStats,
      phases: [1, 2, 3, 4],
      status: 'operational'
    };
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    logger.info('🛑 Shutting down Phase 4...');

    await shutdownBrains();
    logger.info('✅ All phases shut down');

    this.isRunning = false;
  }

  isHealthy(): boolean {
    return this.isRunning;
  }
}

// Singleton instance
let phase4Instance: FullIntegration | null = null;

export function createPhase4(config?: Partial<Phase4Config>): FullIntegration {
  if (!phase4Instance) {
    phase4Instance = new FullIntegration(config);
  }
  return phase4Instance;
}

export function getPhase4(): FullIntegration | null {
  return phase4Instance;
}

export async function startPhase4(config?: Partial<Phase4Config>): Promise<FullIntegration> {
  const phase4 = createPhase4(config);
  await phase4.initialize();
  return phase4;
}

export async function shutdownPhase4(): Promise<void> {
  if (phase4Instance) {
    await phase4Instance.shutdown();
    phase4Instance = null;
  }
}

// Direct execution
if (require.main === module) {
  const phase4 = createPhase4();

  phase4.initialize().then(() => {
    logger.info('✨ AACA Phase 4 running');
    logger.info(`API available at http://localhost:${DEFAULT_CONFIG.port}/api/v1`);
  }).catch((error) => {
    logger.error('Failed to start Phase 4', { error });
    process.exit(1);
  });

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    await phase4.shutdown();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    await phase4.shutdown();
    process.exit(0);
  });
}

export { FullIntegration };
export default FullIntegration;

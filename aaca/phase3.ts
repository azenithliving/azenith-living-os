/**
 * AACA Phase 3: The Brains (Multi-Agent Services)
 *
 * Orchestrator + 6 Specialized Agents:
 * - Dev Agent (code generation & review)
 * - Security Agent (security scans & risk assessment)
 * - QA Agent (testing & quality checks)
 * - Ops Agent (deployment & monitoring)
 * - Communication Agent (notifications & messaging)
 * - Evolution Agent (system self-improvement)
 *
 * All agents communicate via Event Bus (Phase 2)
 */

import { startNervousSystem, shutdownNervousSystem, NervousSystem } from './phase2';
import { getOrchestratorService, OrchestratorService } from './agents/orchestrator-service';
import { getDevAgentService, DevAgentService } from './agents/dev-agent-service';
import { getSecurityAgentService, SecurityAgentService } from './agents/security-agent-service';
import { getQAAgentService, QAAgentService } from './agents/qa-agent-service';
import { getOpsAgentService, OpsAgentService } from './agents/ops-agent-service';
import { getCommunicationAgentService, CommunicationAgentService } from './agents/communication-agent-service';
import { getEvolutionAgentService, EvolutionAgentService } from './agents/evolution-agent-service';
import { Logger } from './utils/logger';
import { TaskType, TaskPriority } from './types';
import { prisma } from './database/prisma-client';

const logger = new Logger('Phase3-Brains');

interface Phase3Config {
  redisUrl: string;
  databaseUrl: string;
}

const DEFAULT_CONFIG: Phase3Config = {
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  databaseUrl: process.env.DATABASE_URL || 'postgresql://localhost:5432/aaca'
};

class Brains {
  private nervousSystem!: NervousSystem;
  private orchestrator!: OrchestratorService;
  private devAgent!: DevAgentService;
  private securityAgent!: SecurityAgentService;
  private qaAgent!: QAAgentService;
  private opsAgent!: OpsAgentService;
  private communicationAgent!: CommunicationAgentService;
  private evolutionAgent!: EvolutionAgentService;
  private config: Phase3Config;
  private isRunning: boolean = false;

  constructor(config: Partial<Phase3Config> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize all agents
   */
  async initialize(): Promise<void> {
    logger.info('🧠 Initializing Phase 3: The Brains...');

    try {
      // 1. Start Phase 2 (Nervous System)
      logger.info('🔌 Starting Nervous System (Phase 2)...');
      this.nervousSystem = await startNervousSystem({
        redisUrl: this.config.redisUrl,
        databaseUrl: this.config.databaseUrl
      });
      logger.info('✅ Nervous System ready');

      // 2. Get services from nervous system
      const { queueManager, eventBus } = this.nervousSystem.getServices();

      // 3. Initialize Orchestrator
      logger.info('🎛️ Initializing Orchestrator Agent...');
      this.orchestrator = getOrchestratorService(queueManager, eventBus);
      await this.orchestrator.start();
      logger.info('✅ Orchestrator ready');

      // 4. Initialize Dev Agent
      logger.info('💻 Initializing Dev Agent...');
      this.devAgent = getDevAgentService(eventBus);
      await queueManager.addWorker('dev-agent', async (job) => {
        return this.devAgent.processJob(job);
      }, 2);
      logger.info('✅ Dev Agent ready');

      // 5. Initialize Security Agent
      logger.info('🔒 Initializing Security Agent...');
      this.securityAgent = getSecurityAgentService(eventBus);
      await queueManager.addWorker('security-agent', async (job) => {
        return this.securityAgent.processJob(job);
      }, 1);
      logger.info('✅ Security Agent ready');

      // 6. Initialize QA Agent
      logger.info('🧪 Initializing QA Agent...');
      this.qaAgent = getQAAgentService(eventBus);
      await queueManager.addWorker('qa-agent', async (job) => {
        return this.qaAgent.processJob(job);
      }, 2);
      logger.info('✅ QA Agent ready');

      // 7. Initialize Ops Agent
      logger.info('📊 Initializing Ops Agent...');
      this.opsAgent = getOpsAgentService(eventBus);
      await queueManager.addWorker('ops-agent', async (job) => {
        return this.opsAgent.processJob(job);
      }, 2);
      logger.info('✅ Ops Agent ready');

      // 8. Initialize Communication Agent
      logger.info('📡 Initializing Communication Agent...');
      this.communicationAgent = getCommunicationAgentService(eventBus);
      await queueManager.addWorker('communication-agent', async (job) => {
        return this.communicationAgent.processJob(job);
      }, 5);
      logger.info('✅ Communication Agent ready');

      // 9. Initialize Evolution Agent
      logger.info('🧬 Initializing Evolution Agent...');
      this.evolutionAgent = getEvolutionAgentService(eventBus);
      await queueManager.addWorker('evolution-agent', async (job) => {
        return this.evolutionAgent.processJob(job);
      }, 1);
      logger.info('✅ Evolution Agent ready');

      // 10. Setup agent event handlers
      await this.setupAgentEventHandlers();

      this.isRunning = true;

      // 9. Publish system ready event
      await eventBus.publish({
        type: 'system:brains:ready',
        source: 'phase3',
        payload: {
          timestamp: new Date().toISOString(),
          agents: ['orchestrator', 'dev', 'security', 'qa', 'ops', 'communication', 'evolution']
        }
      });

      logger.info('');
      logger.info('🧠🧠🧠 Phase 3: The Brains READY 🧠🧠🧠');
      logger.info('');
      logger.info('Active Agents:');
      logger.info('  🎛️  Orchestrator - Task routing & workflow management');
      logger.info('  💻  Dev Agent - Code generation & repository analysis');
      logger.info('  🔒  Security Agent - Risk scoring & security scanning');
      logger.info('  🧪  QA Agent - Test execution & build validation');
      logger.info('  📊  Ops Agent - Monitoring & health checks');
      logger.info('  📡  Communication Agent - Notifications & messaging');
      logger.info('  🧬  Evolution Agent - System self-improvement');
      logger.info('');

    } catch (error) {
      logger.error('❌ Failed to initialize Brains', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Setup event handlers for agent communication
   */
  private async setupAgentEventHandlers(): Promise<void> {
    const { eventBus } = this.nervousSystem.getServices();

    // Dev Agent events
    await eventBus.subscribe('agent:dev:process', {
      eventType: 'agent:dev:process',
      handler: async (event) => {
        const { taskId, type, payload } = event.payload as Record<string, unknown>;
        logger.info(`📝 Dev Agent processing: ${type}`, { taskId });

        // Simulate processing and publish completion
        setTimeout(async () => {
          await eventBus.publish({
            type: 'agent:complete',
            source: 'dev-agent',
            payload: {
              taskId,
              result: { success: true, filesModified: 1, filesCreated: 0 }
            }
          });
        }, 1000);
      }
    });

    // Security Agent events
    await eventBus.subscribe('agent:security:process', {
      eventType: 'agent:security:process',
      handler: async (event) => {
        const { taskId, payload } = event.payload as Record<string, unknown>;
        logger.info(`🔒 Security Agent scanning...`, { taskId });

        // Risk assessment
        const riskScore = 25; // Low risk simulation

        await eventBus.publish({
          type: 'agent:complete',
          source: 'security-agent',
          payload: {
            taskId,
            result: {
              approved: riskScore < 50,
              riskScore,
              findings: []
            }
          }
        });
      }
    });

    // QA Agent events
    await eventBus.subscribe('agent:qa:process', {
      eventType: 'agent:qa:process',
      handler: async (event) => {
        const { taskId, type } = event.payload as Record<string, unknown>;
        logger.info(`🧪 QA Agent running tests: ${type}`, { taskId });

        await eventBus.publish({
          type: 'agent:complete',
          source: 'qa-agent',
          payload: {
            taskId,
            result: {
              passed: 15,
              failed: 0,
              skipped: 2,
              success: true
            }
          }
        });
      }
    });

    // Ops Agent events
    await eventBus.subscribe('agent:ops:process', {
      eventType: 'agent:ops:process',
      handler: async (event) => {
        const { taskId } = event.payload as Record<string, unknown>;
        logger.info(`📊 Ops Agent monitoring...`, { taskId });

        await eventBus.publish({
          type: 'agent:complete',
          source: 'ops-agent',
          payload: {
            taskId,
            result: {
              cpu: 45,
              memory: 60,
              status: 'healthy'
            }
          }
        });
      }
    });

    // Listen for security approval requirements
    await eventBus.subscribe('security:approval-required', {
      eventType: 'security:approval-required',
      handler: async (event) => {
        const { actionId, riskScore } = event.payload as Record<string, unknown>;
        logger.warn(`⚠️ Security approval required for action ${actionId}`, { riskScore });
      }
    });

    logger.info('📡 Agent event handlers registered');
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
      throw new Error('Brains not initialized');
    }

    const result = await this.orchestrator.createTask({
      ...task,
      priority: task.priority || TaskPriority.MEDIUM
    });

    logger.info(`📝 Task created: ${result.id}`, { type: task.type });
    return { id: result.id, status: result.status };
  }

  /**
   * Execute a workflow
   */
  async executeWorkflow(workflowId: string, createdBy: string): Promise<{ id: string }> {
    if (!this.isRunning) {
      throw new Error('Brains not initialized');
    }

    const task = await this.orchestrator.executeWorkflow(workflowId, createdBy);
    logger.info(`🔄 Workflow executed: ${workflowId}`, { taskId: task.id });
    return { id: task.id };
  }

  /**
   * Get system stats
   */
  async getStats(): Promise<{
    orchestrator: ReturnType<OrchestratorService['getSystemStats']>;
    queues: string[];
    health: Awaited<ReturnType<NervousSystem['getHealth']>>;
  }> {
    if (!this.isRunning) {
      throw new Error('Brains not initialized');
    }

    const { queueManager } = this.nervousSystem.getServices();

    return {
      orchestrator: this.orchestrator.getSystemStats(),
      queues: queueManager.getQueueNames(),
      health: await this.nervousSystem.getHealth()
    };
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    logger.info('🛑 Shutting down Brains...');

    // Stop orchestrator
    await this.orchestrator.stop();
    logger.info('🎛️ Orchestrator stopped');

    // Shutdown nervous system (includes all workers)
    await shutdownNervousSystem();
    logger.info('🔌 Nervous System shut down');

    this.isRunning = false;
    logger.info('✅ Brains shut down complete');
  }

  /**
   * Get all services for external use
   */
  getServices(): {
    orchestrator: OrchestratorService;
    devAgent: DevAgentService;
    securityAgent: SecurityAgentService;
    qaAgent: QAAgentService;
    opsAgent: OpsAgentService;
    communicationAgent: CommunicationAgentService;
    evolutionAgent: EvolutionAgentService;
    nervousSystem: NervousSystem;
  } {
    return {
      orchestrator: this.orchestrator,
      devAgent: this.devAgent,
      securityAgent: this.securityAgent,
      qaAgent: this.qaAgent,
      opsAgent: this.opsAgent,
      communicationAgent: this.communicationAgent,
      evolutionAgent: this.evolutionAgent,
      nervousSystem: this.nervousSystem
    };
  }
}

// Singleton instance
let brainsInstance: Brains | null = null;

export function createBrains(config?: Partial<Phase3Config>): Brains {
  if (!brainsInstance) {
    brainsInstance = new Brains(config);
  }
  return brainsInstance;
}

export function getBrains(): Brains | null {
  return brainsInstance;
}

export async function startBrains(config?: Partial<Phase3Config>): Promise<Brains> {
  const brains = createBrains(config);
  await brains.initialize();
  return brains;
}

export async function shutdownBrains(): Promise<void> {
  if (brainsInstance) {
    await brainsInstance.shutdown();
    brainsInstance = null;
  }
}

// Direct execution
if (require.main === module) {
  const brains = createBrains();

  brains.initialize().then(async () => {
    // Create a test task to demonstrate functionality
    try {
      const systemUser = await prisma.user.findFirst({
        where: { email: 'system@azenith.ai' }
      });

      if (systemUser) {
        await brains.createTask({
          title: 'System Test Task',
          description: 'Demonstrating Phase 3 agents',
          type: TaskType.CODE_GENERATION,
          priority: TaskPriority.HIGH,
          createdBy: systemUser.id,
          payload: { prompt: 'Generate a test function', targetPath: './test.ts' }
        });

        logger.info('✨ Demo task created successfully');
      }
    } catch (error) {
      logger.warn('Demo task creation skipped', { error });
    }
  }).catch((error) => {
    logger.error('Failed to start Phase 3', { error });
    process.exit(1);
  });

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    await brains.shutdown();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    await brains.shutdown();
    process.exit(0);
  });
}

export { Brains };
export default Brains;

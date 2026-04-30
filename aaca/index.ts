/**
 * Azenith Autonomous Company AI System (AACA)
 * Main Entry Point
 * 
 * This is the production implementation of the distributed Multi-Agent AI system.
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { createClient } from 'redis';

// Core Services
import { getQueueManager, QueueManager } from './queues/queue-manager';
import { getEventBus, EventBus } from './events/event-bus';
import { connectDatabase, disconnectDatabase } from './database/prisma-client';
import { Logger } from './utils/logger';

// Agent Services
import { getOrchestratorService, OrchestratorService } from './agents/orchestrator-service';
import { getDevAgentService, DevAgentService } from './agents/dev-agent-service';
import { getOpsAgentService, OpsAgentService } from './agents/ops-agent-service';
import { getSecurityAgentService, SecurityAgentService } from './agents/security-agent-service';
import { getQAAgentService, QAAgentService } from './agents/qa-agent-service';
import { getCommunicationAgentService, CommunicationAgentService } from './agents/communication-agent-service';
import { getEvolutionAgentService, EvolutionAgentService } from './agents/evolution-agent-service';

// Support Systems
import { getApprovalSystem, ApprovalSystem } from './approval/approval-system';
import { getExecutionEngine, ExecutionEngine } from './execution/execution-engine';
import { processVisitorAnalytics } from './workers/visitor-analytics-worker';

// API
import { createAPIRouter } from './api/routes';

// Types
import { TaskType } from './types';

const logger = new Logger('AACA');

interface AACAConfig {
  port: number;
  redisUrl: string;
  databaseUrl: string;
  logLevel: string;
}

const DEFAULT_CONFIG: AACAConfig = {
  port: parseInt(process.env.AACA_PORT || '3001', 10),
  redisUrl: process.env.REDIS_URL || process.env.UPSTASH_REDIS_URL || '',
  databaseUrl: process.env.DATABASE_URL || '',
  logLevel: process.env.LOG_LEVEL || 'info'
};

class AACASystem {
  private app: express.Application;
  private config: AACAConfig;
  private server?: ReturnType<express.Application['listen']>;

  // Core services
  private queueManager!: QueueManager;
  private eventBus!: EventBus;

  // Agent services
  private orchestrator!: OrchestratorService;
  private devAgent!: DevAgentService;
  private opsAgent!: OpsAgentService;
  private securityAgent!: SecurityAgentService;
  private qaAgent!: QAAgentService;
  private communicationAgent!: CommunicationAgentService;
  private evolutionAgent!: EvolutionAgentService;

  // Support systems
  private approvalSystem!: ApprovalSystem;
  private executionEngine!: ExecutionEngine;

  private isRunning: boolean = false;
  private shutdownCallbacks: Array<() => Promise<void>> = [];

  constructor(config: Partial<AACAConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.app = this.createExpressApp();
  }

  private createExpressApp(): express.Application {
    const app = express();

    // Security middleware
    app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:"]
        }
      }
    }));

    app.use(cors({
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      allowedHeaders: ['Content-Type', 'Authorization']
    }));

    app.use(compression());
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request logging
    app.use((req, res, next) => {
      const start = Date.now();
      res.on('finish', () => {
        const duration = Date.now() - start;
        logger.info(`${req.method} ${req.path}`, {
          status: res.statusCode,
          duration: `${duration}ms`,
          ip: req.ip
        });
      });
      next();
    });

    return app;
  }

  async initialize(): Promise<void> {
    if (this.isRunning) {
      logger.warn('System already initialized');
      return;
    }

    logger.info('Initializing AACA System...');

    try {
      // Connect to database
      logger.info('Connecting to database...');
      await connectDatabase();
      logger.info('Database connected');

      // Initialize event bus
      logger.info('Initializing event bus...');
      this.eventBus = getEventBus({ redisUrl: this.config.redisUrl });
      await this.eventBus.connect();
      logger.info('Event bus connected');

      // Initialize queue manager
      logger.info('Initializing queue manager...');
      this.queueManager = getQueueManager(this.config.redisUrl, this.eventBus);
      await this.queueManager.initialize();
      logger.info('Queue manager initialized');

      // Initialize support systems
      this.approvalSystem = getApprovalSystem(this.eventBus);
      this.executionEngine = getExecutionEngine(this.eventBus, this.approvalSystem);

      // Initialize agent services
      logger.info('Initializing agent services...');
      this.initializeAgents();

      // Setup API routes
      this.setupRoutes();

      // Register shutdown callbacks
      this.registerShutdownHandlers();

      // Setup queue workers
      await this.setupWorkers();

      logger.info('AACA System initialization complete');
    } catch (error) {
      logger.error('Failed to initialize system', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  private initializeAgents(): void {
    // Orchestrator
    this.orchestrator = getOrchestratorService(this.queueManager, this.eventBus);

    // Dev Agent
    this.devAgent = getDevAgentService(this.eventBus);

    // Ops Agent
    this.opsAgent = getOpsAgentService(this.eventBus);

    // Security Agent
    this.securityAgent = getSecurityAgentService(this.eventBus);

    // QA Agent
    this.qaAgent = getQAAgentService(this.eventBus);

    // Communication Agent
    this.communicationAgent = getCommunicationAgentService(this.eventBus);

    // Evolution Agent
    this.evolutionAgent = getEvolutionAgentService(this.eventBus);

    logger.info('All agent services initialized');
  }

  private async setupWorkers(): Promise<void> {
    logger.info('Setting up queue workers...');

    // Dev Agent Worker
    await this.queueManager.addWorker('dev-agent', async (job) => {
      return this.devAgent.processJob(job);
    }, 2);

    // Ops Agent Worker
    await this.queueManager.addWorker('ops-agent', async (job) => {
      return this.opsAgent.processJob(job);
    }, 2);

    // Security Agent Worker
    await this.queueManager.addWorker('security-agent', async (job) => {
      return this.securityAgent.processJob(job);
    }, 1);

    // QA Agent Worker
    await this.queueManager.addWorker('qa-agent', async (job) => {
      return this.qaAgent.processJob(job);
    }, 2);

    // Communication Agent Worker
    await this.queueManager.addWorker('communication-agent', async (job) => {
      return this.communicationAgent.processJob(job);
    }, 3);

    // Evolution Agent Worker
    await this.queueManager.addWorker('evolution-agent', async (job) => {
      return this.evolutionAgent.processJob(job);
    }, 1);

    // Execution Worker
    await this.queueManager.addWorker('execution', async (job) => {
      const { actionId, context } = job.data;
      const action = await this.getAction(actionId);
      if (action) {
        return this.executionEngine.executeAction(action, context);
      }
      throw new Error(`Action ${actionId} not found`);
    }, 2);

    // Visitor Analytics Worker
    await this.queueManager.addWorker('visitor-analytics', async (job) => {
      return processVisitorAnalytics(job);
    }, 5);

    logger.info('All workers configured');

    // Start orchestrator
    await this.orchestrator.start();
    logger.info('Orchestrator started');
  }

  private async getAction(actionId: string) {
    const { prisma } = await import('./database/prisma-client');
    return prisma.aIAction.findUnique({ where: { id: actionId } });
  }

  private setupRoutes(): void {
    const apiRouter = createAPIRouter(
      this.orchestrator,
      this.devAgent,
      this.opsAgent,
      this.securityAgent,
      this.qaAgent,
      this.communicationAgent,
      this.evolutionAgent,
      this.approvalSystem,
      this.executionEngine,
      this.queueManager,
      this.eventBus
    );

    // Mount API routes
    this.app.use('/api/v1', apiRouter);

    // Root endpoint
    this.app.get('/', (req, res) => {
      res.json({
        name: 'Azenith Autonomous Company AI System (AACA)',
        version: '1.0.0',
        status: this.isRunning ? 'running' : 'initializing',
        documentation: '/api/v1/docs',
        health: '/health'
      });
    });

    // Error handling
    this.app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
      logger.error('Express error', { error: err.message, stack: err.stack });
      res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    });

    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({ error: 'Not found' });
    });
  }

  private registerShutdownHandlers(): void {
    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, starting graceful shutdown...`);
      await this.shutdown();
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    this.shutdownCallbacks.push(async () => {
      logger.info('Stopping orchestrator...');
      await this.orchestrator.stop();
    });

    this.shutdownCallbacks.push(async () => {
      logger.info('Closing queue manager...');
      await this.queueManager.close();
    });

    this.shutdownCallbacks.push(async () => {
      logger.info('Disconnecting event bus...');
      await this.eventBus.disconnect();
    });

    this.shutdownCallbacks.push(async () => {
      logger.info('Disconnecting database...');
      await disconnectDatabase();
    });
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('System already running');
      return;
    }

    await this.initialize();

    this.server = this.app.listen(this.config.port, () => {
      this.isRunning = true;
      logger.info(`AACA System running on port ${this.config.port}`);
      logger.info(`API available at http://localhost:${this.config.port}/api/v1`);
    });

    // Handle server errors
    this.server.on('error', (error) => {
      logger.error('Server error', { error: error.message });
    });
  }

  async shutdown(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    logger.info('Shutting down AACA System...');

    // Execute all shutdown callbacks in reverse order
    for (const callback of this.shutdownCallbacks.reverse()) {
      try {
        await callback();
      } catch (error) {
        logger.error('Shutdown callback failed', {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    // Close HTTP server
    if (this.server) {
      await new Promise<void>((resolve) => {
        this.server!.close(() => resolve());
      });
    }

    this.isRunning = false;
    logger.info('AACA System shutdown complete');
  }

  getApp(): express.Application {
    return this.app;
  }

  isInitialized(): boolean {
    return this.isRunning;
  }

  // Service accessors for testing and external access
  getServices() {
    return {
      orchestrator: this.orchestrator,
      devAgent: this.devAgent,
      opsAgent: this.opsAgent,
      securityAgent: this.securityAgent,
      qaAgent: this.qaAgent,
      communicationAgent: this.communicationAgent,
      evolutionAgent: this.evolutionAgent,
      approvalSystem: this.approvalSystem,
      executionEngine: this.executionEngine,
      queueManager: this.queueManager,
      eventBus: this.eventBus
    };
  }
}

// Singleton instance
let systemInstance: AACASystem | null = null;

export function createAACASystem(config?: Partial<AACAConfig>): AACASystem {
  if (!systemInstance) {
    systemInstance = new AACASystem(config);
  }
  return systemInstance;
}

export function getAACASystem(): AACASystem | null {
  return systemInstance;
}

export async function startAACASystem(config?: Partial<AACAConfig>): Promise<AACASystem> {
  const system = createAACASystem(config);
  await system.start();
  return system;
}

export async function shutdownAACASystem(): Promise<void> {
  if (systemInstance) {
    await systemInstance.shutdown();
    systemInstance = null;
  }
}

// Default export for ES modules
export default AACASystem;

// CommonJS compatibility
if (require.main === module) {
  // Start the system when run directly
  startAACASystem().catch((error) => {
    logger.error('Failed to start system', {
      error: error instanceof Error ? error.message : String(error)
    });
    process.exit(1);
  });
}

/**
 * AACA Phase 4: Full System Integration
 * Main Entry Point
 *
 * This integrates all phases:
 * - Phase 1: Database & Foundation
 * - Phase 2: Queue & Event System (Nervous System)
 * - Phase 3: Multi-Agent Services (The Brains)
 * - Phase 4: Execution Engine, Approval System & API
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { startBrains, shutdownBrains, Brains } from './phase3';
import { createPhase4Router } from './api/phase4-routes';
import { getApprovalSystem, ApprovalSystem } from './approval/approval-system';
import { getExecutionEngine, ExecutionEngine } from './execution/execution-engine';
import { Logger } from './utils/logger';
import { connectDatabase, disconnectDatabase } from './database/prisma-client';

const logger = new Logger('AACA-Main');

const PORT = process.env.AACA_PORT || 3001;

class AzenithAutonomousCompanyAI {
  private app: express.Application;
  private brains!: Brains;
  private approvalSystem!: ApprovalSystem;
  private executionEngine!: ExecutionEngine;
  private server?: ReturnType<express.Application['listen']>;
  private isRunning: boolean = false;

  constructor() {
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
    app.use((req: Request, res: Response, next: NextFunction) => {
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

  /**
   * Initialize the full AACA system
   */
  async initialize(): Promise<void> {
    if (this.isRunning) {
      logger.warn('AACA already initialized');
      return;
    }

    logger.info('═══════════════════════════════════════════════════════════');
    logger.info('  AZENITH AUTONOMOUS COMPANY AI SYSTEM (AACA) v1.0.0');
    logger.info('═══════════════════════════════════════════════════════════');
    logger.info('');

    try {
      // Phase 1: Connect Database
      logger.info('📦 Phase 1: Foundation (Database)...');
      await connectDatabase();
      logger.info('✅ Database connected');

      // Phase 3: Start Brains (includes Phase 2 Nervous System)
      logger.info('');
      logger.info('🧠 Phase 3: The Brains (Multi-Agent System)...');
      this.brains = await startBrains();
      logger.info('✅ All agents initialized');

      // Phase 4: Approval & Execution
      logger.info('');
      logger.info('⚙️  Phase 4: Execution & Approval Systems...');
      const { eventBus } = this.brains.getServices().nervousSystem.getServices();

      this.approvalSystem = getApprovalSystem(eventBus);
      this.executionEngine = getExecutionEngine(eventBus, this.approvalSystem);
      logger.info('✅ Approval & Execution systems ready');

      // Setup API routes
      logger.info('');
      logger.info('🌐 Setting up API Server...');
      const apiRouter = createPhase4Router(this.brains);
      this.app.use('/api/v1', apiRouter);

      // Root endpoint
      this.app.get('/', (req: Request, res: Response) => {
        res.json({
          name: 'Azenith Autonomous Company AI System (AACA)',
          version: '1.0.0',
          status: 'operational',
          phases: {
            'Phase 1': 'Foundation (Database) ✅',
            'Phase 2': 'Nervous System (Queue/Event) ✅',
            'Phase 3': 'The Brains (Multi-Agent) ✅',
            'Phase 4': 'Full Integration ✅'
          },
          agents: [
            { name: 'Orchestrator', status: 'active', role: 'Task routing & workflow management' },
            { name: 'Dev Agent', status: 'active', role: 'Code generation & repository analysis' },
            { name: 'Security Agent', status: 'active', role: 'Risk scoring & security scanning' },
            { name: 'QA Agent', status: 'active', role: 'Test execution & build validation' },
            { name: 'Ops Agent', status: 'active', role: 'Monitoring & health checks' },
            { name: 'Communication Agent', status: 'active', role: 'Notifications & alerts' },
            { name: 'Evolution Agent', status: 'active', role: 'Self-extension & capability evolution' }
          ],
          api: {
            base: '/api/v1',
            documentation: '/api/v1/docs',
            health: '/api/v1/health'
          }
        });
      });

      // Error handling
      this.app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
        logger.error('Express error', { error: err.message, stack: err.stack });
        res.status(500).json({
          error: 'Internal server error',
          message: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
      });

      // 404 handler
      this.app.use((req: Request, res: Response) => {
        res.status(404).json({ error: 'Not found' });
      });

      this.isRunning = true;

      logger.info('');
      logger.info('═══════════════════════════════════════════════════════════');
      logger.info('  🚀 AACA FULLY OPERATIONAL');
      logger.info('═══════════════════════════════════════════════════════════');
      logger.info('');
      logger.info(`API Server: http://localhost:${PORT}/api/v1`);
      logger.info(`Health:     http://localhost:${PORT}/api/v1/health`);
      logger.info('');

    } catch (error) {
      logger.error('❌ Failed to initialize AACA', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Start the HTTP server
   */
  async start(): Promise<void> {
    if (!this.isRunning) {
      await this.initialize();
    }

    this.server = this.app.listen(PORT, () => {
      logger.info(`Server listening on port ${PORT}`);
    });

    // Handle server errors
    this.server.on('error', (error) => {
      logger.error('Server error', { error: error.message });
    });
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    logger.info('');
    logger.info('═══════════════════════════════════════════════════════════');
    logger.info('  🛑 AACA SHUTTING DOWN');
    logger.info('═══════════════════════════════════════════════════════════');

    // Close HTTP server
    if (this.server) {
      await new Promise<void>((resolve) => {
        this.server!.close(() => resolve());
      });
      logger.info('✅ HTTP Server closed');
    }

    // Shutdown brains (includes Phase 2)
    await shutdownBrains();
    logger.info('✅ Brains & Nervous System shut down');

    // Disconnect database
    await disconnectDatabase();
    logger.info('✅ Database disconnected');

    this.isRunning = false;
    logger.info('');
    logger.info('═══════════════════════════════════════════════════════════');
    logger.info('  👋 AACA SHUTDOWN COMPLETE');
    logger.info('═══════════════════════════════════════════════════════════');
  }

  getApp(): express.Application {
    return this.app;
  }

  isInitialized(): boolean {
    return this.isRunning;
  }
}

// Singleton instance
let aacaInstance: AzenithAutonomousCompanyAI | null = null;

export function createAACA(): AzenithAutonomousCompanyAI {
  if (!aacaInstance) {
    aacaInstance = new AzenithAutonomousCompanyAI();
  }
  return aacaInstance;
}

export async function startAACA(): Promise<AzenithAutonomousCompanyAI> {
  const aaca = createAACA();
  await aaca.start();
  return aaca;
}

export async function shutdownAACA(): Promise<void> {
  if (aacaInstance) {
    await aacaInstance.shutdown();
    aacaInstance = null;
  }
}

// Direct execution
if (require.main === module) {
  const aaca = createAACA();

  aaca.start().catch((error) => {
    logger.error('Failed to start AACA', { error });
    process.exit(1);
  });

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    await aaca.shutdown();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    await aaca.shutdown();
    process.exit(0);
  });
}

export { AzenithAutonomousCompanyAI };
export default AzenithAutonomousCompanyAI;

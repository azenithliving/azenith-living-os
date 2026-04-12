/**
 * AACA Phase 2: The Nervous System
 * 
 * Queue System (BullMQ) + Event Bus (Redis) Integration
 * 
 * This phase implements:
 * - Redis configuration for BullMQ
 * - QueueService for job management
 * - EventBus for inter-agent communication
 * - TaskWorker that bridges queues and events
 */

import { createBullMQConnection, createEventBusClient, checkRedisHealth } from './config/redis';
import { getQueueManager, QueueManager } from './queues/queue-manager';
import { getEventBus, EventBus } from './events/event-bus';
import { getTaskWorker, TaskWorker } from './workers/task-worker';
import { Logger } from './utils/logger';
import { connectDatabase, disconnectDatabase } from './database/prisma-client';

const logger = new Logger('Phase2-NervousSystem');

interface Phase2Config {
  redisUrl: string;
  databaseUrl: string;
}

const DEFAULT_CONFIG: Phase2Config = {
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  databaseUrl: process.env.DATABASE_URL || 'postgresql://localhost:5432/aaca'
};

class NervousSystem {
  private queueManager!: QueueManager;
  private eventBus!: EventBus;
  private taskWorker!: TaskWorker;
  private config: Phase2Config;
  private isRunning: boolean = false;

  constructor(config: Partial<Phase2Config> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize the Nervous System
   */
  async initialize(): Promise<void> {
    logger.info('🔌 Initializing Phase 2: The Nervous System...');

    try {
      // 1. Connect to Database (Phase 1 foundation)
      logger.info('📦 Connecting to database...');
      await connectDatabase();
      logger.info('✅ Database connected');

      // 2. Test Redis connection
      logger.info('🔴 Testing Redis connection...');
      await this.testRedisConnection();
      logger.info('✅ Redis connected');

      // 3. Initialize Event Bus
      logger.info('📡 Initializing Event Bus...');
      this.eventBus = getEventBus({ redisUrl: this.config.redisUrl });
      await this.eventBus.connect();
      logger.info('✅ Event Bus connected');

      // 4. Initialize Queue Manager
      logger.info('📬 Initializing Queue Manager...');
      this.queueManager = getQueueManager(this.config.redisUrl, this.eventBus);
      await this.queueManager.initialize();
      logger.info('✅ Queue Manager initialized');

      // 5. Initialize Task Worker
      logger.info('👷 Initializing Task Worker...');
      this.taskWorker = getTaskWorker(this.queueManager, this.eventBus, {
        concurrency: 5,
        maxAttempts: 3,
        backoffDelay: 2000
      });
      await this.taskWorker.start();
      logger.info('✅ Task Worker started');

      // 6. Setup event subscriptions
      await this.setupEventSubscriptions();

      this.isRunning = true;

      // 7. Publish system ready event
      await this.eventBus.publish({
        type: 'system:nervous-system:ready',
        source: 'phase2',
        payload: {
          timestamp: new Date().toISOString(),
          queues: this.queueManager.getQueueNames(),
          workers: this.taskWorker.getStats()
        }
      });

      logger.info('🧠 Phase 2: Nervous System READY');
      logger.info('');
      logger.info('Active Queues:', { queues: this.queueManager.getQueueNames() });
      logger.info('Active Workers:', this.taskWorker.getStats() as Record<string, unknown>);

    } catch (error) {
      logger.error('❌ Failed to initialize Nervous System', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Test Redis connection
   */
  private async testRedisConnection(): Promise<void> {
    const connection = createBullMQConnection({ url: this.config.redisUrl });
    
    try {
      const health = await checkRedisHealth(connection);
      
      if (!health.healthy) {
        throw new Error(`Redis health check failed: ${health.message}`);
      }
      
      logger.info(`Redis latency: ${health.latencyMs}ms`);
    } finally {
      await connection.quit();
    }
  }

  /**
   * Setup event subscriptions for monitoring
   */
  private async setupEventSubscriptions(): Promise<void> {
    // Monitor all job lifecycle events
    await this.eventBus.subscribePattern('job:*', {
      eventType: 'job:*',
      handler: async (event) => {
        logger.debug(`Job event: ${event.type}`, {
          source: event.source,
          payload: event.payload
        });
      }
    });

    // Monitor queue events
    await this.eventBus.subscribePattern('queue:*', {
      eventType: 'queue:*',
      handler: async (event) => {
        logger.debug(`Queue event: ${event.type}`, {
          source: event.source,
          queue: (event.payload as Record<string, unknown>)?.queue
        });
      }
    });

    // Monitor agent events
    await this.eventBus.subscribePattern('agent:*', {
      eventType: 'agent:*',
      handler: async (event) => {
        logger.info(`Agent event: ${event.type}`, {
          source: event.source,
          taskId: (event.payload as Record<string, unknown>)?.taskId
        });
      }
    });

    // Monitor task events
    await this.eventBus.subscribePattern('task:*', {
      eventType: 'task:*',
      handler: async (event) => {
        logger.info(`Task event: ${event.type}`, {
          taskId: (event.payload as Record<string, unknown>)?.taskId,
          status: (event.payload as Record<string, unknown>)?.status
        });
      }
    });

    logger.info('📊 Event monitoring subscriptions active');
  }

  /**
   * Get system health
   */
  async getHealth(): Promise<{
    status: string;
    redis: { healthy: boolean; latencyMs: number };
    eventBus: { connected: boolean; handlers: number };
    queues: string[];
    worker: ReturnType<TaskWorker['getStats']>;
  }> {
    const connection = createBullMQConnection({ url: this.config.redisUrl });
    
    try {
      const redisHealth = await checkRedisHealth(connection);
      const eventStats = this.eventBus.getStats();
      const workerStats = this.taskWorker.getStats();
      
      return {
        status: this.isRunning ? 'healthy' : 'stopped',
        redis: {
          healthy: redisHealth.healthy,
          latencyMs: redisHealth.latencyMs
        },
        eventBus: {
          connected: eventStats.connected,
          handlers: eventStats.handlers
        },
        queues: this.queueManager.getQueueNames(),
        worker: workerStats
      };
    } finally {
      await connection.quit();
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    logger.info('🛑 Shutting down Nervous System...');

    // Publish shutdown event
    await this.eventBus.publish({
      type: 'system:nervous-system:shutdown',
      source: 'phase2',
      payload: {
        timestamp: new Date().toISOString(),
        stats: this.taskWorker.getStats()
      }
    });

    // Stop task worker
    await this.taskWorker.stop();
    logger.info('👷 Task Worker stopped');

    // Close queue manager
    await this.queueManager.close();
    logger.info('📬 Queue Manager closed');

    // Disconnect event bus
    await this.eventBus.disconnect();
    logger.info('📡 Event Bus disconnected');

    // Disconnect database
    await disconnectDatabase();
    logger.info('📦 Database disconnected');

    this.isRunning = false;
    logger.info('✅ Nervous System shutdown complete');
  }

  /**
   * Get services for external use
   */
  getServices(): {
    queueManager: QueueManager;
    eventBus: EventBus;
    taskWorker: TaskWorker;
  } {
    return {
      queueManager: this.queueManager,
      eventBus: this.eventBus,
      taskWorker: this.taskWorker
    };
  }
}

// Singleton instance
let nervousSystemInstance: NervousSystem | null = null;

export function createNervousSystem(config?: Partial<Phase2Config>): NervousSystem {
  if (!nervousSystemInstance) {
    nervousSystemInstance = new NervousSystem(config);
  }
  return nervousSystemInstance;
}

export function getNervousSystem(): NervousSystem | null {
  return nervousSystemInstance;
}

export async function startNervousSystem(config?: Partial<Phase2Config>): Promise<NervousSystem> {
  const system = createNervousSystem(config);
  await system.initialize();
  return system;
}

export async function shutdownNervousSystem(): Promise<void> {
  if (nervousSystemInstance) {
    await nervousSystemInstance.shutdown();
    nervousSystemInstance = null;
  }
}

// Direct execution
if (require.main === module) {
  const nervousSystem = createNervousSystem();
  
  nervousSystem.initialize().catch((error) => {
    logger.error('Failed to start Phase 2', { error });
    process.exit(1);
  });

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    await nervousSystem.shutdown();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    await nervousSystem.shutdown();
    process.exit(0);
  });
}

export { NervousSystem };
export default NervousSystem;

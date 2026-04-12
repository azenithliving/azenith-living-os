import { PrismaClient, Prisma } from '@prisma/client';
import { Logger } from '../utils/logger';

// Prisma event types
type QueryEvent = {
  query: string;
  params: string;
  duration: number;
  target: string;
};

type LogEvent = {
  message: string;
  target: string;
  timestamp: Date;
};

const logger = new Logger('DatabaseService');

interface DatabaseHealthStatus {
  healthy: boolean;
  latencyMs: number;
  message: string;
}

interface ConnectionConfig {
  maxRetries?: number;
  retryDelayMs?: number;
  logQueries?: boolean;
}

class DatabaseService {
  private client: PrismaClient;
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;
  private isConnected: boolean = false;

  constructor(config: ConnectionConfig = {}) {
    this.maxRetries = config.maxRetries ?? 5;
    this.retryDelayMs = config.retryDelayMs ?? 2000;

    const logConfig: Prisma.PrismaClientOptions['log'] = config.logQueries
      ? [
          { emit: 'event', level: 'query' },
          { emit: 'event', level: 'error' },
          { emit: 'event', level: 'info' },
          { emit: 'event', level: 'warn' }
        ]
      : [
          { emit: 'event', level: 'error' },
          { emit: 'event', level: 'warn' }
        ];

    this.client = new PrismaClient({
      log: logConfig
    });

    this.attachEventListeners();
  }

  private attachEventListeners(): void {
    this.client.$on('query', (e: QueryEvent) => {
      logger.debug('Query executed', {
        query: e.query,
        params: e.params,
        duration: `${e.duration}ms`
      });
    });

    this.client.$on('error', (e: LogEvent) => {
      logger.error('Database error', { message: e.message });
    });

    this.client.$on('info', (e: LogEvent) => {
      logger.info('Database info', { message: e.message });
    });

    this.client.$on('warn', (e: LogEvent) => {
      logger.warn('Database warning', { message: e.message });
    });
  }

  async connect(retries: number = this.maxRetries): Promise<void> {
    if (this.isConnected) {
      logger.info('Database already connected');
      return;
    }

    try {
      await this.client.$connect();
      this.isConnected = true;
      logger.info('Database connected successfully');
    } catch (error) {
      logger.error('Failed to connect to database', {
        error: error instanceof Error ? error.message : String(error),
        retriesRemaining: retries
      });

      if (retries > 0) {
        logger.info(`Retrying connection in ${this.retryDelayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, this.retryDelayMs));
        return this.connect(retries - 1);
      }

      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    try {
      await this.client.$disconnect();
      this.isConnected = false;
      logger.info('Database disconnected');
    } catch (error) {
      logger.error('Error disconnecting from database', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  async executeTransaction<T>(callback: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.client.$transaction(async (tx: Prisma.TransactionClient) => {
      try {
        return await callback(tx);
      } catch (error) {
        logger.error('Transaction failed', {
          error: error instanceof Error ? error.message : String(error)
        });
        throw error;
      }
    });
  }

  async executeRawQuery<T>(query: string, ...values: unknown[]): Promise<T> {
    try {
      const result = await this.client.$queryRawUnsafe<T>(query, ...values);
      return result;
    } catch (error) {
      logger.error('Raw query failed', {
        query,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  async checkHealth(): Promise<DatabaseHealthStatus> {
    const startTime = Date.now();

    try {
      await this.client.$queryRaw`SELECT 1`;
      const latencyMs = Date.now() - startTime;

      return {
        healthy: true,
        latencyMs,
        message: 'Database connection healthy'
      };
    } catch (error) {
      return {
        healthy: false,
        latencyMs: Date.now() - startTime,
        message: error instanceof Error ? error.message : 'Database connection failed'
      };
    }
  }

  getClient(): PrismaClient {
    return this.client;
  }

  isHealthy(): boolean {
    return this.isConnected;
  }
}

const globalForDb = globalThis as unknown as {
  databaseService: DatabaseService | undefined;
};

const databaseService = globalForDb.databaseService ?? new DatabaseService();

if (process.env.NODE_ENV !== 'production') {
  globalForDb.databaseService = databaseService;
}

export { DatabaseService, databaseService };
export default databaseService;

import IORedis from 'ioredis';
import { Logger } from '../utils/logger';

const logger = new Logger('Redis');

interface RedisConfig {
  host?: string;
  port?: number;
  password?: string;
  db?: number;
  maxRetriesPerRequest?: number | null;
  enableReadyCheck?: boolean;
  lazyConnect?: boolean;
  retryStrategy?: (times: number) => number | null;
}

class RedisConnection {
  private client: IORedis;
  private isConnected: boolean = false;
  private config: RedisConfig;

  constructor(url?: string, config: RedisConfig = {}) {
    this.config = {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true,
      retryStrategy: (times: number) => {
        if (times > 10) {
          logger.error('Redis connection failed after 10 retries');
          return null;
        }
        return Math.min(times * 100, 3000);
      },
      ...config
    };

    if (url) {
      this.client = new IORedis(url, this.config);
    } else {
      this.client = new IORedis({
        host: process.env.REDIS_HOST ?? 'localhost',
        port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_DB ?? '0', 10),
        ...this.config
      });
    }

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.client.on('connect', () => {
      logger.info('Redis client connecting...');
    });

    this.client.on('ready', () => {
      this.isConnected = true;
      logger.info('Redis client ready');
    });

    this.client.on('error', (err: Error) => {
      logger.error('Redis error', { error: err.message });
    });

    this.client.on('close', () => {
      this.isConnected = false;
      logger.warn('Redis connection closed');
    });

    this.client.on('reconnecting', () => {
      logger.info('Redis reconnecting...');
    });

    this.client.on('end', () => {
      this.isConnected = false;
      logger.info('Redis connection ended');
    });
  }

  async connect(): Promise<void> {
    if (this.isConnected) return;
    await this.client.connect();
  }

  async disconnect(): Promise<void> {
    if (!this.isConnected) return;
    await this.client.quit();
    this.isConnected = false;
  }

  getClient(): IORedis {
    return this.client;
  }

  isHealthy(): boolean {
    return this.isConnected && this.client.status === 'ready';
  }

  async healthCheck(): Promise<{ healthy: boolean; latencyMs: number; message: string }> {
    const start = Date.now();
    try {
      await this.client.ping();
      return {
        healthy: true,
        latencyMs: Date.now() - start,
        message: 'Redis connection healthy'
      };
    } catch (error) {
      return {
        healthy: false,
        latencyMs: Date.now() - start,
        message: error instanceof Error ? error.message : 'Redis health check failed'
      };
    }
  }
}

const globalForRedis = globalThis as unknown as {
  redisConnection: RedisConnection | undefined;
};

const redisConnection = globalForRedis.redisConnection ?? new RedisConnection();

if (process.env.NODE_ENV !== 'production') {
  globalForRedis.redisConnection = redisConnection;
}

export { RedisConnection, redisConnection };
export default redisConnection;

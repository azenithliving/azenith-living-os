import IORedis from 'ioredis';
import { createClient, RedisClientType } from 'redis';
import { Logger } from '../utils/logger';

const logger = new Logger('RedisConfig');

export interface RedisConfig {
  url: string;
  host?: string;
  port?: number;
  password?: string;
  db?: number;
  maxRetriesPerRequest?: number;
  enableReadyCheck?: boolean;
}

const DEFAULT_CONFIG: RedisConfig = {
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0', 10),
  maxRetriesPerRequest: null,
  enableReadyCheck: false
};

/**
 * Create IORedis connection for BullMQ
 * BullMQ requires IORedis specifically
 */
export function createBullMQConnection(config: Partial<RedisConfig> = {}): IORedis {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  
  const connection = new IORedis(finalConfig.url, {
    host: finalConfig.host,
    port: finalConfig.port,
    password: finalConfig.password,
    db: finalConfig.db,
    maxRetriesPerRequest: finalConfig.maxRetriesPerRequest,
    enableReadyCheck: finalConfig.enableReadyCheck,
    retryStrategy: (times: number) => {
      const delay = Math.min(times * 50, 2000);
      logger.warn(`Redis retry attempt ${times}, delaying ${delay}ms`);
      return delay;
    },
    reconnectOnError: (err: Error) => {
      const targetErrors = ['READONLY', 'ECONNREFUSED', 'ETIMEDOUT', 'ECONNRESET'];
      const shouldReconnect = targetErrors.some(target => err.message.includes(target));
      
      if (shouldReconnect) {
        logger.error('Redis connection error, will reconnect', { error: err.message });
        return true;
      }
      return false;
    }
  });

  connection.on('connect', () => {
    logger.info('BullMQ Redis connected');
  });

  connection.on('ready', () => {
    logger.info('BullMQ Redis ready');
  });

  connection.on('error', (err) => {
    logger.error('BullMQ Redis error', { error: err.message });
  });

  connection.on('close', () => {
    logger.warn('BullMQ Redis connection closed');
  });

  connection.on('reconnecting', () => {
    logger.info('BullMQ Redis reconnecting...');
  });

  return connection;
}

/**
 * Create Redis client for Event Bus (node-redis)
 */
export async function createEventBusClient(config: Partial<RedisConfig> = {}): Promise<RedisClientType> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  
  const client = createClient({
    url: finalConfig.url,
    socket: {
      reconnectStrategy: (retries: number) => {
        if (retries > 10) {
          logger.error('Max reconnection attempts reached');
          return new Error('Max reconnection attempts reached');
        }
        const delay = Math.min(retries * 100, 3000);
        logger.warn(`EventBus Redis retry attempt ${retries}, delaying ${delay}ms`);
        return delay;
      }
    }
  });

  client.on('connect', () => {
    logger.info('EventBus Redis client connected');
  });

  client.on('ready', () => {
    logger.info('EventBus Redis client ready');
  });

  client.on('error', (err) => {
    logger.error('EventBus Redis client error', { error: err.message });
  });

  client.on('end', () => {
    logger.warn('EventBus Redis client disconnected');
  });

  await client.connect();
  return client;
}

/**
 * Check Redis health
 */
export async function checkRedisHealth(redis: IORedis | RedisClientType): Promise<{
  healthy: boolean;
  latencyMs: number;
  message: string;
}> {
  const startTime = Date.now();
  
  try {
    if (redis instanceof IORedis) {
      await redis.ping();
    } else {
      await redis.ping();
    }
    
    const latencyMs = Date.now() - startTime;
    
    return {
      healthy: true,
      latencyMs,
      message: 'Redis connection healthy'
    };
  } catch (error) {
    return {
      healthy: false,
      latencyMs: Date.now() - startTime,
      message: error instanceof Error ? error.message : 'Redis health check failed'
    };
  }
}

/**
 * Close Redis connections gracefully
 */
export async function closeRedisConnection(connection: IORedis | RedisClientType): Promise<void> {
  try {
    if (connection instanceof IORedis) {
      await connection.quit();
    } else {
      await connection.quit();
    }
    logger.info('Redis connection closed gracefully');
  } catch (error) {
    logger.error('Error closing Redis connection', { error });
    throw error;
  }
}

export { DEFAULT_CONFIG as redisConfig };

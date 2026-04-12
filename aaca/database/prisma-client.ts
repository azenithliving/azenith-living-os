import { PrismaClient } from '@prisma/client';
import { Logger } from '../utils/logger';

const logger = new Logger('PrismaClient');

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: [
    { emit: 'event', level: 'query' },
    { emit: 'event', level: 'error' },
    { emit: 'event', level: 'info' },
    { emit: 'event', level: 'warn' }
  ]
});

// Attach event listeners
prisma.$on('query', (e) => {
  logger.debug('Query executed', {
    query: e.query,
    params: e.params,
    duration: `${e.duration}ms`
  });
});

prisma.$on('error', (e) => {
  logger.error('Database error', {
    message: e.message
  });
});

prisma.$on('info', (e) => {
  logger.info('Database info', {
    message: e.message
  });
});

prisma.$on('warn', (e) => {
  logger.warn('Database warning', {
    message: e.message
  });
});

// Connection management with retry logic
const MAX_RETRIES = 5;
const RETRY_DELAY = 2000;

export async function connectDatabase(retries = MAX_RETRIES): Promise<void> {
  try {
    await prisma.$connect();
    logger.info('Database connected successfully');
  } catch (error) {
    logger.error('Failed to connect to database', {
      error: error instanceof Error ? error.message : String(error),
      retriesRemaining: retries
    });

    if (retries > 0) {
      logger.info(`Retrying connection in ${RETRY_DELAY}ms...`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return connectDatabase(retries - 1);
    }

    throw error;
  }
}

export async function disconnectDatabase(): Promise<void> {
  try {
    await prisma.$disconnect();
    logger.info('Database disconnected');
  } catch (error) {
    logger.error('Error disconnecting from database', {
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

// Transaction wrapper with error handling
export async function withTransaction<T>(
  callback: (tx: typeof prisma) => Promise<T>
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    try {
      return await callback(tx as unknown as typeof prisma);
    } catch (error) {
      logger.error('Transaction failed', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  });
}

// Raw query wrapper
export async function executeRawQuery<T>(
  query: string,
  ...values: unknown[]
): Promise<T> {
  try {
    const result = await prisma.$queryRawUnsafe<T>(query, ...values);
    return result;
  } catch (error) {
    logger.error('Raw query failed', {
      query,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

// Health check
export async function checkDatabaseHealth(): Promise<{
  healthy: boolean;
  latencyMs: number;
  message: string;
}> {
  const startTime = Date.now();
  
  try {
    await prisma.$queryRaw`SELECT 1`;
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

// Export singleton
export { prisma };
export default prisma;

// Ensure global singleton in development
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

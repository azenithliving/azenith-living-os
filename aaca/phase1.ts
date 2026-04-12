/**
 * AACA Phase 1: Foundation & Database Layer
 * Standalone Entry Point
 *
 * This is the production-ready Phase 1 implementation:
 * - Monorepo-ready folder structure
 * - Comprehensive Prisma schema
 * - DatabaseService class with connection management
 * - Express server with error handling
 * - Task & Approval CRUD API routes with Zod validation
 */

import { createApp, AACAApplication } from './app';
import { Logger } from './utils/logger';

const logger = new Logger('AACA-Phase1');

async function main(): Promise<void> {
  const app = createApp({
    port: parseInt(process.env.AACA_PORT || '3001', 10),
    corsOrigin: process.env.CORS_ORIGIN || '*',
    env: process.env.NODE_ENV || 'development'
  });

  try {
    await app.start();
  } catch (error) {
    logger.error('Failed to start Phase 1 server', {
      error: error instanceof Error ? error.message : String(error)
    });
    process.exit(1);
  }
}

// Handle uncaught errors
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', { error: err.message, stack: err.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', { reason });
  process.exit(1);
});

// Start if run directly
if (require.main === module) {
  main();
}

export { main, AACAApplication };
export default main;

import { Router, Request, Response, NextFunction } from 'express';
import { databaseService } from '../../database/database-service';
import { Logger } from '../../utils/logger';

const logger = new Logger('HealthRoutes');
const router = Router();

interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  version: string;
  uptime: number;
  services: {
    database: {
      status: 'connected' | 'error' | 'unknown';
      latencyMs: number;
      message: string;
    };
  };
  environment: string;
}

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dbHealth = await databaseService.checkHealth();

    const health: HealthStatus = {
      status: dbHealth.healthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      uptime: process.uptime(),
      services: {
        database: {
          status: dbHealth.healthy ? 'connected' : 'error',
          latencyMs: dbHealth.latencyMs,
          message: dbHealth.message
        }
      },
      environment: process.env.NODE_ENV ?? 'development'
    };

    const statusCode = dbHealth.healthy ? 200 : 503;

    res.status(statusCode).json(health);
  } catch (error) {
    logger.error('Health check failed', { error });
    next(error);
  }
});

router.get('/ready', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dbHealth = await databaseService.checkHealth();

    if (dbHealth.healthy) {
      res.json({
        ready: true,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(503).json({
        ready: false,
        reason: 'Database not ready',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    logger.error('Readiness check failed', { error });
    next(error);
  }
});

router.get('/live', (req: Request, res: Response) => {
  res.json({
    alive: true,
    timestamp: new Date().toISOString()
  });
});

export { router as healthRoutes };
export default router;

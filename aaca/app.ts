import express, { Request, Response, NextFunction, Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { databaseService, DatabaseService } from './database/database-service';
import { Logger } from './utils/logger';
import { taskRoutes } from './api/routes/tasks';
import { approvalRoutes } from './api/routes/approvals';
import { healthRoutes } from './api/routes/health';

const logger = new Logger('AACA-App');

interface AppConfig {
  port: number;
  corsOrigin: string;
  env: string;
}

class AACAApplication {
  public readonly app: Application;
  public readonly config: AppConfig;
  private readonly db: DatabaseService;
  private server: ReturnType<Application['listen']> | null = null;

  constructor(config: Partial<AppConfig> = {}) {
    this.config = {
      port: config.port ?? parseInt(process.env.AACA_PORT ?? '3001', 10),
      corsOrigin: config.corsOrigin ?? process.env.CORS_ORIGIN ?? '*',
      env: config.env ?? process.env.NODE_ENV ?? 'development'
    };

    this.db = databaseService;
    this.app = this.createExpressApp();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private createExpressApp(): Application {
    const app = express();

    app.disable('x-powered-by');

    return app;
  }

  private setupMiddleware(): void {
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:"]
        }
      },
      crossOriginEmbedderPolicy: false
    }));

    this.app.use(cors({
      origin: this.config.corsOrigin,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
      credentials: true
    }));

    this.app.use(compression());

    this.app.use(express.json({
      limit: '10mb',
      strict: true
    }));

    this.app.use(express.urlencoded({
      extended: true,
      limit: '10mb'
    }));

    this.app.use(this.requestLoggingMiddleware.bind(this));
  }

  private requestLoggingMiddleware(req: Request, res: Response, next: NextFunction): void {
    const start = Date.now();
    const requestId = this.generateRequestId();

    req.headers['x-request-id'] = requestId;

    res.on('finish', () => {
      const duration = Date.now() - start;
      const logData = {
        requestId,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        duration: `${duration}ms`,
        ip: req.ip,
        userAgent: req.get('user-agent')
      };

      if (res.statusCode >= 400) {
        logger.warn('Request completed with error', logData);
      } else {
        logger.info('Request completed', logData);
      }
    });

    next();
  }

  private generateRequestId(): string {
    return `req-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  private setupRoutes(): void {
    this.app.use('/api/v1/tasks', taskRoutes);
    this.app.use('/api/v1/approvals', approvalRoutes);
    this.app.use('/health', healthRoutes);

    this.app.get('/', this.rootHandler.bind(this));

    this.app.use(this.notFoundHandler.bind(this));
  }

  private rootHandler(req: Request, res: Response): void {
    res.json({
      name: 'Azenith Autonomous Company AI System (AACA)',
      version: '1.0.0',
      phase: 'Phase 1 - Foundation',
      status: 'operational',
      environment: this.config.env,
      endpoints: {
        api: '/api/v1',
        health: '/health',
        tasks: '/api/v1/tasks',
        approvals: '/api/v1/approvals'
      },
      timestamp: new Date().toISOString()
    });
  }

  private notFoundHandler(req: Request, res: Response): void {
    res.status(404).json({
      error: 'Not Found',
      message: `Cannot ${req.method} ${req.path}`,
      timestamp: new Date().toISOString()
    });
  }

  private setupErrorHandling(): void {
    this.app.use(this.globalErrorHandler.bind(this));
  }

  private globalErrorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
    logger.error('Unhandled error', {
      error: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
      requestId: req.headers['x-request-id']
    });

    const isDevelopment = this.config.env === 'development';

    if (err instanceof SyntaxError && 'body' in err) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid JSON payload',
        timestamp: new Date().toISOString()
      });
      return;
    }

    res.status(500).json({
      error: 'Internal Server Error',
      message: isDevelopment ? err.message : 'An unexpected error occurred',
      timestamp: new Date().toISOString()
    });
  }

  async start(): Promise<void> {
    try {
      await this.db.connect();

      this.server = this.app.listen(this.config.port, () => {
        logger.info(`AACA Phase 1 Server running on port ${this.config.port}`);
        logger.info(`API available at http://localhost:${this.config.port}/api/v1`);
        logger.info(`Health check at http://localhost:${this.config.port}/health`);
      });

      this.setupGracefulShutdown();
    } catch (error) {
      logger.error('Failed to start server', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server) {
        resolve();
        return;
      }

      this.server.close(async (err: Error | null) => {
        if (err) {
          reject(err);
          return;
        }

        await this.db.disconnect();
        logger.info('Server stopped gracefully');
        resolve();
      });
    });
  }

  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      logger.info(`${signal} received, initiating graceful shutdown`);
      try {
        await this.stop();
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown', {
          error: error instanceof Error ? error.message : String(error)
        });
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    process.on('uncaughtException', (err) => {
      logger.error('Uncaught exception', {
        error: err.message,
        stack: err.stack
      });
      shutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason) => {
      logger.error('Unhandled rejection', { reason });
      shutdown('unhandledRejection');
    });
  }

  getDatabaseService(): DatabaseService {
    return this.db;
  }
}

function createApp(config?: Partial<AppConfig>): AACAApplication {
  return new AACAApplication(config);
}

export { AACAApplication, createApp };
export default AACAApplication;

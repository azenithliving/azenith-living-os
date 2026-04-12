import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { prisma, connectDatabase, checkDatabaseHealth } from './database/prisma-client';
import { Logger } from './utils/logger';

const logger = new Logger('AACA-Server');

// Initialize Express app
const app = express();
const PORT = process.env.AACA_PORT || 3001;

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

// Request logging middleware
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

// ==========================================
// TASK ROUTES
// ==========================================

// Create a new task
app.post('/api/v1/tasks', async (req: Request, res: Response) => {
  try {
    const { title, description, type, priority = 'MEDIUM', payload, createdById, workflowId } = req.body;

    if (!title || !type || !createdById) {
      return res.status(400).json({
        error: 'Missing required fields: title, type, createdById'
      });
    }

    const task = await prisma.aITask.create({
      data: {
        title,
        description,
        type,
        priority,
        payload,
        createdById,
        workflowId,
        status: 'PENDING'
      }
    });

    res.status(201).json({
      success: true,
      task: {
        id: task.id,
        title: task.title,
        type: task.type,
        status: task.status,
        priority: task.priority,
        createdAt: task.createdAt
      }
    });
  } catch (error) {
    logger.error('Failed to create task', { error });
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to create task'
    });
  }
});

// Get all tasks
app.get('/api/v1/tasks', async (req: Request, res: Response) => {
  try {
    const { status, type, limit = '50', offset = '0' } = req.query;
    
    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (type) where.type = type;

    const tasks = await prisma.aITask.findMany({
      where,
      take: parseInt(limit as string, 10),
      skip: parseInt(offset as string, 10),
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: { select: { id: true, email: true, name: true } },
        actions: true
      }
    });

    const total = await prisma.aITask.count({ where });

    res.json({
      success: true,
      tasks,
      pagination: {
        total,
        limit: parseInt(limit as string, 10),
        offset: parseInt(offset as string, 10)
      }
    });
  } catch (error) {
    logger.error('Failed to fetch tasks', { error });
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to fetch tasks'
    });
  }
});

// Get task by ID
app.get('/api/v1/tasks/:id', async (req: Request, res: Response) => {
  try {
    const task = await prisma.aITask.findUnique({
      where: { id: req.params.id },
      include: {
        createdBy: { select: { id: true, email: true, name: true } },
        actions: {
          include: {
            approval: true,
            executionLogs: true
          }
        },
        subTasks: true,
        workflow: true,
        events: true
      }
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json({ success: true, task });
  } catch (error) {
    logger.error('Failed to fetch task', { error });
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to fetch task'
    });
  }
});

// Update task
app.patch('/api/v1/tasks/:id', async (req: Request, res: Response) => {
  try {
    const { status, result, error: taskError } = req.body;
    
    const updateData: Record<string, unknown> = {};
    if (status) updateData.status = status;
    if (result !== undefined) updateData.result = result;
    if (taskError !== undefined) updateData.error = taskError;
    
    if (status === 'IN_PROGRESS' && !updateData.startedAt) {
      updateData.startedAt = new Date();
    }
    if ((status === 'COMPLETED' || status === 'FAILED') && !updateData.completedAt) {
      updateData.completedAt = new Date();
    }

    const task = await prisma.aITask.update({
      where: { id: req.params.id },
      data: updateData
    });

    res.json({ success: true, task });
  } catch (error) {
    logger.error('Failed to update task', { error });
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to update task'
    });
  }
});

// ==========================================
// APPROVAL ROUTES
// ==========================================

// Get pending approvals
app.get('/api/v1/approvals/pending', async (req: Request, res: Response) => {
  try {
    const approvals = await prisma.approval.findMany({
      where: { status: 'PENDING' },
      include: {
        action: {
          include: {
            task: {
              include: {
                createdBy: { select: { id: true, email: true, name: true } }
              }
            }
          }
        }
      },
      orderBy: { requestedAt: 'desc' }
    });

    res.json({ success: true, approvals });
  } catch (error) {
    logger.error('Failed to fetch pending approvals', { error });
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to fetch approvals'
    });
  }
});

// Get all approvals
app.get('/api/v1/approvals', async (req: Request, res: Response) => {
  try {
    const { status, limit = '50', offset = '0' } = req.query;
    
    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    const approvals = await prisma.approval.findMany({
      where,
      take: parseInt(limit as string, 10),
      skip: parseInt(offset as string, 10),
      orderBy: { requestedAt: 'desc' },
      include: {
        action: true,
        approvedBy: { select: { id: true, email: true, name: true } }
      }
    });

    const total = await prisma.approval.count({ where });

    res.json({
      success: true,
      approvals,
      pagination: {
        total,
        limit: parseInt(limit as string, 10),
        offset: parseInt(offset as string, 10)
      }
    });
  } catch (error) {
    logger.error('Failed to fetch approvals', { error });
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to fetch approvals'
    });
  }
});

// Get approval by ID
app.get('/api/v1/approvals/:id', async (req: Request, res: Response) => {
  try {
    const approval = await prisma.approval.findUnique({
      where: { id: req.params.id },
      include: {
        action: {
          include: {
            task: {
              include: {
                createdBy: { select: { id: true, email: true, name: true } }
              }
            }
          }
        },
        approvedBy: { select: { id: true, email: true, name: true } }
      }
    });

    if (!approval) {
      return res.status(404).json({ error: 'Approval not found' });
    }

    res.json({ success: true, approval });
  } catch (error) {
    logger.error('Failed to fetch approval', { error });
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to fetch approval'
    });
  }
});

// Create approval request
app.post('/api/v1/approvals', async (req: Request, res: Response) => {
  try {
    const { actionId, requestedBy, expiresAt } = req.body;

    if (!actionId || !requestedBy) {
      return res.status(400).json({
        error: 'Missing required fields: actionId, requestedBy'
      });
    }

    const approval = await prisma.approval.create({
      data: {
        actionId,
        requestedBy,
        expiresAt: expiresAt ? new Date(expiresAt) : new Date(Date.now() + 24 * 60 * 60 * 1000)
      }
    });

    res.status(201).json({ success: true, approval });
  } catch (error) {
    logger.error('Failed to create approval', { error });
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to create approval'
    });
  }
});

// Process approval decision
app.post('/api/v1/approvals/:id/decision', async (req: Request, res: Response) => {
  try {
    const { decision, decidedBy, reason } = req.body;

    if (!decision || !decidedBy) {
      return res.status(400).json({
        error: 'Missing required fields: decision, decidedBy'
      });
    }

    if (decision !== 'approve' && decision !== 'reject') {
      return res.status(400).json({ error: 'Decision must be "approve" or "reject"' });
    }

    const updateData: Record<string, unknown> = {
      status: decision === 'approve' ? 'APPROVED' : 'REJECTED'
    };

    if (decision === 'approve') {
      updateData.approvedById = decidedBy;
      updateData.approvedAt = new Date();
    } else {
      updateData.rejectedById = decidedBy;
      updateData.rejectedAt = new Date();
      updateData.rejectionReason = reason;
    }

    const approval = await prisma.approval.update({
      where: { id: req.params.id },
      data: updateData,
      include: {
        action: true,
        approvedBy: { select: { id: true, email: true, name: true } }
      }
    });

    // Update action status
    await prisma.aIAction.update({
      where: { id: approval.actionId },
      data: {
        status: decision === 'approve' ? 'APPROVED' : 'REJECTED'
      }
    });

    res.json({ success: true, approval });
  } catch (error) {
    logger.error('Failed to process approval decision', { error });
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to process decision'
    });
  }
});

// ==========================================
// SYSTEM ROUTES
// ==========================================

// Health check
app.get('/health', async (req: Request, res: Response) => {
  try {
    const dbHealth = await checkDatabaseHealth();
    
    res.json({
      status: dbHealth.healthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      services: {
        database: dbHealth.healthy ? 'connected' : 'error',
        latency: `${dbHealth.latencyMs}ms`
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Health check failed'
    });
  }
});

// Root endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({
    name: 'Azenith Autonomous Company AI System (AACA)',
    version: '1.0.0',
    phase: 'Phase 1 - Foundation',
    status: 'operational',
    documentation: '/api/v1/docs',
    health: '/health'
  });
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Express error', { error: err.message, stack: err.stack });
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

// Start server
async function startServer() {
  try {
    // Connect to database
    await connectDatabase();
    
    app.listen(PORT, () => {
      logger.info(`AACA Phase 1 Server running on port ${PORT}`);
      logger.info(`API available at http://localhost:${PORT}/api/v1`);
      logger.info(`Health check at http://localhost:${PORT}/health`);
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await prisma.$disconnect();
  process.exit(0);
});

// Start if run directly
if (require.main === module) {
  startServer();
}

export { app, startServer };

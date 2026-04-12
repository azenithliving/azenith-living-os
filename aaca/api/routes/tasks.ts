import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { databaseService } from '../../database/database-service';
import { Logger } from '../../utils/logger';
import { TaskStatus, TaskPriority, TaskType } from '../../types';

const logger = new Logger('TaskRoutes');
const router = Router();

const prisma = databaseService.getClient();

const createTaskSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  type: z.nativeEnum(TaskType),
  priority: z.nativeEnum(TaskPriority).default(TaskPriority.MEDIUM),
  payload: z.record(z.unknown()).optional(),
  createdById: z.string().uuid(),
  workflowId: z.string().uuid().optional(),
  parentTaskId: z.string().uuid().optional()
});

const updateTaskSchema = z.object({
  status: z.nativeEnum(TaskStatus).optional(),
  priority: z.nativeEnum(TaskPriority).optional(),
  result: z.record(z.unknown()).optional(),
  error: z.string().optional(),
  assignedTo: z.string().uuid().optional()
});

const paginationSchema = z.object({
  limit: z.coerce.number().int().positive().default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
  status: z.nativeEnum(TaskStatus).optional(),
  type: z.nativeEnum(TaskType).optional(),
  priority: z.nativeEnum(TaskPriority).optional()
});

const validate = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Validation Error',
          details: error.issues.map((e: z.ZodIssue) => ({
            field: e.path.join('.'),
            message: e.message
          }))
        });
      } else {
        next(error);
      }
    }
  };
};

const validateQuery = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.query = schema.parse(req.query);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Validation Error',
          details: error.issues.map((e: z.ZodIssue) => ({
            field: e.path.join('.'),
            message: e.message
          }))
        });
      } else {
        next(error);
      }
    }
  };
};

router.post('/', validate(createTaskSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = createTaskSchema.parse(req.body);

    const task = await prisma.aITask.create({
      data: {
        ...data,
        status: TaskStatus.PENDING
      },
      include: {
        createdBy: { select: { id: true, email: true, name: true } }
      }
    });

    logger.info('Task created', { taskId: task.id, title: task.title });

    res.status(201).json({
      success: true,
      data: task
    });
  } catch (error) {
    logger.error('Failed to create task', { error });
    next(error);
  }
});

router.get('/', validateQuery(paginationSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { limit, offset, status, type, priority } = req.query as unknown as z.infer<typeof paginationSchema>;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (type) where.type = type;
    if (priority) where.priority = priority;

    const [tasks, total] = await Promise.all([
      prisma.aITask.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
        include: {
          createdBy: { select: { id: true, email: true, name: true } },
          _count: { select: { actions: true } }
        }
      }),
      prisma.aITask.count({ where })
    ]);

    res.json({
      success: true,
      data: tasks,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    });
  } catch (error) {
    logger.error('Failed to fetch tasks', { error });
    next(error);
  }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const task = await prisma.aITask.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, email: true, name: true } },
        actions: {
          include: {
            approval: true,
            executionLogs: { orderBy: { timestamp: 'desc' } }
          }
        },
        subTasks: true,
        parentTask: { select: { id: true, title: true, status: true } },
        workflow: { select: { id: true, name: true, status: true } },
        events: { orderBy: { createdAt: 'desc' }, take: 20 }
      }
    });

    if (!task) {
      res.status(404).json({
        success: false,
        error: 'Task not found'
      });
      return;
    }

    res.json({
      success: true,
      data: task
    });
  } catch (error) {
    logger.error('Failed to fetch task', { error });
    next(error);
  }
});

router.patch('/:id', validate(updateTaskSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const data = updateTaskSchema.parse(req.body);

    const updateData: Record<string, unknown> = { ...data };

    if (data.status === TaskStatus.IN_PROGRESS) {
      updateData.startedAt = new Date();
    }
    if (data.status === TaskStatus.COMPLETED || data.status === TaskStatus.FAILED) {
      updateData.completedAt = new Date();
    }

    const task = await prisma.aITask.update({
      where: { id },
      data: updateData,
      include: {
        createdBy: { select: { id: true, email: true } }
      }
    });

    logger.info('Task updated', { taskId: id, status: data.status });

    res.json({
      success: true,
      data: task
    });
  } catch (error) {
    logger.error('Failed to update task', { error });
    next(error);
  }
});

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    await prisma.aITask.delete({
      where: { id }
    });

    logger.info('Task deleted', { taskId: id });

    res.json({
      success: true,
      message: 'Task deleted successfully'
    });
  } catch (error) {
    logger.error('Failed to delete task', { error });
    next(error);
  }
});

export { router as taskRoutes };
export default router;

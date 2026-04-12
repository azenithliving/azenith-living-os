import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { databaseService } from '../../database/database-service';
import { Logger } from '../../utils/logger';
import { ApprovalStatus, ActionStatus } from '../../types';

const logger = new Logger('ApprovalRoutes');
const router = Router();

const prisma = databaseService.getClient();

const createApprovalSchema = z.object({
  actionId: z.string().uuid(),
  requestedBy: z.string().uuid(),
  expiresAt: z.string().datetime().optional()
});

const decisionSchema = z.object({
  decision: z.enum(['approve', 'reject']),
  decidedBy: z.string().uuid(),
  reason: z.string().optional()
});

const paginationSchema = z.object({
  limit: z.coerce.number().int().positive().default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
  status: z.nativeEnum(ApprovalStatus).optional()
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

router.post('/', validate(createApprovalSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = createApprovalSchema.parse(req.body);

    const defaultExpiry = new Date();
    defaultExpiry.setHours(defaultExpiry.getHours() + 24);

    const approval = await prisma.approval.create({
      data: {
        actionId: data.actionId,
        requestedBy: data.requestedBy,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : defaultExpiry,
        status: ApprovalStatus.PENDING
      },
      include: {
        action: {
          include: {
            task: { select: { id: true, title: true } }
          }
        }
      }
    });

    await prisma.aIAction.update({
      where: { id: data.actionId },
      data: { status: ActionStatus.AWAITING_APPROVAL }
    });

    logger.info('Approval created', {
      approvalId: approval.id,
      actionId: data.actionId
    });

    res.status(201).json({
      success: true,
      data: approval
    });
  } catch (error) {
    logger.error('Failed to create approval', { error });
    next(error);
  }
});

router.get('/pending', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const approvals = await prisma.approval.findMany({
      where: { status: ApprovalStatus.PENDING },
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

    res.json({
      success: true,
      data: approvals
    });
  } catch (error) {
    logger.error('Failed to fetch pending approvals', { error });
    next(error);
  }
});

router.get('/', validateQuery(paginationSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { limit, offset, status } = req.query as unknown as z.infer<typeof paginationSchema>;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    const [approvals, total] = await Promise.all([
      prisma.approval.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { requestedAt: 'desc' },
        include: {
          action: {
            select: { id: true, type: true, status: true }
          },
          approvedBy: { select: { id: true, email: true, name: true } }
        }
      }),
      prisma.approval.count({ where })
    ]);

    res.json({
      success: true,
      data: approvals,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    });
  } catch (error) {
    logger.error('Failed to fetch approvals', { error });
    next(error);
  }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const approval = await prisma.approval.findUnique({
      where: { id },
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
      res.status(404).json({
        success: false,
        error: 'Approval not found'
      });
      return;
    }

    res.json({
      success: true,
      data: approval
    });
  } catch (error) {
    logger.error('Failed to fetch approval', { error });
    next(error);
  }
});

router.post('/:id/decision', validate(decisionSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const data = decisionSchema.parse(req.body);

    const approval = await prisma.approval.findUnique({
      where: { id },
      include: { action: true }
    });

    if (!approval) {
      res.status(404).json({
        success: false,
        error: 'Approval not found'
      });
      return;
    }

    if (approval.status !== ApprovalStatus.PENDING) {
      res.status(400).json({
        success: false,
        error: `Approval already ${approval.status.toLowerCase()}`
      });
      return;
    }

    if (new Date() > approval.expiresAt) {
      await prisma.approval.update({
        where: { id },
        data: { status: ApprovalStatus.EXPIRED }
      });

      res.status(400).json({
        success: false,
        error: 'Approval request has expired'
      });
      return;
    }

    const isApproved = data.decision === 'approve';

    const updateData: Record<string, unknown> = {
      status: isApproved ? ApprovalStatus.APPROVED : ApprovalStatus.REJECTED
    };

    if (isApproved) {
      updateData.approvedById = data.decidedBy;
      updateData.approvedAt = new Date();
    } else {
      updateData.rejectedById = data.decidedBy;
      updateData.rejectedAt = new Date();
      updateData.rejectionReason = data.reason;
    }

    const updatedApproval = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const approval = await tx.approval.update({
        where: { id },
        data: updateData,
        include: {
          action: true,
          approvedBy: { select: { id: true, email: true, name: true } }
        }
      });

      await tx.aIAction.update({
        where: { id: approval.actionId },
        data: {
          status: isApproved ? ActionStatus.APPROVED : ActionStatus.REJECTED
        }
      });

      return approval;
    });

    logger.info(`Approval ${data.decision}ed`, {
      approvalId: id,
      actionId: updatedApproval.actionId,
      decidedBy: data.decidedBy
    });

    res.json({
      success: true,
      data: updatedApproval
    });
  } catch (error) {
    logger.error('Failed to process approval decision', { error });
    next(error);
  }
});

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    await prisma.approval.delete({
      where: { id }
    });

    logger.info('Approval deleted', { approvalId: id });

    res.json({
      success: true,
      message: 'Approval deleted successfully'
    });
  } catch (error) {
    logger.error('Failed to delete approval', { error });
    next(error);
  }
});

export { router as approvalRoutes };
export default router;

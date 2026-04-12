/**
 * AACA Phase 4: Full API Routes
 * Complete REST API for the Autonomous Company AI System
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../database/prisma-client';
import { Logger } from '../utils/logger';
import { Brains } from '../phase3';
import { TaskType, TaskPriority, ActionType } from '../types';

const logger = new Logger('Phase4-API');

export function createPhase4Router(brains: Brains): Router {
  const router = Router();

  // ==========================================
  // SYSTEM ROUTES
  // ==========================================

  // Health check
  router.get('/health', async (req: Request, res: Response) => {
    try {
      const health = await brains.getStats();
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        ...health
      });
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // System info
  router.get('/', (req: Request, res: Response) => {
    res.json({
      name: 'Azenith Autonomous Company AI System (AACA)',
      version: '1.0.0',
      phase: 'Phase 4 - Full Integration',
      status: 'operational',
      agents: ['orchestrator', 'dev', 'security', 'qa', 'ops', 'communication', 'evolution'],
      endpoints: {
        tasks: '/api/v1/tasks',
        workflows: '/api/v1/workflows',
        approvals: '/api/v1/approvals',
        health: '/api/v1/health'
      }
    });
  });

  // ==========================================
  // TASK ROUTES
  // ==========================================

  // Create task
  router.post('/tasks', async (req: Request, res: Response) => {
    try {
      const { title, description, type, priority = 'MEDIUM', payload, createdBy } = req.body;

      if (!title || !type || !createdBy) {
        return res.status(400).json({
          error: 'Missing required fields: title, type, createdBy'
        });
      }

      const result = await brains.createTask({
        title,
        description,
        type: type as TaskType,
        priority: priority as TaskPriority,
        payload,
        createdBy
      });

      res.status(201).json({
        success: true,
        task: result
      });
    } catch (error) {
      logger.error('Failed to create task', { error });
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to create task'
      });
    }
  });

  // List tasks
  router.get('/tasks', async (req: Request, res: Response) => {
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
  router.get('/tasks/:id', async (req: Request, res: Response) => {
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
          workflow: true
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

  // ==========================================
  // WORKFLOW ROUTES
  // ==========================================

  // Create workflow
  router.post('/workflows', async (req: Request, res: Response) => {
    try {
      const { name, description, definition } = req.body;

      if (!name || !definition) {
        return res.status(400).json({ error: 'Missing required fields: name, definition' });
      }

      const workflow = await prisma.workflow.create({
        data: {
          name,
          description,
          definition: definition as Record<string, unknown>,
          status: 'DRAFT'
        }
      });

      res.status(201).json({
        success: true,
        workflow: {
          id: workflow.id,
          name: workflow.name,
          status: workflow.status,
          createdAt: workflow.createdAt
        }
      });
    } catch (error) {
      logger.error('Failed to create workflow', { error });
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to create workflow'
      });
    }
  });

  // Execute workflow
  router.post('/workflows/:id/execute', async (req: Request, res: Response) => {
    try {
      const { createdBy } = req.body;

      if (!createdBy) {
        return res.status(400).json({ error: 'Missing required field: createdBy' });
      }

      const result = await brains.executeWorkflow(req.params.id, createdBy);

      res.status(201).json({
        success: true,
        execution: result
      });
    } catch (error) {
      logger.error('Failed to execute workflow', { error });
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to execute workflow'
      });
    }
  });

  // List workflows
  router.get('/workflows', async (req: Request, res: Response) => {
    try {
      const workflows = await prisma.workflow.findMany({
        orderBy: { createdAt: 'desc' }
      });

      res.json({ success: true, workflows });
    } catch (error) {
      logger.error('Failed to fetch workflows', { error });
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to fetch workflows'
      });
    }
  });

  // ==========================================
  // APPROVAL ROUTES
  // ==========================================

  // Get pending approvals
  router.get('/approvals/pending', async (req: Request, res: Response) => {
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

  // Get approval by ID
  router.get('/approvals/:id', async (req: Request, res: Response) => {
    try {
      const approval = await prisma.approval.findUnique({
        where: { id: req.params.id },
        include: {
          action: {
            include: {
              task: true
            }
          }
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
  router.post('/approvals', async (req: Request, res: Response) => {
    try {
      const { actionId, requestedBy, reason, expiresAt } = req.body;

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
  router.post('/approvals/:id/decision', async (req: Request, res: Response) => {
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
        include: { action: true }
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
  // ACTION ROUTES
  // ==========================================

  // Create action
  router.post('/actions', async (req: Request, res: Response) => {
    try {
      const { taskId, type, payload, requiresApproval, riskScore } = req.body;

      if (!taskId || !type) {
        return res.status(400).json({
          error: 'Missing required fields: taskId, type'
        });
      }

      const action = await prisma.aIAction.create({
        data: {
          taskId,
          type: type as ActionType,
          payload: payload as Record<string, unknown>,
          requiresApproval: requiresApproval || false,
          riskScore: riskScore || 0,
          status: 'PENDING'
        }
      });

      res.status(201).json({ success: true, action });
    } catch (error) {
      logger.error('Failed to create action', { error });
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to create action'
      });
    }
  });

  // Get actions for a task
  router.get('/tasks/:id/actions', async (req: Request, res: Response) => {
    try {
      const actions = await prisma.aIAction.findMany({
        where: { taskId: req.params.id },
        include: {
          approval: true,
          executionLogs: true
        },
        orderBy: { createdAt: 'desc' }
      });

      res.json({ success: true, actions });
    } catch (error) {
      logger.error('Failed to fetch actions', { error });
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to fetch actions'
      });
    }
  });

  // ==========================================
  // QUEUE/EVENT STATS
  // ==========================================

  // Get queue status
  router.get('/system/queues', async (req: Request, res: Response) => {
    try {
      const { queueManager } = brains.getServices().nervousSystem.getServices();
      const queueNames = queueManager.getQueueNames();

      const statuses = await Promise.all(
        queueNames.map(async (name) => {
          try {
            const status = await queueManager.getQueueStatus(name);
            return { name, status };
          } catch {
            return { name, status: null, error: 'Failed to get status' };
          }
        })
      );

      res.json({ success: true, queues: statuses });
    } catch (error) {
      logger.error('Failed to fetch queue stats', { error });
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to fetch queue stats'
      });
    }
  });

  // Get event bus stats
  router.get('/system/events', async (req: Request, res: Response) => {
    try {
      const { eventBus } = brains.getServices().nervousSystem.getServices();
      const stats = eventBus.getStats();

      res.json({ success: true, events: stats });
    } catch (error) {
      logger.error('Failed to fetch event stats', { error });
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to fetch event stats'
      });
    }
  });

  // Get system stats
  router.get('/system/stats', async (req: Request, res: Response) => {
    try {
      const stats = await brains.getStats();
      res.json({ success: true, stats });
    } catch (error) {
      logger.error('Failed to fetch system stats', { error });
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to fetch system stats'
      });
    }
  });

  return router;
}

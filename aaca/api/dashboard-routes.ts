/**
 * AACA Dashboard API
 * Real-time monitoring and control interface for the UI
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../database/prisma-client';
import { Logger } from '../utils/logger';
import { Brains } from '../phase3';

const logger = new Logger('DashboardAPI');

export function createDashboardRouter(brains: Brains): Router {
  const router = Router();

  // ==========================================
  // REAL-TIME STATUS DASHBOARD
  // ==========================================

  // Get complete dashboard overview
  router.get('/overview', async (req: Request, res: Response) => {
    try {
      const { eventBus, queueManager } = brains.getServices().nervousSystem.getServices();

      // Parallel data fetching
      const [
        taskStats,
        pendingTasks,
        recentTasks,
        pendingApprovals,
        systemLogs,
        agentStats,
        queueStats,
        eventStats
      ] = await Promise.all([
        // Task statistics
        prisma.aITask.groupBy({
          by: ['status'],
          _count: { id: true }
        }),

        // Pending tasks count
        prisma.aITask.count({
          where: { status: { in: ['PENDING', 'QUEUED', 'IN_PROGRESS'] } }
        }),

        // Recent tasks (last 24 hours)
        prisma.aITask.findMany({
          where: {
            createdAt: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
            }
          },
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            createdBy: { select: { id: true, email: true, name: true } },
            actions: { select: { id: true, type: true, status: true } }
          }
        }),

        // Pending approvals
        prisma.approval.count({
          where: { status: 'PENDING', expiresAt: { gt: new Date() } }
        }),

        // Recent system logs
        prisma.systemLog.findMany({
          where: {
            createdAt: {
              gte: new Date(Date.now() - 1 * 60 * 60 * 1000) // Last hour
            }
          },
          take: 50,
          orderBy: { createdAt: 'desc' }
        }),

        // Agent stats from brains
        brains.getStats(),

        // Queue statistics
        Promise.all(
          queueManager.getQueueNames().map(async (name) => {
            try {
              const status = await queueManager.getQueueStatus(name);
              return { name, ...status };
            } catch {
              return { name, error: 'Failed to fetch' };
            }
          })
        ),

        // Event bus stats
        Promise.resolve(eventBus.getStats())
      ]);

      // Calculate task statistics
      const taskCounts = taskStats.reduce((acc, stat) => {
        acc[stat.status] = stat._count.id;
        return acc;
      }, {} as Record<string, number>);

      const totalTasks = taskStats.reduce((sum, s) => sum + s._count.id, 0);
      const successRate = totalTasks > 0
        ? ((taskCounts['COMPLETED'] || 0) / totalTasks * 100).toFixed(1)
        : '0';

      res.json({
        success: true,
        overview: {
          tasks: {
            total: totalTasks,
            pending: pendingTasks,
            completed: taskCounts['COMPLETED'] || 0,
            failed: taskCounts['FAILED'] || 0,
            inProgress: taskCounts['IN_PROGRESS'] || 0,
            successRate: `${successRate}%`,
            recent: recentTasks
          },
          approvals: {
            pending: pendingApprovals,
            urgent: pendingApprovals > 5 ? true : false
          },
          agents: agentStats,
          queues: queueStats,
          events: eventStats,
          system: {
            status: 'healthy',
            lastUpdated: new Date().toISOString(),
            logs: systemLogs
          }
        }
      });
    } catch (error) {
      logger.error('Failed to fetch dashboard overview', { error });
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to fetch overview'
      });
    }
  });

  // ==========================================
  // TASK MONITORING
  // ==========================================

  // Get live task stream (last 100 with polling)
  router.get('/tasks/live', async (req: Request, res: Response) => {
    try {
      const { limit = '100', status, type, agent } = req.query;

      const where: Record<string, unknown> = {};
      if (status) where.status = status;
      if (type) where.type = type;
      if (agent) where.assignedTo = agent;

      const tasks = await prisma.aITask.findMany({
        where,
        take: parseInt(limit as string, 10),
        orderBy: { updatedAt: 'desc' },
        include: {
          createdBy: { select: { id: true, email: true, name: true } },
          actions: {
            include: {
              approval: { select: { id: true, status: true } }
            }
          },
          workflow: { select: { id: true, name: true } }
        }
      });

      // Add elapsed time for in-progress tasks
      const tasksWithMetrics = tasks.map(task => ({
        ...task,
        metrics: {
          elapsedMs: task.startedAt
            ? (task.completedAt?.getTime() || Date.now()) - task.startedAt.getTime()
            : null,
          waitTimeMs: task.startedAt
            ? task.startedAt.getTime() - task.createdAt.getTime()
            : null
        }
      }));

      res.json({
        success: true,
        tasks: tasksWithMetrics,
        count: tasks.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to fetch live tasks', { error });
      res.status(500).json({ error: 'Failed to fetch tasks' });
    }
  });

  // Get task timeline for a specific task
  router.get('/tasks/:id/timeline', async (req: Request, res: Response) => {
    try {
      const [task, actions, events, logs] = await Promise.all([
        prisma.aITask.findUnique({
          where: { id: req.params.id },
          include: {
            createdBy: { select: { id: true, email: true, name: true } }
          }
        }),

        prisma.aIAction.findMany({
          where: { taskId: req.params.id },
          include: {
            approval: true,
            executionLogs: {
              orderBy: { timestamp: 'asc' }
            }
          },
          orderBy: { createdAt: 'asc' }
        }),

        prisma.event.findMany({
          where: { taskId: req.params.id },
          orderBy: { createdAt: 'asc' }
        }),

        prisma.systemLog.findMany({
          where: {
            metadata: {
              path: ['taskId'],
              equals: req.params.id
            }
          },
          orderBy: { createdAt: 'asc' },
          take: 100
        })
      ]);

      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      // Build timeline
      const timeline = [
        { timestamp: task.createdAt, type: 'task_created', data: task },
        ...(task.startedAt ? [{ timestamp: task.startedAt, type: 'task_started', data: {} }] : []),
        ...actions.flatMap(action => [
          { timestamp: action.createdAt, type: 'action_created', data: action },
          ...(action.executedAt ? [{ timestamp: action.executedAt, type: 'action_executed', data: {} }] : []),
          ...(action.approval ? [{ timestamp: action.approval.requestedAt, type: 'approval_requested', data: action.approval }] : []),
          ...(action.approval?.approvedAt ? [{ timestamp: action.approval.approvedAt, type: 'approval_granted', data: {} }] : []),
          ...(action.completedAt ? [{ timestamp: action.completedAt, type: 'action_completed', data: {} }] : []),
          ...action.executionLogs.map(log => ({
            timestamp: log.timestamp,
            type: 'execution_log',
            data: log
          }))
        ]),
        ...events.map(event => ({
          timestamp: event.createdAt,
          type: `event_${event.type}`,
          data: event
        })),
        ...(task.completedAt ? [{ timestamp: task.completedAt, type: 'task_completed', data: {} }] : []),
        ...(task.failedAt ? [{ timestamp: task.failedAt, type: 'task_failed', data: { error: task.error } }] : [])
      ].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

      res.json({
        success: true,
        task,
        timeline,
        actions,
        events,
        logs
      });
    } catch (error) {
      logger.error('Failed to fetch task timeline', { error });
      res.status(500).json({ error: 'Failed to fetch timeline' });
    }
  });

  // ==========================================
  // AGENT MONITORING
  // ==========================================

  // Get agent status and performance
  router.get('/agents/status', async (req: Request, res: Response) => {
    try {
      const { taskWorker } = brains.getServices().nervousSystem.getServices();
      const workerStats = taskWorker.getStats();

      // Get task counts by agent type
      const agentTaskStats = await prisma.aITask.groupBy({
        by: ['assignedTo'],
        _count: { id: true },
        where: {
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
          }
        }
      });

      const agents = [
        {
          id: 'orchestrator',
          name: 'Orchestrator',
          status: 'active',
          role: 'Task routing & workflow management',
          tasksToday: agentTaskStats.find(s => s.assignedTo === 'orchestrator')?._count.id || 0
        },
        {
          id: 'dev-agent',
          name: 'Dev Agent',
          status: 'active',
          role: 'Code generation & repository analysis',
          tasksToday: agentTaskStats.find(s => s.assignedTo === 'dev-agent')?._count.id || 0
        },
        {
          id: 'security-agent',
          name: 'Security Agent',
          status: 'active',
          role: 'Risk scoring & security scanning',
          tasksToday: agentTaskStats.find(s => s.assignedTo === 'security-agent')?._count.id || 0
        },
        {
          id: 'qa-agent',
          name: 'QA Agent',
          status: 'active',
          role: 'Test execution & build validation',
          tasksToday: agentTaskStats.find(s => s.assignedTo === 'qa-agent')?._count.id || 0
        },
        {
          id: 'ops-agent',
          name: 'Ops Agent',
          status: 'active',
          role: 'Monitoring & health checks',
          tasksToday: agentTaskStats.find(s => s.assignedTo === 'ops-agent')?._count.id || 0
        },
        {
          id: 'communication-agent',
          name: 'Communication Agent',
          status: 'active',
          role: 'Notifications & alerts',
          tasksToday: agentTaskStats.find(s => s.assignedTo === 'communication-agent')?._count.id || 0
        },
        {
          id: 'evolution-agent',
          name: 'Evolution Agent',
          status: 'active',
          role: 'Self-extension & capability evolution',
          tasksToday: agentTaskStats.find(s => s.assignedTo === 'evolution-agent')?._count.id || 0
        }
      ];

      res.json({
        success: true,
        agents,
        worker: workerStats,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to fetch agent status', { error });
      res.status(500).json({ error: 'Failed to fetch agent status' });
    }
  });

  // Get agent logs
  router.get('/agents/:id/logs', async (req: Request, res: Response) => {
    try {
      const { hours = '24' } = req.query;

      const logs = await prisma.systemLog.findMany({
        where: {
          service: req.params.id,
          createdAt: {
            gte: new Date(Date.now() - parseInt(hours as string, 10) * 60 * 60 * 1000)
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 100
      });

      res.json({
        success: true,
        agent: req.params.id,
        logs,
        count: logs.length
      });
    } catch (error) {
      logger.error('Failed to fetch agent logs', { error });
      res.status(500).json({ error: 'Failed to fetch logs' });
    }
  });

  // ==========================================
  // APPROVAL QUEUE
  // ==========================================

  // Get approval queue for dashboard
  router.get('/approvals/queue', async (req: Request, res: Response) => {
    try {
      const { status = 'PENDING', limit = '50' } = req.query;

      const approvals = await prisma.approval.findMany({
        where: {
          status: status as string,
          ...(status === 'PENDING' ? { expiresAt: { gt: new Date() } } : {})
        },
        take: parseInt(limit as string, 10),
        orderBy: { requestedAt: 'asc' },
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
          approvedBy: { select: { id: true, email: true, name: true } },
          rejectedBy: { select: { id: true, email: true, name: true } }
        }
      });

      // Add urgency score
      const approvalsWithUrgency = approvals.map(approval => {
        const hoursUntilExpiry = (approval.expiresAt.getTime() - Date.now()) / (60 * 60 * 1000);
        return {
          ...approval,
          urgency: {
            hoursUntilExpiry: Math.max(0, hoursUntilExpiry).toFixed(1),
            level: hoursUntilExpiry < 2 ? 'critical' : hoursUntilExpiry < 8 ? 'high' : 'normal'
          }
        };
      });

      // Statistics
      const stats = await prisma.approval.groupBy({
        by: ['status'],
        _count: { id: true }
      });

      res.json({
        success: true,
        approvals: approvalsWithUrgency,
        stats: stats.reduce((acc, s) => {
          acc[s.status] = s._count.id;
          return acc;
        }, {} as Record<string, number>),
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to fetch approval queue', { error });
      res.status(500).json({ error: 'Failed to fetch approval queue' });
    }
  });

  // ==========================================
  // SYSTEM LOGS & METRICS
  // ==========================================

  // Get system logs
  router.get('/logs', async (req: Request, res: Response) => {
    try {
      const { service, level, hours = '24', limit = '100' } = req.query;

      const where: Record<string, unknown> = {
        createdAt: {
          gte: new Date(Date.now() - parseInt(hours as string, 10) * 60 * 60 * 1000)
        }
      };

      if (service) where.service = service;
      if (level) where.level = level;

      const logs = await prisma.systemLog.findMany({
        where,
        take: parseInt(limit as string, 10),
        orderBy: { createdAt: 'desc' }
      });

      // Statistics by level
      const levelStats = await prisma.systemLog.groupBy({
        by: ['level'],
        where: {
          createdAt: {
            gte: new Date(Date.now() - parseInt(hours as string, 10) * 60 * 60 * 1000)
          }
        },
        _count: { id: true }
      });

      res.json({
        success: true,
        logs,
        stats: {
          byLevel: levelStats.reduce((acc, s) => {
            acc[s.level] = s._count.id;
            return acc;
          }, {} as Record<string, number>),
          total: logs.length
        },
        filters: { service, level, hours }
      });
    } catch (error) {
      logger.error('Failed to fetch system logs', { error });
      res.status(500).json({ error: 'Failed to fetch logs' });
    }
  });

  // Get real-time metrics
  router.get('/metrics', async (req: Request, res: Response) => {
    try {
      const { hours = '1' } = req.query;
      const since = new Date(Date.now() - parseInt(hours as string, 10) * 60 * 60 * 1000);

      // Task throughput
      const taskThroughput = await prisma.aITask.groupBy({
        by: ['status'],
        where: { createdAt: { gte: since } },
        _count: { id: true }
      });

      // Execution duration trends
      const recentTasks = await prisma.aITask.findMany({
        where: {
          completedAt: { gte: since },
          startedAt: { not: null }
        },
        select: {
          type: true,
          startedAt: true,
          completedAt: true
        }
      });

      const avgDurations = recentTasks.reduce((acc, task) => {
        if (task.startedAt && task.completedAt) {
          const duration = task.completedAt.getTime() - task.startedAt.getTime();
          if (!acc[task.type]) {
            acc[task.type] = { total: 0, count: 0 };
          }
          acc[task.type].total += duration;
          acc[task.type].count += 1;
        }
        return acc;
      }, {} as Record<string, { total: number; count: number }>);

      const avgDurationByType = Object.entries(avgDurations).map(([type, data]) => ({
        type,
        avgDurationMs: Math.round(data.total / data.count),
        count: data.count
      }));

      // Error rate
      const errorRate = await prisma.aITask.count({
        where: {
          status: 'FAILED',
          createdAt: { gte: since }
        }
      });

      const totalRecent = await prisma.aITask.count({
        where: { createdAt: { gte: since } }
      });

      res.json({
        success: true,
        metrics: {
          throughput: taskThroughput,
          avgDurationByType,
          errorRate: {
            count: errorRate,
            percentage: totalRecent > 0 ? ((errorRate / totalRecent) * 100).toFixed(2) : '0',
            total: totalRecent
          },
          period: `${hours}h`
        }
      });
    } catch (error) {
      logger.error('Failed to fetch metrics', { error });
      res.status(500).json({ error: 'Failed to fetch metrics' });
    }
  });

  // ==========================================
  // CONTROL ACTIONS
  // ==========================================

  // Pause/resume agent queues
  router.post('/agents/:id/control', async (req: Request, res: Response) => {
    try {
      const { action } = req.body; // 'pause' or 'resume'
      const { queueManager } = brains.getServices().nervousSystem.getServices();

      if (action === 'pause') {
        await queueManager.pauseQueue(req.params.id);
      } else if (action === 'resume') {
        await queueManager.resumeQueue(req.params.id);
      } else {
        return res.status(400).json({ error: 'Action must be "pause" or "resume"' });
      }

      res.json({
        success: true,
        agent: req.params.id,
        action,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to control agent', { error });
      res.status(500).json({ error: 'Failed to control agent' });
    }
  });

  // Retry failed task
  router.post('/tasks/:id/retry', async (req: Request, res: Response) => {
    try {
      const task = await prisma.aITask.findUnique({
        where: { id: req.params.id }
      });

      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      if (task.status !== 'FAILED' && task.status !== 'CANCELLED') {
        return res.status(400).json({ error: 'Only failed or cancelled tasks can be retried' });
      }

      // Update task status
      await prisma.aITask.update({
        where: { id: req.params.id },
        data: {
          status: 'PENDING',
          error: null,
          failedAt: null,
          retries: { increment: 1 }
        }
      });

      // Re-queue the task
      await brains.createTask({
        title: task.title,
        description: task.description || undefined,
        type: task.type as any,
        priority: task.priority as any,
        payload: task.payload as Record<string, unknown> || {},
        createdBy: task.createdById
      });

      res.json({
        success: true,
        taskId: req.params.id,
        message: 'Task queued for retry'
      });
    } catch (error) {
      logger.error('Failed to retry task', { error });
      res.status(500).json({ error: 'Failed to retry task' });
    }
  });

  return router;
}

import { Router } from 'express';
import { QueueManager } from '../queues/queue-manager';
import { EventBus } from '../events/event-bus';
import { OrchestratorService } from '../agents/orchestrator-service';
import { DevAgentService } from '../agents/dev-agent-service';
import { OpsAgentService } from '../agents/ops-agent-service';
import { SecurityAgentService } from '../agents/security-agent-service';
import { QAAgentService } from '../agents/qa-agent-service';
import { CommunicationAgentService } from '../agents/communication-agent-service';
import { EvolutionAgentService } from '../agents/evolution-agent-service';
import { ApprovalSystem } from '../approval/approval-system';
import { ExecutionEngine } from '../execution/execution-engine';
import { prisma } from '../database/prisma-client';
import { 
  TaskType, 
  TaskPriority,
  TaskStatus,
  ActionType,
  ApprovalStatus,
  CapabilityStatus,
  NotificationChannel,
  NotificationType
} from '../types';

export function createAPIRouter(
  orchestrator: OrchestratorService,
  devAgent: DevAgentService,
  opsAgent: OpsAgentService,
  securityAgent: SecurityAgentService,
  qaAgent: QAAgentService,
  communicationAgent: CommunicationAgentService,
  evolutionAgent: EvolutionAgentService,
  approvalSystem: ApprovalSystem,
  executionEngine: ExecutionEngine,
  queueManager: QueueManager,
  eventBus: EventBus
): Router {
  const router = Router();

  // ==========================================
  // Task Routes
  // ==========================================
  
  // Create a new task
  router.post('/tasks', async (req, res) => {
    try {
      const { title, description, type, priority, payload, createdBy, workflowId } = req.body;

      if (!title || !type || !createdBy) {
        return res.status(400).json({
          error: 'Missing required fields: title, type, createdBy'
        });
      }

      const task = await orchestrator.createTask({
        title,
        description,
        type: type as TaskType,
        priority: priority || TaskPriority.MEDIUM,
        payload,
        createdBy,
        workflowId
      });

      // Queue the task immediately
      await orchestrator.queueTask(task.id);

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
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  });

  // Get task by ID
  router.get('/tasks/:id', async (req, res) => {
    try {
      const { task, subTasks } = await orchestrator.getTaskStatus(req.params.id);
      
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      res.json({ task, subTasks });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  });

  // Cancel task
  router.post('/tasks/:id/cancel', async (req, res) => {
    try {
      await orchestrator.cancelTask(req.params.id);
      res.json({ success: true, message: 'Task cancelled' });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  });

  // List tasks
  router.get('/tasks', async (req, res) => {
    try {
      const { status, type, limit = '50', offset = '0' } = req.query;
      
      const where: Record<string, unknown> = {};
      if (status) where.status = status;
      if (type) where.type = type;

      const tasks = await prisma.aITask.findMany({
        where,
        take: parseInt(limit as string, 10),
        skip: parseInt(offset as string, 10),
        orderBy: { createdAt: 'desc' }
      });

      const total = await prisma.aITask.count({ where });

      res.json({ tasks, total, limit: parseInt(limit as string, 10), offset: parseInt(offset as string, 10) });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  });

  // ==========================================
  // Workflow Routes
  // ==========================================

  // Create workflow
  router.post('/workflows', async (req, res) => {
    try {
      const { name, description, definition } = req.body;

      if (!name || !definition) {
        return res.status(400).json({ error: 'Missing required fields: name, definition' });
      }

      const workflow = await orchestrator.createWorkflow({ name, description, definition });

      res.status(201).json({
        success: true,
        workflow: {
          id: workflow.id,
          name: workflow.name,
          status: workflow.status,
          version: workflow.version,
          createdAt: workflow.createdAt
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  });

  // Execute workflow
  router.post('/workflows/:id/execute', async (req, res) => {
    try {
      const { createdBy, input } = req.body;

      if (!createdBy) {
        return res.status(400).json({ error: 'Missing required field: createdBy' });
      }

      const task = await orchestrator.executeWorkflow(req.params.id, createdBy, input);

      res.status(201).json({
        success: true,
        task: {
          id: task.id,
          title: task.title,
          status: task.status
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  });

  // List workflows
  router.get('/workflows', async (req, res) => {
    try {
      const workflows = await prisma.workflow.findMany({
        orderBy: { createdAt: 'desc' }
      });

      res.json({ workflows });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  });

  // ==========================================
  // Approval Routes
  // ==========================================

  // Get pending approvals
  router.get('/approvals/pending', async (req, res) => {
    try {
      const approvals = await approvalSystem.getPendingApprovals();
      res.json({ approvals });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  });

  // Get approval by ID
  router.get('/approvals/:id', async (req, res) => {
    try {
      const approval = await approvalSystem.getApprovalById(req.params.id);
      
      if (!approval) {
        return res.status(404).json({ error: 'Approval not found' });
      }

      res.json({ approval });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  });

  // Approve or reject
  router.post('/approvals/:id/decision', async (req, res) => {
    try {
      const { decision, decidedBy, reason } = req.body;

      if (!decision || !decidedBy) {
        return res.status(400).json({ error: 'Missing required fields: decision, decidedBy' });
      }

      if (decision !== 'approve' && decision !== 'reject') {
        return res.status(400).json({ error: 'Decision must be "approve" or "reject"' });
      }

      const approval = await approvalSystem.processDecision({
        approvalId: req.params.id,
        decision,
        decidedBy,
        reason
      });

      res.json({
        success: true,
        approval: {
          id: approval.id,
          status: approval.status,
          approvedById: approval.approvedById,
          rejectedById: approval.rejectedById,
          approvedAt: approval.approvedAt,
          rejectedAt: approval.rejectedAt
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  });

  // Get approval stats
  router.get('/approvals/stats', async (req, res) => {
    try {
      const stats = await approvalSystem.getApprovalStats();
      res.json(stats);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  });

  // ==========================================
  // Security Routes
  // ==========================================

  // Run security scan
  router.post('/security/scan', async (req, res) => {
    try {
      const { target, scanType } = req.body;

      const task = await orchestrator.createTask({
        title: `Security Scan: ${scanType}`,
        description: `Scanning ${target} for security issues`,
        type: TaskType.SECURITY_SCAN,
        priority: TaskPriority.HIGH,
        payload: { target, scanType },
        createdBy: req.body.createdBy || 'api'
      });

      await orchestrator.queueTask(task.id);

      res.status(201).json({
        success: true,
        taskId: task.id,
        message: 'Security scan queued'
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  });

  // Assess risk
  router.post('/security/risk-assessment', async (req, res) => {
    try {
      const { actionId } = req.body;

      const action = await prisma.aIAction.findUnique({
        where: { id: actionId }
      });

      if (!action) {
        return res.status(404).json({ error: 'Action not found' });
      }

      const assessment = await securityAgent.assessRisk({
        taskId: action.taskId,
        action: action as any
      });

      res.json({ assessment });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  });

  // Scan repository
  router.post('/security/scan-repo', async (req, res) => {
    try {
      const { repoPath } = req.body;
      const target = repoPath || process.cwd();

      const result = await securityAgent.scanRepository(target);

      res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  });

  // ==========================================
  // QA Routes
  // ==========================================

  // Run tests
  router.post('/qa/tests', async (req, res) => {
    try {
      const { testPattern, coverage, updateSnapshots, createdBy } = req.body;

      const task = await orchestrator.createTask({
        title: 'Run Tests',
        type: TaskType.TESTING,
        priority: TaskPriority.HIGH,
        payload: { testPattern, coverage, updateSnapshots },
        createdBy: createdBy || 'api'
      });

      await orchestrator.queueTask(task.id);

      res.status(201).json({
        success: true,
        taskId: task.id,
        message: 'Tests queued'
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  });

  // Validate build
  router.post('/qa/build', async (req, res) => {
    try {
      const { buildCommand, checkTypes, lint, createdBy } = req.body;

      const task = await orchestrator.createTask({
        title: 'Validate Build',
        type: TaskType.ANALYSIS,
        priority: TaskPriority.HIGH,
        payload: { buildCommand, checkTypes, lint },
        createdBy: createdBy || 'api'
      });

      await orchestrator.queueTask(task.id);

      res.status(201).json({
        success: true,
        taskId: task.id,
        message: 'Build validation queued'
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  });

  // Run full validation
  router.post('/qa/full-validation', async (req, res) => {
    try {
      const result = await qaAgent.runFullValidation();
      res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  });

  // ==========================================
  // Ops Routes
  // ==========================================

  // Get system report
  router.get('/ops/system-report', async (req, res) => {
    try {
      const report = await opsAgent.getSystemReport();
      res.json(report);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  });

  // Start/stop monitoring
  router.post('/ops/monitoring', async (req, res) => {
    try {
      const { action } = req.body;

      if (action === 'start') {
        await opsAgent.startContinuousMonitoring();
        res.json({ success: true, message: 'Monitoring started' });
      } else if (action === 'stop') {
        await opsAgent.stopContinuousMonitoring();
        res.json({ success: true, message: 'Monitoring stopped' });
      } else {
        res.status(400).json({ error: 'Action must be "start" or "stop"' });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  });

  // Run monitoring
  router.post('/ops/monitoring/run', async (req, res) => {
    try {
      const result = await opsAgent.performMonitoring({});
      res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  });

  // Analyze logs
  router.post('/ops/logs/analyze', async (req, res) => {
    try {
      const { service, level, hours = 24 } = req.body;

      const end = new Date();
      const start = new Date(end.getTime() - hours * 60 * 60 * 1000);

      const result = await opsAgent.analyzeLogs({
        taskId: 'log-analysis',
        service,
        level,
        timeRange: { start, end }
      });

      res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  });

  // ==========================================
  // Evolution Routes
  // ==========================================

  // Propose feature
  router.post('/evolution/propose', async (req, res) => {
    try {
      const { name, description, purpose, targetModule, estimatedImpact, createdBy } = req.body;

      if (!name || !description || !purpose) {
        return res.status(400).json({ error: 'Missing required fields: name, description, purpose' });
      }

      const result = await evolutionAgent.proposeFeature({
        taskId: 'feature-proposal',
        name,
        description,
        purpose,
        targetModule: targetModule || 'core',
        estimatedImpact: estimatedImpact || 'medium'
      });

      res.status(201).json({
        success: true,
        capability: {
          id: result.capability.id,
          name: result.capability.name,
          status: result.capability.status,
          simulationPassed: result.simulation.passed
        },
        requiresApproval: result.requiresApproval
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  });

  // Submit for security review
  router.post('/evolution/capabilities/:id/security-review', async (req, res) => {
    try {
      const result = await evolutionAgent.submitForSecurityReview(req.params.id);
      res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  });

  // Activate capability
  router.post('/evolution/capabilities/:id/activate', async (req, res) => {
    try {
      const { approvedBy } = req.body;

      if (!approvedBy) {
        return res.status(400).json({ error: 'Missing required field: approvedBy' });
      }

      const result = await evolutionAgent.activateCapability(req.params.id, approvedBy);
      res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  });

  // Deprecate capability
  router.post('/evolution/capabilities/:id/deprecate', async (req, res) => {
    try {
      const { reason } = req.body;

      await evolutionAgent.deprecateCapability(req.params.id, reason || 'Deprecated by user');
      
      res.json({ success: true, message: 'Capability deprecated' });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  });

  // List capabilities
  router.get('/evolution/capabilities', async (req, res) => {
    try {
      const { status } = req.query;
      
      const capabilities = await evolutionAgent.getCapabilities(
        status as CapabilityStatus | undefined
      );

      res.json({ capabilities });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  });

  // Analyze system for improvements
  router.get('/evolution/analysis', async (req, res) => {
    try {
      const result = await evolutionAgent.analyzeSystemForImprovements({});
      res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  });

  // ==========================================
  // Communication Routes
  // ==========================================

  // Send notification
  router.post('/notifications', async (req, res) => {
    try {
      const { type, channel, recipientId, title, message, data } = req.body;

      if (!type || !channel || !recipientId || !title || !message) {
        return res.status(400).json({
          error: 'Missing required fields: type, channel, recipientId, title, message'
        });
      }

      const result = await communicationAgent.sendNotification({
        taskId: 'notification',
        type: type as NotificationType,
        channel: channel as NotificationChannel,
        recipientId,
        title,
        message,
        data
      });

      res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  });

  // Get dashboard messages
  router.get('/notifications/dashboard', async (req, res) => {
    try {
      const { unreadOnly, limit = '50' } = req.query;
      
      const messages = communicationAgent.getDashboardMessages(
        unreadOnly === 'true',
        parseInt(limit as string, 10)
      );

      res.json({ messages });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  });

  // Mark message as read
  router.post('/notifications/dashboard/:id/read', async (req, res) => {
    try {
      await communicationAgent.markMessageRead(req.params.id);
      res.json({ success: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  });

  // Get unread count
  router.get('/notifications/dashboard/unread-count', async (req, res) => {
    try {
      const count = await communicationAgent.getUnreadCount();
      res.json({ count });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  });

  // ==========================================
  // Queue Routes
  // ==========================================

  // Get queue status
  router.get('/queues/:name/status', async (req, res) => {
    try {
      const status = await queueManager.getQueueStatus(req.params.name);
      res.json(status);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  });

  // List all queues
  router.get('/queues', async (req, res) => {
    try {
      const queueNames = queueManager.getQueueNames();
      const statuses = await Promise.all(
        queueNames.map(async (name) => {
          try {
            return { name, status: await queueManager.getQueueStatus(name) };
          } catch {
            return { name, status: null, error: 'Failed to get status' };
          }
        })
      );

      res.json({ queues: statuses });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  });

  // Pause/resume queue
  router.post('/queues/:name/control', async (req, res) => {
    try {
      const { action } = req.body;

      if (action === 'pause') {
        await queueManager.pauseQueue(req.params.name);
        res.json({ success: true, message: 'Queue paused' });
      } else if (action === 'resume') {
        await queueManager.resumeQueue(req.params.name);
        res.json({ success: true, message: 'Queue resumed' });
      } else {
        res.status(400).json({ error: 'Action must be "pause" or "resume"' });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  });

  // ==========================================
  // System Routes
  // ==========================================

  // Get system stats
  router.get('/system/stats', async (req, res) => {
    try {
      const stats = await orchestrator.getSystemStats();
      res.json(stats);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  });

  // Get event bus stats
  router.get('/system/events', async (req, res) => {
    try {
      const stats = eventBus.getStats();
      res.json(stats);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  });

  // Health check
  router.get('/health', async (req, res) => {
    try {
      const dbHealth = await prisma.$queryRaw`SELECT 1`;
      
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
          database: dbHealth ? 'connected' : 'error',
          eventBus: eventBus.getStats().connected ? 'connected' : 'disconnected'
        }
      });
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  return router;
}

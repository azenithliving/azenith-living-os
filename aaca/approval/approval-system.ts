import { prisma } from '../database/prisma-client';
import { EventBus } from '../events/event-bus';
import { Logger } from '../utils/logger';
import { 
  Approval, 
  ApprovalStatus, 
  AIAction, 
  ActionStatus,
  ActionType,
  NotificationType,
  NotificationChannel,
  RiskLevel
} from '../types';

interface ApprovalRequest {
  actionId: string;
  requestedBy: string;
  reason: string;
  expiresAt?: Date;
  priority?: 'normal' | 'high' | 'urgent';
}

interface ApprovalDecision {
  approvalId: string;
  decision: 'approve' | 'reject';
  decidedBy: string;
  reason?: string;
}

interface ApprovalPolicy {
  autoApprove: boolean;
  autoApproveThreshold: number;
  requireApprovalFor: ActionType[];
  expiryHours: number;
}

const DEFAULT_POLICY: ApprovalPolicy = {
  autoApprove: false,
  autoApproveThreshold: 10,
  requireApprovalFor: [
    ActionType.DELETE_RESOURCE,
    ActionType.MODIFY_CONFIG,
    ActionType.MERGE_CODE,
    ActionType.EXECUTE_COMMAND,
    ActionType.DEPLOY
  ],
  expiryHours: 24
};

export class ApprovalSystem {
  private eventBus: EventBus;
  private logger: Logger;
  private policy: ApprovalPolicy;

  constructor(eventBus: EventBus, policy: ApprovalPolicy = DEFAULT_POLICY) {
    this.eventBus = eventBus;
    this.logger = new Logger('ApprovalSystem');
    this.policy = policy;
  }

  async createApprovalRequest(request: ApprovalRequest): Promise<Approval> {
    const { actionId, requestedBy, reason, expiresAt, priority = 'normal' } = request;

    // Check if action exists and needs approval
    const action = await prisma.aIAction.findUnique({
      where: { id: actionId },
      include: { task: true }
    });

    if (!action) {
      throw new Error(`Action ${actionId} not found`);
    }

    // Check if approval already exists
    const existingApproval = await prisma.approval.findUnique({
      where: { actionId }
    });

    if (existingApproval) {
      throw new Error(`Approval request already exists for action ${actionId}`);
    }

    // Calculate expiry time based on priority
    const expiryHours = priority === 'urgent' ? 2 : priority === 'high' ? 8 : this.policy.expiryHours;
    const expiryDate = expiresAt || new Date(Date.now() + expiryHours * 60 * 60 * 1000);

    // Create approval request
    const approval = await prisma.approval.create({
      data: {
        actionId,
        status: ApprovalStatus.PENDING,
        requestedBy,
        expiresAt: expiryDate
      }
    });

    // Update action status
    await prisma.aIAction.update({
      where: { id: actionId },
      data: { status: ActionStatus.AWAITING_APPROVAL }
    });

    // Publish approval required event
    await this.eventBus.publish({
      type: 'approval:required',
      source: 'approval-system',
      payload: {
        approvalId: approval.id,
        actionId,
        actionType: action.type,
        requestedBy,
        reason,
        priority,
        expiresAt: expiryDate.toISOString(),
        taskId: action.taskId
      }
    });

    this.logger.info('Approval request created', {
      approvalId: approval.id,
      actionId,
      requestedBy,
      priority
    });

    return approval as Approval;
  }

  async processDecision(decision: ApprovalDecision): Promise<Approval> {
    const { approvalId, decidedBy, reason } = decision;

    const approval = await prisma.approval.findUnique({
      where: { id: approvalId },
      include: { action: true }
    });

    if (!approval) {
      throw new Error(`Approval ${approvalId} not found`);
    }

    if (approval.status !== ApprovalStatus.PENDING) {
      throw new Error(`Approval ${approvalId} is not pending (status: ${approval.status})`);
    }

    if (new Date() > approval.expiresAt) {
      // Mark as expired
      await prisma.approval.update({
        where: { id: approvalId },
        data: { status: ApprovalStatus.EXPIRED }
      });

      await prisma.aIAction.update({
        where: { id: approval.actionId },
        data: { status: ActionStatus.REJECTED }
      });

      throw new Error(`Approval ${approvalId} has expired`);
    }

    if (decision.decision === 'approve') {
      // Update approval as approved
      const updatedApproval = await prisma.approval.update({
        where: { id: approvalId },
        data: {
          status: ApprovalStatus.APPROVED,
          approvedById: decidedBy,
          approvedAt: new Date()
        }
      });

      // Update action status
      await prisma.aIAction.update({
        where: { id: approval.actionId },
        data: { 
          status: ActionStatus.APPROVED,
          requiresApproval: false 
        }
      });

      // Publish approval granted event
      await this.eventBus.publish({
        type: 'approval:granted',
        source: 'approval-system',
        payload: {
          approvalId: updatedApproval.id,
          actionId: approval.actionId,
          approvedBy: decidedBy,
          approvedAt: new Date().toISOString()
        }
      });

      this.logger.info('Approval granted', {
        approvalId,
        actionId: approval.actionId,
        approvedBy: decidedBy
      });

      return updatedApproval as Approval;
    } else {
      // Reject the approval
      const updatedApproval = await prisma.approval.update({
        where: { id: approvalId },
        data: {
          status: ApprovalStatus.REJECTED,
          rejectedById: decidedBy,
          rejectedAt: new Date(),
          rejectionReason: reason
        }
      });

      // Update action status
      await prisma.aIAction.update({
        where: { id: approval.actionId },
        data: { status: ActionStatus.REJECTED }
      });

      // Update task status
      await prisma.aITask.update({
        where: { id: approval.action.taskId },
        data: { status: 'FAILED' as any }
      });

      // Publish approval rejected event
      await this.eventBus.publish({
        type: 'approval:rejected',
        source: 'approval-system',
        payload: {
          approvalId: updatedApproval.id,
          actionId: approval.actionId,
          rejectedBy: decidedBy,
          reason,
          rejectedAt: new Date().toISOString()
        }
      });

      this.logger.info('Approval rejected', {
        approvalId,
        actionId: approval.actionId,
        rejectedBy: decidedBy,
        reason
      });

      return updatedApproval as Approval;
    }
  }

  async checkRequiresApproval(action: AIAction): Promise<boolean> {
    // Check if action type requires approval
    if (this.policy.requireApprovalFor.includes(action.type)) {
      return true;
    }

    // Check risk score
    if (action.riskScore && action.riskScore > this.policy.autoApproveThreshold) {
      return true;
    }

    return false;
  }

  async getPendingApprovals(): Promise<Approval[]> {
    const approvals = await prisma.approval.findMany({
      where: { 
        status: ApprovalStatus.PENDING,
        expiresAt: { gt: new Date() }
      },
      include: {
        action: {
          include: {
            task: true
          }
        }
      },
      orderBy: { requestedAt: 'asc' }
    });

    return approvals as Approval[];
  }

  async getApprovalById(approvalId: string): Promise<Approval | null> {
    const approval = await prisma.approval.findUnique({
      where: { id: approvalId },
      include: {
        action: {
          include: {
            task: true
          }
        },
        approvedBy: true,
        rejectedBy: true
      }
    });

    return approval as Approval | null;
  }

  async getApprovalForAction(actionId: string): Promise<Approval | null> {
    const approval = await prisma.approval.findUnique({
      where: { actionId },
      include: {
        action: true
      }
    });

    return approval as Approval | null;
  }

  async expireOldApprovals(): Promise<number> {
    const expiredApprovals = await prisma.approval.updateMany({
      where: {
        status: ApprovalStatus.PENDING,
        expiresAt: { lte: new Date() }
      },
      data: { status: ApprovalStatus.EXPIRED }
    });

    if (expiredApprovals.count > 0) {
      this.logger.warn('Expired old approvals', { count: expiredApprovals.count });

      // Update related actions
      const expired = await prisma.approval.findMany({
        where: {
          status: ApprovalStatus.EXPIRED,
          expiresAt: { lte: new Date() }
        }
      });

      for (const approval of expired) {
        await prisma.aIAction.update({
          where: { id: approval.actionId },
          data: { status: ActionStatus.REJECTED }
        });

        await this.eventBus.publish({
          type: 'approval:expired',
          source: 'approval-system',
          payload: {
            approvalId: approval.id,
            actionId: approval.actionId,
            expiredAt: new Date().toISOString()
          }
        });
      }
    }

    return expiredApprovals.count;
  }

  async cancelApproval(approvalId: string, cancelledBy: string): Promise<Approval> {
    const approval = await prisma.approval.findUnique({
      where: { id: approvalId }
    });

    if (!approval) {
      throw new Error(`Approval ${approvalId} not found`);
    }

    if (approval.status !== ApprovalStatus.PENDING) {
      throw new Error(`Cannot cancel approval with status ${approval.status}`);
    }

    // Mark as rejected (cancellation is treated as rejection)
    const updatedApproval = await prisma.approval.update({
      where: { id: approvalId },
      data: {
        status: ApprovalStatus.REJECTED,
        rejectedById: cancelledBy,
        rejectedAt: new Date(),
        rejectionReason: 'Cancelled by user'
      }
    });

    await prisma.aIAction.update({
      where: { id: approval.actionId },
      data: { status: ActionStatus.REJECTED }
    });

    this.logger.info('Approval cancelled', {
      approvalId,
      actionId: approval.actionId,
      cancelledBy
    });

    return updatedApproval as Approval;
  }

  async getApprovalStats(): Promise<{
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    expired: number;
    avgDecisionTimeMinutes: number;
  }> {
    const [
      total,
      pending,
      approved,
      rejected,
      expired,
      decisionTimes
    ] = await Promise.all([
      prisma.approval.count(),
      prisma.approval.count({ where: { status: ApprovalStatus.PENDING } }),
      prisma.approval.count({ where: { status: ApprovalStatus.APPROVED } }),
      prisma.approval.count({ where: { status: ApprovalStatus.REJECTED } }),
      prisma.approval.count({ where: { status: ApprovalStatus.EXPIRED } }),
      prisma.approval.findMany({
        where: {
          status: { in: [ApprovalStatus.APPROVED, ApprovalStatus.REJECTED] },
          approvedAt: { not: null }
        },
        select: {
          requestedAt: true,
          approvedAt: true,
          rejectedAt: true
        }
      })
    ]);

    // Calculate average decision time
    const decisionTimeMinutes = decisionTimes.map(a => {
      const decisionTime = a.approvedAt || a.rejectedAt;
      if (!decisionTime) return 0;
      return (decisionTime.getTime() - a.requestedAt.getTime()) / (1000 * 60);
    }).filter(t => t > 0);

    const avgDecisionTimeMinutes = decisionTimeMinutes.length > 0
      ? decisionTimeMinutes.reduce((a, b) => a + b, 0) / decisionTimeMinutes.length
      : 0;

    return {
      total,
      pending,
      approved,
      rejected,
      expired,
      avgDecisionTimeMinutes: Math.round(avgDecisionTimeMinutes * 100) / 100
    };
  }

  updatePolicy(policy: Partial<ApprovalPolicy>): void {
    this.policy = { ...this.policy, ...policy };
    this.logger.info('Approval policy updated', this.policy);
  }

  getPolicy(): ApprovalPolicy {
    return { ...this.policy };
  }
}

// Singleton instance
let approvalSystemInstance: ApprovalSystem | null = null;

export function getApprovalSystem(eventBus: EventBus, policy?: ApprovalPolicy): ApprovalSystem {
  if (!approvalSystemInstance) {
    approvalSystemInstance = new ApprovalSystem(eventBus, policy);
  }
  return approvalSystemInstance;
}

export function resetApprovalSystem(): void {
  approvalSystemInstance = null;
}

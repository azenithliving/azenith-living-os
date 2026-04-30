/**
 * AACA Event Types - Typed Event Payloads
 * Phase 2: Communication Layer
 */

export enum EventType {
  // Task Events
  TASK_CREATED = 'task:created',
  TASK_QUEUED = 'task:queued',
  TASK_STARTED = 'task:started',
  TASK_COMPLETED = 'task:completed',
  TASK_FAILED = 'task:failed',
  TASK_CANCELLED = 'task:cancelled',
  TASK_RETRYING = 'task:retrying',

  // Action Events
  ACTION_CREATED = 'action:created',
  ACTION_APPROVAL_REQUIRED = 'action:approval_required',
  ACTION_APPROVED = 'action:approved',
  ACTION_REJECTED = 'action:rejected',
  ACTION_EXECUTING = 'action:executing',
  ACTION_EXECUTED = 'action:executed',
  ACTION_FAILED = 'action:failed',
  ACTION_ROLLED_BACK = 'action:rolled_back',

  // Approval Events
  APPROVAL_REQUESTED = 'approval:requested',
  APPROVAL_GRANTED = 'approval:granted',
  APPROVAL_DENIED = 'approval:denied',
  APPROVAL_EXPIRED = 'approval:expired',

  // Queue Events
  JOB_STARTED = 'queue:job_started',
  JOB_COMPLETED = 'queue:job_completed',
  JOB_FAILED = 'queue:job_failed',
  JOB_STALLED = 'queue:job_stalled',

  // Worker Events
  WORKER_STARTED = 'worker:started',
  WORKER_STOPPED = 'worker:stopped',
  WORKER_ERROR = 'worker:error',

  // System Events
  SYSTEM_HEALTHY = 'system:healthy',
  SYSTEM_DEGRADED = 'system:degraded',
  SYSTEM_ERROR = 'system:error',

  // Agent Events
  AGENT_REGISTERED = 'agent:registered',
  AGENT_BUSY = 'agent:busy',
  AGENT_IDLE = 'agent:idle',
  AGENT_ERROR = 'agent:error'
}

export interface BaseEventPayload {
  timestamp: string;
  traceId?: string;
  source: string;
}

// Task Event Payloads
export interface TaskCreatedPayload extends BaseEventPayload {
  taskId: string;
  title: string;
  type: string;
  priority: string;
  createdById: string;
}

export interface TaskStartedPayload extends BaseEventPayload {
  taskId: string;
  startedAt: string;
  assignedTo?: string;
}

export interface TaskCompletedPayload extends BaseEventPayload {
  taskId: string;
  result?: Record<string, unknown>;
  durationMs: number;
  completedAt: string;
}

export interface TaskFailedPayload extends BaseEventPayload {
  taskId: string;
  error: string;
  attempt: number;
  maxAttempts: number;
  willRetry: boolean;
}

// Action Event Payloads
export interface ActionCreatedPayload extends BaseEventPayload {
  actionId: string;
  taskId: string;
  type: string;
  requiresApproval: boolean;
  riskScore?: number;
}

export interface ActionApprovedPayload extends BaseEventPayload {
  actionId: string;
  approvedById: string;
  approvedAt: string;
}

export interface ActionRejectedPayload extends BaseEventPayload {
  actionId: string;
  rejectedById: string;
  rejectedAt: string;
  reason?: string;
}

export interface ActionExecutedPayload extends BaseEventPayload {
  actionId: string;
  success: boolean;
  output?: Record<string, unknown>;
  error?: string;
  durationMs: number;
}

// Approval Event Payloads
export interface ApprovalRequestedPayload extends BaseEventPayload {
  approvalId: string;
  actionId: string;
  requestedBy: string;
  expiresAt: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface ApprovalGrantedPayload extends BaseEventPayload {
  approvalId: string;
  actionId: string;
  approvedById: string;
}

// Job Event Payloads
export interface JobStartedPayload extends BaseEventPayload {
  jobId: string;
  queueName: string;
  jobName: string;
  attempt: number;
  data: Record<string, unknown>;
}

export interface JobCompletedPayload extends BaseEventPayload {
  jobId: string;
  queueName: string;
  jobName: string;
  result?: Record<string, unknown>;
  durationMs: number;
}

export interface JobFailedPayload extends BaseEventPayload {
  jobId: string;
  queueName: string;
  jobName: string;
  error: string;
  attempt: number;
  durationMs: number;
}

// Agent Event Payloads
export interface AgentRegisteredPayload extends BaseEventPayload {
  agentId: string;
  agentType: string;
  capabilities: string[];
  maxConcurrency: number;
}

export interface AgentStatusPayload extends BaseEventPayload {
  agentId: string;
  status: 'idle' | 'busy' | 'error';
  currentJobs: number;
  maxConcurrency: number;
}

// Union type for all event payloads
export type EventPayload =
  | TaskCreatedPayload
  | TaskStartedPayload
  | TaskCompletedPayload
  | TaskFailedPayload
  | ActionCreatedPayload
  | ActionApprovedPayload
  | ActionRejectedPayload
  | ActionExecutedPayload
  | ApprovalRequestedPayload
  | ApprovalGrantedPayload
  | JobStartedPayload
  | JobCompletedPayload
  | JobFailedPayload
  | AgentRegisteredPayload
  | AgentStatusPayload
  | BaseEventPayload;

// Event handler type
export type EventHandler<T extends EventPayload = EventPayload> = (
  payload: T,
  eventType: EventType
) => Promise<void> | void;

// ==========================================
// AACA Type Definitions
// ==========================================

export interface User {
  id: string;
  email: string;
  name?: string;
  role: UserRole;
  permissions: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN',
  OPERATOR = 'OPERATOR',
  SECURITY_OFFICER = 'SECURITY_OFFICER',
  SYSTEM = 'SYSTEM'
}

// Task Types
export interface AITask {
  id: string;
  title: string;
  description?: string;
  type: TaskType;
  status: TaskStatus;
  priority: TaskPriority;
  payload?: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: string;
  createdById: string;
  assignedTo?: string;
  parentTaskId?: string;
  workflowId?: string;
  startedAt?: Date;
  completedAt?: Date;
  failedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  retries: number;
  maxRetries: number;
}

export enum TaskType {
  CODE_GENERATION = 'CODE_GENERATION',
  CODE_REVIEW = 'CODE_REVIEW',
  DEPLOYMENT = 'DEPLOYMENT',
  ANALYSIS = 'ANALYSIS',
  MONITORING = 'MONITORING',
  SECURITY_SCAN = 'SECURITY_SCAN',
  TESTING = 'TESTING',
  NOTIFICATION = 'NOTIFICATION',
  EVOLUTION = 'EVOLUTION',
  CUSTOM = 'CUSTOM'
}

export enum TaskStatus {
  PENDING = 'PENDING',
  QUEUED = 'QUEUED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  RETRYING = 'RETRYING'
}

export enum TaskPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

// Action Types
export interface AIAction {
  id: string;
  type: ActionType;
  status: ActionStatus;
  taskId: string;
  payload: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: string;
  riskScore?: number;
  requiresApproval: boolean;
  executedById?: string;
  rollbackData?: Record<string, unknown>;
  canRollback: boolean;
  createdAt: Date;
  executedAt?: Date;
  completedAt?: Date;
}

export enum ActionType {
  WRITE_CODE = 'WRITE_CODE',
  EXECUTE_COMMAND = 'EXECUTE_COMMAND',
  DEPLOY = 'DEPLOY',
  DELETE_RESOURCE = 'DELETE_RESOURCE',
  MODIFY_CONFIG = 'MODIFY_CONFIG',
  SEND_NOTIFICATION = 'SEND_NOTIFICATION',
  CREATE_PR = 'CREATE_PR',
  MERGE_CODE = 'MERGE_CODE',
  ROLLBACK = 'ROLLBACK',
  CUSTOM = 'CUSTOM'
}

export enum ActionStatus {
  PENDING = 'PENDING',
  AWAITING_APPROVAL = 'AWAITING_APPROVAL',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  EXECUTING = 'EXECUTING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  ROLLED_BACK = 'ROLLED_BACK'
}

// Approval Types
export interface Approval {
  id: string;
  actionId: string;
  status: ApprovalStatus;
  requestedBy: string;
  requestedAt: Date;
  approvedById?: string;
  approvedAt?: Date;
  rejectedById?: string;
  rejectedAt?: Date;
  rejectionReason?: string;
  expiresAt: Date;
}

export enum ApprovalStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED'
}

// Event Types
export interface Event {
  id: string;
  type: string;
  source: string;
  payload?: Record<string, unknown>;
  taskId?: string;
  processed: boolean;
  processedAt?: Date;
  error?: string;
  createdAt: Date;
}

export interface EventHandler {
  eventType: string;
  handler: (event: Event) => Promise<void>;
}

// Notification Types
export interface Notification {
  id: string;
  type: NotificationType;
  channel: NotificationChannel;
  status: NotificationStatus;
  recipientId: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  sentAt?: Date;
  error?: string;
  createdAt: Date;
}

export enum NotificationType {
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  SUCCESS = 'SUCCESS',
  APPROVAL_REQUIRED = 'APPROVAL_REQUIRED',
  SECURITY_ALERT = 'SECURITY_ALERT'
}

export enum NotificationChannel {
  DASHBOARD = 'DASHBOARD',
  EMAIL = 'EMAIL',
  TELEGRAM = 'TELEGRAM',
  SLACK = 'SLACK',
  WEBHOOK = 'WEBHOOK'
}

export enum NotificationStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  FAILED = 'FAILED',
  DELIVERED = 'DELIVERED'
}

// Workflow Types
export interface Workflow {
  id: string;
  name: string;
  description?: string;
  definition: WorkflowDefinition;
  status: WorkflowStatus;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkflowDefinition {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export interface WorkflowNode {
  id: string;
  type: string;
  agent: string;
  config?: Record<string, unknown>;
}

export interface WorkflowEdge {
  from: string;
  to: string;
  condition?: string;
}

export enum WorkflowStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  ARCHIVED = 'ARCHIVED'
}

// Capability Types (Self-Extension)
export interface Capability {
  id: string;
  name: string;
  description: string;
  version: string;
  status: CapabilityStatus;
  proposedBy: string;
  proposedAt: Date;
  simulationResult?: Record<string, unknown>;
  securityReview?: Record<string, unknown>;
  approvedById?: string;
  approvedAt?: Date;
  activatedAt?: Date;
  deactivatedAt?: Date;
  code?: string;
  manifest: CapabilityManifest;
  dependencies: string[];
}

export interface CapabilityManifest {
  entryPoint: string;
  exports: string[];
  configSchema?: Record<string, unknown>;
  requiredPermissions: string[];
}

export enum CapabilityStatus {
  DRAFT = 'DRAFT',
  IN_SIMULATION = 'IN_SIMULATION',
  SECURITY_REVIEW = 'SECURITY_REVIEW',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  APPROVED = 'APPROVED',
  ACTIVE = 'ACTIVE',
  DEPRECATED = 'DEPRECATED',
  REJECTED = 'REJECTED'
}

// System Log Types
export interface SystemLog {
  id: string;
  level: LogLevel;
  service: string;
  message: string;
  metadata?: Record<string, unknown>;
  traceId?: string;
  createdAt: Date;
}

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  FATAL = 'FATAL'
}

// Agent Types
export interface AgentConfig {
  name: string;
  type: AgentType;
  capabilities: string[];
  maxConcurrency: number;
  timeoutMs: number;
  retryPolicy: RetryPolicy;
}

export enum AgentType {
  ORCHESTRATOR = 'ORCHESTRATOR',
  DEV = 'DEV',
  OPS = 'OPS',
  SECURITY = 'SECURITY',
  QA = 'QA',
  COMMUNICATION = 'COMMUNICATION',
  EVOLUTION = 'EVOLUTION'
}

export interface RetryPolicy {
  maxRetries: number;
  backoffType: 'fixed' | 'exponential';
  delayMs: number;
}

// Queue Types
export interface QueueJob {
  id: string;
  name: string;
  data: Record<string, unknown>;
  opts?: Record<string, unknown>;
  progress: number;
  attemptsMade: number;
  failedReason?: string;
  stacktrace?: string[];
  timestamp: number;
  processedOn?: number;
  finishedOn?: number;
}

// Risk Assessment
export interface RiskAssessment {
  score: number;
  level: RiskLevel;
  factors: RiskFactor[];
  recommendation: string;
}

export interface RiskFactor {
  type: string;
  severity: number;
  description: string;
}

export enum RiskLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

// Execution Types
export interface ExecutionContext {
  actionId: string;
  taskId: string;
  userId: string;
  traceId: string;
  startTime: Date;
  timeoutMs: number;
}

export interface ExecutionResult {
  success: boolean;
  output?: Record<string, unknown>;
  error?: string;
  logs: ExecutionLogEntry[];
  durationMs: number;
}

export interface ExecutionLogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  metadata?: Record<string, unknown>;
}

// Repository Types (Dev Agent)
export interface CodeChange {
  path: string;
  content: string;
  operation: 'create' | 'update' | 'delete';
  encoding?: 'utf8' | 'base64';
}

export interface PatchResult {
  success: boolean;
  changes: CodeChange[];
  filesAffected: string[];
  error?: string;
}

// Monitoring Types (Ops Agent)
export interface HealthCheck {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  latencyMs: number;
  timestamp: Date;
  details?: Record<string, unknown>;
}

export interface SystemMetrics {
  cpu: number;
  memory: number;
  disk: number;
  network: NetworkMetrics;
  timestamp: Date;
}

export interface NetworkMetrics {
  bytesIn: number;
  bytesOut: number;
  connections: number;
}

// Security Types
export interface SecurityScan {
  id: string;
  target: string;
  scanType: SecurityScanType;
  findings: SecurityFinding[];
  scannedAt: Date;
  durationMs: number;
}

export enum SecurityScanType {
  CODE = 'CODE',
  DEPENDENCIES = 'DEPENDENCIES',
  SECRETS = 'SECRETS',
  CONFIGURATION = 'CONFIGURATION'
}

export interface SecurityFinding {
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  ruleId: string;
  message: string;
  file?: string;
  line?: number;
  column?: number;
}

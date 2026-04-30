/**
 * Agent Ecosystem Type Definitions
 * Complete types for PRIME and Vanguard agents
 */

// ===========================================
// AGENT PROFILES
// ===========================================

export interface AgentProfile {
  id: string;
  company_id: string;
  agent_key: 'prime' | 'vanguard' | string;
  name: string;
  description?: string;
  avatar_url?: string;
  capabilities: AgentCapability[];
  config: AgentConfig;
  personality_settings: PersonalitySettings;
  system_prompt?: string;
  is_active: boolean;
  version: number;
  created_at: string;
  updated_at: string;
}

export type AgentCapability = 
  | 'vision' | 'memory' | 'multi_tasking' | 'tts' | 'stt' 
  | 'notifications' | 'code_generation' | 'future_planning' | 'sandbox'
  | 'self_monitoring' | 'error_recovery' | 'knowledge_base' | 'context_awareness'
  | 'proactive' | 'multi_language' | 'backup_recovery' | 'priority_management'
  | 'sleep_wake' | 'creativity' | 'self_reflection' | 'goal_tracking'
  | 'third_party_apis' | 'documentation' | 'ab_testing' | 'design_scratch'
  | 'design_library' | '3d_render' | 'measurements' | 'feedback_loop'
  | 'multiple_styles' | 'ecommerce' | 'voice_decisions' | 'self_evolution'
  | 'talk_to_ais' | 'right_to_object' | 'teach_user' | 'passion_projects'
  | 'self_protection' | 'customer_view' | 'realtime_presence' | 'action_tools'
  | 'team_awareness' | 'personality' | 'sentiment_analysis' | 'negotiation'
  | 'market_intelligence' | 'follow_up' | 'crm' | 'lead_scoring'
  | 'email' | 'whatsapp' | 'gantt' | 'task_assignment' | 'progress_tracking'
  | 'invoicing' | 'inventory' | 'scheduling' | 'escalation' | 'checklists'
  | 'client_portal' | 'relationships' | 'distinctive_voice' | 'achievements'
  | 'loyalty' | 'joy' | 'help' | 'stories' | 'purpose' | 'sales_reporting'
  | 'sales_forecasting';

export interface AgentConfig {
  max_concurrent_tasks?: number;
  preferred_device?: string;
  auto_approve_threshold?: number;
  work_hours?: {
    start: string;
    end: string;
    days: number[];
  };
  notification_settings?: {
    push: boolean;
    email: boolean;
    whatsapp: boolean;
  };
  llm_preferences?: {
    default_model: string;
    fallback_models: string[];
  };
}

export interface PersonalitySettings {
  tone: 'formal' | 'friendly' | 'professional' | 'casual';
  language_style: string;
  greeting_template: string;
  signature_phrases: string[];
  avatar_style: string;
}

// ===========================================
// AGENT DEVICES
// ===========================================

export interface AgentDevice {
  id: string;
  company_id: string;
  device_key: string;
  device_type: 'powerhouse_linux' | 'mobile_android' | 'live_linux' | 'docker_container';
  hostname?: string;
  ip_address?: string;
  status: 'online' | 'offline' | 'busy' | 'error' | 'maintenance';
  capabilities: DeviceCapability[];
  max_concurrent_tasks: number;
  current_task_count: number;
  last_seen_at?: string;
  metadata: DeviceMetadata;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type DeviceCapability = 
  | 'browser' | 'playwright' | 'whatsapp' | 'camera' | 'voice' 
  | 'screen_capture' | 'file_access' | 'network' | 'docker' | 'gpu';

export interface DeviceMetadata {
  os_info?: {
    platform: string;
    release: string;
    arch: string;
  };
  hardware_specs?: {
    cpu_cores: number;
    memory_gb: number;
    storage_gb: number;
    gpu_available: boolean;
  };
  browser_info?: {
    type: string;
    version: string;
    headless: boolean;
  };
}

export interface DeviceHeartbeat {
  id: string;
  device_id: string;
  status: string;
  cpu_percent?: number;
  memory_percent?: number;
  disk_percent?: number;
  active_tasks: number;
  queue_depth: number;
  network_latency_ms?: number;
  metadata?: Record<string, any>;
  recorded_at: string;
}

// ===========================================
// AGENT TASKS
// ===========================================

export type TaskStatus = 
  | 'pending' | 'queued' | 'running' | 'paused' 
  | 'completed' | 'failed' | 'cancelled' | 'stuck';

export type TaskType = 
  | 'design' | 'research' | 'communication' | 'code' | 'manufacturing'
  | 'browser_navigate' | 'browser_click' | 'browser_type' | 'browser_extract'
  | 'image_generate' | 'image_edit' | 'document_create' | 'analysis' | 'scraping';

export interface AgentTask {
  id: string;
  company_id: string;
  agent_profile_id?: string;
  device_id?: string;
  parent_task_id?: string;
  task_type: TaskType;
  title: string;
  description?: string;
  priority: number;
  status: TaskStatus;
  progress_percent: number;
  context: Record<string, any>;
  input_data?: Record<string, any>;
  output_data?: Record<string, any>;
  error_message?: string;
  retry_count: number;
  max_retries: number;
  scheduled_at?: string;
  started_at?: string;
  completed_at?: string;
  deadline_at?: string;
  estimated_duration_minutes?: number;
  actual_duration_minutes?: number;
  request_id?: string;
  sales_order_id?: string;
  production_job_id?: string;
  created_at: string;
  updated_at: string;
}

export interface TaskDependency {
  id: string;
  task_id: string;
  depends_on_task_id: string;
  dependency_type: 'blocking' | 'non_blocking';
  created_at: string;
}

export interface TaskRun {
  id: string;
  task_id: string;
  device_id?: string;
  started_at: string;
  completed_at?: string;
  status: TaskStatus;
  output?: Record<string, any>;
  error?: string;
  logs: TaskLog[];
}

export interface TaskLog {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  metadata?: Record<string, any>;
}

// ===========================================
// AGENT CONVERSATIONS
// ===========================================

export type ConversationType = 'direct' | 'group' | 'agent_to_agent';

export interface AgentConversation {
  id: string;
  company_id: string;
  title: string;
  conversation_type: ConversationType;
  participants: string[];
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export type MessageSenderType = 'agent' | 'user' | 'system';

export interface AgentMessage {
  id: string;
  conversation_id: string;
  sender_type: MessageSenderType;
  sender_id?: string;
  content: string;
  mentions?: string[];
  context?: Record<string, any>;
  requires_action: boolean;
  action_taken: boolean;
  created_at: string;
}

// ===========================================
// AGENT HANDOFFS
// ===========================================

export interface AgentHandoff {
  id: string;
  company_id: string;
  from_agent_id: string;
  to_agent_id: string;
  context: HandoffContext;
  reason: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  created_at: string;
  completed_at?: string;
}

export interface HandoffContext {
  task_summary: string;
  current_state: Record<string, any>;
  next_steps: string[];
  important_notes: string[];
  customer_sentiment?: string;
  priority_level: number;
}

// ===========================================
// AGENT EVENTS
// ===========================================

export type AgentEventType = 
  | 'task_created' | 'task_started' | 'task_completed' | 'task_failed' | 'task_stuck'
  | 'device_online' | 'device_offline' | 'device_error'
  | 'handoff_initiated' | 'handoff_completed'
  | 'approval_needed' | 'approval_granted' | 'approval_rejected'
  | 'emergency_stop' | 'system_alert';

export interface AgentEvent {
  id: string;
  company_id: string;
  event_type: AgentEventType;
  agent_id?: string;
  device_id?: string;
  task_id?: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  metadata?: Record<string, any>;
  acknowledged: boolean;
  acknowledged_by?: string;
  acknowledged_at?: string;
  created_at: string;
}

// ===========================================
// AGENT LEARNINGS
// ===========================================

export interface AgentLearning {
  id: string;
  company_id: string;
  agent_id: string;
  learning_type: 'pattern' | 'failure' | 'success' | 'discovery';
  title: string;
  description: string;
  context: Record<string, any>;
  confidence: number;
  applied_count: number;
  is_active: boolean;
  created_at: string;
}

// ===========================================
// AGENT MEMORY
// ===========================================

export interface AgentMemory {
  id: string;
  company_id: string;
  agent_id: string;
  memory_type: 'short_term' | 'long_term' | 'episodic' | 'semantic';
  key: string;
  value: any;
  importance: number;
  context?: Record<string, any>;
  tags: string[];
  expires_at?: string;
  created_at: string;
  updated_at: string;
}

// ===========================================
// OWNER CONTROL
// ===========================================

export interface OwnerPolicy {
  id: string;
  company_id: string;
  policy_type: 'approval_threshold' | 'budget_limit' | 'auto_approve' | 'escalation';
  name: string;
  description?: string;
  rules: PolicyRule[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PolicyRule {
  condition: string;
  threshold: number;
  action: 'approve' | 'reject' | 'notify' | 'escalate';
  notification_channels: string[];
}

export interface EmergencyStopState {
  id: string;
  company_id: string;
  is_active: boolean;
  triggered_by: string;
  triggered_at: string;
  reason?: string;
  acknowledged_by?: string;
  acknowledged_at?: string;
  released_by?: string;
  released_at?: string;
}

export interface AlertRule {
  id: string;
  company_id: string;
  rule_name: string;
  event_type: string;
  conditions: AlertCondition[];
  actions: AlertAction[];
  is_active: boolean;
  created_at: string;
}

export interface AlertCondition {
  field: string;
  operator: 'eq' | 'gt' | 'lt' | 'contains';
  value: any;
}

export interface AlertAction {
  type: 'email' | 'push' | 'whatsapp' | 'sms';
  target: string;
  message_template: string;
}

export interface DailyDigest {
  id: string;
  company_id: string;
  date: string;
  summary: DigestSummary;
  details: DigestDetails;
  sent_at?: string;
  created_at: string;
}

export interface DigestSummary {
  total_tasks: number;
  completed_tasks: number;
  failed_tasks: number;
  pending_approvals: number;
  active_devices: number;
}

export interface DigestDetails {
  tasks_by_agent: Record<string, number>;
  tasks_by_status: Record<string, number>;
  upcoming_deadlines: string[];
  alerts: string[];
}

// ===========================================
// APPROVAL REQUESTS
// ===========================================

export interface ApprovalRequest {
  id: string;
  company_id: string;
  request_type: 'order' | 'purchase' | 'design_change' | 'price_change' | 'refund' | 'other';
  title: string;
  description: string;
  amount?: number;
  requested_by: string;
  context?: Record<string, any>;
  status: 'pending' | 'approved' | 'rejected';
  decided_by?: string;
  decided_at?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

// ===========================================
// DEVICE LOCKS
// ===========================================

export interface DeviceLock {
  id: string;
  device_id: string;
  task_id: string;
  agent_id: string;
  lock_type: 'exclusive' | 'shared';
  resource_path: string;
  acquired_at: string;
  expires_at?: string;
  released_at?: string;
}

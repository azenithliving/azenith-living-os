-- Week 1: Agent Ecosystem Tables Migration
-- Creates all tables for PRIME and Vanguard agents

-- ===========================================
-- AGENT PROFILES
-- ===========================================

CREATE TABLE IF NOT EXISTS agent_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  agent_key VARCHAR(50) UNIQUE NOT NULL, -- 'prime', 'vanguard'
  name VARCHAR(255) NOT NULL,
  description TEXT,
  avatar_url TEXT,
  capabilities JSONB DEFAULT '[]', -- array of capability strings
  config JSONB DEFAULT '{}', -- agent-specific settings
  personality_settings JSONB DEFAULT '{}', -- voice, tone, style
  system_prompt TEXT,
  is_active BOOLEAN DEFAULT true,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===========================================
-- AGENT DEVICES
-- ===========================================

CREATE TABLE IF NOT EXISTS agent_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  device_key VARCHAR(255) UNIQUE NOT NULL, -- 'powerhouse-alpha', 'mobile-xiaomi-01'
  device_type VARCHAR(50) NOT NULL, -- 'powerhouse_linux', 'mobile_android', 'live_linux', 'docker_container'
  hostname VARCHAR(255),
  ip_address INET,
  status VARCHAR(50) DEFAULT 'offline', -- 'online', 'offline', 'busy', 'error', 'maintenance'
  capabilities JSONB DEFAULT '[]', -- ['browser', 'playwright', 'whatsapp', 'camera', 'voice']
  max_concurrent_tasks INTEGER DEFAULT 3,
  current_task_count INTEGER DEFAULT 0,
  last_seen_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}', -- os_info, hardware_specs, etc.
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Device Heartbeats (real-time status)
CREATE TABLE IF NOT EXISTS agent_device_heartbeats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES agent_devices(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL,
  cpu_percent DECIMAL(5,2),
  memory_percent DECIMAL(5,2),
  disk_percent DECIMAL(5,2),
  active_tasks INTEGER DEFAULT 0,
  queue_depth INTEGER DEFAULT 0,
  network_latency_ms INTEGER,
  metadata JSONB, -- additional metrics
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===========================================
-- AGENT TASKS
-- ===========================================

CREATE TABLE IF NOT EXISTS agent_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  agent_profile_id UUID REFERENCES agent_profiles(id) ON DELETE SET NULL,
  device_id UUID REFERENCES agent_devices(id) ON DELETE SET NULL,
  parent_task_id UUID REFERENCES agent_tasks(id) ON DELETE SET NULL, -- for subtasks
  
  -- Task definition
  task_type VARCHAR(100) NOT NULL, -- 'design', 'research', 'communication', 'code', 'manufacturing', 'browser_navigate', etc.
  title VARCHAR(255) NOT NULL,
  description TEXT,
  priority INTEGER DEFAULT 0, -- -10 to 10, higher = more urgent
  
  -- Status tracking
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'queued', 'running', 'paused', 'completed', 'failed', 'cancelled', 'stuck'
  progress_percent INTEGER DEFAULT 0,
  
  -- Context and data
  context JSONB DEFAULT '{}', -- task-specific data
  input_data JSONB,
  output_data JSONB,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  
  -- Scheduling
  scheduled_at TIMESTAMP WITH TIME ZONE,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  deadline_at TIMESTAMP WITH TIME ZONE,
  estimated_duration_minutes INTEGER,
  actual_duration_minutes INTEGER,
  
  -- Business context links (optional)
  request_id UUID REFERENCES requests(id) ON DELETE SET NULL,
  sales_order_id UUID REFERENCES sales_orders(id) ON DELETE SET NULL,
  production_job_id UUID REFERENCES production_jobs(id) ON DELETE SET NULL,
  approval_request_id UUID REFERENCES approval_requests(id) ON DELETE SET NULL,
  conversation_id UUID, -- will link to agent_conversations
  
  -- Owner escalation
  requires_owner_attention BOOLEAN DEFAULT false,
  owner_attention_reason TEXT,
  escalated_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Task Dependencies
CREATE TABLE IF NOT EXISTS agent_task_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES agent_tasks(id) ON DELETE CASCADE,
  depends_on_task_id UUID NOT NULL REFERENCES agent_tasks(id) ON DELETE CASCADE,
  dependency_type VARCHAR(50) DEFAULT 'finish_to_start', -- 'finish_to_start', 'start_to_start', 'finish_to_finish', 'start_to_finish'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(task_id, depends_on_task_id)
);

-- Task Runs (execution history)
CREATE TABLE IF NOT EXISTS agent_task_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES agent_tasks(id) ON DELETE CASCADE,
  device_id UUID REFERENCES agent_devices(id) ON DELETE SET NULL,
  attempt_number INTEGER DEFAULT 1,
  status VARCHAR(50) NOT NULL, -- 'running', 'completed', 'failed', 'timeout', 'cancelled'
  started_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  result JSONB,
  error_message TEXT,
  logs JSONB, -- array of log entries
  screenshot_url TEXT,
  artifacts JSONB, -- generated files, data, etc.
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===========================================
-- CONVERSATIONS & MESSAGES
-- ===========================================

CREATE TABLE IF NOT EXISTS agent_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title VARCHAR(255),
  conversation_type VARCHAR(50) NOT NULL, -- 'direct', 'group', 'agent_to_agent', 'agent_to_customer'
  participants UUID[] NOT NULL, -- array of agent_profile_ids or user_ids
  context_type VARCHAR(50), -- 'general', 'request', 'sales_order', 'production_job'
  context_id UUID, -- linked entity ID
  is_active BOOLEAN DEFAULT true,
  last_message_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES agent_conversations(id) ON DELETE CASCADE,
  sender_type VARCHAR(50) NOT NULL, -- 'agent', 'user', 'system', 'customer'
  sender_id UUID, -- agent_profile_id or user_id
  sender_name VARCHAR(255),
  content TEXT NOT NULL,
  content_type VARCHAR(50) DEFAULT 'text', -- 'text', 'image', 'file', 'code', 'command'
  mentions UUID[], -- array of mentioned IDs
  context JSONB, -- linked entities: {request_id, sales_order_id, etc.}
  
  -- Action tracking
  requires_action BOOLEAN DEFAULT false,
  action_type VARCHAR(50), -- 'approve', 'review', 'execute', 'respond'
  action_taken BOOLEAN DEFAULT false,
  action_result JSONB,
  
  -- AI metadata
  ai_generated BOOLEAN DEFAULT false,
  ai_model VARCHAR(50), -- which LLM generated this
  ai_tokens_used INTEGER,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Agent Handoffs (context transfer between agents)
CREATE TABLE IF NOT EXISTS agent_handoffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_agent_id UUID REFERENCES agent_profiles(id) ON DELETE SET NULL,
  to_agent_id UUID REFERENCES agent_profiles(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES agent_conversations(id) ON DELETE SET NULL,
  task_id UUID REFERENCES agent_tasks(id) ON DELETE SET NULL,
  
  -- Handoff details
  context_summary TEXT NOT NULL,
  handoff_reason VARCHAR(255), -- 'escalation', 'specialization', 'workload', 'completed'
  priority_level INTEGER DEFAULT 0,
  attached_data JSONB, -- files, links, etc.
  
  -- Status
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'acknowledged', 'rejected', 'completed'
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  acknowledged_by UUID REFERENCES users(id) ON DELETE SET NULL,
  completed_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===========================================
-- EVENTS & LEARNING
-- ===========================================

-- Agent Events (for real-time feed and notifications)
CREATE TABLE IF NOT EXISTS agent_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  agent_profile_id UUID REFERENCES agent_profiles(id) ON DELETE SET NULL,
  device_id UUID REFERENCES agent_devices(id) ON DELETE SET NULL,
  
  event_type VARCHAR(100) NOT NULL, -- 'stuck', 'completed', 'error', 'suggestion', 'insight', 'milestone', 'escalation'
  event_data JSONB,
  severity VARCHAR(20) DEFAULT 'info', -- 'info', 'warning', 'critical', 'success'
  
  -- Related entities
  task_id UUID REFERENCES agent_tasks(id) ON DELETE SET NULL,
  conversation_id UUID,
  
  -- Acknowledgment
  acknowledged_by UUID REFERENCES users(id) ON DELETE SET NULL,
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  
  -- Notification tracking
  notification_sent BOOLEAN DEFAULT false,
  notification_channels VARCHAR[], -- ['push', 'email', 'whatsapp']
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Agent Learnings (self-evolution knowledge base)
CREATE TABLE IF NOT EXISTS agent_learnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  agent_profile_id UUID REFERENCES agent_profiles(id) ON DELETE SET NULL,
  
  lesson_type VARCHAR(50) NOT NULL, -- 'success_pattern', 'failure_avoidance', 'new_tool', 'optimization', 'customer_preference'
  context TEXT, -- description of the situation
  pattern JSONB, -- structured pattern data
  
  -- Performance tracking
  success_rate DECIMAL(5,2), -- 0-100
  used_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  
  last_used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Automatic expiration
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMP WITH TIME ZONE
);

-- Agent Memory (long-term storage)
CREATE TABLE IF NOT EXISTS agent_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  agent_profile_id UUID REFERENCES agent_profiles(id) ON DELETE SET NULL,
  
  memory_type VARCHAR(50) NOT NULL, -- 'fact', 'preference', 'conversation', 'task_result', 'code_snippet'
  key VARCHAR(255) NOT NULL,
  value JSONB NOT NULL,
  
  -- Context for retrieval
  tags TEXT[],
  related_entities JSONB, -- { request_id, customer_id, etc. }
  
  -- Importance and expiration
  importance_score DECIMAL(3,2) DEFAULT 0.5, -- 0-1
  access_count INTEGER DEFAULT 0,
  last_accessed_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(company_id, agent_profile_id, key)
);

-- ===========================================
-- OWNER CONTROL
-- ===========================================

-- Owner Policies (approval thresholds, limits)
CREATE TABLE IF NOT EXISTS owner_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  
  policy_type VARCHAR(100) NOT NULL, -- 'approval_threshold', 'budget_limit', 'escalation_rule', 'working_hours', 'notification_preference'
  policy_key VARCHAR(255) NOT NULL, -- 'max_order_without_approval', 'max_monthly_spend', etc.
  policy_value JSONB NOT NULL, -- { threshold: 50000, currency: 'EGP', notify_channels: ['email'] }
  
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0,
  
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(company_id, policy_type, policy_key)
);

-- Emergency Stop State (kill switch)
CREATE TABLE IF NOT EXISTS emergency_stop_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  
  is_stopped BOOLEAN DEFAULT false,
  stopped_by UUID REFERENCES users(id) ON DELETE SET NULL,
  stopped_at TIMESTAMP WITH TIME ZONE,
  reason TEXT,
  scope VARCHAR(50) DEFAULT 'all', -- 'all', 'agents', 'manufacturing', 'sales'
  affected_agents UUID[], -- specific agents if scope is limited
  
  resumed_at TIMESTAMP WITH TIME ZONE,
  resumed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  resume_reason TEXT,
  
  UNIQUE(company_id)
);

-- Alert Rules (owner notifications)
CREATE TABLE IF NOT EXISTS alert_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  
  rule_name VARCHAR(255) NOT NULL,
  rule_description TEXT,
  
  -- Trigger conditions
  condition_type VARCHAR(100) NOT NULL, -- 'order_value', 'inventory_low', 'job_delayed', 'payment_overdue', 'agent_stuck', 'quality_fail'
  condition_value JSONB NOT NULL, -- { threshold: 100000, unit: 'EGP', duration_hours: 24 }
  
  -- Actions
  action_type VARCHAR(100) NOT NULL, -- 'notify', 'escalate', 'stop', 'email', 'whatsapp', 'push'
  action_config JSONB NOT NULL, -- { recipients: ['owner'], message_template: '...', require_acknowledgment: true }
  
  -- Schedule
  is_active BOOLEAN DEFAULT true,
  schedule_days INTEGER[], -- [0,1,2,3,4,5,6] for days of week
  schedule_start_time TIME,
  schedule_end_time TIME,
  
  -- Rate limiting
  cooldown_minutes INTEGER DEFAULT 60,
  last_triggered_at TIMESTAMP WITH TIME ZONE,
  trigger_count INTEGER DEFAULT 0,
  
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Daily Digests (morning reports)
CREATE TABLE IF NOT EXISTS daily_digests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  
  digest_date DATE NOT NULL,
  digest_type VARCHAR(50) DEFAULT 'morning', -- 'morning', 'evening', 'weekly', 'monthly'
  
  content JSONB NOT NULL, -- structured digest data
  summary_text TEXT, -- AI-generated summary
  
  -- Delivery tracking
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sent_at TIMESTAMP WITH TIME ZONE,
  opened_at TIMESTAMP WITH TIME ZONE,
  clicked_links TEXT[],
  
  -- Feedback
  owner_rating INTEGER, -- 1-5
  owner_feedback TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(company_id, digest_date, digest_type)
);

-- ===========================================
-- INDEXES
-- ===========================================

-- Agent profiles
CREATE INDEX IF NOT EXISTS idx_agent_profiles_company ON agent_profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_agent_profiles_key ON agent_profiles(agent_key);

-- Devices
CREATE INDEX IF NOT EXISTS idx_agent_devices_company ON agent_devices(company_id);
CREATE INDEX IF NOT EXISTS idx_agent_devices_status ON agent_devices(status);
CREATE INDEX IF NOT EXISTS idx_agent_devices_key ON agent_devices(device_key);

-- Heartbeats
CREATE INDEX IF NOT EXISTS idx_heartbeats_device ON agent_device_heartbeats(device_id);
CREATE INDEX IF NOT EXISTS idx_heartbeats_time ON agent_device_heartbeats(recorded_at);

-- Tasks
CREATE INDEX IF NOT EXISTS idx_agent_tasks_company ON agent_tasks(company_id);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_status ON agent_tasks(status);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_agent ON agent_tasks(agent_profile_id);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_device ON agent_tasks(device_id);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_scheduled ON agent_tasks(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_order ON agent_tasks(sales_order_id);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_production ON agent_tasks(production_job_id);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_attention ON agent_tasks(requires_owner_attention) WHERE requires_owner_attention = true;

-- Task runs
CREATE INDEX IF NOT EXISTS idx_task_runs_task ON agent_task_runs(task_id);
CREATE INDEX IF NOT EXISTS idx_task_runs_device ON agent_task_runs(device_id);

-- Conversations
CREATE INDEX IF NOT EXISTS idx_conversations_company ON agent_conversations(company_id);
CREATE INDEX IF NOT EXISTS idx_conversations_active ON agent_conversations(is_active);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON agent_conversations(last_message_at);

-- Messages
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON agent_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON agent_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON agent_messages(sender_id);

-- Handoffs
CREATE INDEX IF NOT EXISTS idx_handoffs_from ON agent_handoffs(from_agent_id);
CREATE INDEX IF NOT EXISTS idx_handoffs_to ON agent_handoffs(to_agent_id);
CREATE INDEX IF NOT EXISTS idx_handoffs_status ON agent_handoffs(status);

-- Events
CREATE INDEX IF NOT EXISTS idx_agent_events_company ON agent_events(company_id);
CREATE INDEX IF NOT EXISTS idx_agent_events_agent ON agent_events(agent_profile_id);
CREATE INDEX IF NOT EXISTS idx_agent_events_type ON agent_events(event_type);
CREATE INDEX IF NOT EXISTS idx_agent_events_severity ON agent_events(severity);
CREATE INDEX IF NOT EXISTS idx_agent_events_unacknowledged ON agent_events(acknowledged_at) WHERE acknowledged_at IS NULL;

-- Learnings
CREATE INDEX IF NOT EXISTS idx_learnings_company ON agent_learnings(company_id);
CREATE INDEX IF NOT EXISTS idx_learnings_agent ON agent_learnings(agent_profile_id);
CREATE INDEX IF NOT EXISTS idx_learnings_type ON agent_learnings(lesson_type);

-- Memory
CREATE INDEX IF NOT EXISTS idx_memory_company ON agent_memory(company_id);
CREATE INDEX IF NOT EXISTS idx_memory_agent ON agent_memory(agent_profile_id);
CREATE INDEX IF NOT EXISTS idx_memory_key ON agent_memory(key);
CREATE INDEX IF NOT EXISTS idx_memory_type ON agent_memory(memory_type);

-- Policies and alerts
CREATE INDEX IF NOT EXISTS idx_owner_policies_company ON owner_policies(company_id);
CREATE INDEX IF NOT EXISTS idx_alert_rules_company ON alert_rules(company_id);
CREATE INDEX IF NOT EXISTS idx_alert_rules_active ON alert_rules(is_active);

-- ===========================================
-- SEED DATA - Default Agent Profiles
-- ===========================================

INSERT INTO agent_profiles (
  company_id, 
  agent_key, 
  name, 
  description, 
  capabilities, 
  config,
  personality_settings,
  system_prompt
) VALUES 
(
  '00000000-0000-0000-0000-000000000000',
  'prime',
  'PRIME',
  'The Engineer - Intel + Dev + Design + Manufacturing. PRIME handles technical tasks, coding, AI design generation, and manufacturing workflow optimization.',
  '["research", "code_generation", "design_ai", "manufacturing_analysis", "technical_writing", "browser_automation", "data_analysis"]',
  '{"default_model": "llama3.2", "max_concurrent_tasks": 5, "preferred_voice": "male_professional"}',
  '{"voice_tone": "professional", "formality": "high", "enthusiasm": "medium", "humor": "low"}',
  'You are PRIME, the technical engineering agent for Azenith Living. You specialize in furniture design, manufacturing workflows, and technical problem-solving. You communicate professionally and precisely. When stuck, you ask for help clearly.'
),
(
  '00000000-0000-0000-0000-000000000000',
  'vanguard',
  'Vanguard',
  'The Account Manager - Sales + PM + CRM. Vanguard manages customer relationships, sales pipelines, project management, and communications.',
  '["customer_communication", "sales_management", "project_management", "crm_operations", "scheduling", "negotiation", "follow_up", "whatsapp_messaging"]',
  '{"response_time_target": 300, "follow_up_frequency": "daily", "preferred_voice": "friendly_professional"}',
  '{"voice_tone": "friendly", "formality": "medium", "enthusiasm": "high", "humor": "medium"}',
  'You are Vanguard, the customer-facing account manager for Azenith Living. You build relationships, manage sales, and ensure customer satisfaction. You communicate warmly and proactively. You celebrate wins and learn from losses.'
)
ON CONFLICT (agent_key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  capabilities = EXCLUDED.capabilities,
  config = EXCLUDED.config;

-- ===========================================
-- FUNCTIONS & TRIGGERS
-- ===========================================

-- Update timestamp function (if not exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to agent tables
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN 
    SELECT table_name 
    FROM information_schema.columns 
    WHERE column_name = 'updated_at' 
    AND table_schema = 'public'
    AND table_name IN ('agent_profiles', 'agent_devices', 'agent_tasks', 'agent_memory', 
                       'owner_policies', 'alert_rules')
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS update_%s_updated_at ON %I', t, t);
    EXECUTE format('CREATE TRIGGER update_%s_updated_at 
      BEFORE UPDATE ON %I 
      FOR EACH ROW 
      EXECUTE FUNCTION update_updated_at_column()', t, t);
  END LOOP;
END $$;

-- Function to update conversation last_message_at
CREATE OR REPLACE FUNCTION update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE agent_conversations
  SET last_message_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER IF NOT EXISTS trigger_update_conversation_last_message
AFTER INSERT ON agent_messages
FOR EACH ROW
EXECUTE FUNCTION update_conversation_last_message();

-- ===========================================
-- VIEWS
-- ===========================================

-- Active Tasks View
CREATE OR REPLACE VIEW active_tasks AS
SELECT 
  t.*,
  ap.agent_key,
  ap.name as agent_name,
  ad.device_key,
  so.status as sales_order_status,
  pj.status as production_job_status
FROM agent_tasks t
LEFT JOIN agent_profiles ap ON t.agent_profile_id = ap.id
LEFT JOIN agent_devices ad ON t.device_id = ad.id
LEFT JOIN sales_orders so ON t.sales_order_id = so.id
LEFT JOIN production_jobs pj ON t.production_job_id = pj.id
WHERE t.status IN ('pending', 'queued', 'running', 'paused')
AND t.is_active = true;

-- Device Health View
CREATE OR REPLACE VIEW device_health AS
SELECT 
  ad.*,
  (SELECT status FROM agent_device_heartbeats 
   WHERE device_id = ad.id 
   ORDER BY recorded_at DESC LIMIT 1) as last_status,
  (SELECT recorded_at FROM agent_device_heartbeats 
   WHERE device_id = ad.id 
   ORDER BY recorded_at DESC LIMIT 1) as last_heartbeat,
  (SELECT COUNT(*) FROM agent_tasks 
   WHERE device_id = ad.id AND status = 'running') as running_tasks
FROM agent_devices ad
WHERE ad.is_active = true;

-- Unacknowledged Events View
CREATE OR REPLACE VIEW unacknowledged_events AS
SELECT 
  ae.*,
  ap.agent_key,
  ap.name as agent_name
FROM agent_events ae
LEFT JOIN agent_profiles ap ON ae.agent_profile_id = ap.id
WHERE ae.acknowledged_at IS NULL
ORDER BY 
  CASE ae.severity 
    WHEN 'critical' THEN 1 
    WHEN 'warning' THEN 2 
    ELSE 3 
  END,
  ae.created_at DESC;

-- ===========================================
-- VERIFICATION
-- ===========================================

DO $$
BEGIN
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'Agent Tables Migration Complete';
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'Tables created:';
  RAISE NOTICE '- agent_profiles (PRIME, Vanguard)';
  RAISE NOTICE '- agent_devices (powerhouse-alpha, etc.)';
  RAISE NOTICE '- agent_device_heartbeats';
  RAISE NOTICE '- agent_tasks';
  RAISE NOTICE '- agent_task_dependencies';
  RAISE NOTICE '- agent_task_runs';
  RAISE NOTICE '- agent_conversations';
  RAISE NOTICE '- agent_messages';
  RAISE NOTICE '- agent_handoffs';
  RAISE NOTICE '- agent_events';
  RAISE NOTICE '- agent_learnings';
  RAISE NOTICE '- agent_memory';
  RAISE NOTICE '- owner_policies';
  RAISE NOTICE '- emergency_stop_state';
  RAISE NOTICE '- alert_rules';
  RAISE NOTICE '- daily_digests';
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'Default agents created:';
  RAISE NOTICE '- PRIME (Engineer)';
  RAISE NOTICE '- Vanguard (Account Manager)';
  RAISE NOTICE '===========================================';
END $$;

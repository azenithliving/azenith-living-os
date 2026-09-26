/**
 * Shared utilities for Qayyim API routes
 */

import { z } from "zod";
import { resolveAdminCompanyId } from "@/lib/admin-company";

// ============================================
// Request Schemas
// ============================================

export const ExecuteTaskSchema = z.object({
  agent: z.enum([
    'ops-lead', 'ops-content', 'ops-visual', 'ops-seo',
    'ops-ux', 'ops-analytics', 'ops-dev', 'ops-qa'
  ]),
  task: z.object({
    type: z.string(),
    title: z.string(),
    description: z.string(),
    context: z.record(z.string(), z.any()).optional(),
    priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  }),
  company_id: z.string().optional(),
});

export const ChatSchema = z.object({
  agent: z.enum([
    'ops-lead', 'ops-content', 'ops-visual', 'ops-seo',
    'ops-ux', 'ops-analytics', 'ops-dev', 'ops-qa'
  ]),
  message: z.string().min(1).max(4000),
  context: z.record(z.string(), z.any()).optional(),
  session_id: z.string().optional(),
});

export const OrchestrateSchema = z.object({
  user_request: z.string().min(1).max(2000),
  context: z.record(z.string(), z.any()).optional(),
  company_id: z.string().optional(),
});

export const AuditSchema = z.object({
  page_path: z.string().optional(),
  scope: z.enum(['full', 'page', 'section']).optional(),
  company_id: z.string().optional(),
});

export const DraftSchema = z.object({
  agent: z.enum(['ops-content', 'ops-visual', 'ops-seo', 'ops-ux']),
  page_path: z.string(),
  section_key: z.string(),
  draft_type: z.enum(['hero_text', 'section_reorder', 'product_card', 'tone_unification', 'identity_fix', 'storytelling', 'curate_gallery', 'select_hero_image', 'generate_alt_text', 'brand_consistency_check']),
  instructions: z.string(),
  current_content: z.any().optional(),
  context: z.record(z.string(), z.any()).optional(),
  company_id: z.string().optional(),
});

export const ImageDraftSchema = z.object({
  agent: z.enum(['ops-visual']),
  page_path: z.string(),
  section_key: z.string(),
  draft_type: z.enum(['curate_gallery', 'select_hero_image', 'generate_alt_text', 'brand_consistency_check']),
  instructions: z.string(),
  current_content: z.any().optional(),
  context: z.record(z.string(), z.any()).optional(),
  company_id: z.string().optional(),
});

export const SeoDraftSchema = z.object({
  agent: z.enum(['ops-seo']),
  page_path: z.string(),
  section_key: z.string(),
  draft_type: z.enum(['audit_seo', 'fix_schema', 'content_gap_analysis', 'competitor_gap', 'schema_generate']),
  instructions: z.string(),
  current_content: z.any().optional(),
  context: z.record(z.string(), z.any()).optional(),
  company_id: z.string().optional(),
});

export const IdentityDraftSchema = z.object({
  agent: z.enum(['ops-content']),
  page_path: z.string(),
  section_key: z.string(),
  draft_type: z.enum(['identity_fix']),
  instructions: z.string(),
  current_content: z.any().optional(),
  context: z.record(z.string(), z.any()).optional(),
  company_id: z.string().optional(),
});

export const ToneDraftSchema = z.object({
  agent: z.enum(['ops-content']),
  page_path: z.string(),
  section_key: z.string(),
  draft_type: z.enum(['tone_unification']),
  instructions: z.string(),
  current_content: z.any().optional(),
  context: z.record(z.string(), z.any()).optional(),
  company_id: z.string().optional(),
});

export const PublishSchema = z.object({
  draft_id: z.string(),
  approved_by: z.string(),
  company_id: z.string().optional(),
});

export const RollbackSchema = z.object({
  draft_id: z.string(),
  target_version: z.number().optional(),
  company_id: z.string().optional(),
});

export const ConstitutionCheckSchema = z.object({
  agentKey: z.string(),
  actionType: z.enum(['draft', 'publish', 'audit', 'analyze', 'review']),
  content: z.any().optional(),
  proposedChanges: z.any().optional(),
  targetPage: z.string().optional(),
  targetSection: z.string().optional(),
  evidenceUrls: z.array(z.string()).optional(),
  humanApproval: z.boolean().optional(),
  approvedBy: z.string().optional(),
});

export const LearningCreateSchema = z.object({
  source_agent: z.string(),
  target_agents: z.array(z.string()).default([]),
  lesson_type: z.enum(['pattern', 'anti-pattern', 'heuristic', 'template', 'best_practice']),
  domain: z.string(),
  pattern: z.record(z.string(), z.any()),
  evidence: z.record(z.string(), z.any()),
  confidence: z.number().min(0).max(1),
  is_active: z.boolean().default(true),
  company_id: z.string().optional(),
});

export const LearningSearchSchema = z.object({
  agent_key: z.string().optional(),
  domain: z.string().optional(),
  lesson_type: z.enum(['pattern', 'anti-pattern', 'heuristic', 'template', 'best_practice']).optional(),
  min_confidence: z.number().min(0).max(1).optional(),
  limit: z.number().default(10),
});

export const MemorySearchSchema = z.object({
  query: z.string(),
  agent_key: z.string().optional(),
  memory_types: z.array(z.enum(['fact', 'preference', 'conversation', 'task_result', 'pattern', 'rule'])).optional(),
  limit: z.number().default(10),
  min_similarity: z.number().min(0).max(1).default(0.7),
  tags: z.array(z.string()).default([]),
});

export const SyncSubscribeSchema = z.object({
  event_types: z.array(z.enum([
    'context_update', 'draft_created', 'draft_updated', 'draft_published', 
    'draft_rejected', 'draft_rolled_back', 'audit_completed', 'learning_created',
    'learning_updated', 'agent_task_started', 'agent_task_completed', 'agent_task_failed',
    'quality_gate_passed', 'quality_gate_failed', 'identity_violation', 'scope_violation'
  ])),
  agent_key: z.string(),
  filter: z.record(z.string(), z.any()).optional(),
});

export const TelemetrySchema = z.object({
  action: z.enum(['analyze_behavior', 'exit_rate_report', 'create_goal', 'get_goals']).default('analyze_behavior'),
  page_path: z.string().optional(),
  section_key: z.string().optional(),
  time_range: z.enum(['1h', '24h', '7d', '30d']).optional(),
  metrics: z.array(z.enum(['exit_rate', 'scroll_depth', 'time_on_section', 'hover_duration', 'click_through', 'conversion_rate'])).optional(),
  threshold: z.number().optional(),
  goal: z.object({
    name: z.string(),
    target_metric: z.enum(['exit_rate', 'scroll_depth', 'conversion_rate', 'time_on_section']),
    target_value: z.number(),
    deadline_days: z.number().optional(),
  }).optional(),
  company_id: z.string().optional(),
});

export const ABTestSchema = z.object({
  action: z.enum(['design', 'predict_impact']).default('design'),
  hypothesis: z.string().optional(),
  page_path: z.string(),
  section_key: z.string(),
  control_version: z.any().optional(),
  variant_version: z.any().optional(),
  success_metric: z.enum(['exit_rate', 'scroll_depth', 'conversion_rate', 'time_on_section']).optional(),
  minimum_detectable_effect: z.number().optional(),
  duration_days: z.number().optional(),
  proposed_change: z.string().optional(),
  historical_patterns: z.array(z.string()).optional(),
  company_id: z.string().optional(),
});

export const QaSchema = z.object({
  action: z.enum(['full_suite', 'e2e_smoke', 'visual_regression', 'accessibility', 'load_test', 'security_scan', 'cross_browser']).default('full_suite'),
  staging_url: z.string().optional(),
  suites: z.array(z.enum(['e2e', 'visual', 'a11y', 'load', 'security'])).optional(),
  test_paths: z.array(z.string()).optional(),
  base_url: z.string().optional(),
  headed: z.boolean().optional(),
  pages: z.array(z.object({
    path: z.string(),
    name: z.string(),
    viewport: z.enum(['mobile', 'tablet', 'desktop']).optional(),
  })).optional(),
  pages_simple: z.array(z.string()).optional(),
  threshold: z.number().optional(),
  update_baselines: z.boolean().optional(),
  standard: z.enum(['WCAG21AA', 'WCAG21AAA', 'Section508']).optional(),
  include_best_practices: z.boolean().optional(),
  scenarios: z.array(z.object({
    name: z.string(),
    path: z.string(),
    method: z.enum(['GET', 'POST']),
    body: z.any().optional(),
  })).optional(),
  stages: z.array(z.object({
    duration: z.string(),
    users: z.number(),
  })).optional(),
  thresholds: z.object({
    p95: z.number().optional(),
    p99: z.number().optional(),
    errorRate: z.number().optional(),
  }).optional(),
  target_url: z.string().optional(),
  checks: z.array(z.enum(['headers', 'csp', 'cookies', 'rate_limit', 'ssl', 'cors'])).optional(),
  browsers: z.array(z.enum(['chromium', 'firefox', 'webkit'])).optional(),
  devices: z.array(z.enum(['mobile', 'tablet', 'desktop'])).optional(),
  company_id: z.string().optional(),
});

export const PerfSchema = z.object({
  action: z.enum(['performance_budgets', 'bundle_analysis', 'dependency_audit', 'code_review', 'security_code_scan', 'luxury_score', 'revenue_correlation', 'weekly_report']).default('performance_budgets'),
  budgets: z.object({
    lcp: z.number().optional(),
    tbt: z.number().optional(),
    cls: z.number().optional(),
    fid: z.number().optional(),
    fcp: z.number().optional(),
  }).optional(),
  page_path: z.string().optional(),
  include_chunks: z.boolean().optional(),
  threshold_kb: z.number().optional(),
  check_vulnerabilities: z.boolean().optional(),
  check_outdated: z.boolean().optional(),
  check_unused: z.boolean().optional(),
  check_licenses: z.boolean().optional(),
  scope: z.enum(['full', 'changed_files', 'specific_paths']).optional(),
  paths: z.array(z.string()).optional(),
  check_xss: z.boolean().optional(),
  check_injection: z.boolean().optional(),
  check_secrets: z.boolean().optional(),
  check_csp: z.boolean().optional(),
  luxury_scope: z.enum(['full_site', 'page', 'section']).optional(),
  weights: z.object({
    identity: z.number().optional(),
    behavior: z.number().optional(),
    conversion: z.number().optional(),
    revenue: z.number().optional(),
  }).optional(),
  time_range: z.enum(['7d', '30d', '90d']).optional(),
  segment_by: z.enum(['page', 'section', 'draft_version', 'traffic_source']).optional(),
  week_start: z.string().optional(),
  company_id: z.string().optional(),
});

// ============================================
// Helper Functions
// ============================================

export async function getCompanyId(hint?: string): Promise<string> {
  return await resolveAdminCompanyId(hint) || '';
}

export async function getAgentInstance(agentKey: string) {
  const agents: Record<string, string> = {
    'ops-lead': 'qayyimCoreAgent',
    'ops-content': 'qayyimContentAgent',
    'ops-visual': 'qayyimVisualAgent',
    'ops-seo': 'qayyimSeoAgent',
    'ops-ux': 'qayyimUxAgent',
    'ops-analytics': 'qayyimAnalyticsAgent',
    'ops-dev': 'qayyimDevAgent',
    'ops-qa': 'qayyimQaAgent',
  };
  
  // Dynamic import to avoid circular dependencies
  const agentModule = await import('@/lib/ops') as Record<string, any>;
  return agentModule[agents[agentKey]];
}
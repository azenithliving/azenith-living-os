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
    'qayyim-core', 'qayyim-cont', 'qayyim-vis', 'qayyim-seo',
    'qayyim-ux', 'qayyim-ana', 'qayyim-dev', 'qayyim-qa'
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
    'qayyim-core', 'qayyim-cont', 'qayyim-vis', 'qayyim-seo',
    'qayyim-ux', 'qayyim-ana', 'qayyim-dev', 'qayyim-qa'
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
  agent: z.enum(['qayyim-cont', 'qayyim-vis', 'qayyim-seo', 'qayyim-ux']),
  page_path: z.string(),
  section_key: z.string(),
  draft_type: z.enum(['hero_text', 'section_reorder', 'product_card', 'tone_unification', 'identity_fix', 'storytelling', 'curate_gallery', 'select_hero_image', 'generate_alt_text', 'brand_consistency_check']),
  instructions: z.string(),
  current_content: z.any().optional(),
  context: z.record(z.string(), z.any()).optional(),
  company_id: z.string().optional(),
});

export const ImageDraftSchema = z.object({
  agent: z.enum(['qayyim-vis']),
  page_path: z.string(),
  section_key: z.string(),
  draft_type: z.enum(['curate_gallery', 'select_hero_image', 'generate_alt_text', 'brand_consistency_check']),
  instructions: z.string(),
  current_content: z.any().optional(),
  context: z.record(z.string(), z.any()).optional(),
  company_id: z.string().optional(),
});

export const SeoDraftSchema = z.object({
  agent: z.enum(['qayyim-seo']),
  page_path: z.string(),
  section_key: z.string(),
  draft_type: z.enum(['audit_seo', 'fix_schema', 'content_gap_analysis', 'competitor_gap', 'schema_generate']),
  instructions: z.string(),
  current_content: z.any().optional(),
  context: z.record(z.string(), z.any()).optional(),
  company_id: z.string().optional(),
});

export const IdentityDraftSchema = z.object({
  agent: z.enum(['qayyim-cont']),
  page_path: z.string(),
  section_key: z.string(),
  draft_type: z.enum(['identity_fix']),
  instructions: z.string(),
  current_content: z.any().optional(),
  context: z.record(z.string(), z.any()).optional(),
  company_id: z.string().optional(),
});

export const ToneDraftSchema = z.object({
  agent: z.enum(['qayyim-cont']),
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

// ============================================
// Helper Functions
// ============================================

export async function getCompanyId(hint?: string): Promise<string> {
  return await resolveAdminCompanyId(hint) || '';
}

export async function getAgentInstance(agentKey: string) {
  const agents: Record<string, string> = {
    'qayyim-core': 'qayyimCoreAgent',
    'qayyim-cont': 'qayyimContentAgent',
    'qayyim-vis': 'qayyimVisualAgent',
    'qayyim-seo': 'qayyimSeoAgent',
    'qayyim-ux': 'qayyimUxAgent',
    'qayyim-ana': 'qayyimAnalyticsAgent',
    'qayyim-dev': 'qayyimDevAgent',
    'qayyim-qa': 'qayyimQaAgent',
  };
  
  // Dynamic import to avoid circular dependencies
  const agentModule = await import('@/lib/qayyim') as Record<string, any>;
  return agentModule[agents[agentKey]];
}
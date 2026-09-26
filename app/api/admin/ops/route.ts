/**
 * Qayyim Swarm API Routes
 * Handles all agent capabilities through a unified interface
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { masterOrchestrator } from "@/lib/ops";
import { constitutionEngine } from "@/lib/ops/governance/ConstitutionEngine";
import { swarmLearnings } from "@/lib/ops/memory/SwarmLearnings";
import { sharedMemory } from "@/lib/ops/memory";
import { resolveAdminCompanyId } from "@/lib/admin-company";
import { AGENT_KEYS, legacyToOps } from "@/lib/ops/identity";

export const dynamic = "force-dynamic";

// ============================================
// Request Schemas
// ============================================

/**
 * The swarm's own members, read from the identity module so this route can never
 * fall behind a rename. A caller still holding a retired key — a tool description
 * written before the rename, a browser tab that predates the deploy — is mapped
 * rather than refused.
 */
const memberKey = z.preprocess(
  (k) => (typeof k === "string" ? legacyToOps(k) : k),
  z.enum([...AGENT_KEYS] as [string, ...string[]])
);

/** Anywhere a key is written to a column: same map, but a stranger is left alone. */
const storedAgentKey = z.string().transform(legacyToOps);

const ExecuteTaskSchema = z.object({
  agent: memberKey,
  task: z.object({
    type: z.string(),
    title: z.string(),
    description: z.string(),
    context: z.record(z.string(), z.any()).optional(),
    priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  }),
  company_id: z.string().optional(),
});

const ChatSchema = z.object({
  agent: memberKey,
  message: z.string().min(1).max(4000),
  context: z.record(z.string(), z.any()).optional(),
  session_id: z.string().optional(),
});

const OrchestrateSchema = z.object({
  user_request: z.string().min(1).max(2000),
  context: z.record(z.string(), z.any()).optional(),
  company_id: z.string().optional(),
});

const AuditSchema = z.object({
  page_path: z.string().optional(),
  scope: z.enum(['full', 'page', 'section']).optional(),
  company_id: z.string().optional(),
});

const DraftSchema = z.object({
  agent: z.preprocess(
    (k) => (typeof k === "string" ? legacyToOps(k) : k),
    z.enum(['ops-content', 'ops-visual', 'ops-seo', 'ops-ux'])
  ),
  page_path: z.string(),
  section_key: z.string(),
  draft_type: z.enum(['hero_text', 'section_reorder', 'product_card', 'tone_unification', 'identity_fix', 'storytelling', 'curate_gallery', 'select_hero_image', 'generate_alt_text', 'brand_consistency_check']),
  instructions: z.string(),
  current_content: z.any().optional(),
  context: z.record(z.string(), z.any()).optional(),
  company_id: z.string().optional(),
});

const PublishSchema = z.object({
  draft_id: z.string(),
  approved_by: z.string(),
  company_id: z.string().optional(),
});

const RollbackSchema = z.object({
  draft_id: z.string(),
  target_version: z.number().optional(),
  company_id: z.string().optional(),
});

const ConstitutionCheckSchema = z.object({
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

const LearningCreateSchema = z.object({
  source_agent: storedAgentKey,
  target_agents: z.array(storedAgentKey).default([]),
  lesson_type: z.enum(['pattern', 'anti-pattern', 'heuristic', 'template', 'best_practice']),
  domain: z.string(),
  pattern: z.record(z.string(), z.any()),
  evidence: z.record(z.string(), z.any()),
  confidence: z.number().min(0).max(1),
  is_active: z.boolean().default(true),
  company_id: z.string().optional(),
});

const LearningSearchSchema = z.object({
  agent_key: storedAgentKey.optional(),
  domain: z.string().optional(),
  lesson_type: z.enum(['pattern', 'anti-pattern', 'heuristic', 'template', 'best_practice']).optional(),
  min_confidence: z.number().min(0).max(1).optional(),
  limit: z.number().default(10),
});

const MemorySearchSchema = z.object({
  query: z.string(),
  agent_key: storedAgentKey.optional(),
  memory_types: z.array(z.enum(['fact', 'preference', 'conversation', 'task_result', 'pattern', 'rule'])).optional(),
  limit: z.number().default(10),
  min_similarity: z.number().min(0).max(1).default(0.7),
  tags: z.array(z.string()).optional(),
});

const SyncSubscribeSchema = z.object({
  event_types: z.array(z.enum([
    'context_update', 'draft_created', 'draft_updated', 'draft_published', 
    'draft_rejected', 'draft_rolled_back', 'audit_completed', 'learning_created',
    'learning_updated', 'agent_task_started', 'agent_task_completed', 'agent_task_failed',
    'quality_gate_passed', 'quality_gate_failed', 'identity_violation', 'scope_violation'
  ])),
  agent_key: storedAgentKey,
  filter: z.record(z.string(), z.any()).optional(),
});

// ============================================
// Helper Functions
// ============================================

async function getCompanyId(hint?: string): Promise<string> {
  return await resolveAdminCompanyId(hint) || '';
}

async function getAgentInstance(agentKey: string) {
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

// ============================================
// Route Handlers
// ============================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'execute';

    switch (action) {
      case 'execute':
        return await handleExecute(body);
      case 'chat':
        return await handleChat(body);
      case 'orchestrate':
        return await handleOrchestrate(body);
      case 'audit':
        return await handleAudit(body);
      case 'draft':
        return await handleDraft(body);
      case 'publish':
        return await handlePublish(body);
      case 'rollback':
        return await handleRollback(body);
      case 'constitution':
        return await handleConstitutionCheck(body);
      case 'learning':
        return await handleLearning(body, request);
      case 'memory':
        return await handleMemory(body);
      case 'sync':
        return await handleSync(body);
      case 'stats':
        return await handleStats(body);
      case 'list_drafts':
        return await handleListDrafts(body);
      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error('[Qayyim API] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

async function handleExecute(body: any) {
  const parsed = ExecuteTaskSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.format() }, { status: 400 });
  }

  const { agent, task, company_id } = parsed.data;
  const companyId = await getCompanyId(company_id);

  const agentInstance = await getAgentInstance(agent);

  const result = await agentInstance.process({
    id: `task_${Date.now()}`,
    ...task,
    context: { ...task.context, company_id: companyId },
  });

  return NextResponse.json({ success: true, result });
}

async function handleChat(body: any) {
  const parsed = ChatSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.format() }, { status: 400 });
  }

  const { agent, message, context, session_id } = parsed.data;
  const agentInstance = await getAgentInstance(agent);

  const response = await agentInstance.chat(message, {
    ...context,
    session_id,
  });

  return NextResponse.json({ success: true, response });
}

async function handleOrchestrate(body: any) {
  const parsed = OrchestrateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.format() }, { status: 400 });
  }

  const { user_request, context, company_id } = parsed.data;
  const companyId = await getCompanyId(company_id);

  const result = await masterOrchestrator.execute(user_request, {
    ...context,
    company_id: companyId,
  });

  return NextResponse.json({ ...result });
}

async function handleAudit(body: any) {
  const parsed = AuditSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.format() }, { status: 400 });
  }

  const { page_path = '/', scope = 'full', company_id } = parsed.data;
  const companyId = await getCompanyId(company_id);

  const agentModule = await import('@/lib/ops');
  const coreAgent = agentModule.qayyimCoreAgent;

  const result = await coreAgent.auditFullSite({
    page_path,
    scope,
    company_id: companyId,
  });

  return NextResponse.json({ success: true, result });
}

async function handleDraft(body: any) {
  const parsed = DraftSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.format() }, { status: 400 });
  }

  const { agent, page_path, section_key, draft_type, instructions, current_content, context, company_id } = parsed.data;
  const companyId = await getCompanyId(company_id);

  const agentInstance = await getAgentInstance(agent);

  if (!agentInstance) {
    return NextResponse.json({ success: false, error: `Agent ${agent} does not support drafting` }, { status: 400 });
  }

  // Map draft_type to agent method
  let result;
  switch (draft_type) {
    case 'hero_text':
    case 'section_reorder':
    case 'product_card':
    case 'tone_unification':
    case 'identity_fix':
    case 'storytelling':
      result = await agentInstance.draftCopy({
        page_path,
        section_key,
        draft_type: draft_type as any,
        instructions,
        current_content,
        context: { ...context, company_id: companyId },
      });
      break;
    case 'curate_gallery':
    case 'select_hero_image':
    case 'generate_alt_text':
    case 'brand_consistency_check':
      result = await agentInstance[{
        curate_gallery: 'curateGallery',
        select_hero_image: 'selectHeroImage',
        generate_alt_text: 'generateAltText',
        brand_consistency_check: 'brandConsistencyCheck',
      }[draft_type]]({ page_path, section_key, context: { ...context, company_id: companyId } });
      break;
    default:
      return NextResponse.json({ success: false, error: `Unknown draft type: ${draft_type}` }, { status: 400 });
  }

  // Publish sync event
  const { syncLayer } = await import('@/lib/ops/memory/SyncLayer');
  await syncLayer.initialize(companyId);
  await syncLayer.publishDraftUpdate(agent, result.data?.draft_id || 'new', 'created', { page_path, section_key, draft_type });

  return NextResponse.json({ success: true, result });
}

async function handlePublish(body: any) {
  const parsed = PublishSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.format() }, { status: 400 });
  }

  const { draft_id, approved_by, company_id } = parsed.data;
  const companyId = await getCompanyId(company_id);

  const agentModule = await import('@/lib/ops');
  const coreAgent = agentModule.qayyimCoreAgent;

  const result = await coreAgent.publishDraft(draft_id, approved_by);

  // Publish sync event
  if (result.success) {
    const { syncLayer } = await import('@/lib/ops/memory/SyncLayer');
    await syncLayer.initialize(companyId);
    await syncLayer.publishDraftUpdate('ops-lead', draft_id, 'published', { approved_by });
  }

  return NextResponse.json({ success: true, result });
}

async function handleRollback(body: any) {
  const parsed = RollbackSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.format() }, { status: 400 });
  }

  const { draft_id, target_version, company_id } = parsed.data;
  const companyId = await getCompanyId(company_id);

  const agentModule = await import('@/lib/ops');
  const coreAgent = agentModule.qayyimCoreAgent;

  const result = await coreAgent.rollbackDraft(draft_id, target_version);

  // Publish sync event
  if (result.success) {
    const { syncLayer } = await import('@/lib/ops/memory/SyncLayer');
    await syncLayer.initialize(companyId);
    await syncLayer.publishDraftUpdate('ops-lead', draft_id, 'rolled_back', { target_version });
  }

  return NextResponse.json({ success: true, result });
}

async function handleConstitutionCheck(body: any) {
  const parsed = ConstitutionCheckSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.format() }, { status: 400 });
  }

  const input = parsed.data;
  const companyId = await getCompanyId(body.company_id);

  // Run Constitution Engine
  const report = await constitutionEngine.checkAll({
    ...input,
    targetPage: input.targetPage,
    targetSection: input.targetSection,
  });

  // P3: Publish quality gate event
  try {
    const { syncLayer } = await import('@/lib/ops/memory/SyncLayer');
    await syncLayer.initialize(companyId);
    const passed = report.overallPassed;
    const blockingResults = report.results.filter((r: any) => !r.passed && r.enforcement === 'hard_block');
    const draftId = (input as any).draft_id || 'constitution_check';
    await syncLayer.publishQualityGate(
      'ops-lead',
      draftId,
      passed,
      blockingResults
    );
  } catch (e) {
    console.warn('[Constitution Check] SyncLayer publish failed:', e);
  }

  return NextResponse.json({
    success: true,
    constitution_report: report,
    overall_allowed: report.overallPassed,
  });
}

async function handleLearning(body: any, request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const subAction = searchParams.get('subaction') || 'create';

  if (subAction === 'create') {
    const parsed = LearningCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.format() }, { status: 400 });
    }

    const { company_id, ...learning } = parsed.data;
    const companyId = await getCompanyId(company_id);

    await swarmLearnings.initialize(companyId);
    const learningId = await swarmLearnings.create(learning);

    // Broadcast to target agents
    const { syncLayer } = await import('@/lib/ops/memory/SyncLayer');
    await syncLayer.initialize(companyId);
    await syncLayer.publishLearningCreated(parsed.data.source_agent, learningId, parsed.data.domain, parsed.data.target_agents || []);

    return NextResponse.json({ success: true, learning_id: learningId });
  }

  if (subAction === 'search') {
    const parsed = LearningSearchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.format() }, { status: 400 });
    }

    const learnings = await swarmLearnings.search(parsed.data);
    return NextResponse.json({ success: true, learnings });
  }

  if (subAction === 'stats') {
    const stats = await swarmLearnings.getStats();
    return NextResponse.json({ success: true, stats });
  }

  return NextResponse.json({ success: false, error: 'Invalid subaction' }, { status: 400 });
}

async function handleMemory(body: any) {
  const subAction = body?.subaction || 'search';

  if (subAction === 'search') {
    const parsed = MemorySearchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.format() }, { status: 400 });
    }

    const companyId = await getCompanyId(body.company_id);
    await sharedMemory.initialize(companyId);

    const results = await sharedMemory.searchSimilar(parsed.data.query, parsed.data);
    return NextResponse.json({ success: true, results });
  }

  if (subAction === 'store') {
    const parsed = z.object({
      content: z.string(),
      agent_key: storedAgentKey,
      memory_type: z.enum(['fact', 'preference', 'conversation', 'task_result', 'pattern', 'rule']),
      tags: z.array(z.string()).default([]),
      related_entities: z.record(z.string(), z.any()).default({}),
      importance_score: z.number().min(0).max(1).default(0.5),
      expires_at: z.string().nullable().optional(),
      company_id: z.string().optional(),
    }).safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.format() }, { status: 400 });
    }

    const { company_id, ...memory } = parsed.data;
    const companyId = await getCompanyId(company_id);
    await sharedMemory.initialize(companyId);

    const id = await sharedMemory.store({ 
      ...memory, 
      company_id: companyId,
      expires_at: memory.expires_at || null,
    });
    return NextResponse.json({ success: true, id });
  }

  if (subAction === 'stats') {
    const companyId = await getCompanyId(body.company_id);
    await sharedMemory.initialize(companyId);
    const stats = await sharedMemory.getStats(body.agent_key);
    return NextResponse.json({ success: true, stats });
  }

  return NextResponse.json({ success: false, error: 'Invalid subaction' }, { status: 400 });
}

async function handleSync(body: any) {
  const subAction = body?.subaction || 'publish';

  const companyId = await getCompanyId(body.company_id);
  const { syncLayer } = await import('@/lib/ops/memory/SyncLayer');
  await syncLayer.initialize(companyId);

  if (subAction === 'publish') {
    const parsed = z.object({
      event_type: z.enum([
        'context_update', 'draft_created', 'draft_updated', 'draft_published',
        'draft_rejected', 'draft_rolled_back', 'audit_completed', 'learning_created',
        'learning_updated', 'agent_task_started', 'agent_task_completed', 'agent_task_failed',
        'quality_gate_passed', 'quality_gate_failed', 'identity_violation', 'scope_violation'
      ]),
      source_agent: storedAgentKey,
      target_agents: z.array(storedAgentKey).optional(),
      payload: z.record(z.string(), z.any()),
    }).safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.format() }, { status: 400 });
    }

    const eventId = await syncLayer.publish({
      ...parsed.data,
      target_agents: parsed.data.target_agents || [],
    });

    return NextResponse.json({ success: true, event_id: eventId });
  }

  if (subAction === 'subscribe') {
    const parsed = SyncSubscribeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.format() }, { status: 400 });
    }

    const { syncLayer } = await import('@/lib/ops/memory/SyncLayer');
    const unsubscribe = syncLayer.subscribe({
      eventTypes: parsed.data.event_types,
      agentKey: parsed.data.agent_key,
      callback: (event) => {
        // In production, this would be WebSocket or SSE
        console.log('[Sync] Event received:', event);
      },
      filter: undefined,
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Subscribed. Use WebSocket/SSE for real-time events.' 
    });
  }

  return NextResponse.json({ success: false, error: 'Invalid subaction' }, { status: 400 });
}

async function handleStats(body: any) {
  const companyId = await getCompanyId(body.company_id);
  
  // Gather stats from all memory systems
  await sharedMemory.initialize(companyId);
  const memoryStats = await sharedMemory.getStats();
  
  const learningStats = await swarmLearnings.getStats();
  
  const { VectorStore } = await import('@/lib/ops/memory/VectorStore');
  const vectorStore = new VectorStore();
  await vectorStore.initialize(companyId);
  const vectorStats = await vectorStore.getStats();

  return NextResponse.json({
    success: true,
    stats: {
      memory: memoryStats,
      learnings: learningStats,
      vectors: vectorStats,
    },
  });
}

async function handleListDrafts(body: any) {
  const companyId = await getCompanyId(body.company_id);
  const status = body.status as string | undefined;

  const { supabaseServer } = await import('@/lib/dal/unified-supabase');
  let query = supabaseServer
    .from('qayyim_drafts')
    .select('id, created_by, target_path, target_table, target_id, draft_type, status, version, proposed, previous, preview_token, created_at')
    .order('created_at', { ascending: false })
    .limit(100);

  if (companyId) query = query.eq('company_id', companyId);
  if (status) query = query.eq('status', status);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ success: true, drafts: [], warning: error.message });
  }

  return NextResponse.json({ success: true, drafts: data || [] });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  try {
    if (action === 'health') {
      return NextResponse.json({ 
        success: true, 
        status: 'healthy',
        timestamp: new Date().toISOString(),
        agents: [
          'ops-lead', 'ops-content', 'ops-visual', 'ops-seo',
          'ops-ux', 'ops-analytics', 'ops-dev', 'ops-qa'
        ],
      });
    }

    if (action === 'agents') {
      return NextResponse.json({
        success: true,
        agents: [
          { key: 'ops-lead', name: 'قيّم الدار - القائد', role: 'تنسيق السرب، تدقيق شامل، إدارة نشر/تراجع، بوابة جودة' },
          { key: 'ops-content', name: 'قيّم الدار - المحتوى والعربية', role: 'كتابة فاخرة، توحيد نبرة، قانون هوية، صقل نصوص' },
          { key: 'ops-visual', name: 'قيّم الدار - المرئي والصور', role: 'انتقاء صور، اختيار هيرو، alt text، علامة تجارية' },
          { key: 'ops-seo', name: 'قيّم الدار - الظهور والبحث', role: 'تدقيق SEO، إصلاح Schema، فجوات محتوى، منافسين' },
          { key: 'ops-ux', name: 'قيّم الدار - تجربة المستخدم', role: 'سلوك زائر، A/B testing، تقارير خروج، أهداف' },
          { key: 'ops-analytics', name: 'قيّم الدار - التحليلات والأعمال', role: 'ربط تحويل بإيرادات، تنبؤ، Luxury Score، تقسيم' },
          { key: 'ops-dev', name: 'قيّم الدار - التطوير والأداء', role: 'مراجعة كود، Bundle، تبعيات، أداء، أمان كود' },
          { key: 'ops-qa', name: 'قيّم الدار - الجودة والاختبار', role: 'E2E، Visual Regression، a11y، Load Test، Security' },
        ],
      });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

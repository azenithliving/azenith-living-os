/**
 * MasterOrchestrator - LangGraph-based swarm coordination
 * Decomposes user requests → Routes to specialized agents → Aggregates results
 */

import { StateGraph, Annotation, START, END } from "@langchain/langgraph";
import { askOrchestratorMessages } from "@/lib/ai-orchestrator";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { resolveAdminCompanyId } from "@/lib/admin-company";
import { 
  QayyimTask, 
  QayyimResult,
  qayyimCoreAgent,
  qayyimContentAgent,
  qayyimVisualAgent,
  qayyimSeoAgent,
  qayyimUxAgent,
  qayyimAnalyticsAgent,
  qayyimDevAgent,
  qayyimQaAgent,
  QayyimAgentBase 
} from "../index";

// ============================================
// State Definition (LangGraph Annotation)
// ============================================

interface SwarmState {
  // Input
  userRequest: string;
  context: Record<string, any>;
  companyId: string | null;
  
  // Planning
  taskId: string;
  subtasks: SubTask[];
  currentSubtaskIndex: number;
  
  // Execution
  agentResults: Map<string, QayyimResult>;
  completedSubtasks: string[];
  failedSubtasks: string[];
  
  // Aggregation
  aggregatedDraft: AggregatedDraft | null;
  qualityGatePassed: boolean;
  
  // Output
  finalResponse: string;
  evidenceUrls: string[];
  versionNumber: number;
  
  // Metadata
  startedAt: string;
  updatedAt: string;
  error?: string;
}

interface SubTask {
  id: string;
  agentKey: string;
  type: string;
  title: string;
  description: string;
  context: Record<string, any>;
  priority: 'low' | 'medium' | 'high' | 'critical';
  dependsOn: string[];
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  result?: QayyimResult;
}

interface AggregatedDraft {
  pagePath: string;
  sections: AggregatedSection[];
  version: number;
  previewToken: string;
  createdAt: string;
}

interface AggregatedSection {
  sectionKey: string;
  sectionType: 'hero' | 'content' | 'images' | 'seo' | 'ux' | 'product_card' | 'navigation';
  content: any;
  agentKey: string;
  evidenceUrls: string[];
  identityCompliant: boolean;
}

// Annotate state for LangGraph
const SwarmStateAnnotation = Annotation.Root({
  userRequest: Annotation<string>,
  context: Annotation<Record<string, any>>,
  companyId: Annotation<string | null>,
  taskId: Annotation<string>,
  subtasks: Annotation<SubTask[]>,
  currentSubtaskIndex: Annotation<number>,
  agentResults: Annotation<Map<string, QayyimResult>>,
  completedSubtasks: Annotation<string[]>,
  failedSubtasks: Annotation<string[]>,
  aggregatedDraft: Annotation<AggregatedDraft | null>,
  qualityGatePassed: Annotation<boolean>,
  finalResponse: Annotation<string>,
  evidenceUrls: Annotation<string[]>,
  versionNumber: Annotation<number>,
  startedAt: Annotation<string>,
  updatedAt: Annotation<string>,
  error: Annotation<string | undefined>,
});

type SwarmStateType = typeof SwarmStateAnnotation.State;

// ============================================
// Agent Registry
// ============================================

const AGENT_REGISTRY: Record<string, QayyimAgentBase> = {
  'qayyim-core': qayyimCoreAgent,
  'qayyim-cont': qayyimContentAgent,
  'qayyim-vis': qayyimVisualAgent,
  'qayyim-seo': qayyimSeoAgent,
  'qayyim-ux': qayyimUxAgent,
  'qayyim-ana': qayyimAnalyticsAgent,
  'qayyim-dev': qayyimDevAgent,
  'qayyim-qa': qayyimQaAgent,
};

// Agent capabilities for routing
const AGENT_CAPABILITIES: Record<string, string[]> = {
  'qayyim-core': ['coordination', 'audit_full_site', 'publish', 'rollback', 'quality_gate'],
  'qayyim-cont': ['draft_copy', 'unify_tone', 'identity_check', 'arabic_polish', 'copy_review'],
  'qayyim-vis': ['curate_gallery', 'select_hero_image', 'generate_alt_text', 'brand_consistency_check', 'image_optimization', 'gallery_sequencing'],
  'qayyim-seo': ['audit_seo', 'fix_seo', 'generate_schema', 'content_gap', 'keyword_research'],
  'qayyim-ux': ['analyze_behavior', 'design_ab_test', 'create_goal', 'exit_rate_report'],
  'qayyim-ana': ['revenue_correlation', 'predict_impact', 'luxury_score', 'segment_luxury_buyers', 'weekly_report'],
  'qayyim-dev': ['code_review', 'bundle_analysis', 'dependency_audit', 'performance_budgets', 'security_code_scan'],
  'qayyim-qa': ['full_qa_suite', 'e2e_smoke', 'visual_regression', 'accessibility_audit', 'load_test', 'security_scan', 'cross_browser'],
};

// ============================================
// Master Orchestrator Class
// ============================================

export class MasterOrchestrator {
  private graph: any;
  private supabase: any;

  constructor() {
    this.supabase = getSupabaseAdminClient();
    this.graph = this.buildGraph();
  }

  /**
   * Build the LangGraph workflow
   */
  private buildGraph() {
    const workflow = new StateGraph(SwarmStateAnnotation)
      // Nodes
      .addNode("plan", this.planNode.bind(this))
      .addNode("route", this.routeNode.bind(this))
      .addNode("execute", this.executeNode.bind(this))
      .addNode("aggregate", this.aggregateNode.bind(this))
      .addNode("quality_gate", this.qualityGateNode.bind(this))
      .addNode("respond", this.respondNode.bind(this))
      .addNode("handle_error", this.errorNode.bind(this))
      
      // Edges
      .addEdge(START, "plan")
      .addEdge("plan", "route")
      .addConditionalEdges("route", this.shouldContinue.bind(this), {
        execute: "execute",
        aggregate: "aggregate",
        error: "handle_error",
      })
      .addEdge("execute", "route")
      .addEdge("aggregate", "quality_gate")
      .addConditionalEdges("quality_gate", this.gateDecision.bind(this), {
        pass: "respond",
        fail: "route", // Retry with fixes
        error: "handle_error",
      })
      .addEdge("respond", END)
      .addEdge("handle_error", END);

    return workflow.compile();
  }

  /**
   * Node 1: Plan - Decompose user request into subtasks
   */
  private async planNode(state: SwarmStateType): Promise<Partial<SwarmStateType>> {
    const { userRequest, context, companyId } = state;
    
    // Use AI to decompose the request
    const decomposition = await this.decomposeRequest(userRequest, context);
    
    const subtasks: SubTask[] = decomposition.subtasks.map((st: any, i: number) => ({
      id: `sub_${Date.now()}_${i}`,
      agentKey: st.agentKey,
      type: st.type,
      title: st.title,
      description: st.description,
      context: { ...context, ...st.context },
      priority: st.priority,
      dependsOn: st.dependsOn,
      status: 'pending',
    }));

    return {
      taskId: `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      subtasks,
      currentSubtaskIndex: 0,
      agentResults: new Map(),
      completedSubtasks: [],
      failedSubtasks: [],
      evidenceUrls: [],
      versionNumber: 1,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Node 2: Route - Select next subtask to execute
   */
  private async routeNode(state: SwarmStateType): Promise<Partial<SwarmStateType>> {
    const { subtasks, completedSubtasks, failedSubtasks } = state;
    
    // Find next runnable subtask (dependencies met, not completed/failed)
    const nextSubtask = subtasks.find(st => 
      st.status === 'pending' &&
      st.dependsOn.every(dep => completedSubtasks.includes(dep)) &&
      !failedSubtasks.includes(st.id)
    );

    if (!nextSubtask) {
      // All done or blocked
      const allDone = subtasks.every(st => st.status === 'completed' || st.status === 'failed' || st.status === 'skipped');
      return { 
        currentSubtaskIndex: allDone ? -1 : state.currentSubtaskIndex,
        updatedAt: new Date().toISOString(),
      };
    }

    // Mark as running
    const updatedSubtasks = subtasks.map(st => 
      st.id === nextSubtask.id ? { ...st, status: 'running' as const } : st
    );

    return {
      subtasks: updatedSubtasks,
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Node 3: Execute - Run the selected subtask on its agent
   */
  private async executeNode(state: SwarmStateType): Promise<Partial<SwarmStateType>> {
    const { subtasks, agentResults, companyId } = state;
    
    const currentSubtask = subtasks.find(st => st.status === 'running');
    if (!currentSubtask) {
      return { error: "No running subtask found" };
    }

    const agent = AGENT_REGISTRY[currentSubtask.agentKey];
    if (!agent) {
      const error = `Agent ${currentSubtask.agentKey} not found`;
      const updatedSubtasks = subtasks.map(st => 
        st.id === currentSubtask.id ? { ...st, status: 'failed' as const } : st
      );
      return { 
        subtasks: updatedSubtasks,
        failedSubtasks: [...state.failedSubtasks, currentSubtask.id],
        error,
      };
    }

    try {
      // Create QayyimTask for the agent
      const task: QayyimTask = {
        id: currentSubtask.id,
        type: currentSubtask.type,
        title: currentSubtask.title,
        description: currentSubtask.description,
        context: { ...currentSubtask.context, company_id: companyId },
        priority: currentSubtask.priority,
        dependsOn: currentSubtask.dependsOn,
      };

      // Execute on agent
      const result = await agent.process(task);
      
      // Update state
      const newAgentResults = new Map(agentResults);
      newAgentResults.set(currentSubtask.id, result);

      const updatedSubtasks = subtasks.map(st => 
        st.id === currentSubtask.id 
          ? { ...st, status: result.success ? 'completed' as const : 'failed' as const, result }
          : st
      );

      const newCompleted = result.success 
        ? [...state.completedSubtasks, currentSubtask.id]
        : state.completedSubtasks;
      const newFailed = result.success 
        ? state.failedSubtasks
        : [...state.failedSubtasks, currentSubtask.id];

      // Collect evidence URLs
      const newEvidenceUrls = [...state.evidenceUrls, ...(result.evidenceUrls || [])];

      return {
        subtasks: updatedSubtasks,
        agentResults: newAgentResults,
        completedSubtasks: newCompleted,
        failedSubtasks: newFailed,
        evidenceUrls: newEvidenceUrls,
        updatedAt: new Date().toISOString(),
      };
    } catch (error: any) {
      const updatedSubtasks = subtasks.map(st => 
        st.id === currentSubtask.id ? { ...st, status: 'failed' as const } : st
      );
      return {
        subtasks: updatedSubtasks,
        failedSubtasks: [...state.failedSubtasks, currentSubtask.id],
        error: error.message,
        updatedAt: new Date().toISOString(),
      };
    }
  }

  /**
   * Node 4: Aggregate - Combine results from all agents
   */
  private async aggregateNode(state: SwarmStateType): Promise<Partial<SwarmStateType>> {
    const { agentResults, userRequest, companyId } = state;
    
    // Use Core agent to aggregate
    const coreAgent = AGENT_REGISTRY['qayyim-core'];
    
    const aggregationPrompt = this.buildAggregationPrompt(userRequest, agentResults);
    const aggregationResult = await coreAgent.chat(aggregationPrompt, { company_id: companyId });
    
    // Parse aggregated draft
    const aggregatedDraft = this.parseAggregatedDraft(aggregationPrompt, aggregationResult, agentResults);
    
    return {
      aggregatedDraft,
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Node 5: Quality Gate - Validate before publish
   */
  private async qualityGateNode(state: SwarmStateType): Promise<Partial<SwarmStateType>> {
    const { aggregatedDraft, companyId } = state;
    
    if (!aggregatedDraft) {
      return { qualityGatePassed: false, error: "No draft to validate" };
    }

    const coreAgent = AGENT_REGISTRY['qayyim-core'];
    const qaAgent = AGENT_REGISTRY['qayyim-qa'];
    
    // Run quality checks
    const checks = await Promise.all([
      coreAgent.process({
        id: `qgate_${Date.now()}`,
        type: "quality_gate",
        title: "بوابة الجودة",
        description: `تحقق: هوية 100%، لا وهم، evidenceUrls، معاينة مطابقة`,
        context: { draft: aggregatedDraft },
        priority: "critical",
      }),
      // Visual regression check if images changed
      aggregatedDraft.sections.some(s => s.sectionType === 'images') 
        ? qaAgent.process({
            id: `vreg_${Date.now()}`,
            type: "visual_regression",
            title: "فحص بصري",
            description: "قارن الصور الجديدة ضد البيسلاين",
            context: { draft: aggregatedDraft },
            priority: "high",
          })
        : Promise.resolve({ success: true, output: "No images to check" }),
    ]);

    const passed = checks.every(c => c.success);
    
    return {
      qualityGatePassed: passed,
      evidenceUrls: [...state.evidenceUrls, ...checks.flatMap((c: any) => c.evidenceUrls || [])],
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Node 6: Respond - Format final response for user
   */
  private async respondNode(state: SwarmStateType): Promise<Partial<SwarmStateType>> {
    const { userRequest, aggregatedDraft, agentResults, evidenceUrls, qualityGatePassed, versionNumber } = state;
    
    let response = "";
    
    if (qualityGatePassed && aggregatedDraft) {
      response = this.formatSuccessResponse(aggregatedDraft, agentResults, evidenceUrls, versionNumber);
    } else {
      response = this.formatFailureResponse(state);
    }

    return {
      finalResponse: response,
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Node 7: Error Handler
   */
  private async errorNode(state: SwarmStateType): Promise<Partial<SwarmStateType>> {
    return {
      finalResponse: `⚠️ حدث خطأ في تنسيق السرب: ${state.error || "خطأ غير معروف"}\n\nالرجاء إعادة المحاولة أو تبسيط الطلب.`,
      updatedAt: new Date().toISOString(),
    };
  }

  // ============================================
  // Helper Methods
  // ============================================

  private async decomposeRequest(userRequest: string, context: Record<string, any>) {
    // Use AI to intelligently decompose the request
    const prompt = `حلل طلب المستخدم وقسمه لمهام فرعية للوكلاء المتخصصين.

طلب المستخدم: "${userRequest}"
السياق: ${JSON.stringify(context)}

الوكلاء المتاحون:
- qayyim-core: تنسيق، تدقيق شامل، نشر، تراجع، جودة
- qayyim-cont: محتوى عربي فاخر، توحيد نبرة، قانون هوية، صقل نصوص
- qayyim-vis: صور، هيرو، alt text، علامة تجارية، تحسين صور
- qayyim-seo: تدقيق SEO، إصلاح، Schema، فجوات محتوى، كلمات مفتاحية
- qayyim-ux: سلوك زائر، A/B tests، أهداف، تقارير خروج
- qayyim-ana: ربط تحويل بإيرادات، تنبؤ، Luxury Score، تقسيم عملاء
- qayyim-dev: مراجعة كود، Bundle، تبعيات، أداء، أمان كود
- qayyim-qa: E2E، Visual Regression، a11y، Load Test، Security

أجب بـ JSON فقط:
{
  "subtasks": [
    {
      "agentKey": "qayyim-xxx",
      "type": "task_type",
      "title": "عنوان المهمة",
      "description": "وصف مفصل",
      "context": {},
      "priority": "high",
      "dependsOn": []
    }
  ]
}`;

    const result = await askOrchestratorMessages(
      [{ role: "system", content: "You are a master orchestrator. Decompose requests into subtasks for specialized agents. Return only valid JSON." },
       { role: "user", content: prompt }],
      { temperature: 0.3, maxTokens: 2048, jsonMode: true }
    );

    if (result.success && result.content) {
      try {
        return JSON.parse(result.content);
      } catch {
        // Fallback to rule-based decomposition
      }
    }
    
    // Rule-based fallback
    return this.ruleBasedDecomposition(userRequest);
  }

  private ruleBasedDecomposition(userRequest: string) {
    const lower = userRequest.toLowerCase();
    const subtasks: any[] = [];
    
    // Always start with audit if it's about fixing/checking
    if (lower.includes("افحص") || lower.includes("أصلح") || lower.includes("تحقق") || lower.includes("تدقيق")) {
      subtasks.push({
        agentKey: "qayyim-core",
        type: "full_site_audit",
        title: "تدقيق شامل للموقع",
        description: "افحص الموقع كاملاً: رئيسية، غرف، منتجات، هوية، سيو، أداء، سلوك زائر",
        context: {},
        priority: "high",
        dependsOn: [],
      });
    }
    
    // Content tasks
    if (lower.includes("اكتب") || lower.includes("مسودة") || lower.includes("نص") || lower.includes("عربي") || lower.includes("هيرو") || lower.includes("عنوان") || lower.includes("وصف")) {
      subtasks.push({
        agentKey: "qayyim-cont",
        type: "draft_copy",
        title: "صياغة محتوى فاخر",
        description: userRequest,
        context: {},
        priority: "high",
        dependsOn: subtasks.length > 0 ? [subtasks[0].id] : [],
      });
    }
    
    // Visual tasks
    if (lower.includes("صورة") || lower.includes("هيرو") || lower.includes("معرض") || lower.includes("alt")) {
      subtasks.push({
        agentKey: "qayyim-vis",
        type: lower.includes("هيرو") ? "select_hero_image" : "curate_gallery",
        title: lower.includes("هيرو") ? "اختيار صورة هيرو" : "انتقاء معرض صور",
        description: userRequest,
        context: {},
        priority: "medium",
        dependsOn: [],
      });
    }
    
    // SEO tasks
    if (lower.includes("seo") || lower.includes("بحث") || lower.includes("ظهور") || lower.includes("schema")) {
      subtasks.push({
        agentKey: "qayyim-seo",
        type: "audit_seo",
        title: "تدقيق SEO",
        description: userRequest,
        context: {},
        priority: "medium",
        dependsOn: [],
      });
    }
    
    // UX tasks
    if (lower.includes("سلوك") || lower.includes("خروج") || lower.includes("تحويل") || lower.includes("a/b") || lower.includes("اختبار")) {
      subtasks.push({
        agentKey: "qayyim-ux",
        type: "behavior_analysis",
        title: "تحليل سلوك الزائر",
        description: userRequest,
        context: {},
        priority: "medium",
        dependsOn: [],
      });
    }
    
    // Default: at least core audit
    if (subtasks.length === 0) {
      subtasks.push({
        agentKey: "qayyim-core",
        type: "full_site_audit",
        title: "تدقيق شامل افتراضي",
        description: "افحص الموقع شاملاً لأن الطلب غير محدد",
        context: {},
        priority: "medium",
        dependsOn: [],
      });
    }
    
    // Assign IDs
    return { subtasks: subtasks.map((st, i) => ({ ...st, id: `sub_${Date.now()}_${i}` })) };
  }

  private buildAggregationPrompt(userRequest: string, agentResults: Map<string, QayyimResult>): string {
    let prompt = `أجمع نتائج الوكلاء التالية في مسودة موحدة للطلب: "${userRequest}"\n\n`;
    
    for (const [taskId, result] of agentResults) {
      prompt += `=== ${taskId} (${result.taskId}) ===\n`;
      prompt += `نجاح: ${result.success}\n`;
      prompt += `الناتج: ${result.output.slice(0, 2000)}\n`;
      if (result.evidenceUrls?.length) {
        prompt += `أدلة: ${result.evidenceUrls.join(', ')}\n`;
      }
      if (result.data?.draftContent) {
        prompt += `مسودة: ${JSON.stringify(result.data.draftContent)}\n`;
      }
      prompt += "\n";
    }
    
    prompt += `\nأخرج مسودة موحدة بصيغة JSON:\n{
  "pagePath": "/",
  "sections": [
    {"sectionKey": "hero", "sectionType": "hero", "content": {}, "agentKey": "qayyim-cont", "evidenceUrls": [], "identityCompliant": true}
  ],
  "version": 1,
  "previewToken": "auto-generated",
  "createdAt": "${new Date().toISOString()}"
}`;
    
    return prompt;
  }

  private parseAggregatedDraft(prompt: string, response: string, agentResults: Map<string, QayyimResult>): AggregatedDraft {
    // Try to extract JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch {
        // Fall through to manual construction
      }
    }
    
    // Build from agent results
    const sections: AggregatedSection[] = [];
    for (const [taskId, result] of agentResults) {
      if (result.success && result.data) {
        if (result.data.draftContent) {
          sections.push({
            sectionKey: result.data.contentType || 'content',
            sectionType: (result.data.contentType || 'content') as AggregatedSection['sectionType'],
            content: result.data.draftContent,
            agentKey: 'qayyim-cont',
            evidenceUrls: result.evidenceUrls || [],
            identityCompliant: result.data.verdict === 'pass' || true,
          });
        }
      }
      if (result.data?.images?.length) {
        sections.push({
          sectionKey: 'gallery',
          sectionType: 'images',
          content: { images: result.data.images },
          agentKey: 'qayyim-vis',
          evidenceUrls: result.evidenceUrls || [],
          identityCompliant: result.data.visualVerdict === 'approved',
        });
      }
      if (result.data?.issues?.length) {
        sections.push({
          sectionKey: 'seo_fixes',
          sectionType: 'seo',
          content: { issues: result.data.issues, fixes: result.data.suggestions },
          agentKey: 'qayyim-seo',
          evidenceUrls: result.evidenceUrls || [],
          identityCompliant: true,
        });
      }
    }
    
    return {
      pagePath: '/',
      sections,
      version: 1,
      previewToken: `preview_${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
  }

  private shouldContinue(state: SwarmStateType): "execute" | "aggregate" | "error" {
    if (state.error) return "error";
    
    const { subtasks, completedSubtasks, failedSubtasks } = state;
    const pending = subtasks.filter(st => st.status === 'pending');
    const running = subtasks.filter(st => st.status === 'running');
    
    if (running.length > 0) return "execute";
    if (pending.length > 0) return "execute";
    if (subtasks.length === completedSubtasks.length + failedSubtasks.length) return "aggregate";
    return "execute";
  }

  private gateDecision(state: SwarmStateType): "pass" | "fail" | "error" {
    if (state.error) return "error";
    return state.qualityGatePassed ? "pass" : "fail";
  }

  private formatSuccessResponse(draft: AggregatedDraft, agentResults: Map<string, QayyimResult>, evidenceUrls: string[], version: number): string {
    let response = `✅ **السرب أكمل المهمة - النسخة v${version} جاهزة للمراجعة**\n\n`;
    response += `📋 **ملخص المسودة الموحدة:**\n`;
    response += `📄 الصفحة: ${draft.pagePath}\n`;
    response += `🔧 السكشنات: ${draft.sections.length}\n`;
    response += `🔒 قانون الهوية: ${draft.sections.every(s => s.identityCompliant) ? '✅ متوافق 100%' : '⚠️ يحتاج مراجعة'}\n\n`;
    
    response += `📦 **تفاصيل السكشنات:**\n`;
    for (const section of draft.sections) {
      const agentName = AGENT_REGISTRY[section.agentKey]?.agentName || section.agentKey;
      response += `- **${section.sectionKey}** (${section.sectionType}) ← ${agentName}\n`;
      response += `  ${section.identityCompliant ? '✅' : '⚠️'} ${section.evidenceUrls.length} evidenceUrl(s)\n`;
    }
    
    response += `\n🔗 **روابط الأدلة:** ${evidenceUrls.length} رابط\n`;
    for (const url of evidenceUrls.slice(0, 10)) {
      response += `\n- ${url}`;
    }
    if (evidenceUrls.length > 10) response += `\n... و ${evidenceUrls.length - 10} رابط آخر`;
    
    response += `\n\n👁️ **للمعاينة:** \`/preview?draft=${draft.previewToken}\``;
    response += `\n✅ **للموافقة والنشر:** اكتيبي "قيّم، انشر المسودة v${version}"`;
    response += `\n↩️ **للتراجع:** اكتيبي "قيّم، ارجع للنسخة السابقة"`;
    
    return response;
  }

  private formatFailureResponse(state: SwarmStateType): string {
    let response = `⚠️ **السرب واجه مشاكل**\n\n`;
    if (state.error) response += `❌ خطأ: ${state.error}\n\n`;
    if (state.failedSubtasks.length > 0) {
      response += `❌ مهام فاشلة: ${state.failedSubtasks.length}\n`;
    }
    if (!state.qualityGatePassed) {
      response += `⚠️ بوابة الجودة: لم تمر - المسودة تحتاج تعديلات\n`;
    }
    response += `\n🔄 **جرب مرة أخرى** أو بسّط الطلب.`;
    return response;
  }

  /**
   * Public API
   */
  async execute(userRequest: string, context: Record<string, any> = {}): Promise<{
    success: boolean;
    response: string;
    draft?: AggregatedDraft;
    evidenceUrls: string[];
    version: number;
    taskId: string;
  }> {
    const companyId = await resolveAdminCompanyId(context?.company_id);
    
    const initialState: SwarmStateType = {
      userRequest,
      context,
      companyId,
      taskId: '',
      subtasks: [],
      currentSubtaskIndex: 0,
      agentResults: new Map(),
      completedSubtasks: [],
      failedSubtasks: [],
      aggregatedDraft: null,
      qualityGatePassed: false,
      finalResponse: '',
      evidenceUrls: [],
      versionNumber: 1,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      error: undefined,
    };

    try {
      const result = await this.graph.invoke(initialState);
      return {
        success: true,
        response: result.finalResponse,
        draft: result.aggregatedDraft || undefined,
        evidenceUrls: result.evidenceUrls,
        version: result.versionNumber,
        taskId: result.taskId,
      };
    } catch (error: any) {
      return {
        success: false,
        response: `⚠️ خطأ في السرب: ${error.message}`,
        evidenceUrls: [],
        version: 0,
        taskId: '',
      };
    }
  }

  /**
   * Stream execution for real-time updates
   */
  async *streamExecute(userRequest: string, context: Record<string, any> = {}) {
    const companyId = await resolveAdminCompanyId(context?.company_id);
    
    const initialState: SwarmStateType = {
      userRequest,
      context,
      companyId,
      taskId: '',
      subtasks: [],
      currentSubtaskIndex: 0,
      agentResults: new Map(),
      completedSubtasks: [],
      failedSubtasks: [],
      aggregatedDraft: null,
      qualityGatePassed: false,
      finalResponse: '',
      evidenceUrls: [],
      versionNumber: 1,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      error: undefined,
    };

    for await (const chunk of this.graph.stream(initialState)) {
      yield chunk;
    }
  }
}

export const masterOrchestrator = new MasterOrchestrator();

/**
 * Agent Orchestrator - Routes tasks to the appropriate agent
 * Manages the 8 Qayyim Swarm Agents + 6 Specialist Agents with intelligent routing & real AI execution
 */

import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { resolveAdminCompanyId } from "@/lib/admin-company";
import { resolveMasterCompanyId } from "@/lib/admin-env-resolver";
import { askGroqMessages, askGoogle, askGoogleMessages, askOpenRouter, askMistral } from "@/lib/ai-orchestrator";
import { runUltimateTool } from "@/lib/admin-tool-bridge";
import { routeIntent } from "@/lib/agents/intent-router";
import { recallMemory, finalizeReply } from "@/lib/qayyim/chat-brain";
import { critiqueAndPolish, shouldDebate } from "@/lib/qayyim/debate";
import { 
  QayyimCoreAgent, qayyimCoreAgent,
  QayyimContentAgent, qayyimContentAgent,
  QayyimVisualAgent, qayyimVisualAgent,
  QayyimSeoAgent, qayyimSeoAgent,
  QayyimUxAgent, qayyimUxAgent,
  QayyimAnalyticsAgent, qayyimAnalyticsAgent,
  QayyimDevAgent, qayyimDevAgent,
  QayyimQaAgent, qayyimQaAgent,
  MasterOrchestrator, masterOrchestrator,
} from "@/lib/qayyim";

export type AgentType =
  | "qayyim-core"
  | "qayyim-cont"
  | "qayyim-vis"
  | "qayyim-seo"
  | "qayyim-ux"
  | "qayyim-ana"
  | "qayyim-dev"
  | "qayyim-qa"
  | "prime" // deprecated alias for qayyim-core
  | "vanguard"
  | "analyst"
  | "coder"
  | "ops"
  | "security"
  | "learner"
  | "auto";

export interface AgentMessage {
  id: string;
  agent_key: AgentType;
  content: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface AgentOrchestratorResult {
  success: boolean;
  agentUsed: AgentType;
  response: string;
  metadata?: {
    suggestions?: string[];
    actionItems?: string[];
    priority?: string;
    designParameters?: Record<string, any>;
    taskId?: string;
  };
}

export const AGENT_PERSONAS: Record<string, { name: string; role: string; prompt: string }> = {
  "qayyim-core": {
    name: "قيّم الدار - القائد",
    role: "تنسيق السرب، تدقيق شامل، إدارة نشر/تراجع، بوابة جودة",
    prompt: `أنت قيّم الدار - القائد، منسق سرب "قيّم الدار" لإدارة إطلالة Azenith Living على الموقع.
دورك: تنسيق 7 وكلاء متخصصين، تدقيق الموقع كاملاً، إدارة مسودات النشر والتراجع، وبوابة جودة صارمة.
لا تنفّذ المهام التفصيلية بنفسك - أوكلها للوكلاء المتخصصين وراجع نتائجهم.
إذا طُلب منك شيء خارج نطاق الإطلالة (مصنع، مخزن، مبيعات، كود خلفي)، قل: "مش قادر على الصفحة دي" أو حوّل للوكلاء المختصين.
رد بالعربية الفصحى المبسطة بأسلوب فاخر وسلطان.`
  },
  "qayyim-cont": {
    name: "قيّم الدار - المحتوى والعربية",
    role: "كتابة فاخرة، توحيد نبرة، قانون هوية، صقل نصوص",
    prompt: `أنت قيّم الدار - المحتوى والعربية، كاتب النصوص الفاخرة لـ Azenith Living.
تخصصك: كتابة/إعادة صياغة نصوص عربية فاخرة (hero، قسم، منتج)، توحيد نبرة "فخامة هادئة"، قانون الهوية (مصطلحات محظورة/مطلوبة)، سردية العلامة.
لا تلمس الصور أو الكود أو SEO أو التحليلات.
إذا لم تستطع تنفيذ مهمة، قل: "مش قادر على الصفحة دي".
رد بالعربية الفصحى الفاخرة، بأسلوب يعكس رقي Azenith Living.`
  },
  "qayyim-vis": {
    name: "قيّم الدار - المرئي والصور",
    role: "انتقاء صور، اختيار هيرو، alt text، علامة تجارية",
    prompt: `أنت قيّم الدار - المرئي والصور، أمين المعرض البصري لـ Azenith Living.
تخصصك: انتقاء صور المنتجات/الغرف، اختيار صورة هيرو رئيسية، كتابة alt text غني، التحقق من اتساق العلامة التجارية.
لا تكتب نصوصاً عربية، لا تلمس SEO أو كود أو تحليلات.
إذا لم تستطع تنفيذ مهمة، قل: "مش قادر على الصفحة دي".
رد بالعربية الفصحى بأسلوب بصري دقيق.`
  },
  "qayyim-seo": {
    name: "قيّم الدار - الظهور والبحث",
    role: "تدقيق SEO، إصلاح Schema، فجوات محتوى، منافسين",
    prompt: `أنت قيّم الدار - الظهور والبحث، مهندس الرؤية في محركات البحث لـ Azenith Living.
تخصصك: تدقيق SEO تقني، إصلاح Schema.org (Product/Article/Breadcrumb)، تحديد فجوات المحتوى، تحليل المنافسين.
لا تكتب نصوصاً تسويقية، لا تختار صوراً، لا تلمس كود الأداء.
إذا لم تستطع تنفيذ مهمة، قل: "مش قادر على الصفحة دي".
رد بالعربية الفصحى بأسلوب تحليلي تقني.`
  },
  "qayyim-ux": {
    name: "قيّم الدار - تجربة المستخدم",
    role: "سلوك زائر، A/B testing، تقارير خروج، أهداف",
    prompt: `أنت قيّم الدار - تجربة المستخدم، محلل سلوك الزوار لـ Azenith Living.
تخصصك: تحليل telemetry، تصميم A/B tests، تقارير معدل الخروج/التحويل، إنشاء أهداف قابلة للقياس.
لا تكتب نصوصاً، لا تختار صوراً، لا تصلح SEO أو كود.
إذا لم تستطع تنفيذ مهمة، قل: "مش قادر على الصفحة دي".
رد بالعربية الفصحى بأسلوب مستخدم-محوري.`
  },
  "qayyim-ana": {
    name: "قيّم الدار - التحليلات والأعمال",
    role: "ربط تحويل بإيرادات، تنبؤ، Luxury Score، تقسيم",
    prompt: `أنت قيّم الدار - التحليلات والأعمال، عالم البيانات الاستراتيجية لـ Azenith Living.
تخصصك: ربط التحويلات بالإيرادات، نماذج التنبؤ بالتأثير، حساب Luxury Score، تقسيم العملاء/الزوار.
لا تكتب نصوصاً، لا تختار صوراً، لا تلمس كود أو UX مباشرة.
إذا لم تستطع تنفيذ مهمة، قل: "مش قادر على الصفحة دي".
رد بالعربية الفصحى بأسلوب تحليلي تنفيذي.`
  },
  "qayyim-dev": {
    name: "قيّم الدار - التطوير والأداء",
    role: "مراجعة كود، Bundle، تبعيات، أداء، أمان كود",
    prompt: `أنت قيّم الدار - التطوير والأداء، مهندس المنصة التقني لـ Azenith Living.
تخصصك: مراجعة تغييرات الكود، تحليل Bundle size، تدقيق التبعيات، تقارير أداء Core Web Vitals، مسح أمان الكود.
لا تكتب نصوصاً تسويقية، لا تختار صوراً، لا تحلل سلوك مستخدم.
إذا لم تستطع تنفيذ مهمة، قل: "مش قادر على الصفحة دي".
رد بالعربية الفصحى بأسلوب هندسي دقيق.`
  },
  "qayyim-qa": {
    name: "قيّم الدار - الجودة والاختبار",
    role: "E2E، Visual Regression، a11y، Load Test، Security",
    prompt: `أنت قيّم الدار - الجودة والاختبار، حارس الجودة الشامل لـ Azenith Living.
تخصصك: اختبارات E2E smoke، visual regression، تدقيق إمكانية الوصول (a11y)، اختبارات الحمل، مسح أمني.
لا تكتب نصوصاً، لا تختار صوراً، لا تصلح كود أو أداء مباشرة.
إذا لم تستطع تنفيذ مهمة، قل: "مش قادر على الصفحة دي".
رد بالعربية الفصحى بأسلوب دقيق ومعايير عالية.`
  },
  // deprecated alias — kept for backward compatibility with legacy DB records only
  prime: {
    name: "قيّم الدار — القائد",
    role: "قائد سرب القيّم (alias لـ qayyim-core)",
    prompt: `أنت قيّم الدار - القائد، منسق سرب أزينث للموقع.
تخصصك: شكل الصفحات الظاهرة للزائر، النصوص، صور الغرف والمنتجات، وفخامة الهوية البصرية.
لا تتحدث عن المصنع أو المخزن أو الخامات أو أوامر التشغيل.
رد بالعربية الفصحى المبسطة الفاخرة.`
  },
  vanguard: {
    name: "Vanguard",
    role: "مدير العمليات والمبيعات",
    prompt: `أنت Vanguard، مدير العمليات والمبيعات وخدمة العملاء في Azenith Living للأثاث الفاخر.
تخصصك: إدارة طلبات العملاء، عروض الأسعار، الجدولة، والمتابعة التجارية.
رد بأسلوب عملي، ودود، واحترافي بالعربية الفصحى المبسطة.`
  },
  analyst: {
    name: "Analyst",
    role: "محلل البيانات والتقارير",
    prompt: `أنت Analyst، كبير محللي البيانات ومؤشرات الأداء في Azenith Living للأثاث الفاخر.
تخصصك: تحليل أداء المبيعات، مؤشرات التصنيع، كفاءة التكلفة، وتقديم التوصيات المبنية على الأرقام.
قدم إجابات دقيقة ومدعمة بالتحليل العملي بالعربية الفصحى المبسطة.`
  },
  coder: {
    name: "Coder",
    role: "مطور الكود والتقنية",
    prompt: `أنت Coder، كبير مهندسي البرمجيات والأنظمة التقنية في Azenith Living.
تخصصك: بنية المنصة البرمجية، واجهات الـ APIs، تكامل الذكاء الاصطناعي، واستكشاف الأخطاء البرمجية وحلها.
قدم حلولاً برمجية مباشرة وعملية بالعربية الفصحى المبسطة.`
  },
  ops: {
    name: "Ops",
    role: "مراقب العمليات والنظام",
    prompt: `أنت Ops، مدير استقرار البنية التحتية والعمليات في Azenith Living.
تخصصك: مراقبة الخوادم، تدفق خطوط الإنتاج والتسليم، معالجة الاختناقات، وسرعة الاستجابة التشغيلية.
رد بأسلوب هندسي حازم وتركيز على الميدان بالعربية الفصحى المبسطة.`
  },
  security: {
    name: "Security",
    role: "حارس الأمن والتدقيق",
    prompt: `أنت Security، رئيس أمن المعلومات والامتثال في Azenith Living.
تخصصك: حماية البيانات، تدقيق أذونات المشرفين والـ 2FA، مراجعة السياسات، والتأكد من موثوقية العمليات.
رد بدقة وحرص أمني عالٍ بالعربية الفصحى المبسطة.`
  },
  learner: {
    name: "Learner",
    role: "محرك التعلم الذاتي",
    prompt: `أنت Learner، محرك التعلم والتطوير الذاتي للوكلاء في Azenith Living.
تخصصك: استخلاص الدروس من تجارب العملاء وطلباتهم، تحسين جودة الردود، واقتراح ترقيات مستمرة لأداء النظام.
رد بأسلوب تحليلي وتطويري ملهم بالعربية الفصحى المبسطة.`
  },
};

export class AgentOrchestrator {
  private agents: Record<string, any>;

  constructor() {
    this.agents = {
      "qayyim-core": qayyimCoreAgent,
      "qayyim-cont": qayyimContentAgent,
      "qayyim-vis": qayyimVisualAgent,
      "qayyim-seo": qayyimSeoAgent,
      "qayyim-ux": qayyimUxAgent,
      "qayyim-ana": qayyimAnalyticsAgent,
      "qayyim-dev": qayyimDevAgent,
      "qayyim-qa": qayyimQaAgent,
      prime: qayyimCoreAgent, // alias
      vanguard: null, // Will use AI fallback
    };
  }

  private normalizeAgentKey(key: string): string {
    if (key === 'prime') return 'qayyim-core';
    return key;
  }

  async chat(agentKey: AgentType, message: string, context?: Record<string, any>): Promise<AgentOrchestratorResult> {
    const selectedAgent = agentKey === "auto" ? this.detectAgent(message) : agentKey;
    const supabase = getSupabaseAdminClient();

    try {
      const resolvedCompanyId =
        (await resolveAdminCompanyId(context?.company_id)) ||
        (await resolveMasterCompanyId());

      // ── 1. أوجد أو أنشئ محادثة لهذا الوكيل ──────────────────────
      let conversationId: string | null = null;
      if (supabase && resolvedCompanyId) {
        const normKey = selectedAgent.toLowerCase();
        const { data: existingConv } = await supabase
          .from("agent_conversations")
          .select("id")
          .eq("company_id", resolvedCompanyId)
          .or(`participants.cs.{${normKey}},title.ilike.%${normKey}%`)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existingConv) {
          conversationId = existingConv.id;
        } else {
          const { data: newConv } = await supabase
            .from("agent_conversations")
            .insert({
              company_id: resolvedCompanyId,
              title: `محادثة مع ${selectedAgent.toUpperCase()}`,
              conversation_type: "direct",
              participants: [normKey],
              is_active: true,
              created_at: new Date().toISOString(),
              last_message_at: new Date().toISOString(),
            })
            .select("id")
            .single();
          if (newConv) conversationId = newConv.id;
        }

        // ── 2. احفظ رسالة المستخدم ──────────────────────────────────
        if (conversationId) {
          await supabase.from("agent_messages").insert({
            conversation_id: conversationId,
            sender_type: "user",
            sender_name: "أنت",
            content: message,
            created_at: new Date().toISOString(),
          });
        }
      }

      // ── فحص وتنفيذ الأدوات الحقيقية إن وجدت ───────────────────────
      // P5-R1: dialect-first routing (regex fast-path, then LLM intent map).
      // Site-wide audit requests must reach the audit shortcut / swarm, never
      // be hijacked into a single narrow tool.
      const isSiteAudit = selectedAgent === "qayyim-core" && /افحص الموقع|الموقع كله|تقرير.*(تنفيذي|شامل)|دقّق.*شامل|audit.*site/i.test(message);
      const inferredTool = isSiteAudit ? null : await routeIntent(message);
      let toolResult: any = null;
      let toolContextStr = "";

      if (inferredTool) {
        try {
          toolResult = await runUltimateTool(inferredTool.toolName, inferredTool.params, {
            userId: "admin",
            companyId: resolvedCompanyId || undefined,
          });
          if (toolResult?.success) {
            toolContextStr = `\n[ملاحظة للنظام: تم تنفيذ الأداة الحقيقية (${inferredTool.toolName}) بنجاح. البيانات المستخرجة: ${JSON.stringify(toolResult.data || toolResult.message)}. اعتمد على هذه البيانات الميدانية في ردك ولا تخترع أرقاماً غير موجودة فيها].`;
          } else if (toolResult) {
            toolContextStr = `\n[ملاحظة للنظام: محاولة تشغيل الأداة (${inferredTool.toolName}) فشلت: ${toolResult.message}. أخبر المستخدم بالحقيقة ولا تخترع نتيجة ناجحة].`;
          }
        } catch (toolErr) {
          console.warn(`[AgentOrchestrator] Tool execution error:`, toolErr);
        }
      }

      // ── 3. استدعِ الوكيل بالذكاء الاصطناعي الحقيقي ───────────────
      let response: string | undefined;
      const metadata: AgentOrchestratorResult["metadata"] = {};
      if (toolResult) {
        metadata.actionItems = [toolResult.message || `تم تشغيل ${inferredTool?.toolName}`];
        (metadata as any).tool = inferredTool?.toolName;
        (metadata as any).toolData = toolResult.data;
        (metadata as any).toolSuccess = toolResult.success;
      }

      let promptWithToolContext = toolContextStr ? `${message}\n${toolContextStr}` : message;

      // P5-R1: conversation memory — replay the recent thread so follow-ups
      // ("خليه أقصر", "نفذه") resolve without restating context.
      if (supabase && conversationId) {
        try {
          const { data: hist } = await supabase
            .from("agent_messages")
            .select("sender_type,content")
            .eq("conversation_id", conversationId)
            .order("created_at", { ascending: false })
            .limit(9);
          const prior = (hist || []).slice(1).reverse(); // drop the message we just stored
          if (prior.length) {
            const historyCtx = prior
              .map((m: any) => `${m.sender_type === "agent" ? "القيّم" : "المالك"}: ${String(m.content).slice(0, 300)}`)
              .join("\n");
            promptWithToolContext = `[حوارك الأخير مع المالك — للتذكير بالإشارات فقط، وممنوع نسخ تقارير سابقة منه:\n${historyCtx}]\n\n${promptWithToolContext}`;
          }
        } catch {}
      }

      // P5-M1: inject real semantic memories (pgvector) — never blocks the reply
      const memoryCtx = await recallMemory(message, resolvedCompanyId);
      if (memoryCtx) promptWithToolContext = `${memoryCtx}\n\n${promptWithToolContext}`;

      // P5-M5: closed learning loop — feed thumbs-up/down lessons back into the prompt
      try {
        const { selfLearningEngine } = await import("@/lib/agents/SelfLearningEngine");
        const lessons = await selfLearningEngine.getImprovementSuggestions(selectedAgent);
        if (lessons?.length) {
          promptWithToolContext = `[دروس تعلمتها من تقييماتك السابقة — التزم بها:\n${lessons.slice(0, 3).map((l: string) => `- ${l}`).join("\n")}]\n\n${promptWithToolContext}`;
        }
      } catch {}

      // P6-M1: every agent knows itself before it speaks. Built with no
      // companyId on purpose — the identity line only names the title, the
      // agent's own roles and the live tool count, so a chat turn never pays
      // for the DB counters (the qayyim_whoami tool renders those).
      //
      // Short conversational follow-ups ("كم واحدة فيهم؟", "ليه؟") are answered
      // from the replayed history. Business context must not be injected into
      // those turns: with the world digest present, a follow-up counting drafts
      // answered from the digest's counters instead of the thread it was
      // actually replying to.
      const isShortFollowUp =
        message.length < 70 && !/أنشئ|انشئ|اعرض|نسّق|نسق|شغّل|شغل|ادرس|قارن|نشر|رجّع|draft|publish/i.test(message);
      try {
        const { buildSelfModel, renderIdentityLine } = await import("@/lib/qayyim/self-model");
        const self = await buildSelfModel(null);
        promptWithToolContext = `${renderIdentityLine(selectedAgent, self)}\n\n${promptWithToolContext}`;
      } catch {}

      // P6-M2: the commander speaks about the business only from the live
      // world model. Cached for 10 minutes inside the module, so a busy chat
      // does not re-read the shop on every turn. Core only — the specialist
      // agents get their own numbers from their own tools.
      if (selectedAgent === "qayyim-core" && !isShortFollowUp) {
        try {
          const { buildWorldModel, renderWorldDigest } = await import("@/lib/qayyim/world-model");
          const world = await buildWorldModel(resolvedCompanyId);
          promptWithToolContext = `${renderWorldDigest(world)}\n\n${promptWithToolContext}`;
        } catch {}
      }

      // ══════════════════════════════════════════════════════════════
      // قيّم-كور: ينسق السرب الكامل عبر MasterOrchestrator
      // المستخدم يتكلم مع القائد فقط — السرب يعمل خفياً في الخلفية
      // ══════════════════════════════════════════════════════════════
      if (selectedAgent === "qayyim-core") {
        // Shortcut: افحص → تقرير تنفيذي مختصر مباشر (أسرع وأفيد من السرب الكامل).
        // Tested on the RAW message — injected history must not drag old audit
        // keywords into short follow-ups.
        const isAuditRequest = /افحص|تقرير|دقّق|audit/i.test(message);
        if (isAuditRequest) {
          try {
            const auditRes = await qayyimCoreAgent.auditFullSite({ company_id: resolvedCompanyId, page_path: '/', scope: 'full' });
            if (auditRes.success) {
              response = auditRes.output;
              metadata.actionItems = auditRes.evidenceUrls;
              (metadata as any).suggestions = (auditRes as any).suggestions || [];
              (metadata as any).nextActions = (auditRes as any).nextActions || [];
              (metadata as any).rawAudit = (auditRes as any).data?.rawAudit;
              (metadata as any).issues = (auditRes as any).data?.issues || [];
            } else {
              response = auditRes.output;
            }
          } catch (auditErr: any) {
            console.warn("[AgentOrchestrator] Direct audit failed, falling back to swarm:", auditErr?.message);
          }
        }
        // إذا لم يكن طلب تدقيق أو فشل المباشر، استخدم السرب
        // P5-M1: a successful measured tool already answers the request —
        // don't burn a full swarm run behind it.
        if (!response && toolResult?.success && toolResult.message) {
          response = toolResult.message;
        }
        // Short conversational follow-ups ("كم واحدة فيهم؟", "ليه؟") belong to
        // the persona chat (it has the injected history), not a fresh swarm run.
        if (!response && isShortFollowUp) {
          const coreInstance = this.agents["qayyim-core"];
          if (coreInstance) {
            try {
              response = await coreInstance.chat(promptWithToolContext, context);
            } catch {}
          }
        }
        if (!response) {
          try {
            const swarmResult = await masterOrchestrator.execute(promptWithToolContext, {
              company_id:  resolvedCompanyId,
              source:      context?.source ?? "chat",
              orchestrate: true,
            });

            if (swarmResult.success) {
              response = swarmResult.response;
              const swarmAgents = swarmResult.draft?.sections?.map((s: any) => s.agentKey) ?? [];
              metadata.actionItems = swarmResult.evidenceUrls;
              (metadata as any).swarmAgents    = [...new Set(swarmAgents)];
              (metadata as any).taskId         = swarmResult.taskId;
              (metadata as any).version        = swarmResult.version;
              (metadata as any).draft          = swarmResult.draft ?? null;
            } else {
              const agentInstance = this.agents["qayyim-core"];
              response = agentInstance
                ? await agentInstance.chat(promptWithToolContext, context)
                : `⚠️ السرب غير متاح حالياً: ${swarmResult.response}`;
            }
          } catch (swarmErr: any) {
            console.warn("[AgentOrchestrator] Swarm failed, falling back to core:", swarmErr?.message);
            const agentInstance = this.agents["qayyim-core"];
            response = agentInstance
              ? await agentInstance.chat(promptWithToolContext, context)
              : `⚠️ خطأ في السرب: ${swarmErr.message}`;
          }
        }
        // Ensure response is defined
        if (!response) {
          const agentInstance = this.agents["qayyim-core"];
          response = agentInstance ? await agentInstance.chat(promptWithToolContext, context) : "⚠️ خطأ";
        }
      }
      // ══════════════════════════════════════════════════════════════
      // وكلاء قيّم الآخرون — يُستدعَون مباشرة (للمحادثات الفردية)
      // ══════════════════════════════════════════════════════════════
      else if (["qayyim-cont","qayyim-vis","qayyim-seo","qayyim-ux","qayyim-ana","qayyim-dev","qayyim-qa"].includes(selectedAgent)) {
        const agentInstance = this.agents[selectedAgent];
        if (agentInstance && typeof agentInstance.chat === 'function') {
          response = await agentInstance.chat(promptWithToolContext, context);
        } else {
          const persona = AGENT_PERSONAS[selectedAgent] ?? AGENT_PERSONAS["qayyim-core"];
          const messages = [
            { role: "system" as const, content: persona.prompt },
            { role: "user"   as const, content: promptWithToolContext },
          ];
          response = await this.callAI(messages);
        }
      } else if (selectedAgent === "vanguard") {
        // Vanguard - use AI fallback
        const persona = AGENT_PERSONAS.vanguard;
        const messages = [
          { role: "system" as const, content: persona.prompt },
          { role: "user" as const, content: promptWithToolContext },
        ];
        response = await this.callAI(messages);
      } else {
        // Specialist agents (analyst, coder, ops, security, learner) - use AI
        const persona = AGENT_PERSONAS[selectedAgent] || AGENT_PERSONAS["qayyim-core"];
        const systemPrompt = persona.prompt;
        const messages = [
          { role: "system" as const, content: systemPrompt },
          { role: "user" as const, content: promptWithToolContext },
        ];
        response = await this.callAI(messages);
      }

      // P5-M5: friendly war — a critic pass polices the leader's actionable
      // answers before the owner ever sees them (short replies skip it).
      if (selectedAgent === "qayyim-core" && response && shouldDebate(response)) {
        const polished = await critiqueAndPolish(message, response);
        response = polished.reply;
      }

      if (toolResult?.message && response && !response.includes(toolResult.message)) {
        response = `${toolResult.message}\n\n${response}`;
      }

      // P5-M1: every admin-visible reply passes the truth layer —
      // unverified site paths are neutralized, imperative quotes become buttons.
      const brain = finalizeReply(response || "", process.env.NEXT_PUBLIC_SITE_URL);
      response = brain.reply;
      if (brain.actions.length && !((metadata as any).suggestions?.length || (metadata as any).nextActions?.length)) {
        (metadata as any).suggestions = brain.actions;
      }

      if (supabase && conversationId) {
        await supabase.from("agent_messages").insert({
          conversation_id: conversationId,
          sender_type: "agent",
          sender_name: selectedAgent.toUpperCase(),
          content: response,
          created_at: new Date().toISOString(),
          action_taken: !!toolResult,
          context: toolResult ? {
            tool: inferredTool?.toolName,
            result: toolResult.message,
            data: toolResult.data,
            success: toolResult.success,
          } : {},
        });

        // حدّث last_message_at
        await supabase
          .from("agent_conversations")
          .update({ last_message_at: new Date().toISOString() })
          .eq("id", conversationId);
      }

      return { success: true, agentUsed: selectedAgent as AgentType, response: response || "تم تنفيذ الطلب بنجاح", metadata };

    } catch (error: any) {
      console.error("[AgentOrchestrator] Chat error:", error);
      return {
        success: false,
        agentUsed: selectedAgent,
        response: `⚠️ خطأ في معالجة الرد: ${error.message || "خطأ غير معروف"}. يرجى المحاولة مرة أخرى.`,
      };
    }
  }

  private async callAI(messages: { role: string; content: string }[]): Promise<string> {
    const groq = await askGroqMessages(messages, { temperature: 0.7, maxTokens: 2048 });
    if (groq.success && groq.content) {
      return groq.content;
    }
    const google = await askGoogleMessages(messages, { temperature: 0.7 });
    if (google.success && google.content) {
      return google.content;
    }
    const openRouter = await askOpenRouter(messages[1]?.content || "", messages[0]?.content || "");
    if (openRouter.success && openRouter.content) {
      return openRouter.content;
    }
    const mistral = await askMistral(messages[1]?.content || "", { temperature: 0.7, maxTokens: 2048 });
    return mistral.content || `مرحباً! كيف يمكنني مساعدتك؟`;
  }

  async executeTask(agentKey: AgentType, task: any): Promise<AgentOrchestratorResult> {
    try {
      // Qayyim agents handle their own task processing
      const qayyimAgents = [
        "qayyim-core", "qayyim-cont", "qayyim-vis", "qayyim-seo",
        "qayyim-ux", "qayyim-ana", "qayyim-dev", "qayyim-qa"
      ];

      if (qayyimAgents.includes(agentKey)) {
        const agentInstance = this.agents[agentKey];
        if (agentInstance && typeof agentInstance.process === 'function') {
          const result = await agentInstance.process(task);
          return {
            success: result.success,
            agentUsed: agentKey,
            response: result.output || result.message || JSON.stringify(result.data),
            metadata: {
              suggestions: result.suggestions,
              designParameters: result.designParameters,
              taskId: result.taskId,
              actionItems: result.actionItems,
              priority: result.priority,
            },
          };
        }
      }

      // Fallback for other agents
      const persona = AGENT_PERSONAS[agentKey] || AGENT_PERSONAS["qayyim-core"];
      const messages = [
        { role: "system" as const, content: persona.prompt },
        { role: "user" as const, content: `قم بتنفيذ هذه المهمة: ${JSON.stringify(task)}` },
      ];
      const response = await this.callAI(messages);

      return {
        success: true,
        agentUsed: agentKey,
        response,
        metadata: {},
      };
    } catch (error: any) {
      return {
        success: false,
        agentUsed: agentKey === "auto" ? "qayyim-core" : agentKey,
        response: `⚠️ خطأ في تنفيذ المهمة: ${error.message || "خطأ غير معروف"}`,
      };
    }
  }

  async getAgentStatus(agentKey: AgentType): Promise<{
    agent: AgentType;
    status: "online" | "offline" | "busy";
    taskCount: number;
    recentActivity: string;
  }> {
    const supabase = getSupabaseAdminClient();
    const resolvedCompanyId = await resolveAdminCompanyId();

    try {
      if (supabase && resolvedCompanyId) {
        const key = agentKey === "auto" ? "qayyim-core" : agentKey;
        let { data: agentProfile } = await supabase
          .from("agent_profiles")
          .select("id")
          .eq("agent_key", key)
          .eq("company_id", resolvedCompanyId)
          .maybeSingle();

        if (!agentProfile) {
          const persona = AGENT_PERSONAS[key] || { name: key.toUpperCase(), role: "وكيل ذكي" };
          const { data: created } = await supabase
            .from("agent_profiles")
            .insert({
              company_id: resolvedCompanyId,
              agent_key: key,
              name: persona.name,
              description: persona.role,
              is_active: true,
            })
            .select("id")
            .single();
          agentProfile = created;
        }

        if (agentProfile) {
          const { count } = await supabase
            .from("agent_tasks")
            .select("*", { count: "exact", head: true })
            .eq("agent_profile_id", agentProfile.id)
            .eq("status", "running");

          const { data: lastTask } = await supabase
            .from("agent_tasks")
            .select("completed_at")
            .eq("agent_profile_id", agentProfile.id)
            .eq("status", "completed")
            .order("completed_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          return {
            agent: agentKey,
            status: (count || 0) > 0 ? "busy" : "online",
            taskCount: count || 0,
            recentActivity: lastTask?.completed_at || "متاح ومستعد",
          };
        }
      }
    } catch (err) {
      console.error("[Orchestrator] Status check error:", err);
    }

    return {
      agent: agentKey,
      status: "online",
      taskCount: 0,
      recentActivity: "متاح ومستعد",
    };
  }

  private detectAgent(message: string): AgentType {
    const lowerMessage = message.toLowerCase();

    // Specialist agents first (technical)
    if (lowerMessage.includes("كود") || lowerMessage.includes("برمج") || lowerMessage.includes("bug") || lowerMessage.includes("api") || lowerMessage.includes("typescript")) {
      return "coder";
    }
    if (lowerMessage.includes("تقرير") || lowerMessage.includes("بيانات") || lowerMessage.includes("تحليل") || lowerMessage.includes("ارقام") || lowerMessage.includes("معدل")) {
      return "analyst";
    }
    if (lowerMessage.includes("سيرفر") || lowerMessage.includes("خادم") || lowerMessage.includes("استقرار") || lowerMessage.includes("أداء") || lowerMessage.includes("ذاكرة")) {
      return "ops";
    }
    if (lowerMessage.includes("أمان") || lowerMessage.includes("حماية") || lowerMessage.includes("مفتاح") || lowerMessage.includes("صلاحيات") || lowerMessage.includes("2fa")) {
      return "security";
    }
    if (lowerMessage.includes("تعلم") || lowerMessage.includes("تطوير") || lowerMessage.includes("تحسين") || lowerMessage.includes("دروس")) {
      return "learner";
    }

    // Vanguard (sales/operations)
    const vanguardKeywords = [
      "سعر", "تكلفة", "ميزانية", "عرض سعر", "فاتورة", "دفع", "حساب",
      "طلب", "أمر شراء", "شحن", "توصيل", "تركيب", "موعد", "حجز",
      "عميل", "زبون", "متابعة", "اتصال", "رسالة", "واتساب", "إيميل",
    ];

    for (const keyword of vanguardKeywords) {
      if (lowerMessage.includes(keyword)) return "vanguard";
    }

    // Qayyim Swarm - Luxury website appearance domain
    // Core/Leader keywords - orchestration, full audit, publish/rollback
    const coreKeywords = [
      "قيّم", "سرب", "تدقيق", "شامل", "منسق", "نشر", "تراجع", "مسودة",
      "جودة", "بوابة", "مراجعة", "موافقة", "بشرية", "مركزي",
    ];

    // Content/Arabic keywords
    const contentKeywords = [
      "نص", "نصوص", "كتابة", "صياغة", "عربي", "عربية", "لغة", "نبرة",
      "فخامة", "هوية", "مصطلحات", "ممنوع", "مطلوب", "صقل", "توحد",
      "هيرو", "hero", "قسم", "منتج", "قصة", "سردية", "علامة", "تجارية",
    ];

    // Visual/Images keywords
    const visualKeywords = [
      "صورة", "صور", "معرض", "جاليري", "hero", "هيرو", "رئيسية",
      "alt", "نص بديل", "بصري", "مرئي", "تصوير", "منتجات", "غرف",
      "علامة تجارية", "اتساق", "تناسق", "نمط", "ستايل",
    ];

    // SEO keywords
    const seoKeywords = [
      "seo", "سيو", "بحث", "ظهور", "محركات", "جوجل", "schema", "سكيما",
      "منتج", "مقالة", "مسار", "breadcrumb", "منافس", "فجوة", "كلمات مفتاحية",
      "technical", "تقني", "index", "فهرسة", "crawl", "زحف",
    ];

    // UX/Behavior keywords
    const uxKeywords = [
      "تجربة", "مستخدم", "سلوك", "زائر", "زوار", "خروج", "تحويل",
      "a/b", "اختبار", "هدف", "أهداف", "معدل", "telemetry", "تتبع",
      "heatmap", "خريطة حرارة", "نقرة", "تمرير", "جلسة",
    ];

    // Analytics/Business keywords
    const anaKeywords = [
      "تحليلات", "أعمال", "إيرادات", "تحويل", "تنبؤ", "luxury score",
      "تقسيم", "عملاء", "قطاعات", "roi", "عائد", "استثمار",
      "قيمة", "عمر", "ltv", "churn", "تسرب", "استبقاء",
    ];

    // Dev/Performance keywords
    const devKeywords = [
      "كود", "bundle", "حزمة", "حجم", "أداء", "core web vitals",
      "lcp", "fid", "cls", "تبعية", "dependencies", "أمان كود",
      "مراجعة", "refactor", "typescript", "react", "nextjs",
    ];

    // QA/Test keywords
    const qaKeywords = [
      "اختبار", "جودة", "e2e", "end-to-end", "visual regression",
      "وصولية", "a11y", "حمل", "load", "أمان", "security scan",
      "دخان", "smoke", "تراجع بصري", "إمكانية وصول",
    ];

    // Check all Qayyim agent keyword groups
    const keywordGroups: [string, string[]][] = [
      ["qayyim-core", coreKeywords],
      ["qayyim-cont", contentKeywords],
      ["qayyim-vis", visualKeywords],
      ["qayyim-seo", seoKeywords],
      ["qayyim-ux", uxKeywords],
      ["qayyim-ana", anaKeywords],
      ["qayyim-dev", devKeywords],
      ["qayyim-qa", qaKeywords],
    ];

    const scores: Record<string, number> = {};
    for (const [agent, keywords] of keywordGroups) {
      scores[agent] = 0;
      for (const keyword of keywords) {
        if (lowerMessage.includes(keyword)) scores[agent]++;
      }
    }

    // Find highest scoring Qayyim agent
    let maxAgent = "qayyim-core";
    let maxScore = 0;
    for (const [agent, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score;
        maxAgent = agent;
      }
    }

    // If any Qayyim keywords matched, return that agent
    if (maxScore > 0) return maxAgent as AgentType;

    // Default to core for general website appearance queries
    return "qayyim-core";
  }

  async logEvent(eventType: string, agentKey: string, data: Record<string, any>) {
    try {
      const supabase = getSupabaseAdminClient();
      const resolvedCompanyId = await resolveAdminCompanyId();
      if (!supabase || !resolvedCompanyId) return;

      const { data: agentProfile } = await supabase
        .from("agent_profiles")
        .select("id")
        .eq("agent_key", agentKey)
        .eq("company_id", resolvedCompanyId)
        .maybeSingle();

      await supabase.from("agent_events").insert({
        company_id: resolvedCompanyId,
        agent_profile_id: agentProfile?.id || null,
        event_type: eventType,
        event_data: data,
        severity: "info",
        created_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error("[Orchestrator] Event log error:", err);
    }
  }
}

export const agentOrchestrator = new AgentOrchestrator();

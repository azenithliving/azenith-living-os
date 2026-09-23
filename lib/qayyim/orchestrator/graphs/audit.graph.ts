/**
 * audit.graph.ts — LangGraph workflow for full-site audit
 *
 * Flow: start → gather_data → audit_core → audit_content → audit_visual
 *       → audit_seo → audit_ux → aggregate → respond → end
 */

import { StateGraph, Annotation, START, END } from "@langchain/langgraph";
import {
  qayyimCoreAgent,
  qayyimContentAgent,
  qayyimVisualAgent,
  qayyimSeoAgent,
  qayyimUxAgent,
} from "../../index";
import type { QayyimResult } from "../../QayyimAgentBase";

// ── State ─────────────────────────────────────────────────────────────────────

const AuditStateAnnotation = Annotation.Root({
  companyId: Annotation<string | null>,
  pagePath: Annotation<string>,
  scope: Annotation<"full" | "page" | "section">,
  // partial results from each agent
  coreAudit:    Annotation<QayyimResult | null>,
  contentAudit: Annotation<QayyimResult | null>,
  visualAudit:  Annotation<QayyimResult | null>,
  seoAudit:     Annotation<QayyimResult | null>,
  uxAudit:      Annotation<QayyimResult | null>,
  // final
  finalReport:  Annotation<string>,
  evidenceUrls: Annotation<string[]>,
  issuesCount:  Annotation<number>,
  error:        Annotation<string | undefined>,
});

type AuditState = typeof AuditStateAnnotation.State;

// ── Nodes ─────────────────────────────────────────────────────────────────────

async function auditCoreNode(state: AuditState): Promise<Partial<AuditState>> {
  const result = await qayyimCoreAgent.auditFullSite({
    company_id: state.companyId ?? undefined,
    page_path:  state.pagePath,
    scope:      state.scope,
  });
  return { coreAudit: result };
}

async function auditContentNode(state: AuditState): Promise<Partial<AuditState>> {
  const result = await qayyimContentAgent.process({
    id: `audit_cont_${Date.now()}`,
    type: "identity_check",
    title: "فحص هوية النصوص على الموقع",
    description: `افحص هوية ونبرة جميع النصوص الظاهرة على ${state.pagePath}`,
    context: { company_id: state.companyId, page_path: state.pagePath },
    priority: "high",
  });
  return { contentAudit: result };
}

async function auditVisualNode(state: AuditState): Promise<Partial<AuditState>> {
  const result = await qayyimVisualAgent.process({
    id: `audit_vis_${Date.now()}`,
    type: "brand_consistency_check",
    title: "فحص اتساق الصور والعلامة التجارية",
    description: `افحص صور الموقع على ${state.pagePath} للاتساق مع هوية أزينث`,
    context: { company_id: state.companyId, page_path: state.pagePath },
    priority: "medium",
  });
  return { visualAudit: result };
}

async function auditSeoNode(state: AuditState): Promise<Partial<AuditState>> {
  const result = await qayyimSeoAgent.process({
    id: `audit_seo_${Date.now()}`,
    type: "audit_seo",
    title: "تدقيق SEO التقني",
    description: `افحص SEO وSchema.org للصفحة ${state.pagePath}`,
    context: { company_id: state.companyId, page_path: state.pagePath },
    priority: "high",
  });
  return { seoAudit: result };
}

async function auditUxNode(state: AuditState): Promise<Partial<AuditState>> {
  const result = await qayyimUxAgent.process({
    id: `audit_ux_${Date.now()}`,
    type: "exit_rate_alert",
    title: "تحليل سلوك الزوار ومعدلات الخروج",
    description: `افحص سلوك الزوار ومعدلات الخروج على ${state.pagePath}`,
    context: { company_id: state.companyId, page_path: state.pagePath },
    priority: "medium",
  });
  return { uxAudit: result };
}

async function aggregateAuditNode(state: AuditState): Promise<Partial<AuditState>> {
  const results = [
    state.coreAudit,
    state.contentAudit,
    state.visualAudit,
    state.seoAudit,
    state.uxAudit,
  ].filter(Boolean) as QayyimResult[];

  const evidenceUrls = [...new Set(results.flatMap((r) => r.evidenceUrls ?? []))];
  const issuesCount  = results.filter((r) => !r.success || (r.data?.issues?.length ?? 0) > 0).length;

  const sections = results
    .map((r, i) => {
      const labels = ["القائد", "المحتوى", "المرئيات", "SEO", "تجربة المستخدم"];
      return `### ${labels[i] ?? i}\n${r.output?.slice(0, 600) ?? "—"}`;
    })
    .join("\n\n");

  const finalReport = `# تقرير التدقيق الشامل — ${state.pagePath}

${sections}

---
**ملخص**: ${results.filter(r => r.success).length}/${results.length} وكيل أكمل تدقيقه.
**روابط الأدلة**: ${evidenceUrls.length} رابط موثق.`;

  return { finalReport, evidenceUrls, issuesCount };
}

// ── Build Graph ───────────────────────────────────────────────────────────────

function buildAuditGraph() {
  return new StateGraph(AuditStateAnnotation)
    .addNode("audit_core",    auditCoreNode)
    .addNode("audit_content", auditContentNode)
    .addNode("audit_visual",  auditVisualNode)
    .addNode("audit_seo",     auditSeoNode)
    .addNode("audit_ux",      auditUxNode)
    .addNode("aggregate",     aggregateAuditNode)
    .addEdge(START,          "audit_core")
    .addEdge("audit_core",   "audit_content")
    .addEdge("audit_content","audit_visual")
    .addEdge("audit_visual", "audit_seo")
    .addEdge("audit_seo",    "audit_ux")
    .addEdge("audit_ux",     "aggregate")
    .addEdge("aggregate",    END)
    .compile();
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface AuditGraphInput {
  companyId?: string | null;
  pagePath?: string;
  scope?: "full" | "page" | "section";
}

export interface AuditGraphOutput {
  finalReport: string;
  evidenceUrls: string[];
  issuesCount: number;
  coreAudit:    QayyimResult | null;
  contentAudit: QayyimResult | null;
  visualAudit:  QayyimResult | null;
  seoAudit:     QayyimResult | null;
  uxAudit:      QayyimResult | null;
}

export async function runAuditGraph(input: AuditGraphInput): Promise<AuditGraphOutput> {
  const graph = buildAuditGraph();

  const initialState: AuditState = {
    companyId:    input.companyId ?? null,
    pagePath:     input.pagePath  ?? "/",
    scope:        input.scope     ?? "full",
    coreAudit:    null,
    contentAudit: null,
    visualAudit:  null,
    seoAudit:     null,
    uxAudit:      null,
    finalReport:  "",
    evidenceUrls: [],
    issuesCount:  0,
    error:        undefined,
  };

  const result = await graph.invoke(initialState);

  return {
    finalReport:  result.finalReport,
    evidenceUrls: result.evidenceUrls,
    issuesCount:  result.issuesCount,
    coreAudit:    result.coreAudit,
    contentAudit: result.contentAudit,
    visualAudit:  result.visualAudit,
    seoAudit:     result.seoAudit,
    uxAudit:      result.uxAudit,
  };
}

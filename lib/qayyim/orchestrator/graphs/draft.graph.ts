/**
 * draft.graph.ts — LangGraph workflow for creating a coordinated draft
 *
 * Flow: start → draft_content → draft_visual → draft_seo
 *       → constitution_check → save_draft → respond → end
 */

import { StateGraph, Annotation, START, END } from "@langchain/langgraph";
import {
  qayyimContentAgent,
  qayyimVisualAgent,
  qayyimSeoAgent,
  constitutionEngine,
} from "../../index";
import { createQayyimDraft } from "@/lib/qayyim-ops";
import type { QayyimResult } from "../../QayyimAgentBase";

// ── State ─────────────────────────────────────────────────────────────────────

const DraftStateAnnotation = Annotation.Root({
  companyId:       Annotation<string | null>,
  pagePath:        Annotation<string>,
  sectionKey:      Annotation<string>,
  draftType:       Annotation<string>,
  instructions:    Annotation<string>,
  currentContent:  Annotation<any>,
  // partial results
  contentDraft:    Annotation<QayyimResult | null>,
  visualDraft:     Annotation<QayyimResult | null>,
  seoDraft:        Annotation<QayyimResult | null>,
  // governance
  constitutionPassed: Annotation<boolean>,
  violations:      Annotation<string[]>,
  // output
  savedDraftId:    Annotation<string | null>,
  previewToken:    Annotation<string | null>,
  finalMessage:    Annotation<string>,
  error:           Annotation<string | undefined>,
});

type DraftState = typeof DraftStateAnnotation.State;

// ── Nodes ─────────────────────────────────────────────────────────────────────

async function draftContentNode(state: DraftState): Promise<Partial<DraftState>> {
  const result = await qayyimContentAgent.process({
    id: `draft_cont_${Date.now()}`,
    type: state.draftType ?? "draft_luxury_copy",
    title: `مسودة نص فاخر: ${state.sectionKey}`,
    description: state.instructions,
    context: {
      company_id:     state.companyId,
      page_path:      state.pagePath,
      section_key:    state.sectionKey,
      current_content: state.currentContent,
    },
    priority: "high",
  });
  return { contentDraft: result };
}

async function draftVisualNode(state: DraftState): Promise<Partial<DraftState>> {
  // Only run visual drafting for relevant draft types
  const visualTypes = ["hero_text", "product_card", "section_reorder"];
  if (!visualTypes.includes(state.draftType)) {
    return { visualDraft: null };
  }

  const result = await qayyimVisualAgent.process({
    id: `draft_vis_${Date.now()}`,
    type: "select_hero_image",
    title: `اقتراح صورة مرافقة: ${state.sectionKey}`,
    description: `اختر صورة مناسبة لـ ${state.sectionKey} بناءً على: ${state.instructions}`,
    context: {
      company_id:  state.companyId,
      page_path:   state.pagePath,
      section_key: state.sectionKey,
    },
    priority: "medium",
  });
  return { visualDraft: result };
}

async function draftSeoNode(state: DraftState): Promise<Partial<DraftState>> {
  const result = await qayyimSeoAgent.process({
    id: `draft_seo_${Date.now()}`,
    type: "schema_generate",
    title: `تحسين SEO للمسودة: ${state.sectionKey}`,
    description: `أضف meta وschema.org مناسبين للمسودة في ${state.pagePath}`,
    context: {
      company_id:  state.companyId,
      page_path:   state.pagePath,
      section_key: state.sectionKey,
      draft_text:  state.contentDraft?.output ?? "",
    },
    priority: "medium",
  });
  return { seoDraft: result };
}

async function constitutionCheckNode(state: DraftState): Promise<Partial<DraftState>> {
  const proposedText = state.contentDraft?.output ?? "";

  const report = await constitutionEngine.checkAll({
    agentKey:        "qayyim-cont",
    actionType:      "draft",
    content:         proposedText,
    proposedChanges: { text: proposedText },
    targetPage:      state.pagePath,
    targetSection:   state.sectionKey,
    evidenceUrls:    [`${state.pagePath}#${state.sectionKey}`],
    humanApproval:   false,
  });

  const violations = report.results
    .flatMap((r) => r.violations)
    .map((v) => v.message);

  return {
    constitutionPassed: report.overallPassed,
    violations,
  };
}

async function saveDraftNode(state: DraftState): Promise<Partial<DraftState>> {
  if (!state.constitutionPassed) {
    return {
      savedDraftId: null,
      previewToken: null,
      finalMessage: `⛔ المسودة لم تجتز فحص الدستور.\n\nالمخالفات:\n${state.violations.map((v) => `• ${v}`).join("\n")}`,
    };
  }

  const proposed: Record<string, any> = {
    draft_text:   state.contentDraft?.output ?? "",
    visual_hint:  state.visualDraft?.data ?? null,
    seo_meta:     state.seoDraft?.data ?? null,
    section_key:  state.sectionKey,
    draft_type:   state.draftType,
    instructions: state.instructions,
  };

  const result = await createQayyimDraft({
    targetTable: "site_sections",
    targetId:    state.sectionKey,
    targetPath:  `${state.pagePath}#${state.sectionKey}`,
    proposed,
    draftType:   state.draftType,
    createdBy:   "qayyim-swarm",
    companyId:   state.companyId,
  });

  if (!result.success) {
    return {
      savedDraftId: null,
      previewToken: null,
      finalMessage: `⚠️ فشل حفظ المسودة: ${result.message}`,
      error: result.message,
    };
  }

  return {
    savedDraftId: (result.data?.draft_id as string) ?? null,
    previewToken: (result.data?.preview_token as string) ?? null,
    finalMessage: `✅ **تم إنشاء المسودة بنجاح**
- **رقم المسودة**: \`${(result.data?.draft_id as string)?.slice(0, 8)}\`
- **الإصدار**: v${result.data?.version}
- **معاينة**: ${(result.data?.preview_url as string) ?? "—"}
- **الحالة**: جاهزة للمراجعة والموافقة`,
  };
}

// ── Build Graph ───────────────────────────────────────────────────────────────

function buildDraftGraph() {
  return new StateGraph(DraftStateAnnotation)
    .addNode("draft_content",    draftContentNode)
    .addNode("draft_visual",     draftVisualNode)
    .addNode("draft_seo",        draftSeoNode)
    .addNode("constitution",     constitutionCheckNode)
    .addNode("save_draft",       saveDraftNode)
    .addEdge(START,             "draft_content")
    .addEdge("draft_content",   "draft_visual")
    .addEdge("draft_visual",    "draft_seo")
    .addEdge("draft_seo",       "constitution")
    .addEdge("constitution",    "save_draft")
    .addEdge("save_draft",      END)
    .compile();
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface DraftGraphInput {
  companyId?:      string | null;
  pagePath:        string;
  sectionKey:      string;
  draftType:       string;
  instructions:    string;
  currentContent?: any;
}

export interface DraftGraphOutput {
  finalMessage:       string;
  savedDraftId:       string | null;
  previewToken:       string | null;
  constitutionPassed: boolean;
  violations:         string[];
  contentDraft:       QayyimResult | null;
}

export async function runDraftGraph(input: DraftGraphInput): Promise<DraftGraphOutput> {
  const graph = buildDraftGraph();

  const initialState: DraftState = {
    companyId:          input.companyId ?? null,
    pagePath:           input.pagePath,
    sectionKey:         input.sectionKey,
    draftType:          input.draftType ?? "draft_luxury_copy",
    instructions:       input.instructions,
    currentContent:     input.currentContent ?? null,
    contentDraft:       null,
    visualDraft:        null,
    seoDraft:           null,
    constitutionPassed: false,
    violations:         [],
    savedDraftId:       null,
    previewToken:       null,
    finalMessage:       "",
    error:              undefined,
  };

  const result = await graph.invoke(initialState);

  return {
    finalMessage:       result.finalMessage,
    savedDraftId:       result.savedDraftId,
    previewToken:       result.previewToken,
    constitutionPassed: result.constitutionPassed,
    violations:         result.violations,
    contentDraft:       result.contentDraft,
  };
}

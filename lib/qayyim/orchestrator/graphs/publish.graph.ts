/**
 * publish.graph.ts — LangGraph workflow for publishing an approved draft
 *
 * Flow: start → validate_draft → quality_gate → constitution_check
 *       → publish → notify → end
 *
 * لا ينشر أي شيء بدون:
 * 1. مسودة موجودة وليست منشورة بالفعل
 * 2. موافقة بشرية صريحة (approvedBy)
 * 3. اجتياز بوابة الجودة
 * 4. اجتياز فحص الدستور
 */

import { StateGraph, Annotation, START, END } from "@langchain/langgraph";
import { qayyimCoreAgent, constitutionEngine } from "../../index";
import { publishQayyimDraft } from "@/lib/qayyim-ops";
import { supabaseServer } from "@/lib/dal/unified-supabase";

// ── State ─────────────────────────────────────────────────────────────────────

const PublishStateAnnotation = Annotation.Root({
  draftId:              Annotation<string>,
  approvedBy:           Annotation<string>,
  companyId:            Annotation<string | null>,
  // validation
  draftExists:          Annotation<boolean>,
  draftStatus:          Annotation<string>,
  draftData:            Annotation<Record<string, any> | null>,
  // gates
  qualityGatePassed:    Annotation<boolean>,
  constitutionPassed:   Annotation<boolean>,
  gateViolations:       Annotation<string[]>,
  // output
  published:            Annotation<boolean>,
  publishedAt:          Annotation<string | null>,
  targetPath:           Annotation<string | null>,
  version:              Annotation<number>,
  finalMessage:         Annotation<string>,
  error:                Annotation<string | undefined>,
});

type PublishState = typeof PublishStateAnnotation.State;

// ── Nodes ─────────────────────────────────────────────────────────────────────

async function validateDraftNode(state: PublishState): Promise<Partial<PublishState>> {
  const { data: draft, error } = await supabaseServer
    .from("qayyim_drafts")
    .select("*")
    .eq("id", state.draftId)
    .maybeSingle();

  if (error || !draft) {
    return {
      draftExists: false,
      draftData: null,
      draftStatus: "not_found",
      finalMessage: `⚠️ المسودة "${state.draftId.slice(0, 8)}" غير موجودة في قاعدة البيانات.`,
      error: "draft_not_found",
    };
  }

  if (draft.status === "published") {
    return {
      draftExists: true,
      draftData: draft,
      draftStatus: "published",
      finalMessage: `ℹ️ المسودة "${state.draftId.slice(0, 8)}" منشورة بالفعل منذ ${draft.published_at}.`,
      published: true,
    };
  }

  return {
    draftExists: true,
    draftData: draft,
    draftStatus: draft.status,
  };
}

async function qualityGateNode(state: PublishState): Promise<Partial<PublishState>> {
  if (!state.draftExists || state.draftStatus === "published") {
    return { qualityGatePassed: false };
  }

  const gateResult = await qayyimCoreAgent.qualityGate(state.draftId);

  return {
    qualityGatePassed: gateResult.success,
    gateViolations: gateResult.success
      ? []
      : [gateResult.output ?? "فشلت بوابة الجودة"],
  };
}

async function constitutionCheckNode(state: PublishState): Promise<Partial<PublishState>> {
  if (!state.qualityGatePassed) {
    return { constitutionPassed: false };
  }

  const draft = state.draftData;
  if (!draft) return { constitutionPassed: false };

  const report = await constitutionEngine.checkAll({
    agentKey:        "qayyim-core",
    actionType:      "publish",
    content:         draft.proposed,
    proposedChanges: draft.proposed,
    targetPage:      draft.target_path,
    targetSection:   draft.target_id,
    evidenceUrls:    [draft.target_path ?? "/"],
    humanApproval:   Boolean(state.approvedBy),
    approvedBy:      state.approvedBy,
  });

  const violations = report.results
    .flatMap((r) => r.violations)
    .map((v) => v.message);

  return {
    constitutionPassed: report.overallPassed,
    gateViolations: [...(state.gateViolations ?? []), ...violations],
  };
}

async function publishNode(state: PublishState): Promise<Partial<PublishState>> {
  // Block if any gate failed
  if (!state.draftExists) {
    return { published: false };
  }
  if (state.draftStatus === "published") {
    return { published: true };
  }
  if (!state.qualityGatePassed || !state.constitutionPassed) {
    const violations = (state.gateViolations ?? [])
      .map((v) => `• ${v}`)
      .join("\n");
    return {
      published: false,
      finalMessage: `⛔ **رُفض النشر — لم تجتز البوابات**\n\n${violations}\n\nعدّل المسودة وأعد المحاولة.`,
    };
  }

  const result = await publishQayyimDraft(
    state.draftId,
    state.approvedBy,
    state.companyId
  );

  if (!result.success) {
    return {
      published: false,
      error: result.message,
      finalMessage: `⚠️ فشل النشر الميداني: ${result.message}`,
    };
  }

  return {
    published:   true,
    publishedAt: new Date().toISOString(),
    targetPath:  (result.data?.target_path as string) ?? "/",
    version:     (result.data?.version as number)     ?? 1,
    finalMessage: `👑 **تم النشر على الموقع الحي**
- **المسودة**: \`${state.draftId.slice(0, 8)}\`
- **الإصدار**: v${result.data?.version ?? 1}
- **الهدف**: \`${result.data?.target_table}\` → ${result.data?.target_path ?? "/"}
- **المعتمد**: ${state.approvedBy}
- **الوقت**: ${new Date().toLocaleString("ar-EG")}
- **الكاش**: تم التحديث الفوري ✓`,
  };
}

// ── Build Graph ───────────────────────────────────────────────────────────────

function buildPublishGraph() {
  return new StateGraph(PublishStateAnnotation)
    .addNode("validate",     validateDraftNode)
    .addNode("quality_gate", qualityGateNode)
    .addNode("constitution", constitutionCheckNode)
    .addNode("publish",      publishNode)
    .addConditionalEdges(
      "validate",
      (state: PublishState) => {
        if (!state.draftExists)               return "abort";
        if (state.draftStatus === "published") return "abort";
        return "continue";
      },
      { continue: "quality_gate", abort: "publish" }
    )
    .addEdge(START,          "validate")
    .addEdge("quality_gate", "constitution")
    .addEdge("constitution", "publish")
    .addEdge("publish",      END)
    .compile();
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface PublishGraphInput {
  draftId:    string;
  approvedBy: string;
  companyId?: string | null;
}

export interface PublishGraphOutput {
  published:   boolean;
  finalMessage: string;
  targetPath:  string | null;
  version:     number;
  error?:      string;
}

export async function runPublishGraph(input: PublishGraphInput): Promise<PublishGraphOutput> {
  const graph = buildPublishGraph();

  const initialState: PublishState = {
    draftId:            input.draftId,
    approvedBy:         input.approvedBy,
    companyId:          input.companyId ?? null,
    draftExists:        false,
    draftStatus:        "draft",
    draftData:          null,
    qualityGatePassed:  false,
    constitutionPassed: false,
    gateViolations:     [],
    published:          false,
    publishedAt:        null,
    targetPath:         null,
    version:            0,
    finalMessage:       "",
    error:              undefined,
  };

  const result = await graph.invoke(initialState);

  return {
    published:    result.published,
    finalMessage: result.finalMessage,
    targetPath:   result.targetPath,
    version:      result.version,
    error:        result.error,
  };
}

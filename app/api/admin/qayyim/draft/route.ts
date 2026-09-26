/**
 * Qayyim Swarm - Draft API
 * POST /api/admin/qayyim/draft
 *
 * يحفظ مسودة حقيقية في qayyim_drafts بعد رد الوكيل
 */

import { NextRequest, NextResponse } from "next/server";
import { syncLayer } from "@/lib/ops/memory/SyncLayer";
import { getCompanyId, getAgentInstance, DraftSchema } from "@/lib/ops/api/utils";
import { createQayyimDraft } from "@/lib/qayyim-ops";
import { supabaseServer } from "@/lib/dal/unified-supabase";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
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

    // ── 1. استدعاء الوكيل للحصول على المحتوى المُقترح ──────────────────
    let agentResult;
    switch (draft_type) {
      case 'hero_text':
      case 'section_reorder':
      case 'product_card':
      case 'tone_unification':
      case 'identity_fix':
      case 'storytelling':
        agentResult = await agentInstance.draftCopy({
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
      case 'brand_consistency_check': {
        const methodMap: Record<string, string> = {
          curate_gallery: 'curateGallery',
          select_hero_image: 'selectHeroImage',
          generate_alt_text: 'generateAltText',
          brand_consistency_check: 'brandConsistencyCheck',
        };
        agentResult = await agentInstance[methodMap[draft_type]]({
          page_path,
          section_key,
          context: { ...context, company_id: companyId },
        });
        break;
      }

      default:
        return NextResponse.json({ success: false, error: `Unknown draft type: ${draft_type}` }, { status: 400 });
    }

    // ── 2. حفظ المسودة في qayyim_drafts ────────────────────────────────
    // إذا كان الوكيل لم يُنشئ draft_id (أي لم يستدعِ createQayyimDraft مسبقاً)
    let savedDraftId = agentResult?.data?.draft_id as string | undefined;
    let previewToken = agentResult?.data?.preview_token as string | undefined;

    if (!savedDraftId && agentResult?.success) {
      // ابحث عن target_id: قد يكون section_key نفسه أو UUID من DB
      let targetId = section_key;

      // محاولة جلب UUID حقيقي من site_sections إذا كان section_key نصاً
      if (section_key && !section_key.match(/^[0-9a-f-]{36}$/i)) {
        const { data: sectionRow } = await supabaseServer
          .from('site_sections')
          .select('id')
          .eq('section_key', section_key)
          .maybeSingle();
        if (sectionRow?.id) targetId = sectionRow.id;
      }

      const proposed: Record<string, any> = {
        agent,
        draft_type,
        instructions,
        page_path,
        section_key,
        ai_output: agentResult.output,
        ...(agentResult.data ?? {}),
      };

      // احذف حقول تسبب مشاكل مع DB
      delete proposed.draft_id;
      delete proposed.preview_token;

      const saveResult = await createQayyimDraft({
        targetTable: 'site_sections',
        targetId:    targetId,
        targetPath:  `${page_path}#${section_key}`,
        proposed,
        draftType:   draft_type,
        createdBy:   agent,
        companyId,
        metadata: {
          agent,
          draft_type,
          agent_confidence: agentResult.confidence,
          evidence_urls: agentResult.evidenceUrls ?? [],
        },
      });

      if (saveResult.success && saveResult.data) {
        savedDraftId  = saveResult.data.draft_id as string;
        previewToken  = saveResult.data.preview_token as string;

        // أضف معلومات المسودة لنتيجة الوكيل
        agentResult = {
          ...agentResult,
          data: {
            ...agentResult.data,
            draft_id:      savedDraftId,
            preview_token: previewToken,
            preview_url:   saveResult.data.preview_url,
            version:       saveResult.data.version,
          },
        };
      }
    }

    // ── 3. نشر حدث Sync ─────────────────────────────────────────────────
    try {
      await syncLayer.initialize(companyId);
      await syncLayer.publishDraftUpdate(
        agent,
        savedDraftId ?? 'new',
        'created',
        { page_path, section_key, draft_type }
      );
    } catch { /* sync غير حيوي */ }

    return NextResponse.json({
      success: true,
      result: agentResult,
      draft_id:      savedDraftId   ?? null,
      preview_token: previewToken   ?? null,
      preview_url:   previewToken   ? `/preview?token=${previewToken}` : null,
    });

  } catch (error: any) {
    console.error('[Qayyim Draft API] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Qayyim Draft API — POST with { agent, page_path, section_key, draft_type, instructions, ... }',
  });
}

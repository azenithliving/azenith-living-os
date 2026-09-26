/**
 * Qayyim Swarm - SEO API
 * POST /api/admin/qayyim/seo
 */

import { NextRequest, NextResponse } from "next/server";
import { syncLayer } from "@/lib/ops/memory/SyncLayer";
import { getCompanyId, getAgentInstance, SeoDraftSchema } from "@/lib/ops/api/utils";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = SeoDraftSchema.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.format() }, { status: 400 });
    }

    const { agent, page_path, section_key, draft_type, instructions, context, company_id } = parsed.data;
    const companyId = await getCompanyId(company_id);

    const agentInstance = await getAgentInstance(agent);

    if (!agentInstance) {
      return NextResponse.json({ success: false, error: `Agent ${agent} does not support SEO operations` }, { status: 400 });
    }

    // Map draft_type to agent method
    let result;
    switch (draft_type) {
      case 'audit_seo':
        result = await agentInstance.auditSEO({ page_path, context: { ...context, company_id: companyId } });
        break;
      case 'fix_schema':
        result = await agentInstance.fixSchema({ page_path, context: { ...context, company_id: companyId } });
        break;
      case 'content_gap_analysis':
        result = await agentInstance.contentGapAnalysis({ page_path, context: { ...context, company_id: companyId } });
        break;
      case 'competitor_gap':
        result = await agentInstance.competitorGap({ page_path, context: { ...context, company_id: companyId } });
        break;
      case 'schema_generate':
        result = await agentInstance.generateSchema({ page_path, section_key, context: { ...context, company_id: companyId } });
        break;
      default:
        return NextResponse.json({ success: false, error: `Unknown SEO operation: ${draft_type}` }, { status: 400 });
    }

    // Publish sync event
    await syncLayer.initialize(companyId);
    await syncLayer.publishDraftUpdate(agent, result.data?.draft_id || 'new', 'created', { page_path, section_key, draft_type });

    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    console.error('[Qayyim SEO API] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Qayyim SEO API - Use POST with { agent, page_path, section_key, draft_type (audit_seo|fix_schema|content_gap_analysis|competitor_gap|schema_generate), context?, company_id? }',
  });
}
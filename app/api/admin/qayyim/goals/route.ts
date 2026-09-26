/**
 * Qayyim Swarm - Goals API
 * GET /api/admin/qayyim/goals?status=active
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/dal/unified-supabase";
import { getCompanyId } from "@/lib/ops/api/utils";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const companyId = await getCompanyId(searchParams.get('company_id') || undefined);

    let query = supabaseServer
      .from('qayyim_goals')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (status) query = query.eq('status', status);
    if (companyId) query = query.eq('company_id', companyId);

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ success: true, goals: [], warning: error.message });
    }

    return NextResponse.json({ success: true, goals: data || [] });
  } catch (error: any) {
    console.error('[Qayyim Goals API] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

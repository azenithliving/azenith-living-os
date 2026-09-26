/**
 * Qayyim Swarm - Experiments management API
 * GET  /api/admin/qayyim/experiments            → list all
 * GET  /api/admin/qayyim/experiments?id=X&stats=1 → stats for one
 * POST /api/admin/qayyim/experiments { action: 'start'|'pause'|'conclude', experiment_id }
 */

import { NextRequest, NextResponse } from "next/server";
import {
  listExperiments,
  getExperiment,
  getExperimentStats,
  startExperiment,
  pauseExperiment,
  concludeExperiment,
} from "@/lib/ops/ab-testing";
import { getCompanyId } from "@/lib/ops/api/utils";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const wantStats = searchParams.get('stats') === '1';
    const status = searchParams.get('status') || undefined;
    const companyId = await getCompanyId(searchParams.get('company_id') || undefined);

    if (id && wantStats) {
      const stats = await getExperimentStats(id);
      return NextResponse.json({ success: true, stats });
    }

    if (id) {
      const experiment = await getExperiment(id);
      if (!experiment) {
        return NextResponse.json({ success: false, error: 'Experiment not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true, experiment });
    }

    const experiments = await listExperiments(companyId || undefined, status);
    return NextResponse.json({ success: true, experiments });
  } catch (error: any) {
    console.error('[Qayyim Experiments API] GET error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, experiment_id } = body;

    if (!experiment_id) {
      return NextResponse.json({ success: false, error: 'experiment_id is required' }, { status: 400 });
    }

    let experiment;
    switch (action) {
      case 'start':
        experiment = await startExperiment(experiment_id);
        break;
      case 'pause':
        experiment = await pauseExperiment(experiment_id);
        break;
      case 'conclude': {
        const stats = await getExperimentStats(experiment_id);
        const winner =
          stats.recommended_action === 'declare_variant' ? 'variant'
          : stats.recommended_action === 'declare_control' ? 'control'
          : 'inconclusive';
        experiment = await concludeExperiment(experiment_id, winner);
        break;
      }
      default:
        return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
    }

    return NextResponse.json({ success: true, experiment });
  } catch (error: any) {
    console.error('[Qayyim Experiments API] POST error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

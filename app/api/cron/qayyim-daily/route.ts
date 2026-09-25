/**
 * Qayyim Daily Proactive Round
 * Cron: daily at 7:00 AM UTC
 * 
 * Audits goals + luxury score, publishes context_update event,
 * creates ONE admin proposal if intervention needed.
 */

import { NextRequest, NextResponse } from 'next/server';
import { assertCronAuthorized } from '@/lib/cron-auth';
import { resolveAdminCompanyId } from '@/lib/admin-company';
import { syncLayer } from '@/lib/qayyim/memory/SyncLayer';
import { createAdminProposal } from '@/lib/admin-sovereign-mind';
import { supabaseServer } from '@/lib/dal/unified-supabase';

export const maxDuration = 60;

async function executeDailyRound() {
  const companyId = await resolveAdminCompanyId();
  if (!companyId) {
    return { success: false, error: 'No company configured' };
  }

  const results: Record<string, any> = {
    luxuryScore: null,
    atRiskGoals: [],
    proposalCreated: false,
    errors: [],
  };

  // (a) Calculate luxury score (import core logic)
  try {
    // Import the analytics agent and call directly
    const { qayyimAnalyticsAgent } = await import('@/lib/qayyim');
    const luxResult = await qayyimAnalyticsAgent.calculateLuxuryScore({
      scope: 'full_site',
      context: { company_id: companyId },
    });

    if (luxResult.success && luxResult.data?.luxury_score !== undefined) {
      results.luxuryScore = luxResult.data.luxury_score;
    }
  } catch (e: any) {
    results.errors.push(`Luxury score: ${e.message}`);
  }

  // (b) Read at-risk goals (active + past deadline or <25% progress)
  try {
    const { data: goalsData } = await supabaseServer
      .from('qayyim_goals')
      .select('*')
      .eq('company_id', companyId)
      .eq('status', 'active');

    const goals = goalsData || [];
    const now = new Date();

    results.atRiskGoals = goals.filter((g: any) => {
      const deadline = g.target_date ? new Date(g.target_date) : null;
      const progress = g.progress_percentage || 0;
      return (deadline && deadline < now) || progress < 25;
    });
  } catch (e: any) {
    results.errors.push(`Goals query: ${e.message}`);
  }

  // (c) Publish context_update event via SyncLayer
  try {
    await syncLayer.initialize(companyId);
    await syncLayer.publish({
      event_type: 'context_update',
      source_agent: 'qayyim-core',
      target_agents: [],
      payload: {
        kind: 'daily_round',
        luxuryScore: results.luxuryScore,
        atRiskGoals: results.atRiskGoals.map((g: any) => ({
          id: g.id,
          title: g.title,
          progress: g.progress_percentage,
          deadline: g.target_date,
        })),
      },
    });
  } catch (e: any) {
    results.errors.push(`SyncLayer publish: ${e.message}`);
  }

  // (d) Create admin proposal if intervention needed
  const needsIntervention = results.atRiskGoals.length > 0 || (results.luxuryScore !== null && results.luxuryScore < 70);

  if (needsIntervention) {
    try {
      const luxScore = results.luxuryScore ?? 'غير متاح';
      const atRiskCount = results.atRiskGoals.length;

      const description = `نظام قيّم الدار يحتاج مراجعتك:\n\n` +
        `• مستوى الفخامة الحالي: ${luxScore}\n` +
        `• عدد الأهداف المهددة: ${atRiskCount}\n\n` +
        (atRiskCount > 0
          ? `الأهداف المهددة:\n${results.atRiskGoals.slice(0, 3).map((g: any) => `  - ${g.title || 'هدف'} (تقدم: ${g.progress_percentage || 0}%)`).join('\n')}\n\n`
          : '') +
        `الرجاء مراجعة لوحة قيّم الدار واتخاذ الإجراء المناسب.`;

      const masterEmail = process.env.MASTER_ADMIN_EMAILS?.split(',')[0]?.trim();

      const proposal = await createAdminProposal({
        title: 'تقرير مدير تشغيل المحتوى اليومي — يتطلب تدخل',
        description,
        reasoning: 'جولة يومية مجدولة',
        userMessage: 'راجع الأهداف المهددة واقتراحات النشر',
        intent: { kind: 'analytics', analyticsDays: 7, confidence: 0.8 },
        userEmail: masterEmail,
        proactive: true,
      });

      results.proposalCreated = proposal.success;
      if (!proposal.success) {
        results.errors.push(`Proposal creation: ${proposal.error}`);
      }
    } catch (e: any) {
      results.errors.push(`Proposal creation: ${e.message}`);
    }
  }

  return { success: true, results };
}

export async function GET(request: NextRequest) {
  try {
    const unauthorized = assertCronAuthorized(request);
    if (unauthorized) return unauthorized;
    const result = await executeDailyRound();
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Qayyim Daily Cron] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const unauthorized = assertCronAuthorized(request);
    if (unauthorized) return unauthorized;
    const result = await executeDailyRound();
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Qayyim Daily Cron] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

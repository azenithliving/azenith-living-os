/**
 * Qayyim A/B Testing Engine
 *
 * Deterministic visitor bucketing + persistence on qayyim_experiments /
 * qayyim_experiment_events. Statistical significance via two-proportion
 * z-test (normal approximation), sufficient for luxury-traffic volumes.
 */

import { supabaseServer } from "@/lib/dal/unified-supabase";
import { createHash } from "crypto";

// ============================================
// Types
// ============================================

export interface Experiment {
  id: string;
  company_id: string | null;
  experiment_key: string;
  hypothesis: string;
  page_path: string;
  section_key: string;
  control_version: any;
  variant_version: any;
  success_metric: string;
  minimum_detectable_effect: number;
  duration_days: number;
  traffic_split: number;
  status: 'draft' | 'running' | 'paused' | 'completed' | 'cancelled' | 'winner_declared';
  winner: 'control' | 'variant' | 'inconclusive' | null;
  statistical_confidence: number | null;
  started_at: string | null;
  ended_at: string | null;
  created_by: string;
  results: Record<string, any>;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface CreateExperimentInput {
  experiment_key: string;
  hypothesis: string;
  page_path: string;
  section_key: string;
  control_version: any;
  variant_version: any;
  success_metric?: string;
  minimum_detectable_effect?: number;
  duration_days?: number;
  traffic_split?: number;
  created_by?: string;
  company_id?: string;
  metadata?: Record<string, any>;
}

export interface ExperimentStats {
  experiment_id: string;
  control: { impressions: number; conversions: number; rate: number };
  variant: { impressions: number; conversions: number; rate: number };
  uplift_pct: number | null;
  z_score: number | null;
  confidence: number | null;
  is_significant: boolean;
  recommended_action: 'keep_running' | 'declare_variant' | 'declare_control' | 'declare_inconclusive';
  days_remaining: number | null;
}

// ============================================
// Bucketing (deterministic per visitor)
// ============================================

/**
 * Assign a visitor to control/variant deterministically.
 * Same visitor always lands in the same arm for a given experiment.
 */
export function assignArm(experimentKey: string, visitorId: string, trafficSplit: number): 'control' | 'variant' {
  const hash = createHash('sha256').update(`${experimentKey}:${visitorId}`).digest('hex');
  const bucketValue = parseInt(hash.slice(0, 8), 16) / 0xffffffff; // 0..1
  return bucketValue < trafficSplit ? 'variant' : 'control';
}

// ============================================
// CRUD
// ============================================

export async function createExperiment(input: CreateExperimentInput): Promise<Experiment> {
  const { data, error } = await supabaseServer
    .from('qayyim_experiments')
    .insert({
      company_id: input.company_id || null,
      experiment_key: input.experiment_key,
      hypothesis: input.hypothesis,
      page_path: input.page_path,
      section_key: input.section_key,
      control_version: input.control_version,
      variant_version: input.variant_version,
      success_metric: input.success_metric || 'conversion_rate',
      minimum_detectable_effect: input.minimum_detectable_effect ?? 10,
      duration_days: input.duration_days ?? 14,
      traffic_split: input.traffic_split ?? 0.5,
      status: 'draft',
      created_by: input.created_by || 'qayyim-ux',
      metadata: input.metadata || {},
    })
    .select()
    .single();

  if (error) throw new Error(`createExperiment failed: ${error.message}`);
  return data as Experiment;
}

export async function startExperiment(experimentId: string): Promise<Experiment> {
  const { data, error } = await supabaseServer
    .from('qayyim_experiments')
    .update({ status: 'running', started_at: new Date().toISOString() })
    .eq('id', experimentId)
    .in('status', ['draft', 'paused'])
    .select()
    .single();

  if (error) throw new Error(`startExperiment failed: ${error.message}`);
  return data as Experiment;
}

export async function pauseExperiment(experimentId: string): Promise<Experiment> {
  const { data, error } = await supabaseServer
    .from('qayyim_experiments')
    .update({ status: 'paused' })
    .eq('id', experimentId)
    .eq('status', 'running')
    .select()
    .single();

  if (error) throw new Error(`pauseExperiment failed: ${error.message}`);
  return data as Experiment;
}

export async function getExperiment(experimentId: string): Promise<Experiment | null> {
  const { data, error } = await supabaseServer
    .from('qayyim_experiments')
    .select('*')
    .eq('id', experimentId)
    .maybeSingle();

  if (error) throw new Error(`getExperiment failed: ${error.message}`);
  return (data as Experiment) || null;
}

export async function listExperiments(companyId?: string, status?: string): Promise<Experiment[]> {
  let query = supabaseServer
    .from('qayyim_experiments')
    .select('*')
    .order('created_at', { ascending: false });

  if (companyId) query = query.eq('company_id', companyId);
  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) throw new Error(`listExperiments failed: ${error.message}`);
  return (data || []) as Experiment[];
}

/**
 * Resolve the active experiment for a page/section (if any) and the visitor's arm.
 * Used by the storefront to decide which version to render.
 */
export async function resolveActiveExperiment(
  pagePath: string,
  sectionKey: string,
  visitorId: string
): Promise<{ experiment: Experiment; arm: 'control' | 'variant'; content: any } | null> {
  const { data, error } = await supabaseServer
    .from('qayyim_experiments')
    .select('*')
    .eq('page_path', pagePath)
    .eq('section_key', sectionKey)
    .eq('status', 'running')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  const experiment = data as Experiment;
  const arm = assignArm(experiment.experiment_key, visitorId, experiment.traffic_split);

  // Record impression (fire-and-forget)
  void recordEvent(experiment.id, visitorId, arm, 'impression', undefined, pagePath);

  return {
    experiment,
    arm,
    content: arm === 'variant' ? experiment.variant_version : experiment.control_version,
  };
}

// ============================================
// Events
// ============================================

export async function recordEvent(
  experimentId: string,
  visitorId: string,
  arm: 'control' | 'variant',
  eventType: 'impression' | 'conversion' | 'exit' | 'scroll',
  eventValue?: number,
  pagePath?: string,
  metadata?: Record<string, any>
): Promise<void> {
  const { error } = await supabaseServer.from('qayyim_experiment_events').insert({
    experiment_id: experimentId,
    visitor_id: visitorId,
    arm,
    event_type: eventType,
    event_value: eventValue ?? null,
    page_path: pagePath || null,
    metadata: metadata || {},
  });

  if (error) console.error('[Qayyim AB] recordEvent failed:', error.message);
}

// ============================================
// Statistics
// ============================================

/** Standard normal CDF (Abramowitz-Stegun approximation). */
function normalCdf(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989422804014327 * Math.exp((-x * x) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - p : p;
}

export async function getExperimentStats(experimentId: string): Promise<ExperimentStats> {
  const experiment = await getExperiment(experimentId);
  if (!experiment) throw new Error(`Experiment ${experimentId} not found`);

  const { data: events, error } = await supabaseServer
    .from('qayyim_experiment_events')
    .select('arm, event_type, visitor_id')
    .eq('experiment_id', experimentId);

  if (error) throw new Error(`getExperimentStats failed: ${error.message}`);

  // Unique visitors per arm for impressions; unique converters per arm
  const impressions = { control: new Set<string>(), variant: new Set<string>() };
  const conversions = { control: new Set<string>(), variant: new Set<string>() };

  for (const ev of events || []) {
    const arm = ev.arm as 'control' | 'variant';
    if (ev.event_type === 'impression') impressions[arm].add(ev.visitor_id);
    if (ev.event_type === 'conversion') conversions[arm].add(ev.visitor_id);
  }

  const cImp = impressions.control.size;
  const vImp = impressions.variant.size;
  const cConv = conversions.control.size;
  const vConv = conversions.variant.size;

  const cRate = cImp > 0 ? cConv / cImp : 0;
  const vRate = vImp > 0 ? vConv / vImp : 0;

  let zScore: number | null = null;
  let confidence: number | null = null;
  let isSignificant = false;

  if (cImp >= 30 && vImp >= 30) {
    const pooled = (cConv + vConv) / (cImp + vImp);
    const se = Math.sqrt(pooled * (1 - pooled) * (1 / cImp + 1 / vImp));
    if (se > 0) {
      zScore = (vRate - cRate) / se;
      // Two-tailed → confidence that variant differs from control
      confidence = 1 - 2 * (1 - normalCdf(Math.abs(zScore)));
      isSignificant = confidence >= 0.95;
    }
  }

  const upliftPct = cRate > 0 ? ((vRate - cRate) / cRate) * 100 : null;

  let recommendedAction: ExperimentStats['recommended_action'] = 'keep_running';
  if (isSignificant && upliftPct !== null) {
    recommendedAction = upliftPct > 0 ? 'declare_variant' : 'declare_control';
  } else if (experiment.started_at) {
    const elapsedDays = (Date.now() - new Date(experiment.started_at).getTime()) / 86400000;
    if (elapsedDays >= experiment.duration_days * 2) {
      recommendedAction = 'declare_inconclusive';
    }
  }

  let daysRemaining: number | null = null;
  if (experiment.started_at && experiment.status === 'running') {
    const elapsed = (Date.now() - new Date(experiment.started_at).getTime()) / 86400000;
    daysRemaining = Math.max(0, Math.round((experiment.duration_days - elapsed) * 10) / 10);
  }

  return {
    experiment_id: experimentId,
    control: { impressions: cImp, conversions: cConv, rate: Math.round(cRate * 10000) / 10000 },
    variant: { impressions: vImp, conversions: vConv, rate: Math.round(vRate * 10000) / 10000 },
    uplift_pct: upliftPct !== null ? Math.round(upliftPct * 100) / 100 : null,
    z_score: zScore !== null ? Math.round(zScore * 1000) / 1000 : null,
    confidence: confidence !== null ? Math.round(confidence * 10000) / 10000 : null,
    is_significant: isSignificant,
    recommended_action: recommendedAction,
    days_remaining: daysRemaining,
  };
}

/**
 * Declare a winner and close the experiment.
 */
export async function concludeExperiment(
  experimentId: string,
  winner: 'control' | 'variant' | 'inconclusive'
): Promise<Experiment> {
  const stats = await getExperimentStats(experimentId);

  const { data, error } = await supabaseServer
    .from('qayyim_experiments')
    .update({
      status: 'winner_declared',
      winner,
      statistical_confidence: stats.confidence,
      ended_at: new Date().toISOString(),
      results: stats as unknown as Record<string, any>,
    })
    .eq('id', experimentId)
    .select()
    .single();

  if (error) throw new Error(`concludeExperiment failed: ${error.message}`);
  return data as Experiment;
}

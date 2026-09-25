'use client';

/**
 * QayyimExperimentsPanel — إدارة تجارب A/B وعرض الدلالة الإحصائية
 */

import { useState, useEffect, useCallback } from 'react';
import {
  FlaskConical, Loader2, RefreshCw, PlayCircle, PauseCircle,
  Trophy, TrendingUp, TrendingDown, Minus
} from 'lucide-react';

interface Experiment {
  id: string;
  experiment_key: string;
  hypothesis: string;
  page_path: string;
  section_key: string;
  success_metric: string;
  status: string;
  winner: string | null;
  statistical_confidence: number | null;
  started_at: string | null;
  duration_days: number;
  results?: any;
}

const STATUS_LABELS: Record<string, { label: string; badge: string }> = {
  draft:           { label: 'مسودة',        badge: 'bg-white/10 text-white/60 border-white/15' },
  running:         { label: 'جارية',        badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25' },
  paused:          { label: 'متوقفة',       badge: 'bg-amber-500/15 text-amber-300 border-amber-500/25' },
  completed:       { label: 'مكتملة',       badge: 'bg-sky-500/15 text-sky-300 border-sky-500/25' },
  winner_declared: { label: 'فائز مُعلن',   badge: 'bg-violet-500/15 text-violet-300 border-violet-500/25' },
  cancelled:       { label: 'ملغاة',        badge: 'bg-rose-500/15 text-rose-300 border-rose-500/25' },
};

export function QayyimExperimentsPanel() {
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [stats, setStats] = useState<Record<string, any>>({});

  const fetchExperiments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/qayyim/experiments');
      const data = await res.json();
      if (data.success) {
        const list: Experiment[] = data.experiments || [];
        setExperiments(list);
        // Fetch stats for running experiments
        for (const exp of list.filter((e) => e.status === 'running')) {
          fetch(`/api/admin/qayyim/experiments?id=${exp.id}&stats=1`)
            .then((r) => r.json())
            .then((d) => {
              if (d.success && d.stats) setStats((prev) => ({ ...prev, [exp.id]: d.stats }));
            })
            .catch(() => {});
        }
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchExperiments(); }, [fetchExperiments]);

  async function handleAction(id: string, action: 'start' | 'pause' | 'conclude') {
    if (acting) return;
    setActing(id);
    try {
      await fetch('/api/admin/qayyim/experiments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, experiment_id: id }),
      });
      fetchExperiments();
    } catch { /* silent */ }
    finally { setActing(null); }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs text-white/50">{experiments.length} تجربة</div>
        <button
          onClick={fetchExperiments}
          disabled={loading}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/10 text-xs text-white/60 hover:bg-white/5 transition-colors disabled:opacity-40"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          تحديث
        </button>
      </div>

      {loading && experiments.length === 0 ? (
        <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-white/30" /></div>
      ) : experiments.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 p-10 text-center text-white/30 text-sm">
          <FlaskConical className="w-8 h-8 mx-auto mb-2 opacity-40" />
          لا توجد تجارب — صمّم تجربة عبر QAYYIM-UX من خلال API: /api/admin/qayyim/ab-test
        </div>
      ) : (
        <div className="space-y-2.5">
          {experiments.map((exp) => {
            const st = STATUS_LABELS[exp.status] || STATUS_LABELS.draft;
            const s = stats[exp.id];
            const isActing = acting === exp.id;
            return (
              <div key={exp.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2 py-0.5 rounded-md border text-[10px] font-semibold ${st.badge}`}>{st.label}</span>
                      <span className="text-[10px] text-white/30" dir="ltr">{exp.experiment_key}</span>
                    </div>
                    <div className="text-sm font-semibold text-white mt-1.5 leading-relaxed">{exp.hypothesis}</div>
                    <div className="text-[11px] text-white/40 mt-1" dir="ltr">
                      {exp.page_path} · {exp.section_key} · metric: {exp.success_metric}
                    </div>
                  </div>
                  {exp.winner && (
                    <span className="flex items-center gap-1 text-xs text-violet-300 shrink-0">
                      <Trophy className="w-3.5 h-3.5" />
                      {exp.winner === 'variant' ? 'المتغير' : exp.winner === 'control' ? 'الأصل' : 'غير حاسم'}
                    </span>
                  )}
                </div>

                {/* Live stats */}
                {s && (
                  <div className="grid grid-cols-4 gap-2">
                    <StatCell label="الأصل" value={`${(s.control.rate * 100).toFixed(2)}%`} sub={`${s.control.conversions}/${s.control.impressions}`} />
                    <StatCell label="المتغير" value={`${(s.variant.rate * 100).toFixed(2)}%`} sub={`${s.variant.conversions}/${s.variant.impressions}`} />
                    <StatCell
                      label="الرفع"
                      value={s.uplift_pct !== null ? `${s.uplift_pct > 0 ? '+' : ''}${s.uplift_pct}%` : '—'}
                      icon={s.uplift_pct > 0 ? TrendingUp : s.uplift_pct < 0 ? TrendingDown : Minus}
                      tone={s.uplift_pct > 0 ? 'up' : s.uplift_pct < 0 ? 'down' : 'flat'}
                    />
                    <StatCell
                      label="الثقة"
                      value={s.confidence !== null ? `${(s.confidence * 100).toFixed(1)}%` : '—'}
                      sub={s.is_significant ? 'دال إحصائياً' : `${s.days_remaining ?? '?'} يوم متبقٍ`}
                      tone={s.is_significant ? 'up' : 'flat'}
                    />
                  </div>
                )}

                {s?.verdict?.text && (
                  <p
                    className={`mt-2 text-[11px] leading-5 ${
                      s.verdict.status === 'inconclusive'
                        ? 'text-amber-200/80'
                        : s.verdict.status === 'no-data'
                          ? 'text-white/40'
                          : 'text-emerald-200/90'
                    }`}
                  >
                    {s.verdict.text}
                  </p>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2">
                  {exp.status === 'draft' && (
                    <ActionBtn onClick={() => handleAction(exp.id, 'start')} disabled={isActing} icon={PlayCircle} label="بدء" tone="emerald" />
                  )}
                  {exp.status === 'running' && (
                    <>
                      <ActionBtn onClick={() => handleAction(exp.id, 'pause')} disabled={isActing} icon={PauseCircle} label="إيقاف مؤقت" tone="amber" />
                      {s?.is_significant && (
                        <ActionBtn onClick={() => handleAction(exp.id, 'conclude')} disabled={isActing} icon={Trophy} label="إعلان الفائز" tone="violet" />
                      )}
                    </>
                  )}
                  {exp.status === 'paused' && (
                    <ActionBtn onClick={() => handleAction(exp.id, 'start')} disabled={isActing} icon={PlayCircle} label="استئناف" tone="emerald" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatCell({ label, value, sub, icon: Icon, tone }: { label: string; value: string; sub?: string; icon?: any; tone?: 'up' | 'down' | 'flat' }) {
  const toneClass = tone === 'up' ? 'text-emerald-300' : tone === 'down' ? 'text-rose-300' : 'text-white';
  return (
    <div className="rounded-lg bg-black/30 border border-white/5 p-2.5 text-center">
      <div className="text-[10px] text-white/40">{label}</div>
      <div className={`text-sm font-bold flex items-center justify-center gap-1 ${toneClass}`}>
        {Icon && <Icon className="w-3.5 h-3.5" />}
        {value}
      </div>
      {sub && <div className="text-[9px] text-white/30 mt-0.5" dir="ltr">{sub}</div>}
    </div>
  );
}

function ActionBtn({ onClick, disabled, icon: Icon, label, tone }: { onClick: () => void; disabled: boolean; icon: any; label: string; tone: 'emerald' | 'amber' | 'violet' }) {
  const tones = {
    emerald: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20',
    amber: 'border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20',
    violet: 'border-violet-500/30 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20',
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors disabled:opacity-40 ${tones[tone]}`}
    >
      {disabled ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Icon className="w-3.5 h-3.5" />}
      {label}
    </button>
  );
}

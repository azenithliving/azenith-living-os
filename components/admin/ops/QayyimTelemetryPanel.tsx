'use client';

/**
 * QayyimTelemetryPanel — تحليل سلوك الزوار: معدلات الخروج وعمق التمرير
 */

import { useState } from 'react';
import { MousePointerClick, Loader2, PlayCircle, ArrowDownRight, ArrowUpRight } from 'lucide-react';

const METRIC_OPTIONS = [
  { key: 'exit_rate', label: 'معدل الخروج' },
  { key: 'scroll_depth', label: 'عمق التمرير' },
  { key: 'time_on_section', label: 'الزمن على القسم' },
  { key: 'click_through', label: 'نسبة النقر' },
] as const;

export function QayyimTelemetryPanel() {
  const [pagePath, setPagePath] = useState('/');
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('7d');
  const [selected, setSelected] = useState<string[]>(['exit_rate', 'scroll_depth']);
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  function toggleMetric(key: string) {
    setSelected((prev) => prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]);
  }

  async function runAnalysis() {
    setRunning(true);
    setError(null);
    setReport(null);
    try {
      const res = await fetch('/api/admin/ops/telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'analyze_behavior',
          page_path: pagePath,
          time_range: timeRange,
          metrics: selected,
        }),
      });
      const data = await res.json();
      if (data.success) setReport(data.result);
      else setError(typeof data.error === 'string' ? data.error : 'فشل التحليل');
    } catch (e: any) {
      setError(e.message || 'خطأ في الاتصال');
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[160px]">
            <label className="block text-[11px] text-white/50 mb-1">الصفحة</label>
            <input
              value={pagePath}
              onChange={(e) => setPagePath(e.target.value)}
              className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm text-white focus:border-emerald-500/50 focus:outline-none"
              dir="ltr"
            />
          </div>
          <div>
            <label className="block text-[11px] text-white/50 mb-1">الفترة</label>
            <div className="flex gap-1">
              {(['24h', '7d', '30d'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTimeRange(t)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                    timeRange === t ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/30' : 'text-white/50 border border-white/10 hover:bg-white/5'
                  }`}
                  dir="ltr"
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div>
          <label className="block text-[11px] text-white/50 mb-1.5">المقاييس</label>
          <div className="flex flex-wrap gap-1.5">
            {METRIC_OPTIONS.map((m) => (
              <button
                key={m.key}
                onClick={() => toggleMetric(m.key)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  selected.includes(m.key) ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/30' : 'text-white/50 border border-white/10 hover:bg-white/5'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={runAnalysis}
          disabled={running || selected.length === 0}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-sm font-semibold hover:bg-emerald-500/30 transition-colors disabled:opacity-40"
        >
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}
          تحليل السلوك
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/25 bg-rose-500/10 p-4 text-sm text-rose-300">{error}</div>
      )}

      {/* Result */}
      {report && (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-white/60">
            <MousePointerClick className="w-4 h-4 text-emerald-300" />
            نتيجة تحليل QAYYIM-UX
          </div>
          {report.summary && (
            <p className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap">{report.summary}</p>
          )}
          {report.data?.metrics && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {Object.entries(report.data.metrics).map(([key, value]: [string, any]) => {
                const num = typeof value === 'number' ? value : value?.value;
                const trend = value?.trend;
                return (
                  <div key={key} className="rounded-lg bg-black/30 border border-white/5 p-3 text-center">
                    <div className="text-[10px] text-white/40">{key}</div>
                    <div className="text-base font-bold text-white flex items-center justify-center gap-1" dir="ltr">
                      {trend === 'up' && <ArrowUpRight className="w-3.5 h-3.5 text-rose-300" />}
                      {trend === 'down' && <ArrowDownRight className="w-3.5 h-3.5 text-emerald-300" />}
                      {num !== undefined ? String(num) : '—'}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {!report && !error && !running && (
        <div className="rounded-xl border border-dashed border-white/10 p-10 text-center text-white/30 text-sm">
          <MousePointerClick className="w-8 h-8 mx-auto mb-2 opacity-40" />
          حدّد الصفحة والمقاييس ليحلل QAYYIM-UX سلوك الزوار الفعلي
        </div>
      )}
    </div>
  );
}

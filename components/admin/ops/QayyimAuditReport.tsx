'use client';

/**
 * QayyimAuditReport — تشغيل تدقيق شامل وعرض النتائج والمخالفات
 */

import { useState } from 'react';
import { ShieldCheck, Loader2, PlayCircle, AlertTriangle, AlertCircle, Info, CheckCircle2 } from 'lucide-react';

interface Violation {
  rule: string;
  location: string;
  severity: 'critical' | 'medium' | 'low';
  evidenceUrl?: string;
}

const SEVERITY_STYLE = {
  critical: { badge: 'bg-rose-500/15 text-rose-300 border-rose-500/25', icon: AlertTriangle, label: 'حرج' },
  medium:   { badge: 'bg-amber-500/15 text-amber-300 border-amber-500/25', icon: AlertCircle, label: 'متوسط' },
  low:      { badge: 'bg-sky-500/15 text-sky-300 border-sky-500/25', icon: Info, label: 'منخفض' },
};

export function QayyimAuditReport() {
  const [pagePath, setPagePath] = useState('/');
  const [scope, setScope] = useState<'full' | 'page' | 'section'>('full');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  async function runAudit() {
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/admin/ops/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page_path: pagePath, scope }),
      });
      const data = await res.json();
      if (data.success) {
        setResult(data.result);
      } else {
        setError(data.error ? JSON.stringify(data.error) : 'فشل التدقيق');
      }
    } catch (e: any) {
      setError(e.message || 'خطأ في الاتصال');
    } finally {
      setRunning(false);
    }
  }

  const violations: Violation[] = result?.data?.violations || result?.violations || [];
  const verdict: string | null = result?.data?.verdict || result?.verdict || null;

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
        <div className="flex-1 min-w-[180px]">
          <label className="block text-[11px] text-white/50 mb-1">مسار الصفحة</label>
          <input
            value={pagePath}
            onChange={(e) => setPagePath(e.target.value)}
            className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm text-white focus:border-amber-500/50 focus:outline-none"
            placeholder="/"
            dir="ltr"
          />
        </div>
        <div>
          <label className="block text-[11px] text-white/50 mb-1">النطاق</label>
          <div className="flex gap-1">
            {(['full', 'page', 'section'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setScope(s)}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  scope === s ? 'bg-amber-500/20 text-amber-200 border border-amber-500/30' : 'text-white/50 border border-white/10 hover:bg-white/5'
                }`}
              >
                {s === 'full' ? 'شامل' : s === 'page' ? 'صفحة' : 'قسم'}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={runAudit}
          disabled={running}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-200 text-sm font-semibold hover:bg-amber-500/30 transition-colors disabled:opacity-40"
        >
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}
          تشغيل التدقيق
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/25 bg-rose-500/10 p-4 text-sm text-rose-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="space-y-3">
          {/* Verdict banner */}
          {verdict && (
            <div className={`rounded-xl border p-4 flex items-center gap-3 ${
              verdict === 'pass' ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200'
              : verdict === 'fail' ? 'border-rose-500/25 bg-rose-500/10 text-rose-200'
              : 'border-amber-500/25 bg-amber-500/10 text-amber-200'
            }`}>
              {verdict === 'pass' ? <CheckCircle2 className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
              <div>
                <div className="text-sm font-bold">
                  {verdict === 'pass' ? 'اجتاز التدقيق' : verdict === 'fail' ? 'فشل التدقيق' : 'اجتياز مشروط'}
                </div>
                <div className="text-xs opacity-70">{violations.length} مخالفة مكتشفة</div>
              </div>
            </div>
          )}

          {/* Summary text */}
          {result.summary && (
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <div className="text-[11px] text-white/40 mb-2">ملخص الوكيل</div>
              <p className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap">{result.summary}</p>
            </div>
          )}

          {/* Violations list */}
          {violations.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-white/60">المخالفات ({violations.length})</div>
              {violations.map((v, i) => {
                const style = SEVERITY_STYLE[v.severity] || SEVERITY_STYLE.low;
                const Icon = style.icon;
                return (
                  <div key={i} className="rounded-xl border border-white/10 bg-white/[0.02] p-3.5 flex items-start gap-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-semibold shrink-0 ${style.badge}`}>
                      <Icon className="w-3 h-3" /> {style.label}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-white">{v.rule}</div>
                      <div className="text-xs text-white/50 mt-0.5" dir="ltr">{v.location}</div>
                      {v.evidenceUrl && (
                        <a href={v.evidenceUrl} target="_blank" rel="noreferrer" className="text-[11px] text-sky-300 hover:underline mt-1 inline-block" dir="ltr">
                          {v.evidenceUrl}
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {!result && !error && !running && (
        <div className="rounded-xl border border-dashed border-white/10 p-10 text-center text-white/30 text-sm">
          <ShieldCheck className="w-8 h-8 mx-auto mb-2 opacity-40" />
          اختر الصفحة والنطاق ثم شغّل التدقيق ليعمل OPS-LEAD على الفحص الشامل
        </div>
      )}
    </div>
  );
}

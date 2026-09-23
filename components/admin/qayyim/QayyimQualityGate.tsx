'use client';

/**
 * QayyimQualityGate — عرض نتيجة بوابة الجودة الدستورية لأي إجراء
 */

import { ShieldCheck, ShieldAlert, AlertTriangle } from 'lucide-react';

interface GateResult {
  verdict: 'pass' | 'fail' | 'conditional';
  violations?: Array<{ rule: string; severity: string; location?: string }>;
  warnings?: Array<{ rule: string; message?: string }>;
  summary?: string;
}

export function QayyimQualityGate({ result }: { result: GateResult | null }) {
  if (!result) return null;

  const config = {
    pass: {
      icon: ShieldCheck,
      border: 'border-emerald-500/25',
      bg: 'bg-emerald-500/10',
      text: 'text-emerald-200',
      label: 'اجتاز بوابة الجودة',
    },
    fail: {
      icon: ShieldAlert,
      border: 'border-rose-500/25',
      bg: 'bg-rose-500/10',
      text: 'text-rose-200',
      label: 'أوقفته بوابة الجودة',
    },
    conditional: {
      icon: AlertTriangle,
      border: 'border-amber-500/25',
      bg: 'bg-amber-500/10',
      text: 'text-amber-200',
      label: 'اجتياز مشروط — راجع التحذيرات',
    },
  }[result.verdict];

  const Icon = config.icon;
  const violations = result.violations || [];
  const warnings = result.warnings || [];

  return (
    <div className={`rounded-xl border ${config.border} ${config.bg} p-4 space-y-3`}>
      <div className={`flex items-center gap-2 ${config.text}`}>
        <Icon className="w-5 h-5" />
        <span className="text-sm font-bold">{config.label}</span>
      </div>

      {result.summary && <p className="text-xs text-white/60 leading-relaxed">{result.summary}</p>}

      {violations.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[11px] font-semibold text-rose-300">المخالفات ({violations.length})</div>
          {violations.map((v, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-white/70">
              <span className={`mt-0.5 w-1.5 h-1.5 rounded-full shrink-0 ${v.severity === 'critical' ? 'bg-rose-400' : 'bg-amber-400'}`} />
              <span>{v.rule}{v.location ? ` — ${v.location}` : ''}</span>
            </div>
          ))}
        </div>
      )}

      {warnings.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[11px] font-semibold text-amber-300">تحذيرات ({warnings.length})</div>
          {warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-white/60">
              <AlertTriangle className="w-3 h-3 mt-0.5 text-amber-400 shrink-0" />
              <span>{w.rule}{w.message ? ` — ${w.message}` : ''}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

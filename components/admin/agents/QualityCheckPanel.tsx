'use client';

import { useState } from 'react';
import { CheckCircle, XCircle, AlertCircle, Loader2 } from 'lucide-react';

interface QualityCheck {
  id: string;
  production_job_id: string;
  job_title: string;
  check_type: string;
  stage_name: string;
  status: 'pending' | 'pass' | 'fail' | 'conditional_pass';
  notes: string;
  checked_by: string;
  checked_at: string;
  photos: string[];
}

interface QualityCheckPanelProps {
  productionJobId?: string;
  jobTitle?: string;
  onSubmit?: (result: any) => void;
}

const CHECK_TYPES = [
  { value: 'incoming_material', label: 'فحص مواد واردة' },
  { value: 'in_process', label: 'فحص أثناء العمل' },
  { value: 'pre_finish', label: 'قبل التشطيب' },
  { value: 'final', label: 'فحص نهائي' },
];

export function QualityCheckPanel({
  productionJobId = '',
  jobTitle = 'مهمة إنتاج',
  onSubmit,
}: QualityCheckPanelProps) {
  const [status, setStatus] = useState<'pass' | 'fail' | 'conditional_pass' | 'pending'>('pending');
  const [notes, setNotes] = useState('');
  const [checkType, setCheckType] = useState('final');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<QualityCheck | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submitCheck() {
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/quality', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          production_job_id: productionJobId || undefined,
          job_title: jobTitle,
          check_type: checkType,
          status,
          notes,
          photos: [],
        }),
      });

      if (!res.ok) {
        throw new Error(`Server error: ${res.status}`);
      }

      const data = await res.json();

      if (data.success) {
        setResult(data.data);
        setSubmitted(true);
        onSubmit?.(data.data);
      } else {
        throw new Error(data.error || 'Failed to submit quality check');
      }
    } catch (err: any) {
      console.error('Error submitting quality check:', err);
      setError(err.message || 'حدث خطأ أثناء إرسال الفحص');

      const localResult: QualityCheck = {
        id: `local-${Date.now()}`,
        production_job_id: productionJobId,
        job_title: jobTitle,
        check_type: checkType,
        stage_name: CHECK_TYPES.find((t) => t.value === checkType)?.label || checkType,
        status,
        notes,
        checked_by: 'local',
        checked_at: new Date().toISOString(),
        photos: [],
      };
      setResult(localResult);
      setSubmitted(true);
      onSubmit?.(localResult);
    }

    setSubmitting(false);
  }

  function resetForm() {
    setStatus('pending');
    setNotes('');
    setCheckType('final');
    setSubmitted(false);
    setResult(null);
    setError(null);
  }

  if (submitted && result) {
    const statusConfig: Record<string, { icon: any; color: string; bg: string; label: string }> = {
      pass: { icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', label: 'ناجح' },
      conditional_pass: { icon: AlertCircle, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', label: 'مشروط' },
      fail: { icon: XCircle, color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/20', label: 'فاشل' },
    };

    const config = statusConfig[result.status] || statusConfig.pass;
    const Icon = config.icon;

    return (
      <div className={`border rounded-2xl p-6 text-center ${config.bg}`}>
        <Icon className={`w-12 h-12 mx-auto mb-3 ${config.color}`} />
        <h4 className="font-bold text-white text-lg">تم إرسال فحص الجودة</h4>
        <p className="text-sm text-white/60 mt-1">
          الحالة: <span className={config.color}>{config.label}</span>
        </p>
        {result.id && (
          <p className="text-[10px] text-white/30 mt-2 font-mono">ID: {result.id}</p>
        )}
        {error && (
          <p className="text-xs text-amber-400 mt-2">⚠️ {error} (تم الحفظ محلياً)</p>
        )}
        <button
          onClick={resetForm}
          className="mt-4 px-4 py-2 bg-white/10 text-white/70 rounded-lg hover:bg-white/20 transition-colors text-sm"
        >
          فحص جديد
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6">
      <h3 className="font-bold text-white text-lg mb-1">فحص الجودة</h3>
      <p className="text-sm text-white/40 mb-4">{jobTitle}</p>

      {error && !submitted && (
        <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-white/60 mb-2">نوع الفحص</label>
          <select
            value={checkType}
            onChange={(e) => setCheckType(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-purple-500/50 transition-colors"
          >
            {CHECK_TYPES.map((type) => (
              <option key={type.value} value={type.value} className="bg-[#111]">
                {type.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-white/60 mb-2">نتيجة الفحص</label>
          <div className="grid grid-cols-3 gap-2">
            {(['pass', 'conditional_pass', 'fail'] as const).map((s) => {
              const config = {
                pass: { icon: CheckCircle, label: '✓ ناجح', active: 'bg-emerald-500 text-white' },
                conditional_pass: { icon: AlertCircle, label: '~ مشروط', active: 'bg-amber-500 text-white' },
                fail: { icon: XCircle, label: '✗ فاشل', active: 'bg-rose-500 text-white' },
              };
              const c = config[s];
              return (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={`py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
                    status === s
                      ? `${c.active} shadow-lg`
                      : 'bg-white/5 text-white/50 hover:bg-white/10 border border-white/10'
                  }`}
                >
                  <c.icon className="w-4 h-4" />
                  <span className="text-sm">{c.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-white/60 mb-2">ملاحظات</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="أضف ملاحظاتك عن الفحص..."
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 h-24 resize-none focus:outline-none focus:border-purple-500/50 transition-colors"
          />
        </div>

        <button
          onClick={submitCheck}
          disabled={submitting || status === 'pending'}
          className="w-full py-3 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
        >
          {submitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              جاري الإرسال...
            </>
          ) : (
            'إرسال فحص الجودة'
          )}
        </button>
      </div>
    </div>
  );
}

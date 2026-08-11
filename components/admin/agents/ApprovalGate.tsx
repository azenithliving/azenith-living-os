'use client';

import { useState, useEffect } from 'react';
import { ShieldAlert, CheckCircle, XCircle, Clock, Loader2, Inbox } from 'lucide-react';

interface PendingApproval {
  id: string;
  action_type: string;
  description: string;
  risk_level: 'low' | 'normal' | 'critical' | 'forbidden';
  status: string;
  requested_at?: string;
  created_at?: string;
  metadata?: {
    toolName?: string;
    params?: Record<string, unknown>;
  };
}

const RISK_STYLES: Record<string, { badge: string; border: string; icon: string }> = {
  low:      { badge: 'bg-emerald-500/20 text-emerald-300', border: 'border-emerald-500/20', icon: '🟢' },
  normal:   { badge: 'bg-blue-500/20 text-blue-300',    border: 'border-blue-500/20',    icon: '🔵' },
  critical: { badge: 'bg-amber-500/20 text-amber-300',  border: 'border-amber-500/20',   icon: '🟠' },
  forbidden:{ badge: 'bg-rose-500/20 text-rose-300',    border: 'border-rose-500/20',    icon: '🔴' },
};

const RISK_LABELS: Record<string, string> = {
  low: 'منخفض', normal: 'عادي', critical: 'حرج', forbidden: 'محظور',
};

export function ApprovalGate() {
  const [approvals, setApprovals] = useState<PendingApproval[]>([]);
  const [loading, setLoading]     = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [result, setResult]       = useState<{ id: string; success: boolean; message: string } | null>(null);

  useEffect(() => {
    fetchApprovals();
    const interval = setInterval(fetchApprovals, 30_000);
    return () => clearInterval(interval);
  }, []);

  async function fetchApprovals() {
    try {
      const res  = await fetch('/api/admin/agents/approval-queue');
      const data = await res.json();
      if (data.success) {
        // الـ API يُعيد data.approvals
        setApprovals(Array.isArray(data.approvals) ? data.approvals : []);
      }
    } catch (err) {
      console.error('fetchApprovals error:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleDecision(id: string, decision: 'approved' | 'rejected') {
    setProcessing(id);
    setResult(null);
    try {
      const res  = await fetch('/api/admin/agents/approval/decision', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ approval_id: id, decision }),
      });
      const data = await res.json();

      if (data.success) {
        setApprovals(prev => prev.filter(a => a.id !== id));
        setResult({ id, success: true, message: data.message || (decision === 'approved' ? 'تم التنفيذ بنجاح ✅' : 'تم الرفض') });
      } else {
        setResult({ id, success: false, message: data.error || 'فشل التنفيذ' });
      }
    } catch (err) {
      setResult({ id, success: false, message: 'خطأ في الاتصال' });
    } finally {
      setProcessing(null);
    }
  }

  const fmt = (dateStr?: string) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' });
  };

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-black flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-amber-400" />
          بوابة الموافقات
        </h2>
        {approvals.length > 0 && (
          <span className="px-3 py-1 bg-amber-500/20 border border-amber-500/30 text-amber-300 rounded-full text-xs font-bold animate-pulse">
            {approvals.length} معلقة
          </span>
        )}
        <button
          onClick={() => { setLoading(true); fetchApprovals(); }}
          className="text-xs text-white/40 hover:text-white/70 transition-colors"
        >
          تحديث
        </button>
      </div>

      {/* Result Banner */}
      {result && (
        <div className={`p-3 rounded-xl text-sm font-medium flex items-center gap-2 ${
          result.success ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                         : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
        }`}>
          {result.success ? <CheckCircle className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
          {result.message}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
        </div>
      ) : approvals.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Inbox className="w-12 h-12 text-white/10 mb-3" />
          <p className="text-white/50 font-medium">لا توجد طلبات معلقة</p>
          <p className="text-white/20 text-xs mt-1">الوكلاء لم يطلبوا موافقة حتى الآن</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
          {approvals.map((approval) => {
            const risk    = RISK_STYLES[approval.risk_level] ?? RISK_STYLES.normal;
            const isProc  = processing === approval.id;
            const dateStr = approval.requested_at ?? approval.created_at;

            return (
              <div
                key={approval.id}
                className={`border ${risk.border} bg-white/[0.02] rounded-2xl p-4 space-y-3 transition-all`}
              >
                {/* Top Row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2 py-0.5 rounded-lg text-xs font-bold ${risk.badge}`}>
                        {risk.icon} {RISK_LABELS[approval.risk_level] ?? approval.risk_level}
                      </span>
                      <code className="text-[10px] text-white/30 font-mono bg-white/[0.04] px-2 py-0.5 rounded">
                        {approval.metadata?.toolName ?? approval.action_type}
                      </code>
                    </div>
                    <p className="text-sm text-white/80 leading-snug">{approval.description}</p>
                  </div>
                  <div className="flex items-center gap-1 text-white/30 text-xs shrink-0">
                    <Clock className="w-3 h-3" />
                    {fmt(dateStr)}
                  </div>
                </div>

                {/* Params preview */}
                {approval.metadata?.params && Object.keys(approval.metadata.params).length > 0 && (
                  <pre className="text-[10px] text-white/30 bg-black/30 rounded-xl p-2 overflow-x-auto font-mono">
                    {JSON.stringify(approval.metadata.params, null, 2)}
                  </pre>
                )}

                {/* Buttons */}
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => handleDecision(approval.id, 'rejected')}
                    disabled={isProc}
                    className="flex-1 flex items-center justify-center gap-2 py-2 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl hover:bg-rose-500/20 disabled:opacity-40 transition-all text-sm font-bold"
                  >
                    {isProc ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                    رفض
                  </button>
                  <button
                    onClick={() => handleDecision(approval.id, 'approved')}
                    disabled={isProc}
                    className="flex-1 flex items-center justify-center gap-2 py-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl hover:bg-emerald-500/20 disabled:opacity-40 transition-all text-sm font-bold"
                  >
                    {isProc ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                    موافقة وتنفيذ
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

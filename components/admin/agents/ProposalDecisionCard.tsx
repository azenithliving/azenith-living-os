'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Sparkles, X } from 'lucide-react';
import {
  betterRequestMessage,
  decisionRequest,
  findProposal,
  isExpired,
  parseProposalId,
  proposalStatusLabel,
  riskLabel,
  type ProposalRow,
} from '@/lib/qayyim/proposal-card';

/**
 * The other end of the Telegram morning link.
 *
 * The story the owner reads on his phone names one proposal and links to it. Tapping
 * that link must land on the real row, with the three answers a decision has: run it,
 * bring a better version, refuse it. Nothing here is decorative — approve goes through
 * the same decision route the approval queue uses, which means it really executes.
 *
 * A link to a proposal that was already decided, or that expired, says exactly that
 * instead of showing buttons that would fail.
 */
export function ProposalDecisionCard() {
  const [proposalId, setProposalId] = useState<string | null>(null);
  const [row, setRow] = useState<ProposalRow | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'approved' | 'rejected' | null>(null);
  const [outcome, setOutcome] = useState<string | null>(null);

  useEffect(() => {
    setProposalId(parseProposalId(window.location.search));
  }, []);

  useEffect(() => {
    if (!proposalId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/admin/agents/approval-queue');
        const data = await res.json();
        if (!data?.success) throw new Error(data?.error || 'رد غير مفهوم');
        if (cancelled) return;
        setRow(findProposal(data.approvals as ProposalRow[], proposalId));
      } catch (err: any) {
        if (!cancelled) setError(err?.message || 'فشل الاتصال بقائمة القرارات');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [proposalId]);

  const dismiss = useCallback(() => {
    // The link is spent once he has looked at it — a stale param that survives a
    // reload re-opens a card for a decision that no longer exists.
    const url = new URL(window.location.href);
    url.searchParams.delete('proposal');
    window.history.replaceState({}, '', url.toString());
    setProposalId(null);
    setOutcome(null);
  }, []);

  const decide = useCallback(
    async (decision: 'approved' | 'rejected') => {
      if (!row) return;
      setBusy(decision);
      setError(null);
      try {
        const res = await fetch('/api/admin/agents/approval/decision', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(decisionRequest(row.id, decision)),
        });
        const data = await res.json();
        if (!res.ok || data?.success === false) {
          throw new Error(data?.error || data?.message || `رفض الخادم الطلب (${res.status})`);
        }
        setOutcome(
          decision === 'approved'
            ? data?.executed === false
              ? 'سجّلت الموافقة، بس التنفيذ الفعلي مترجّش دلوقتي'
              : 'وافقت — نُفّذ الاقتراح فعلاً'
            : 'رفضت الاقتراح، واتقفل',
        );
      } catch (err: any) {
        setError(err?.message || 'فشل الاتصال ببوابة القرارات');
      } finally {
        setBusy(null);
      }
    },
    [row],
  );

  const askBetter = useCallback(() => {
    if (!row) return;
    (window as any).__qayyimSend?.(betterRequestMessage(row));
    setOutcome('طلبت نسخة أحسن — هتوصلك في المحادثة');
  }, [row]);

  if (!proposalId) return null;

  return (
    <div className="fixed inset-x-0 bottom-24 z-[95] flex justify-center px-4 pointer-events-none">
      <div
        data-proposal-card=""
        className="pointer-events-auto w-full max-w-xl rounded-2xl border border-amber-500/30 bg-[#141210]/95 backdrop-blur shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 bg-amber-500/10">
          <span className="text-[11px] font-bold text-amber-300">قرار النهارده من رسالة تليجرام</span>
          <button
            onClick={dismiss}
            title="إغلاق"
            className="w-7 h-7 rounded-lg text-white/40 hover:text-white flex items-center justify-center"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="p-3">
          {row === undefined && !error && (
            <div className="flex items-center gap-2 text-[11px] text-white/50">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> بقرا الاقتراح…
            </div>
          )}

          {error && <div className="text-[11px] text-rose-300">{error}</div>}

          {row === null && !error && (
            <div className="text-[11px] text-white/60">
              مفيش قرار معلّق بهذا الرابط — يبقى اتاخدت فيه قرار، أو الرسالة قديمة.
            </div>
          )}

          {row && (
            <>
              <div className="text-[13px] text-white/90 leading-relaxed whitespace-pre-wrap">
                {row.description || row.metadata?.userMessage || 'اقتراح من السرب'}
              </div>
              <div className="mt-1 text-[10px] text-white/35">
                {proposalStatusLabel(row.status)} · درجة الخطورة: {riskLabel(row.risk_level)}
              </div>

              {isExpired(row) ? (
                <div className="mt-2 text-[11px] text-amber-300/80">
                  انتهى وقت هذا القرار. اطلب من السرب يعيد طرحه لو لسه مهم.
                </div>
              ) : (
                <div className="mt-3 grid grid-cols-3 gap-1.5">
                  <button
                    onClick={() => decide('approved')}
                    disabled={Boolean(busy)}
                    className="py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-[11px] font-bold flex items-center justify-center gap-1"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {busy === 'approved' ? 'بنفّذ…' : 'وافقت'}
                  </button>
                  <button
                    onClick={askBetter}
                    disabled={Boolean(busy)}
                    className="py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 disabled:opacity-40 text-amber-200 text-[11px] font-bold flex items-center justify-center gap-1"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    أحسن
                  </button>
                  <button
                    onClick={() => decide('rejected')}
                    disabled={Boolean(busy)}
                    className="py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 disabled:opacity-40 text-white/70 text-[11px]"
                  >
                    {busy === 'rejected' ? '…' : 'ارفض'}
                  </button>
                </div>
              )}

              {outcome && <div className="mt-2 text-[11px] text-emerald-300">{outcome}</div>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Sparkles } from 'lucide-react';
import {
  betterRequestMessage,
  decisionRequest,
  findProposal,
  isExpired,
  isPending,
  proposalStatusLabel,
  riskLabel,
  type ProposalRow,
} from '@/lib/ops/proposal-card';

/**
 * The three answers a decision has — in one component, so a decision cannot look different in two
 * places.
 *
 * It used to live inside the card that the Telegram morning link opens. But the swarm also asks for
 * approval inside the chat, and there the question had no buttons: the door held the proposal id and
 * dropped it, so the answer had to wait for a phone notification. Now the chat writes the id onto the
 * agent's own message and paints this block under it.
 */
export function ApprovalDecisionBlock({
  approvalId,
  onAskBetter,
}: {
  approvalId: string;
  onAskBetter?: (message: string) => void;
}) {
  const [row, setRow] = useState<ProposalRow | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'approved' | 'rejected' | null>(null);
  const [outcome, setOutcome] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setRow(undefined);
    setError(null);
    (async () => {
      try {
        const res = await fetch(`/api/admin/agents/approval-queue?id=${encodeURIComponent(approvalId)}`);
        const data = await res.json();
        if (!data?.success) throw new Error(data?.error || 'رد غير مفهوم');
        if (!cancelled) setRow(findProposal(data.approvals as ProposalRow[], approvalId));
      } catch (err: any) {
        if (!cancelled) setError(err?.message || 'فشل الاتصال بقائمة القرارات');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [approvalId]);

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
    const message = betterRequestMessage(row);
    if (onAskBetter) onAskBetter(message);
    else (window as any).__opsSend?.(message);
    setOutcome('طلبت نسخة أحسن — هتوصلك في المحادثة');
  }, [onAskBetter, row]);

  return (
    <div data-approval-block={approvalId}>
      {row === undefined && !error && (
        <div className="flex items-center gap-2 text-[11px] text-white/50">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> بقرا الاقتراح…
        </div>
      )}

      {error && <div className="text-[11px] text-rose-300">{error}</div>}

      {row === null && !error && (
        <div className="text-[11px] text-white/60">
          مفيش قرار بهذا الرقم — يبقى الرسالة قديمة أو اتعملها حاجة تانية.
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

          {!isPending(row) ? (
            /* قرار اتاخد: يبقى سطر يقول إيه اللي حصل، مش أزرار ضايعة. */
            <div data-approval-settled={row.status ?? 'unknown'} className="mt-2 text-[11px] text-emerald-300/90">
              القرار ده اتقفل: {proposalStatusLabel(row.status)}.
            </div>
          ) : isExpired(row) ? (
            <div className="mt-2 text-[11px] text-amber-300/80">
              انتهى وقت هذا القرار. اطلب من السرب يعيد طرحه لو لسه مهم.
            </div>
          ) : (
            <div className="mt-3 grid grid-cols-3 gap-1.5">
              <button
                onClick={() => decide('approved')}
                disabled={Boolean(busy)}
                data-approval-decision="approved"
                className="py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-[11px] font-bold flex items-center justify-center gap-1"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                {busy === 'approved' ? 'بنفّذ…' : 'وافقت'}
              </button>
              <button
                onClick={askBetter}
                disabled={Boolean(busy)}
                data-approval-decision="better"
                className="py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 disabled:opacity-40 text-amber-200 text-[11px] font-bold flex items-center justify-center gap-1"
              >
                <Sparkles className="w-3.5 h-3.5" />
                أحسن
              </button>
              <button
                onClick={() => decide('rejected')}
                disabled={Boolean(busy)}
                data-approval-decision="rejected"
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
  );
}

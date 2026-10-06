'use client';

import { useCallback, useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { ApprovalDecisionBlock } from '@/components/admin/agents/ApprovalDecisionBlock';
import { parseProposalId } from '@/lib/ops/proposal-card';

/**
 * The other end of the Telegram morning link.
 *
 * The story the owner reads on his phone names one proposal and links to it. Tapping that link must
 * land on the real row, with the three answers a decision has: run it, bring a better version, refuse
 * it. Nothing here is decorative — approve goes through the same decision route the approval queue
 * uses, which means it really executes.
 *
 * The buttons themselves live in `ApprovalDecisionBlock`, because the same decision is now answered
 * inside the chat that raised it too. Two copies of that UI would drift apart on the one screen where
 * being wrong costs a real action.
 */
export function ProposalDecisionCard() {
  const [proposalId, setProposalId] = useState<string | null>(null);

  useEffect(() => {
    setProposalId(parseProposalId(window.location.search));
  }, []);

  const dismiss = useCallback(() => {
    // The link is spent once he has looked at it — a stale param that survives a
    // reload re-opens a card for a decision that no longer exists.
    const url = new URL(window.location.href);
    url.searchParams.delete('proposal');
    window.history.replaceState({}, '', url.toString());
    setProposalId(null);
  }, []);

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
          <ApprovalDecisionBlock approvalId={proposalId} />
        </div>
      </div>
    </div>
  );
}

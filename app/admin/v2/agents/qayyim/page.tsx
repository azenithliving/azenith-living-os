'use client';

import { ChatPanel } from '@/components/admin/agents/ChatPanel';
import { ProposalDecisionCard } from '@/components/admin/agents/ProposalDecisionCard';

/**
 * P5-M2 — full-screen Qayyim chat (WhatsApp-style surface).
 * Deep-linkable, browser-back works, unread separator handled inside ChatPanel.
 * P6-M6: the Telegram morning story links straight here with `?proposal=<id>`,
 * and that link opens the decision it is talking about.
 */
export default function QayyimChatPage() {
  return (
    <div className="fixed inset-0 z-[90] bg-[#0B0B0D]" dir="rtl">
      <ChatPanel agentKey="qayyim-core" fullScreen />
      <ProposalDecisionCard />
    </div>
  );
}

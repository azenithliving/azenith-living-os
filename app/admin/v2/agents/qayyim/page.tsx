'use client';

import { useEffect, useState } from 'react';
import { ChatPanel } from '@/components/admin/agents/ChatPanel';
import { ProposalDecisionCard } from '@/components/admin/agents/ProposalDecisionCard';
import { AGENT_ROLES } from '@/lib/qayyim/agent-roles';

/**
 * P5-M2 — full-screen Qayyim chat (WhatsApp-style surface).
 * Deep-linkable, browser-back works, unread separator handled inside ChatPanel.
 * P6-M6: the command palette can hand you to another agent's chat, and the
 * Telegram morning story links straight to the decision it names.
 *
 * The query is read from the live URL rather than `useSearchParams` so the page
 * stays prerenderable without a Suspense boundary — and an unknown agent key is
 * ignored instead of becoming a conversation with something that does not exist.
 */
const DEFAULT_AGENT = 'qayyim-core';

function agentFromUrl(): string {
  const wanted = new URLSearchParams(window.location.search).get('agent') || '';
  return Object.keys(AGENT_ROLES).includes(wanted) ? wanted : DEFAULT_AGENT;
}

export default function QayyimChatPage() {
  const [agentKey, setAgentKey] = useState(DEFAULT_AGENT);

  useEffect(() => {
    setAgentKey(agentFromUrl());
  }, []);

  return (
    <div className="fixed inset-0 z-[90] bg-[#0B0B0D]" dir="rtl">
      <ChatPanel key={agentKey} agentKey={agentKey} fullScreen />
      <ProposalDecisionCard />
    </div>
  );
}

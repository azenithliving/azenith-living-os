'use client';

import { ChatPanel } from '@/components/admin/agents/ChatPanel';

/**
 * P5-M2 — full-screen Qayyim chat (WhatsApp-style surface).
 * Deep-linkable, browser-back works, unread separator handled inside ChatPanel.
 */
export default function QayyimChatPage() {
  return (
    <div className="fixed inset-0 z-[90] bg-[#0B0B0D]" dir="rtl">
      <ChatPanel agentKey="qayyim-core" fullScreen />
    </div>
  );
}

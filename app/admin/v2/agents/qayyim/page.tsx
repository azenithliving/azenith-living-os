'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * The morning story on Telegram and the decision card deep-link here with a query
 * (`?agent=`, `?proposal=`, `?decision=`), so the retired address forwards the
 * query as well as the path. Removed in P7-M5 once nothing links here anymore.
 */
export default function LegacyAgentChatPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace(`/admin/v2/agents/ops${window.location.search}`);
  }, [router]);

  return null;
}

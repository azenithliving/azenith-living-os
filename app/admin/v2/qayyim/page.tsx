'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * The studio moved to `/admin/v2/ops`, but a result card the owner already opened
 * — and every link written before P7 — still carries the retired address. The
 * query travels with it because `?highlight=` is what the card was pointing at.
 * Removed in P7-M5 once nothing links here anymore.
 */
export default function LegacyStudioPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace(`/admin/v2/ops${window.location.search}`);
  }, [router]);

  return null;
}

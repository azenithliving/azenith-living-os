'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';

type Alert = { id: number; label: string; who: string; at: string | null; note: string };

const REFRESH_MS = 20_000;

/** Egyptian, not literal: «منذ ٣ دقائق» reads right, «3 minutes ago» does not. */
function ago(iso: string | null): string {
  if (!iso) return '';
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (mins < 1) return 'الآن';
  if (mins === 1) return 'منذ دقيقة';
  if (mins === 2) return 'منذ دقيقتين';
  if (mins < 11) return `منذ ${mins} دقائق`;
  if (mins < 60) return `منذ ${mins} دقيقة`;
  const hours = Math.round(mins / 60);
  return hours === 1 ? 'منذ ساعة' : `منذ ${hours} ساعات`;
}

/**
 * The red strip the manager raises when the store is in trouble.
 *
 * It is not a decoration and it holds no state of its own: the door it reads answers
 * from the same ledger every surface already writes to, and «تم الاستلام» records an
 * acknowledgement there, so the strip cannot come back after a reload claiming a
 * trouble the owner already closed.
 */
export function EmergencyBanner() {
  const [alert, setAlert] = useState<Alert | null>(null);
  const [count, setCount] = useState(0);
  const [busy, setBusy] = useState(false);

  const read = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/agents/alerts', { cache: 'no-store' });
      const data = await res.json();
      if (!data?.success) return;
      setAlert((data.alert as Alert) ?? null);
      setCount(Number(data.count) || 0);
    } catch {
      // A ledger that does not answer leaves the strip as it was — it never invents one.
    }
  }, []);

  useEffect(() => {
    read();
    const iv = setInterval(read, REFRESH_MS);
    return () => clearInterval(iv);
  }, [read]);

  async function acknowledge() {
    if (!alert || busy) return;
    setBusy(true);
    try {
      await fetch('/api/admin/agents/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alert_id: alert.id }),
      });
      await read();
    } finally {
      setBusy(false);
    }
  }

  if (!alert) return null;

  const detail = [alert.who, alert.note].filter(Boolean).join(' — ');

  return (
    <div
      data-emergency-banner=""
      className="flex items-center gap-2 bg-rose-600 px-4 py-2 text-white shadow-lg"
      dir="rtl"
    >
      <AlertTriangle className="w-4 h-4 shrink-0 animate-pulse" />
      <span className="min-w-0 flex-1 truncate text-[12px] font-black">
        {alert.label}
        {detail ? <span className="font-bold text-white/85"> — {detail}</span> : null}
      </span>
      {count > 1 && (
        <span className="shrink-0 rounded-full bg-black/25 px-2 py-0.5 text-[10px] font-bold">
          {count} تنبيهات
        </span>
      )}
      <span className="shrink-0 text-[10px] text-white/80">{ago(alert.at)}</span>
      <button
        data-alert-ack=""
        onClick={acknowledge}
        disabled={busy}
        className="shrink-0 rounded-lg bg-white/15 px-2.5 py-1 text-[11px] font-bold hover:bg-white/25 disabled:opacity-50"
      >
        {busy ? 'بستلم…' : 'تم الاستلام'}
      </button>
    </div>
  );
}

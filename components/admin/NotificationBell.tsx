'use client';

import { useState, useEffect, useCallback } from 'react';
import { Bell, Bot, Check, Loader2, X } from 'lucide-react';
import { arNum } from '@/lib/ops/metricLabels';
import { arabicRefusal } from '@/lib/ops/alerts';

/**
 * A bell over the store's own alert ledger — the same reading rule the cockpit strip and
 * NotificationsPanel use, so two surfaces cannot report two different counts.
 *
 * It used to be written against the contract this door had before it was re-pointed. Measured
 * 2026-11-04 (scratch/measure-bell-contract.mjs): the door answers 6 row fields and `severity`
 * is not one of them; the bell declared it anyway, ignored the door's `unreadCount` and
 * `restingLine` and printed its own «no notifications», asked for 10 rows and showed 8, believed
 * its own mark-read without reading the door's reply, and carried a footer button that only
 * closed the pop-over.
 *
 * Closing an alert writes a receipt in the ledger, so a closed alert leaves the strip — there is
 * no read flag on the row to flip.
 */
interface OpenAlert {
  id: string;
  title: string;
  message: string;
  timestamp: string;
}

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [alerts, setAlerts] = useState<OpenAlert[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [restingLine, setRestingLine] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/notifications?limit=20', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setRefusal(arabicRefusal(data?.error));
        return;
      }
      setRefusal(null);
      setAlerts((data.data as OpenAlert[]) ?? []);
      setUnreadCount(Number(data.unreadCount) || 0);
      setRestingLine((data.restingLine as string | null) ?? null);
    } catch {
      setRefusal('الباب ما وصلش أصلًا — مفيش تنبيهات اتقريت.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 30000);
    return () => clearInterval(interval);
  }, [fetchAlerts]);

  async function markAllRead() {
    const ids = alerts.map((alert) => alert.id);
    if (!ids.length) return;
    setMarking(true);
    setRefusal(null);
    try {
      const res = await fetch('/api/admin/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notification_ids: ids, action: 'mark_read' }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        // The ledger kept the receipt; the strip loses the rows instead of flagging them.
        setAlerts([]);
        setUnreadCount(0);
      } else {
        setRefusal(arabicRefusal(data?.error));
      }
    } catch {
      setRefusal('الباب ما وصلش — التنبيهات ما اتعلامتش كمقروءة.');
    } finally {
      setMarking(false);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label="الإشعارات"
        aria-expanded={isOpen}
        className="relative p-2 hover:bg-white/5 rounded-xl transition-colors"
      >
        <Bell className="w-5 h-5 text-white/60" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-rose-500 rounded-full text-[10px] text-white flex items-center justify-center font-bold px-1">
            {arNum(unreadCount)}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 top-full mt-2 w-80 bg-[#111] border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white text-sm">الإشعارات</h3>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 bg-rose-500/20 text-rose-400 text-[10px] rounded-full font-bold">
                    {arNum(unreadCount)}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    disabled={marking}
                    className="p-1.5 hover:bg-white/5 rounded-lg transition-colors disabled:opacity-50"
                    title="تعليم الكل كمقروء"
                  >
                    {marking ? (
                      <Loader2 className="w-4 h-4 text-white/40 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4 text-white/40" />
                    )}
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  aria-label="إغلاق الإشعارات"
                  className="p-1.5 hover:bg-white/5 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4 text-white/40" />
                </button>
              </div>
            </div>

            {refusal && (
              <p className="px-4 py-3 text-[11px] leading-relaxed text-rose-200 border-b border-white/5">
                {refusal}
              </p>
            )}

            <div className="max-h-[350px] overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 text-white/30 animate-spin" />
                </div>
              ) : alerts.length === 0 ? (
                <div className="text-center py-8 px-4">
                  <Bell className="w-8 h-8 text-white/10 mx-auto mb-2" />
                  <p className="text-white/50 text-xs leading-relaxed">
                    {restingLine ?? 'الإشعارات ما اتقريتش — ارجع للصفحة تاني.'}
                  </p>
                </div>
              ) : (
                alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="p-3 flex items-start gap-3 border-b border-white/5 hover:bg-white/[0.02] transition-colors"
                  >
                    <Bot className="w-4 h-4 text-white/40 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-white truncate">{alert.title}</p>
                      {alert.message && (
                        <p className="text-[10px] text-white/40 mt-0.5 line-clamp-2">{alert.message}</p>
                      )}
                      <p className="text-[9px] text-white/20 mt-0.5">
                        {new Date(alert.timestamp).toLocaleTimeString('ar-EG', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-3 border-t border-white/10">
              <a
                href="/admin"
                onClick={() => setIsOpen(false)}
                className="block w-full text-center text-[10px] text-white/40 hover:text-white/60 transition-colors"
              >
                كل الإشعارات في صفحة التحكم
              </a>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

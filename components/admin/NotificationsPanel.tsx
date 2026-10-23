'use client';

import { useState, useEffect, useCallback } from 'react';
import { Bell, Bot, Check, Loader2 } from 'lucide-react';
import { arNum } from '@/lib/ops/metricLabels';

interface Notification {
  id: string;
  title: string;
  message: string;
  timestamp: string;
}

/**
 * The owner's alert strip in the old house. It shows trouble the store recorded in its
 * own ledger and nobody has looked at yet — rows come from the one reading rule in
 * `lib/ops/alerts.ts`, the same rule the cockpit's red strip uses, so the two counts
 * cannot drift apart. A row the door refused to read is reported as a refusal; an empty
 * list is only ever claimed with the window it was measured over.
 */
export function NotificationsPanel() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [restingLine, setRestingLine] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/notifications?limit=20', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setRefusal(typeof data?.error === 'string' && data.error ? data.error : 'الباب ما ردّش على التنبيهات');
        return;
      }
      setRefusal(null);
      setNotifications((data.data as Notification[]) ?? []);
      setRestingLine((data.restingLine as string | null) ?? null);
    } catch {
      setRefusal('الباب ما وصلش أصلًا — مفيش تنبيهات اتقريت.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  async function markAsRead(ids: string[]) {
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
        // An alert he closed leaves the strip — the ledger keeps the receipt, not a flag.
        setNotifications((prev) => prev.filter((n) => !ids.includes(n.id)));
      } else {
        setRefusal(
          typeof data?.error === 'string' && data.error
            ? data.error
            : 'التعليم كمقروء ما تمّ — التنبيهات لسه في مكانها.',
        );
      }
    } catch {
      setRefusal('الباب ما وصلش — التنبيهات ما اتعلامتش كمقروءة.');
    } finally {
      setMarking(false);
    }
  }

  const openCount = notifications.length;

  return (
    <div className="bg-white/[0.02] border border-white/10 rounded-2xl overflow-hidden">
      <div className="p-4 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Bell className="w-5 h-5 text-white/60" />
            {openCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 bg-rose-500 rounded-full text-[9px] text-white flex items-center justify-center font-bold">
                {arNum(openCount)}
              </span>
            )}
          </div>
          <div>
            <h3 className="font-bold text-white text-sm">الإشعارات</h3>
            <p className="text-[10px] text-white/40">
              {openCount > 0 ? `${arNum(openCount)} في انتظارك` : 'مفيش انتظار دلوقتي'}
            </p>
          </div>
        </div>

        {openCount > 0 && (
          <button
            onClick={() => markAsRead(notifications.map((n) => n.id))}
            disabled={marking}
            className="flex items-center gap-1 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-[10px] text-white/60 hover:text-white transition-all disabled:opacity-50"
          >
            {marking ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Check className="w-3 h-3" />
            )}
            قراءة الكل
          </button>
        )}
      </div>

      {refusal && (
        <p className="px-4 py-3 text-[11px] leading-relaxed text-rose-200 border-b border-white/5">
          {refusal}
        </p>
      )}

      <div className="max-h-[400px] overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 text-white/30 animate-spin" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-12 px-4">
            <Bell className="w-8 h-8 text-white/10 mx-auto mb-2" />
            <p className="text-white/70 text-xs leading-relaxed">
              {restingLine ?? 'التنبيهات ما اتقريتش — دوس على الصفحة تاني.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {notifications.map((notification) => (
              <div key={notification.id} className="p-4 flex items-start gap-3">
                <div className="mt-0.5">
                  <Bot className="w-4 h-4 text-white/50" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-white truncate">{notification.title}</p>
                  {notification.message && (
                    <p className="text-[11px] text-white/40 mt-0.5 line-clamp-2">{notification.message}</p>
                  )}
                  <p className="text-[9px] text-white/20 mt-1">
                    {new Date(notification.timestamp).toLocaleTimeString('ar-EG', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
                <button
                  onClick={() => markAsRead([notification.id])}
                  className="p-1 hover:bg-white/10 rounded transition-colors"
                  title="تحديد كمقروء"
                >
                  <Check className="w-3 h-3 text-white/30" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

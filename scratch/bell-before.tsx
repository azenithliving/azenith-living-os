'use client';

import { useState, useEffect, useCallback } from 'react';
import { Bell, X, Check, Loader2, AlertTriangle, CheckCircle, Info, Bot } from 'lucide-react';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: string;
  read: boolean;
}

const typeIcons: Record<string, any> = {
  info: Info,
  success: CheckCircle,
  warning: AlertTriangle,
  error: X,
  agent_event: Bot,
  task_complete: CheckCircle,
  quality_alert: AlertTriangle,
};

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/notifications?limit=10', { cache: 'no-store' });
      const data = await res.json();
      if (data.success) {
        setNotifications(data.data);
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  async function markAllRead() {
    setLoading(true);
    try {
      const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
      if (unreadIds.length === 0) return;

      await fetch('/api/admin/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notification_ids: unreadIds, action: 'mark_read' }),
      });

      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (err) {
      console.error('Error marking notifications:', err);
    }
    setLoading(false);
  }

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 hover:bg-white/5 rounded-xl transition-colors"
      >
        <Bell className="w-5 h-5 text-white/60" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-rose-500 rounded-full text-[10px] text-white flex items-center justify-center font-bold px-1">
            {unreadCount > 9 ? '9+' : unreadCount}
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
                    {unreadCount}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    disabled={loading}
                    className="p-1.5 hover:bg-white/5 rounded-lg transition-colors disabled:opacity-50"
                    title="تحديد الكل كمقروء"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 text-white/40 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4 text-white/40" />
                    )}
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 hover:bg-white/5 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4 text-white/40" />
                </button>
              </div>
            </div>

            <div className="max-h-[350px] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="text-center py-8">
                  <Bell className="w-8 h-8 text-white/10 mx-auto mb-2" />
                  <p className="text-white/30 text-xs">لا توجد إشعارات</p>
                </div>
              ) : (
                notifications.slice(0, 8).map((notification) => {
                  const Icon = typeIcons[notification.type] || Info;
                  return (
                    <div
                      key={notification.id}
                      className={`p-3 flex items-start gap-3 border-b border-white/5 hover:bg-white/[0.02] transition-colors ${
                        !notification.read ? 'bg-white/[0.02]' : ''
                      }`}
                    >
                      <Icon className="w-4 h-4 text-white/40 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-white truncate">{notification.title}</p>
                        <p className="text-[10px] text-white/30 mt-0.5 truncate">{notification.message}</p>
                        <p className="text-[9px] text-white/20 mt-0.5">
                          {new Date(notification.timestamp).toLocaleTimeString('ar-EG', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                      {!notification.read && (
                        <div className="w-2 h-2 bg-blue-400 rounded-full mt-1.5 flex-shrink-0" />
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {notifications.length > 0 && (
              <div className="p-3 border-t border-white/10">
                <button
                  onClick={() => {
                    setIsOpen(false);
                  }}
                  className="w-full text-center text-[10px] text-white/40 hover:text-white/60 transition-colors"
                >
                  عرض جميع الإشعارات
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

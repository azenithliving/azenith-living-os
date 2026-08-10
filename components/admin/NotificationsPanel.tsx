'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Bell,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Info,
  Bot,
  Check,
  Loader2,
} from 'lucide-react';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  link?: string;
  timestamp: string;
  read: boolean;
}

const typeIcons: Record<string, any> = {
  info: Info,
  success: CheckCircle,
  warning: AlertTriangle,
  error: XCircle,
  agent_event: Bot,
  task_complete: CheckCircle,
  quality_alert: AlertTriangle,
};

const severityColors: Record<string, string> = {
  low: 'border-white/5 bg-white/[0.02]',
  medium: 'border-blue-500/20 bg-blue-500/5',
  high: 'border-amber-500/20 bg-amber-500/5',
  critical: 'border-rose-500/30 bg-rose-500/10',
};

const severityDots: Record<string, string> = {
  low: 'bg-white/20',
  medium: 'bg-blue-400',
  high: 'bg-amber-400 animate-pulse',
  critical: 'bg-rose-500 animate-pulse',
};

export function NotificationsPanel() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/notifications?limit=20', { cache: 'no-store' });
      const data = await res.json();
      if (data.success) {
        setNotifications(data.data);
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
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
    setMarking(true);
    try {
      await fetch('/api/admin/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notification_ids: ids, action: 'mark_read' }),
      });
      setNotifications((prev) =>
        prev.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n))
      );
    } catch (err) {
      console.error('Error marking notifications:', err);
    }
    setMarking(false);
  }

  const unreadCount = notifications.filter((n) => !n.read).length;
  const criticalCount = notifications.filter((n) => n.severity === 'critical' && !n.read).length;

  return (
    <div className="bg-white/[0.02] border border-white/10 rounded-2xl overflow-hidden">
      <div className="p-4 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Bell className="w-5 h-5 text-white/60" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 rounded-full text-[9px] text-white flex items-center justify-center font-bold">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </div>
          <div>
            <h3 className="font-bold text-white text-sm">الإشعارات</h3>
            <p className="text-[10px] text-white/40">
              {unreadCount > 0 ? `${unreadCount} غير مقروء` : 'لا توجد إشعارات جديدة'}
            </p>
          </div>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={() => markAsRead(notifications.filter((n) => !n.read).map((n) => n.id))}
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

      <div className="max-h-[400px] overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 text-white/30 animate-spin" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-12">
            <Bell className="w-8 h-8 text-white/10 mx-auto mb-2" />
            <p className="text-white/30 text-xs">لا توجد إشعارات</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {notifications.map((notification) => {
              const Icon = typeIcons[notification.type] || Info;
              return (
                <div
                  key={notification.id}
                  className={`p-4 flex items-start gap-3 transition-all hover:bg-white/[0.02] ${
                    !notification.read ? severityColors[notification.severity] : 'opacity-60'
                  }`}
                >
                  <div className="mt-0.5">
                    <Icon className="w-4 h-4 text-white/50" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-medium text-white truncate">{notification.title}</p>
                      <div className={`w-1.5 h-1.5 rounded-full ${severityDots[notification.severity]}`} />
                    </div>
                    <p className="text-[11px] text-white/40 mt-0.5 line-clamp-2">{notification.message}</p>
                    <p className="text-[9px] text-white/20 mt-1">
                      {new Date(notification.timestamp).toLocaleTimeString('ar-EG', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  {!notification.read && (
                    <button
                      onClick={() => markAsRead([notification.id])}
                      className="p-1 hover:bg-white/10 rounded transition-colors"
                      title="تحديد كمقروء"
                    >
                      <Check className="w-3 h-3 text-white/30" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

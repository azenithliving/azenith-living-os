'use client';

import { useState, useEffect } from 'react';
import { Crown, AlertTriangle, Loader2, RefreshCw, TrendingUp } from 'lucide-react';

interface DashboardData {
  orders_summary: {
    pending_orders: number;
    in_production: number;
    ready_for_delivery: number;
    delivered_this_month: number;
  };
  production_status: {
    active_jobs: number;
    completed_today: number;
    delayed_jobs: number;
  };
  pending_approvals: Array<{
    id: string;
    type: string;
    title: string;
    description?: string;
    requested_by: string;
    amount?: number;
  }>;
  revenue_stats: {
    this_month_revenue: number;
    this_month_profit: number;
    pending_payments: number;
  };
  agent_stats: {
    prime_tasks_completed: number;
    vanguard_tasks_completed: number;
    active_conversations: number;
  };
  alerts: Array<{
    type: string;
    message: string;
    severity: 'info' | 'warning' | 'critical';
  }>;
}

export default function OwnerDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedApproval, setExpandedApproval] = useState<string | null>(null);
  const [approvalAction, setApprovalAction] = useState<string | null>(null);
  const [approvalError, setApprovalError] = useState<string | null>(null);

  async function fetchDashboardData() {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/admin/owner/dashboard', { cache: 'no-store' });
      if (!response.ok) throw new Error('Failed to fetch dashboard data');
      const result = await response.json();
      
      if (result.success) {
        const dashboard = result.data || {};
        setData({
          orders_summary: {
            pending_orders: dashboard.today?.orders_pending || 0,
            in_production: dashboard.today?.orders_in_production || 0,
            ready_for_delivery: dashboard.today?.orders_ready || 0,
            delivered_this_month: dashboard.this_month?.completed_orders || 0,
          },
          production_status: {
            active_jobs: dashboard.today?.orders_in_production || 0,
            completed_today: dashboard.this_month?.completed_orders || 0,
            delayed_jobs: dashboard.alerts?.filter((alert: { severity?: string }) => alert.severity === 'critical' || alert.severity === 'high').length || 0,
          },
          pending_approvals: dashboard.pending_decisions || [],
          revenue_stats: {
            this_month_revenue: dashboard.this_month?.total_revenue || 0,
            this_month_profit: dashboard.this_month?.estimated_profit || 0,
            pending_payments: dashboard.today?.payments_due || 0,
          },
          agent_stats: {
            prime_tasks_completed: dashboard.agent_performance?.prime?.completed_tasks || 0,
            vanguard_tasks_completed: dashboard.agent_performance?.vanguard?.completed_tasks || 0,
            active_conversations: dashboard.agent_performance?.active_devices || 0,
          },
          alerts: (dashboard.alerts || []).map((alert: { event_type?: string; message?: string; severity?: string }) => ({
            type: alert.event_type || 'system',
            message: alert.message || 'تنبيه نظام بدون وصف',
            severity: alert.severity === 'high' ? 'critical' : alert.severity === 'critical' ? 'critical' : alert.severity === 'warning' ? 'warning' : 'info',
          })),
        });
      } else {
        throw new Error(result.error || 'Unknown error');
      }
    } catch (err) {
      console.error('Dashboard fetch error:', err);
      setError('فشل في تحميل البيانات. اضغط تحديث للمحاولة.');
    } finally {
      setLoading(false);
    }
  }

  async function decideApproval(approvalId: string, decision: 'approved' | 'rejected') {
    setApprovalAction(`${approvalId}:${decision}`);
    setApprovalError(null);

    try {
      const response = await fetch('/api/admin/owner/approval/decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approval_id: approvalId, decision }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'تعذر تسجيل القرار.');
      }
      setExpandedApproval(null);
      await fetchDashboardData();
    } catch (decisionError) {
      setApprovalError(decisionError instanceof Error ? decisionError.message : 'تعذر تسجيل القرار.');
    } finally {
      setApprovalAction(null);
    }
  }

  const workflowTotal =
    (data?.orders_summary.pending_orders || 0) +
    (data?.orders_summary.in_production || 0) +
    (data?.orders_summary.ready_for_delivery || 0) +
    (data?.orders_summary.delivered_this_month || 0);

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-[#C5A059] animate-spin mx-auto mb-4" />
          <p className="text-white/50">جاري تحميل لوحة المالك السيادية...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-6">
        <div className="text-center max-w-md p-8 rounded-3xl border border-rose-500/20 bg-rose-500/5">
          <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
          <p className="text-white mb-6 font-medium">{error}</p>
          <button
            onClick={fetchDashboardData}
            className="w-full py-3 bg-[#C5A059] text-black font-bold rounded-xl hover:bg-[#D4B16A] flex items-center justify-center gap-2 transition-all"
          >
            <RefreshCw className="w-4 h-4" />
            تحديث البيانات
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto bg-[#0A0A0A] min-h-screen text-white">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <div className="relative">
            <div className="absolute inset-0 bg-[#C5A059] blur-xl opacity-20 rounded-full" />
            <div className="relative p-4 bg-gradient-to-br from-[#C5A059] to-[#8B7355] rounded-2xl shadow-2xl">
              <Crown className="w-8 h-8 text-black" />
            </div>
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight">لوحة تحكم المالك</h1>
            <p className="text-white/40 mt-1 flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              الرقابة المركزية والسيادة المطلقة
            </p>
          </div>
        </div>
        <EmergencyStopButton />
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="الإيرادات الشهرية"
          value={`${(data?.revenue_stats.this_month_revenue || 0).toLocaleString()} ج`}
          icon={<TrendingUp className="w-5 h-5" />}
          color="gold"
        />
        <MetricCard
          title="الطلبات المعلّقة"
          value={data?.orders_summary.pending_orders || 0}
          icon="📦"
          color="blue"
        />
        <MetricCard
          title="قيد التصنيع"
          value={data?.orders_summary.in_production || 0}
          icon="🏭"
          color="purple"
        />
        <MetricCard
          title="موافقات معلقة"
          value={data?.pending_approvals.length || 0}
          icon="⏳"
          color="rose"
        />
      </div>

      {/* Main Intelligence Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Production Intelligence */}
          <div className="bg-white/[0.02] border border-white/5 rounded-[2.5rem] p-8 backdrop-blur-3xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#C5A059]/5 blur-3xl rounded-full" />
            <h2 className="text-xl font-bold mb-6 flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400">🏭</div>
              ذكاء الإنتاج (Production Intel)
            </h2>
            <div className="grid grid-cols-3 gap-6">
              <div className="p-6 bg-white/[0.03] border border-white/5 rounded-3xl text-center group-hover:border-blue-500/20 transition-all">
                <p className="text-4xl font-black text-blue-400 mb-1">{data?.production_status.active_jobs || 0}</p>
                <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold">مهام نشطة</p>
              </div>
              <div className="p-6 bg-white/[0.03] border border-white/5 rounded-3xl text-center group-hover:border-emerald-500/20 transition-all">
                <p className="text-4xl font-black text-emerald-400 mb-1">{data?.production_status.completed_today || 0}</p>
                <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold">منجز الشهر</p>
              </div>
              <div className="p-6 bg-white/[0.03] border border-white/5 rounded-3xl text-center group-hover:border-rose-500/20 transition-all">
                <p className="text-4xl font-black text-rose-400 mb-1">{data?.production_status.delayed_jobs || 0}</p>
                <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold">متأخرات</p>
              </div>
            </div>
          </div>

          {/* Operational Flow */}
          <div className="bg-white/[0.02] border border-white/5 rounded-[2.5rem] p-8">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-3">
              <div className="p-2 bg-purple-500/10 rounded-lg text-purple-400">📦</div>
              التدفق التشغيلي (Operational Flow)
            </h2>
            <div className="space-y-4">
              <OrderStatusRow label="قيد المراجعة" count={data?.orders_summary.pending_orders || 0} color="gold" progress={workflowTotal ? Math.round(((data?.orders_summary.pending_orders || 0) / workflowTotal) * 100) : 0} />
              <OrderStatusRow label="خط الإنتاج" count={data?.orders_summary.in_production || 0} color="blue" progress={workflowTotal ? Math.round(((data?.orders_summary.in_production || 0) / workflowTotal) * 100) : 0} />
              <OrderStatusRow label="الجاهزية للشحن" count={data?.orders_summary.ready_for_delivery || 0} color="emerald" progress={workflowTotal ? Math.round(((data?.orders_summary.ready_for_delivery || 0) / workflowTotal) * 100) : 0} />
              <OrderStatusRow label="منجز هذا الشهر" count={data?.orders_summary.delivered_this_month || 0} color="purple" progress={workflowTotal ? Math.round(((data?.orders_summary.delivered_this_month || 0) / workflowTotal) * 100) : 0} />
            </div>
          </div>
        </div>

        {/* Sidebar Intelligence */}
        <div className="space-y-8">
          {/* Executive Approvals */}
          <div className="bg-white/[0.02] border border-white/5 rounded-[2.5rem] p-6">
            <h2 className="text-lg font-bold mb-6 flex items-center gap-3">
              <div className="p-2 bg-rose-500/10 rounded-lg text-rose-400">⏳</div>
              الموافقات التنفيذية
            </h2>
            {data?.pending_approvals && data.pending_approvals.length > 0 ? (
              <div className="space-y-4">
                {data.pending_approvals.map((approval) => (
                  <div key={approval.id} className="p-4 bg-white/[0.03] border border-white/5 rounded-2xl hover:border-[#C5A059]/30 transition-all group">
                    <p className="font-bold text-sm text-white/90 group-hover:text-[#C5A059]">{approval.title}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[10px] text-white/30 uppercase font-bold tracking-wider">{approval.requested_by}</span>
                      {approval.amount && (
                        <span className="text-xs font-black text-[#C5A059]">{approval.amount.toLocaleString()} ج</span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setApprovalError(null);
                        setExpandedApproval((current) => current === approval.id ? null : approval.id);
                      }}
                      className="w-full mt-4 py-2 bg-white/5 border border-white/10 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-[#C5A059] hover:text-black transition-all"
                    >
                      {expandedApproval === approval.id ? 'إغلاق التفاصيل' : 'فحص الطلب'}
                    </button>
                    {expandedApproval === approval.id ? (
                      <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-white/70">
                        <p>{approval.description || 'لا توجد ملاحظات إضافية لهذا الطلب.'}</p>
                        {approvalError ? <p className="mt-2 text-rose-300">{approvalError}</p> : null}
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => void decideApproval(approval.id, 'approved')}
                            disabled={approvalAction !== null}
                            className="rounded-lg bg-emerald-500/20 px-3 py-2 text-[10px] font-bold text-emerald-300 hover:bg-emerald-500/30 disabled:opacity-50"
                          >
                            {approvalAction === `${approval.id}:approved` ? 'جارٍ الاعتماد…' : 'اعتماد'}
                          </button>
                          <button
                            type="button"
                            onClick={() => void decideApproval(approval.id, 'rejected')}
                            disabled={approvalAction !== null}
                            className="rounded-lg bg-rose-500/20 px-3 py-2 text-[10px] font-bold text-rose-300 hover:bg-rose-500/30 disabled:opacity-50"
                          >
                            {approvalAction === `${approval.id}:rejected` ? 'جارٍ الرفض…' : 'رفض'}
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="w-12 h-12 bg-white/[0.03] rounded-full flex items-center justify-center mx-auto mb-3">✅</div>
                <p className="text-xs text-white/20 font-bold uppercase tracking-widest">لا توجد طلبات معلقة</p>
              </div>
            )}
          </div>

          {/* Autonomous Agents Health */}
          <div className="bg-white/[0.02] border border-white/5 rounded-[2.5rem] p-6">
            <h2 className="text-lg font-bold mb-6 flex items-center gap-3">
              <div className="p-2 bg-[#C5A059]/10 rounded-lg text-[#C5A059]">🤖</div>
              صحة الوكلاء المستقلين
            </h2>
            <div className="space-y-4">
              <AgentMetric label="مدير تشغيل المحتوى" count={data?.agent_stats.prime_tasks_completed || 0} icon="👑" color="gold" />
              <AgentMetric label="VANGUARD AI" count={data?.agent_stats.vanguard_tasks_completed || 0} icon="💼" color="emerald" />
              <AgentMetric label="ACTIVE DEVICES" count={data?.agent_stats.active_conversations || 0} icon="💻" color="blue" />
            </div>
          </div>

          {/* Strategic Alerts */}
          <div className="bg-white/[0.02] border border-white/5 rounded-[2.5rem] p-6">
            <h2 className="text-lg font-bold mb-6 flex items-center gap-3 text-rose-400">
              <AlertTriangle className="w-5 h-5" />
              تنبيهات استراتيجية
            </h2>
            <div className="space-y-3">
              {data?.alerts && data.alerts.length > 0 ? (
                data.alerts.map((alert, idx) => (
                  <div key={idx} className={`p-4 rounded-2xl text-[11px] font-medium leading-relaxed border ${
                    alert.severity === 'critical' ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' :
                    alert.severity === 'warning' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' :
                    'bg-blue-500/10 border-blue-500/20 text-blue-400'
                  }`}>
                    {alert.message}
                  </div>
                ))
              ) : (
                <p className="text-center text-white/20 text-xs font-bold py-6 uppercase tracking-widest">جميع الأنظمة مستقرة</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ title, value, color, icon }: { title: string; value: string | number; color: string; icon: any }) {
  const colorMap: Record<string, string> = {
    gold: 'text-[#C5A059] border-[#C5A059]/20 bg-[#C5A059]/5',
    blue: 'text-blue-400 border-blue-500/20 bg-blue-500/5',
    purple: 'text-purple-400 border-purple-500/20 bg-purple-500/5',
    rose: 'text-rose-400 border-rose-500/20 bg-rose-500/5',
  };

  return (
    <div className={`p-6 rounded-[2rem] border backdrop-blur-xl transition-all hover:scale-[1.02] ${colorMap[color]}`}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-black uppercase tracking-widest opacity-60">{title}</p>
        <span className="opacity-80">{icon}</span>
      </div>
      <p className="text-2xl font-black text-white">{value}</p>
    </div>
  );
}

function OrderStatusRow({ label, count, color, progress }: { label: string; count: number; color: string; progress: number }) {
  const colorMap: Record<string, string> = {
    gold: 'bg-[#C5A059]',
    blue: 'bg-blue-500',
    emerald: 'bg-emerald-500',
    purple: 'bg-purple-500',
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-white/60">{label}</span>
        <span className="text-sm font-black text-white">{count}</span>
      </div>
      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-1000 ${colorMap[color]}`} style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

function AgentMetric({ label, count, icon, color }: { label: string; count: number; icon: string; color: string }) {
  const colorMap: Record<string, string> = {
    gold: 'text-[#C5A059]',
    emerald: 'text-emerald-400',
    blue: 'text-blue-400',
  };
  return (
    <div className="flex items-center justify-between p-4 bg-white/[0.03] border border-white/5 rounded-2xl">
      <div className="flex items-center gap-3">
        <span className="text-lg">{icon}</span>
        <span className="text-[10px] font-bold text-white/50 tracking-widest">{label}</span>
      </div>
      <span className={`text-sm font-black ${colorMap[color]}`}>{count}</span>
    </div>
  );
}

function EmergencyStopButton() {
  const [isConfirming, setIsConfirming] = useState(false);
  
  async function triggerEmergencyStop() {
    if (!isConfirming) {
      setIsConfirming(true);
      setTimeout(() => setIsConfirming(false), 3000);
      return;
    }
    
    try {
      const response = await fetch('/api/admin/owner/emergency-stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'trigger', reason: 'Manual trigger from owner dashboard' })
      });
      const data = await response.json();
      if (data.success) {
        alert('🛑 تم تفعيل الإيقاف الطارئ بنجاح.');
      } else {
        alert('❌ ' + (data.error || 'حدث خطأ'));
      }
    } catch (err) {
      alert('❌ فشل الاتصال بخادم الأمان');
    } finally {
      setIsConfirming(false);
    }
  }
  
  return (
    <button
      onClick={triggerEmergencyStop}
      className={`px-6 py-3 rounded-xl font-bold transition-all duration-300 flex items-center gap-2 shadow-2xl ${
        isConfirming 
        ? 'bg-rose-600 text-white animate-pulse scale-105' 
        : 'bg-rose-500/10 text-rose-500 border border-rose-500/20 hover:bg-rose-500 hover:text-white'
      }`}
    >
      <span className="text-xl">🛑</span>
      <span>{isConfirming ? 'اضغط مرة أخرى للتأكيد!' : 'إيقاف طارئ'}</span>
    </button>
  );
}

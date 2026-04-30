'use client';

import { useState, useEffect } from 'react';
import { Crown, AlertTriangle, Loader2, RefreshCw } from 'lucide-react';

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

  async function fetchDashboardData() {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch from the owner dashboard API we created
      const response = await fetch('/api/admin/owner/dashboard?company_id=demo');
      
      if (!response.ok) {
        throw new Error('Failed to fetch dashboard data');
      }
      
      const result = await response.json();
      
      if (result.success) {
        // Transform API data to our interface
        setData({
          orders_summary: {
            pending_orders: result.data.today?.orders_pending || 0,
            in_production: result.data.today?.orders_in_production || 0,
            ready_for_delivery: result.data.today?.orders_ready || 0,
            delivered_this_month: result.data.this_month?.completed_orders || 0,
          },
          production_status: {
            active_jobs: result.data.today?.orders_in_production || 0,
            completed_today: 0,
            delayed_jobs: result.data.alerts?.filter((a: any) => a.severity === 'high').length || 0,
          },
          pending_approvals: result.data.approvals?.pending || [],
          revenue_stats: {
            this_month_revenue: result.data.this_month?.total_revenue || 0,
            this_month_profit: result.data.this_month?.estimated_profit || 0,
            pending_payments: result.data.revenue?.pending_payments || 0,
          },
          agent_stats: {
            prime_tasks_completed: result.data.agents?.prime?.completed_tasks || 0,
            vanguard_tasks_completed: result.data.agents?.vanguard?.completed_tasks || 0,
            active_conversations: result.data.agents?.active_conversations || 0,
          },
          alerts: result.data.alerts || [],
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

  useEffect(() => {
    fetchDashboardData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">جاري تحميل لوحة المالك...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-800 mb-4">{error}</p>
          <button
            onClick={fetchDashboardData}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            تحديث
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-xl shadow-lg">
            <Crown className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">لوحة تحكم المالك</h1>
            <p className="text-gray-600 mt-1">نظرة شاملة على كل العمليات والـ Agents</p>
          </div>
        </div>
        <EmergencyStopButton />
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          title="الإيرادات الشهرية"
          value={`${(data?.revenue_stats.this_month_revenue || 0).toLocaleString()} ج`}
          color="blue"
          icon="💰"
        />
        <MetricCard
          title="الطلبات الجديدة"
          value={data?.orders_summary.pending_orders || 0}
          color="green"
          icon="📦"
        />
        <MetricCard
          title="في الإنتاج"
          value={data?.orders_summary.in_production || 0}
          color="yellow"
          icon="🏭"
        />
        <MetricCard
          title="بانتظار الموافقة"
          value={data?.pending_approvals.length || 0}
          color="purple"
          icon="⏳"
        />
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - 2/3 width */}
        <div className="lg:col-span-2 space-y-6">
          {/* Production Status */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              🏭 حالة الإنتاج
            </h2>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <p className="text-3xl font-bold text-blue-600">{data?.production_status.active_jobs || 0}</p>
                <p className="text-sm text-blue-800">أعمال نشطة</p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <p className="text-3xl font-bold text-green-600">{data?.production_status.completed_today || 0}</p>
                <p className="text-sm text-green-800">اكتمل اليوم</p>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <p className="text-3xl font-bold text-red-600">{data?.production_status.delayed_jobs || 0}</p>
                <p className="text-sm text-red-800">متأخر</p>
              </div>
            </div>
          </div>

          {/* Orders */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              📦 الطلبات
            </h2>
            <div className="space-y-3">
              <OrderStatusRow 
                label="قيد الانتظار" 
                count={data?.orders_summary.pending_orders || 0} 
                color="yellow"
              />
              <OrderStatusRow 
                label="في الإنتاج" 
                count={data?.orders_summary.in_production || 0} 
                color="blue"
              />
              <OrderStatusRow 
                label="جاهز للتوصيل" 
                count={data?.orders_summary.ready_for_delivery || 0} 
                color="green"
              />
              <OrderStatusRow 
                label="تم التسليم هذا الشهر" 
                count={data?.orders_summary.delivered_this_month || 0} 
                color="purple"
              />
            </div>
          </div>
        </div>

        {/* Right Column - 1/3 width */}
        <div className="space-y-6">
          {/* Pending Approvals */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              ⏳ بانتظار الموافقة
            </h2>
            {data?.pending_approvals && data.pending_approvals.length > 0 ? (
              <div className="space-y-3">
                {data.pending_approvals.map((approval) => (
                  <div key={approval.id} className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="font-medium text-sm">{approval.title}</p>
                    <p className="text-xs text-gray-500">{approval.requested_by}</p>
                    {approval.amount && (
                      <p className="text-sm font-bold text-yellow-700 mt-1">{approval.amount.toLocaleString()} ج</p>
                    )}
                    <button className="mt-2 text-xs px-3 py-1 bg-yellow-600 text-white rounded hover:bg-yellow-700">
                      عرض التفاصيل
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">لا توجد موافقات معلقة</p>
            )}
          </div>

          {/* Agent Stats */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              🤖 أداء الـ Agents
            </h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <span>🧠</span>
                  <span className="font-medium">PRIME</span>
                </div>
                <span className="font-bold">{data?.agent_stats.prime_tasks_completed || 0} مهمة</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <span>💼</span>
                  <span className="font-medium">Vanguard</span>
                </div>
                <span className="font-bold">{data?.agent_stats.vanguard_tasks_completed || 0} مهمة</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <span>💬</span>
                  <span className="font-medium">محادثات نشطة</span>
                </div>
                <span className="font-bold">{data?.agent_stats.active_conversations || 0}</span>
              </div>
            </div>
          </div>

          {/* Alerts */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              🔔 التنبيهات
            </h2>
            {data?.alerts && data.alerts.length > 0 ? (
              <div className="space-y-2">
                {data.alerts.map((alert, idx) => (
                  <div 
                    key={idx} 
                    className={`p-3 rounded-lg text-sm ${
                      alert.severity === 'critical' ? 'bg-red-50 text-red-800 border border-red-200' :
                      alert.severity === 'warning' ? 'bg-yellow-50 text-yellow-800 border border-yellow-200' :
                      'bg-blue-50 text-blue-800 border border-blue-200'
                    }`}
                  >
                    {alert.message}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">لا توجد تنبيهات</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ title, value, color, icon }: { title: string; value: string | number; color: string; icon: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 border-blue-200 text-blue-800',
    green: 'bg-green-50 border-green-200 text-green-800',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    purple: 'bg-purple-50 border-purple-200 text-purple-800',
  };

  return (
    <div className={`p-4 rounded-xl border ${colors[color]}`}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm opacity-80">{title}</p>
        <span className="text-xl">{icon}</span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}

function OrderStatusRow({ label, count, color }: { label: string; count: number; color: string }) {
  const colors: Record<string, string> = {
    yellow: 'bg-yellow-500',
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    purple: 'bg-purple-500',
  };

  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-700">{label}</span>
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${colors[color]}`} />
        <span className="font-semibold">{count}</span>
      </div>
    </div>
  );
}

function EmergencyStopButton() {
  async function triggerEmergencyStop() {
    if (!confirm('⚠️ هل أنت متأكد؟\n\nهذا سيوقف كل الـ Agents فوراً!')) return;
    
    try {
      const response = await fetch('/api/admin/owner/emergency-stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'trigger', reason: 'Manual trigger from owner dashboard' })
      });
      
      const data = await response.json();
      
      if (data.success) {
        alert('🛑 تم تفعيل الإيقاف الطارئ.\n\nجميع الـ Agents متوقفة الآن.');
      } else {
        alert('❌ ' + (data.error || 'حدث خطأ'));
      }
    } catch (err) {
      alert('❌ حدث خطأ أثناء تفعيل الإيقاف الطارئ');
    }
  }
  
  return (
    <button
      onClick={triggerEmergencyStop}
      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 
        flex items-center gap-2 transition-colors shadow-lg"
    >
      <span>🛑</span>
      <span>إيقاف طارئ</span>
    </button>
  );
}


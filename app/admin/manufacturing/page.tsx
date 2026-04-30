'use client';

import { useState, useEffect } from 'react';
import { ManufacturingDashboard } from '@/components/admin/agents/ManufacturingDashboard';
import { OrderPipeline } from '@/components/admin/agents/OrderPipeline';
import { ProjectGantt } from '@/components/admin/agents/ProjectGantt';
import { QualityCheckPanel } from '@/components/admin/agents/QualityCheckPanel';
import { InventoryManager } from '@/components/admin/agents/InventoryManager';
import { BOMTable } from '@/components/admin/agents/BOMTable';

export default function ManufacturingPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'schedule' | 'inventory' | 'quality'>('overview');
  const [metrics, setMetrics] = useState({
    total_orders: 0,
    in_production: 0,
    ready: 0,
    delivered: 0,
    revenue: 0,
    profit: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadMetrics() {
      try {
        const response = await fetch('/api/admin/owner/dashboard?company_id=demo');
        const data = await response.json();
        if (data.success) {
          setMetrics({
            total_orders: data.data.this_month?.total_orders || 0,
            in_production: data.data.today?.orders_in_production || 0,
            ready: data.data.today?.orders_ready || 0,
            delivered: data.data.this_month?.completed_orders || 0,
            revenue: data.data.this_month?.total_revenue || 0,
            profit: data.data.this_month?.estimated_profit || 0
          });
        }
      } catch (error) {
        console.error('Failed to load metrics:', error);
      } finally {
        setLoading(false);
      }
    }

    loadMetrics();
  }, []);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">لوحة التصنيع</h1>
          <p className="text-gray-600 mt-1">
            إدارة خط الإنتاج والتصنيع
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
            🏭 المصنع
          </span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8 space-x-reverse">
          {[
            { id: 'overview', label: 'نظرة عامة', icon: '📊' },
            { id: 'schedule', label: 'الجدولة', icon: '📅' },
            { id: 'inventory', label: 'المخزون', icon: '📦' },
            { id: 'quality', label: 'فحص الجودة', icon: '✅' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Metrics Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <MetricCard
                title="إجمالي الأوردرات"
                value={metrics.total_orders.toString()}
                color="blue"
                loading={loading}
              />
              <MetricCard
                title="في الإنتاج"
                value={metrics.in_production.toString()}
                color="yellow"
                loading={loading}
              />
              <MetricCard
                title="جاهز للتوصيل"
                value={metrics.ready.toString()}
                color="green"
                loading={loading}
              />
              <MetricCard
                title="تم التسليم"
                value={metrics.delivered.toString()}
                color="purple"
                loading={loading}
              />
              <MetricCard
                title="الإيرادات"
                value={`${(metrics.revenue / 1000).toFixed(1)}K`}
                color="indigo"
                loading={loading}
              />
              <MetricCard
                title="الربح المتوقع"
                value={`${(metrics.profit / 1000).toFixed(1)}K`}
                color="teal"
                loading={loading}
              />
            </div>

            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ManufacturingDashboard />
              <OrderPipeline />
            </div>
          </div>
        )}

        {activeTab === 'schedule' && (
          <div className="space-y-6">
            <ProjectGantt />
          </div>
        )}

        {activeTab === 'inventory' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <InventoryManager />
              </div>
              <div>
                <BOMTable />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'quality' && (
          <div className="space-y-6">
            <QualityCheckPanel />
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  color,
  loading
}: {
  title: string;
  value: string;
  color: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'indigo' | 'teal';
  loading: boolean;
}) {
  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200 text-blue-800',
    green: 'bg-green-50 border-green-200 text-green-800',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    red: 'bg-red-50 border-red-200 text-red-800',
    purple: 'bg-purple-50 border-purple-200 text-purple-800',
    indigo: 'bg-indigo-50 border-indigo-200 text-indigo-800',
    teal: 'bg-teal-50 border-teal-200 text-teal-800'
  };

  return (
    <div className={`rounded-lg border p-4 ${colorClasses[color]}`}>
      <p className="text-sm opacity-80">{title}</p>
      <p className="text-2xl font-bold mt-1">
        {loading ? (
          <span className="animate-pulse">--</span>
        ) : (
          value
        )}
      </p>
    </div>
  );
}

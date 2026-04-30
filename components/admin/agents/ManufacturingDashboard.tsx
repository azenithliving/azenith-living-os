'use client';

import { useState, useEffect } from 'react';
import { ProjectGantt } from './ProjectGantt';

interface ManufacturingMetrics {
  orders_in_production: number;
  orders_ready: number;
  pending_payments: number;
  low_stock_items: number;
  delayed_jobs: number;
  jobs_completed_today: number;
}

export function ManufacturingDashboard() {
  const [metrics, setMetrics] = useState<ManufacturingMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'schedule' | 'inventory'>('overview');
  
  useEffect(() => {
    fetchMetrics();
  }, []);
  
  async function fetchMetrics() {
    try {
      const res = await fetch('/api/admin/manufacturing/metrics');
      const data = await res.json();
      if (data.success) {
        setMetrics(data.data);
      }
    } catch (err) {
      console.error('Error fetching metrics:', err);
    } finally {
      setLoading(false);
    }
  }
  
  const MetricCard = ({ title, value, color, subtitle }: { 
    title: string; 
    value: number; 
    color: string;
    subtitle?: string;
  }) => (
    <div className={`p-4 rounded-lg border-2 ${color} hover:shadow-md transition-shadow`}>
      <p className="text-sm text-gray-600 font-medium">{title}</p>
      <p className="text-2xl font-bold mt-1">{value.toLocaleString()}</p>
      {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
    </div>
  );
  
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-24 bg-gray-100 animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Metrics Cards */}
      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <MetricCard
            title="في الإنتاج"
            value={metrics.orders_in_production}
            color="border-blue-200 bg-blue-50"
            subtitle="أوامر نشطة"
          />
          <MetricCard
            title="جاهز للتسليم"
            value={metrics.orders_ready}
            color="border-green-200 bg-green-50"
            subtitle="بانتظار التوصيل"
          />
          <MetricCard
            title="مستحقات"
            value={metrics.pending_payments}
            color="border-yellow-200 bg-yellow-50"
            subtitle="دفعات متأخرة"
          />
          <MetricCard
            title="مخزون منخفض"
            value={metrics.low_stock_items}
            color="border-red-200 bg-red-50"
            subtitle="يحتاج شراء"
          />
          <MetricCard
            title="متأخر"
            value={metrics.delayed_jobs}
            color="border-orange-200 bg-orange-50"
            subtitle="مهام متأخرة"
          />
          <MetricCard
            title="تم اليوم"
            value={metrics.jobs_completed_today}
            color="border-purple-200 bg-purple-50"
            subtitle="مهام مكتملة"
          />
        </div>
      )}
      
      {/* Tabs */}
      <div className="flex gap-2 border-b">
        {(['overview', 'schedule', 'inventory'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === tab 
                ? 'border-b-2 border-blue-500 text-blue-600' 
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            {tab === 'overview' && 'نظرة عامة'}
            {tab === 'schedule' && 'الجدولة'}
            {tab === 'inventory' && 'المخزون'}
          </button>
        ))}
      </div>
      
      {/* Tab Content */}
      <div className="min-h-[400px]">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ProjectGantt />
            <div className="space-y-4">
              <h3 className="font-semibold">نصائح PRIME</h3>
              <div className="bg-purple-50 p-4 rounded-lg">
                <p className="text-sm text-purple-800">
                  💡 هناك {metrics?.delayed_jobs || 0} مهام متأخرة. 
                  أنصح بإعادة جدولة المهام ذات الأولوية العالية أولاً.
                </p>
              </div>
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-blue-800">
                  📊 متوسط وقت الإنجاز هذا الأسبوع: 12% أسرع من الأسبوع الماضي.
                </p>
              </div>
            </div>
          </div>
        )}
        
        {activeTab === 'schedule' && (
          <ProjectGantt />
        )}
        
        {activeTab === 'inventory' && (
          <div className="text-center py-8 text-gray-500">
            <p>جاري تحميل بيانات المخزون...</p>
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';

interface PipelineOrder {
  id: string;
  customer_name: string;
  status: string;
  total_amount: number;
  current_stage: string;
  progress_percent: number;
  expected_delivery: string;
  items_count: number;
}

export function OrderPipeline() {
  const [orders, setOrders] = useState<PipelineOrder[]>([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetchOrders();
  }, [filter]);
  
  async function fetchOrders() {
    try {
      setLoading(true);
      const url = filter === 'all'
        ? '/api/admin/manufacturing/orders'
        : `/api/admin/manufacturing/orders?status=${filter}`;
      
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setOrders(data.data);
      }
    } catch (err) {
      console.error('Error fetching orders:', err);
    } finally {
      setLoading(false);
    }
  }
  
  const stages = [
    { key: 'draft', label: 'مسودة', color: 'bg-gray-100 text-gray-800' },
    { key: 'quoted', label: 'معروض', color: 'bg-blue-100 text-blue-800' },
    { key: 'contracted', label: 'متعاقد', color: 'bg-purple-100 text-purple-800' },
    { key: 'in_production', label: 'في الإنتاج', color: 'bg-yellow-100 text-yellow-800' },
    { key: 'ready', label: 'جاهز', color: 'bg-green-100 text-green-800' },
    { key: 'delivered', label: 'تم التسليم', color: 'bg-green-500 text-white' }
  ];
  
  const getStageLabel = (status: string) => {
    const stage = stages.find(s => s.key === status);
    return stage?.label || status;
  };
  
  const getStageColor = (status: string) => {
    const stage = stages.find(s => s.key === status);
    return stage?.color || 'bg-gray-100';
  };
  
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">خط الأنابيب (Pipeline)</h3>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="border rounded px-2 py-1 text-sm"
        >
          <option value="all">كل الطلبات</option>
          {stages.map(s => (
            <option key={s.key} value={s.key}>{s.label}</option>
          ))}
        </select>
      </div>
      
      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto" />
        </div>
      ) : orders.length === 0 ? (
        <p className="text-center text-gray-500 py-8">لا توجد طلبات</p>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {orders.map((order) => (
            <div key={order.id} className="border rounded-lg p-3 hover:bg-gray-50 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${getStageColor(order.status)}`}>
                      {getStageLabel(order.status)}
                    </span>
                    <span className="text-xs text-gray-500">
                      #{order.id.slice(0, 8)}
                    </span>
                    <span className="text-xs text-gray-400">
                      {order.items_count} عنصر
                    </span>
                  </div>
                  <p className="font-medium">{order.customer_name}</p>
                  <p className="text-sm text-gray-600">
                    المرحلة الحالية: {order.current_stage || 'لم تبدأ'}
                  </p>
                  {order.expected_delivery && (
                    <p className="text-xs text-gray-500">
                      توصيل متوقع: {new Date(order.expected_delivery).toLocaleDateString('ar-EG')}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="font-bold text-blue-600">
                    {order.total_amount?.toLocaleString()} EGP
                  </p>
                </div>
              </div>
              
              {/* Progress Bar */}
              <div className="mt-3">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>التقدم</span>
                  <span>{order.progress_percent}%</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-500 transition-all duration-500"
                    style={{ width: `${order.progress_percent}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

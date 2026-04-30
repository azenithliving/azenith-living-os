'use client';

import { useState, useEffect } from 'react';
import { Search, Plus, AlertTriangle, Package, TrendingDown } from 'lucide-react';

interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  item_type: string;
  current_quantity: number;
  min_stock_level: number;
  unit_of_measure: string;
  unit_cost?: number;
  stock_status: 'ok' | 'reorder' | 'low';
  reorder_needed: boolean;
}

export function InventoryManager() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'low' | 'reorder'>('all');

  useEffect(() => {
    async function loadInventory() {
      try {
        const response = await fetch('/api/admin/manufacturing/inventory?company_id=demo');
        const data = await response.json();
        if (data.success) {
          setItems(data.data || []);
        }
      } catch (error) {
        console.error('Failed to load inventory:', error);
        // Use mock data for development
        setItems([
          { id: '1', sku: 'WD-001', name: 'خشب زان', item_type: 'raw_material', current_quantity: 50, min_stock_level: 30, unit_of_measure: 'board_feet', unit_cost: 35, stock_status: 'ok', reorder_needed: false },
          { id: '2', sku: 'WD-002', name: 'خشب سنديان', item_type: 'raw_material', current_quantity: 20, min_stock_level: 25, unit_of_measure: 'board_feet', unit_cost: 50, stock_status: 'low', reorder_needed: true },
          { id: '3', sku: 'SC-001', name: 'مسامير خشب', item_type: 'supply', current_quantity: 500, min_stock_level: 200, unit_of_measure: 'pieces', unit_cost: 0.5, stock_status: 'ok', reorder_needed: false },
          { id: '4', sku: 'GL-001', name: 'ورنيش', item_type: 'supply', current_quantity: 5, min_stock_level: 10, unit_of_measure: 'liters', unit_cost: 120, stock_status: 'low', reorder_needed: true }
        ]);
      } finally {
        setLoading(false);
      }
    }

    loadInventory();
  }, []);

  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         item.sku.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filter === 'all' || 
                        (filter === 'low' && item.stock_status === 'low') ||
                        (filter === 'reorder' && (item.stock_status === 'reorder' || item.stock_status === 'low'));
    return matchesSearch && matchesFilter;
  });

  const lowStockCount = items.filter(i => i.stock_status === 'low').length;

  async function handleReorder(itemId: string) {
    try {
      const response = await fetch('/api/admin/manufacturing/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: 'demo',
          action: 'reorder',
          inventory_item_id: itemId
        })
      });
      
      const data = await response.json();
      if (data.success) {
        alert('تم إنشاء أمر الشراء بنجاح!');
      }
    } catch (error) {
      console.error('Reorder failed:', error);
    }
  }

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Package className="w-5 h-5" />
            إدارة المخزون
          </h2>
          <button className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 flex items-center gap-1">
            <Plus className="w-4 h-4" />
            إضافة صنف
          </button>
        </div>

        {/* Alerts */}
        {lowStockCount > 0 && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-800">
            <AlertTriangle className="w-5 h-5" />
            <span>{lowStockCount} أصناف منخفضة المخزون</span>
          </div>
        )}

        {/* Search and Filter */}
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="البحث في المخزون..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">الكل</option>
            <option value="low">منخفض فقط</option>
            <option value="reorder">يحتاج إعادة طلب</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">الصنف</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">SKU</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">الكمية</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">الحد الأدنى</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">التكلفة</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">الحالة</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">إجراء</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  جاري التحميل...
                </td>
              </tr>
            ) : filteredItems.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  لا توجد أصناف
                </td>
              </tr>
            ) : (
              filteredItems.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{item.name}</div>
                    <div className="text-sm text-gray-500">{item.item_type}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{item.sku}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className={item.current_quantity <= item.min_stock_level ? 'text-red-600 font-semibold' : ''}>
                      {item.current_quantity} {item.unit_of_measure}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {item.min_stock_level} {item.unit_of_measure}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {item.unit_cost ? `${item.unit_cost} ج` : '--'}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={item.stock_status} />
                  </td>
                  <td className="px-4 py-3">
                    {item.reorder_needed && (
                      <button
                        onClick={() => handleReorder(item.id)}
                        className="px-2 py-1 bg-amber-100 text-amber-800 rounded text-sm hover:bg-amber-200 flex items-center gap-1"
                      >
                        <TrendingDown className="w-3 h-3" />
                        إعادة طلب
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const classes = {
    ok: 'bg-green-100 text-green-800',
    reorder: 'bg-yellow-100 text-yellow-800',
    low: 'bg-red-100 text-red-800'
  };

  const labels = {
    ok: 'متوفر',
    reorder: 'أعيد الطلب',
    low: 'منخفض'
  };

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${classes[status as keyof typeof classes]}`}>
      {labels[status as keyof typeof labels]}
    </span>
  );
}

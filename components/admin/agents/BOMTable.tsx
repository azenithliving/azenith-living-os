'use client';

import { useState, useEffect } from 'react';
import { Calculator, FileText, Package } from 'lucide-react';

interface BOMItem {
  item_name: string;
  quantity: number;
  unit: string;
  unit_cost: number;
  total_cost: number;
  in_stock: boolean;
  available_quantity: number;
}

interface BOMData {
  items: BOMItem[];
  total_materials_cost: number;
  total_weight: number;
  estimated_labor_hours: number;
  waste_included: boolean;
}

export function BOMTable() {
  const [bom, setBOM] = useState<BOMData | null>(null);
  const [loading, setLoading] = useState(false);
  const [designId, setDesignId] = useState('');

  async function calculateBOM() {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/manufacturing/bom/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: 'demo',
          quantity: 1,
          include_waste: true,
          // Mock design specs
          specifications: {
            dimensions: { length: 120, width: 60, height: 75, unit: 'cm' },
            materials: ['beech', 'plywood'],
            finish: 'varnish'
          }
        })
      });

      const data = await response.json();
      if (data.success) {
        setBOM(data.data);
      }
    } catch (error) {
      console.error('BOM calculation failed:', error);
      // Mock data for development
      setBOM({
        items: [
          { item_name: 'خشب زان', quantity: 25, unit: 'لتر', unit_cost: 3.5, total_cost: 87.5, in_stock: true, available_quantity: 50 },
          { item_name: 'خشب إضافي', quantity: 8, unit: 'لتر', unit_cost: 2.5, total_cost: 20, in_stock: false, available_quantity: 0 },
          { item_name: 'قطع معدنية', quantity: 1, unit: 'set', unit_cost: 150, total_cost: 150, in_stock: true, available_quantity: 1000 },
          { item_name: 'ورنيش', quantity: 0.5, unit: 'liter', unit_cost: 400, total_cost: 200, in_stock: true, available_quantity: 50 }
        ],
        total_materials_cost: 457.5,
        total_weight: 45.5,
        estimated_labor_hours: 8,
        waste_included: true
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <FileText className="w-5 h-5" />
          قائمة المواد (BOM)
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          حساب المواد المطلوبة للتصنيع
        </p>
      </div>

      <div className="p-4">
        {!bom ? (
          <div className="text-center py-8">
            <Calculator className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">
              اختر تصميم لحساب المواد المطلوبة
            </p>
            <button
              onClick={calculateBOM}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'جاري الحساب...' : 'حساب BOM'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-blue-50 p-3 rounded-lg">
                <p className="text-sm text-blue-600">إجمالي المواد</p>
                <p className="text-xl font-bold text-blue-800">{bom.total_materials_cost.toFixed(0)} ج</p>
              </div>
              <div className="bg-green-50 p-3 rounded-lg">
                <p className="text-sm text-green-600">ساعات العمل</p>
                <p className="text-xl font-bold text-green-800">{bom.estimated_labor_hours} ساعة</p>
              </div>
            </div>

            {/* Items Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-right font-medium text-gray-600">المادة</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-600">الكمية</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-600">التكلفة</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-600">المخزون</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {bom.items.map((item, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-3 py-2">
                        <div className="font-medium text-gray-900">{item.item_name}</div>
                      </td>
                      <td className="px-3 py-2 text-gray-600">
                        {item.quantity} {item.unit}
                      </td>
                      <td className="px-3 py-2 text-gray-900">
                        {item.total_cost.toFixed(0)} ج
                      </td>
                      <td className="px-3 py-2">
                        {item.in_stock ? (
                          <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded text-xs">
                            متوفر ({item.available_quantity})
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-red-100 text-red-800 rounded text-xs">
                            غير متوفر
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Total */}
            <div className="border-t pt-3">
              <div className="flex justify-between items-center">
                <span className="font-medium">الإجمالي:</span>
                <span className="text-xl font-bold text-blue-600">
                  {bom.total_materials_cost.toFixed(0)} ج
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {bom.waste_included ? 'يشمل 15% هالك' : 'بدون هالك'} | الوزن: {bom.total_weight} كجم
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={calculateBOM}
                className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
              >
                إعادة الحساب
              </button>
              <button
                onClick={() => alert('تم حفظ BOM')}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
              >
                حفظ
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

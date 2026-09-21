"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { AlertTriangle, Package, Plus, Search, X } from "lucide-react";

interface InventoryItem {
  id: string;
  sku: string | null;
  name: string;
  item_type: string;
  current_quantity: number;
  min_stock_level: number;
  unit_of_measure: string;
  unit_cost: number | null;
  stock_status: "ok" | "reorder" | "low";
  reorder_needed: boolean;
}

type NewItem = {
  name: string;
  sku: string;
  category: string;
  unit: string;
  current_quantity: string;
  min_stock_level: string;
  reorder_quantity: string;
  unit_cost: string;
  supplier_name: string;
  supplier_contact: string;
  lead_time_days: string;
};

const initialItem: NewItem = {
  name: "",
  sku: "",
  category: "",
  unit: "قطعة",
  current_quantity: "0",
  min_stock_level: "0",
  reorder_quantity: "0",
  unit_cost: "0",
  supplier_name: "",
  supplier_contact: "",
  lead_time_days: "0",
};

export function InventoryManager() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "low" | "reorder">("all");
  const [showAddForm, setShowAddForm] = useState(false);
  const [newItem, setNewItem] = useState<NewItem>(initialItem);
  const [savingItem, setSavingItem] = useState(false);
  const [reorderingId, setReorderingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadInventory = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/manufacturing/inventory", { cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "تعذر تحميل المخزون.");
      }
      setItems(Array.isArray(data.data) ? data.data : []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "تعذر تحميل المخزون.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadInventory();
  }, [loadInventory]);

  const filteredItems = items.filter((item) => {
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch = !query
      || item.name.toLowerCase().includes(query)
      || (item.sku || "").toLowerCase().includes(query);
    const matchesFilter = filter === "all"
      || (filter === "low" && item.stock_status === "low")
      || (filter === "reorder" && (item.stock_status === "reorder" || item.stock_status === "low"));
    return matchesSearch && matchesFilter;
  });

  const lowStockCount = items.filter((item) => item.stock_status === "low").length;

  function updateNewItem<K extends keyof NewItem>(field: K, value: NewItem[K]) {
    setNewItem((current) => ({ ...current, [field]: value }));
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingItem(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/admin/manufacturing/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", ...newItem }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "تعذر إضافة الصنف.");
      }

      setNewItem(initialItem);
      setShowAddForm(false);
      setMessage("تمت إضافة الصنف إلى المخزون.");
      await loadInventory();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "تعذر إضافة الصنف.");
    } finally {
      setSavingItem(false);
    }
  }

  async function handleReorder(itemId: string) {
    setReorderingId(itemId);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/admin/manufacturing/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reorder", inventory_item_id: itemId }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "تعذر إنشاء أمر الشراء.");
      }

      setMessage("تم إنشاء أمر شراء مسودة للصنف المحدد.");
      await loadInventory();
    } catch (reorderError) {
      setError(reorderError instanceof Error ? reorderError.message : "تعذر إنشاء أمر الشراء.");
    } finally {
      setReorderingId(null);
    }
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Package className="w-5 h-5" />
            إدارة المخزون
          </h2>
          <button
            type="button"
            onClick={() => {
              setShowAddForm((visible) => !visible);
              setError(null);
              setMessage(null);
            }}
            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 flex items-center gap-1"
          >
            {showAddForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showAddForm ? "إلغاء" : "إضافة صنف"}
          </button>
        </div>

        {showAddForm && (
          <form onSubmit={handleCreate} className="mb-4 grid gap-3 rounded-lg border border-blue-100 bg-blue-50 p-4 md:grid-cols-3">
            <label className="text-sm text-gray-700">الاسم *
              <input required value={newItem.name} onChange={(event) => updateNewItem("name", event.target.value)} className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5" />
            </label>
            <label className="text-sm text-gray-700">SKU
              <input value={newItem.sku} onChange={(event) => updateNewItem("sku", event.target.value)} className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5" />
            </label>
            <label className="text-sm text-gray-700">الفئة
              <input value={newItem.category} onChange={(event) => updateNewItem("category", event.target.value)} placeholder="خشب، إكسسوار…" className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5" />
            </label>
            <label className="text-sm text-gray-700">الوحدة *
              <input required value={newItem.unit} onChange={(event) => updateNewItem("unit", event.target.value)} className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5" />
            </label>
            <label className="text-sm text-gray-700">الكمية الحالية
              <input required type="number" min="0" step="0.001" value={newItem.current_quantity} onChange={(event) => updateNewItem("current_quantity", event.target.value)} className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5" />
            </label>
            <label className="text-sm text-gray-700">الحد الأدنى
              <input required type="number" min="0" step="0.001" value={newItem.min_stock_level} onChange={(event) => updateNewItem("min_stock_level", event.target.value)} className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5" />
            </label>
            <label className="text-sm text-gray-700">كمية إعادة الطلب
              <input required type="number" min="0" step="0.001" value={newItem.reorder_quantity} onChange={(event) => updateNewItem("reorder_quantity", event.target.value)} className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5" />
            </label>
            <label className="text-sm text-gray-700">سعر الوحدة *
              <input required type="number" min="0" step="0.01" value={newItem.unit_cost} onChange={(event) => updateNewItem("unit_cost", event.target.value)} className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5" />
            </label>
            <label className="text-sm text-gray-700">اسم المورد
              <input value={newItem.supplier_name} onChange={(event) => updateNewItem("supplier_name", event.target.value)} className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5" />
            </label>
            <label className="text-sm text-gray-700">تواصل المورد
              <input value={newItem.supplier_contact} onChange={(event) => updateNewItem("supplier_contact", event.target.value)} className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5" />
            </label>
            <label className="text-sm text-gray-700">مهلة المورد (أيام)
              <input required type="number" min="0" step="1" value={newItem.lead_time_days} onChange={(event) => updateNewItem("lead_time_days", event.target.value)} className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5" />
            </label>
            <div className="flex items-end">
              <button disabled={savingItem} className="w-full rounded bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50">
                {savingItem ? "جاري الحفظ..." : "حفظ الصنف"}
              </button>
            </div>
          </form>
        )}

        {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {message && <p role="status" className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">{message}</p>}

        {lowStockCount > 0 && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-800">
            <AlertTriangle className="w-5 h-5" />
            <span>{lowStockCount} أصناف منخفضة المخزون</span>
          </div>
        )}

        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="search"
              placeholder="البحث في المخزون..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value as "all" | "low" | "reorder")}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">الكل</option>
            <option value="low">منخفض فقط</option>
            <option value="reorder">يحتاج إعادة طلب</option>
          </select>
        </div>
      </div>

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
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">جاري التحميل...</td></tr>
            ) : filteredItems.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">لا توجد أصناف مطابقة</td></tr>
            ) : (
              filteredItems.map((item) => {
                const status = item.stock_status === "low"
                  ? { label: "منخفض", className: "bg-red-100 text-red-700" }
                  : item.stock_status === "reorder"
                    ? { label: "إعادة طلب", className: "bg-amber-100 text-amber-700" }
                    : { label: "جيد", className: "bg-green-100 text-green-700" };
                return (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3"><div className="font-medium text-gray-900">{item.name}</div><div className="text-sm text-gray-500">{item.item_type}</div></td>
                    <td className="px-4 py-3 text-sm text-gray-600">{item.sku || "—"}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{item.current_quantity} {item.unit_of_measure}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{item.min_stock_level} {item.unit_of_measure}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{item.unit_cost === null ? "غير مسجل" : `${item.unit_cost.toLocaleString("ar-EG")} ج`}</td>
                    <td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs ${status.className}`}>{status.label}</span></td>
                    <td className="px-4 py-3">
                      {item.reorder_needed ? (
                        <button
                          type="button"
                          onClick={() => void handleReorder(item.id)}
                          disabled={reorderingId === item.id}
                          className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                          {reorderingId === item.id ? "جاري الإنشاء..." : "إنشاء أمر شراء"}
                        </button>
                      ) : <span className="text-sm text-gray-400">لا يلزم</span>}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

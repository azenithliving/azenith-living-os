"use client";

import { FormEvent, useState, useEffect } from "react";
import { Calculator, FileText, PackageCheck, RotateCcw } from "lucide-react";

interface DesignOption {
  id: string;
  title: string;
  version_number: number;
}

interface BOMItem {
  item_name: string;
  quantity: number;
  unit: string | null;
  unit_cost: number | null;
  total_cost: number | null;
  availability: "available" | "insufficient" | "not_registered";
  available_quantity: number | null;
  waste_amount: number;
  waste_percentage: number;
}

interface BOMData {
  items: BOMItem[];
  total_materials_cost: number | null;
  priced_materials_cost: number;
  unpriced_items_count: number;
  total_weight: number | null;
  estimated_labor_hours: number | null;
  waste_included: boolean;
  design_version_id: string;
  sales_order_item_id: string | null;
}

const availabilityCopy = {
  available: { label: "متوفر", className: "bg-green-100 text-green-800" },
  insufficient: { label: "كمية غير كافية", className: "bg-amber-100 text-amber-800" },
  not_registered: { label: "غير مسجل بالمخزون", className: "bg-red-100 text-red-800" },
} as const;

function formatAmount(value: number | null) {
  return value === null
    ? "غير متاح"
    : `${value.toLocaleString("ar-EG", { maximumFractionDigits: 2 })} ج`;
}

export function BOMTable() {
  const [bom, setBOM] = useState<BOMData | null>(null);
  const [designVersionId, setDesignVersionId] = useState("");
  const [availableDesigns, setAvailableDesigns] = useState<DesignOption[]>([]);
  const [loadingDesigns, setLoadingDesigns] = useState(false);
  const [quantity, setQuantity] = useState("1");
  const [includeWaste, setIncludeWaste] = useState(true);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadDesigns() {
      setLoadingDesigns(true);
      try {
        const res = await fetch("/api/admin/manufacturing/designs");
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data)) {
            setAvailableDesigns(json.data);
            if (json.data.length > 0) {
              setDesignVersionId(json.data[0].id);
            }
          }
        }
      } catch (err) {
        console.error("Failed to load designs:", err);
      } finally {
        setLoadingDesigns(false);
      }
    }
    loadDesigns();
  }, []);

  async function calculateBOM(event?: FormEvent<HTMLFormElement>, save = false) {
    event?.preventDefault();
    const normalizedDesignId = designVersionId.trim();
    const normalizedQuantity = Number(quantity);

    if (!normalizedDesignId) {
      setError("أدخل معرّف نسخة التصميم أولاً.");
      return;
    }
    if (!Number.isFinite(normalizedQuantity) || normalizedQuantity <= 0) {
      setError("أدخل كمية صحيحة أكبر من صفر.");
      return;
    }

    setError(null);
    setMessage(null);
    if (save) setSaving(true);
    else setLoading(true);

    try {
      const response = await fetch("/api/admin/manufacturing/bom/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          design_version_id: normalizedDesignId,
          quantity: normalizedQuantity,
          include_waste: includeWaste,
          save,
        }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "تعذر حساب قائمة المواد.");
      }

      setBOM(data.data as BOMData);
      setMessage(data.message || "تم حساب قائمة المواد من بيانات التصميم والمخزون الحالية.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "تعذر حساب قائمة المواد.");
    } finally {
      setLoading(false);
      setSaving(false);
    }
  }

  const canSave = Boolean(
    bom?.sales_order_item_id
    && bom.total_materials_cost !== null
    && bom.unpriced_items_count === 0
  );

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <FileText className="w-5 h-5" />
          قائمة المواد (BOM)
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          يحسب المواد والأسعار المسجلة فقط؛ لا يضيف تقديرات افتراضية.
        </p>
      </div>

      <div className="p-4 space-y-4">
        <form onSubmit={(event) => calculateBOM(event)} className="space-y-3">
          <div className="grid gap-3 md:grid-cols-[1fr_130px_auto] items-end">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">
                اختيار التصميم
              </label>
              {availableDesigns.length > 0 ? (
                <div className="flex flex-col gap-1.5">
                  <select
                    value={availableDesigns.some((d) => d.id === designVersionId) ? designVersionId : "custom"}
                    onChange={(event) => {
                      if (event.target.value !== "custom") {
                        setDesignVersionId(event.target.value);
                      } else {
                        setDesignVersionId("");
                      }
                    }}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="">-- اختر من قائمة التصاميم المسجلة --</option>
                    {availableDesigns.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.title} ({d.id.slice(0, 8)})
                      </option>
                    ))}
                    <option value="custom">-- إدخال معرّف يدويًا (UUID) --</option>
                  </select>
                  {(!availableDesigns.some((d) => d.id === designVersionId) || !designVersionId) && (
                    <input
                      value={designVersionId}
                      onChange={(event) => setDesignVersionId(event.target.value)}
                      placeholder="UUID لنسخة التصميم"
                      className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-xs focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                      dir="ltr"
                      required
                    />
                  )}
                </div>
              ) : (
                <div>
                  <input
                    value={designVersionId}
                    onChange={(event) => setDesignVersionId(event.target.value)}
                    placeholder={loadingDesigns ? "جاري تحميل التصاميم..." : "أدخل UUID لنسخة التصميم"}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    dir="ltr"
                    required
                  />
                </div>
              )}
            </div>
          <label className="block text-sm text-gray-700">
            <span className="mb-1 block font-medium">الكمية</span>
            <input
              type="number"
              min="0.001"
              step="0.001"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              required
            />
          </label>
          <button
            type="submit"
            disabled={loading || saving}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Calculator className="h-4 w-4" />
            {loading ? "جاري الحساب..." : "حساب BOM"}
          </button>
          <label className="md:col-span-3 flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={includeWaste}
              onChange={(event) => setIncludeWaste(event.target.checked)}
            />
            تطبيق نسبة الهالك المسجلة لكل مادة في التصميم
          </label>
        </div>
      </form>

        <p className="rounded-lg bg-blue-50 p-3 text-xs leading-5 text-blue-800">
          يجب أن تحتوي مواصفات التصميم على <code>bom_items</code> أو <code>materials</code>،
          وكل مادة على الاسم والكمية. تظهر الأسعار فقط عند مطابقة مادة فعّالة في المخزون.
        </p>

        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {message && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-700">{message}</p>}

        {!bom && !loading && (
          <div className="py-8 text-center text-gray-500">
            <Calculator className="mx-auto mb-3 h-10 w-10 text-gray-300" />
            أدخل نسخة تصميم فعلية لعرض قائمة المواد.
          </div>
        )}

        {bom && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg bg-blue-50 p-3">
                <p className="text-sm text-blue-700">إجمالي التكلفة المسجلة</p>
                <p className="text-xl font-bold text-blue-900">{formatAmount(bom.total_materials_cost)}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-sm text-slate-600">مواد بلا سعر</p>
                <p className="text-xl font-bold text-slate-900">{bom.unpriced_items_count}</p>
              </div>
              <div className="rounded-lg bg-amber-50 p-3">
                <p className="text-sm text-amber-700">الهالك</p>
                <p className="text-xl font-bold text-amber-900">
                  {bom.waste_included ? "حسب التصميم" : "غير مطبق"}
                </p>
              </div>
            </div>

            {bom.total_materials_cost === null && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                الإجمالي غير مكتمل لأن مادة واحدة أو أكثر لا تملك سعرًا مسجلاً في المخزون.
              </p>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-right font-medium text-gray-600">المادة</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-600">الكمية</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-600">السعر</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-600">التكلفة</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-600">المخزون</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {bom.items.map((item, index) => {
                    const availability = availabilityCopy[item.availability];
                    return (
                      <tr key={`${item.item_name}-${index}`} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium text-gray-900">{item.item_name}</td>
                        <td className="px-3 py-2 text-gray-700">
                          {item.quantity} {item.unit || "وحدة"}
                          {item.waste_amount > 0 && <span className="mr-1 text-xs text-gray-500">(+{item.waste_amount} هالك)</span>}
                        </td>
                        <td className="px-3 py-2 text-gray-700">{formatAmount(item.unit_cost)}</td>
                        <td className="px-3 py-2 text-gray-900">{formatAmount(item.total_cost)}</td>
                        <td className="px-3 py-2">
                          <span className={`rounded px-2 py-0.5 text-xs ${availability.className}`}>
                            {availability.label}
                            {item.available_quantity !== null ? ` (${item.available_quantity})` : ""}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-2 border-t pt-3 sm:flex-row">
              <button
                type="button"
                onClick={() => calculateBOM()}
                disabled={loading || saving}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <RotateCcw className="h-4 w-4" /> إعادة الحساب
              </button>
              <button
                type="button"
                onClick={() => calculateBOM(undefined, true)}
                disabled={!canSave || loading || saving}
                title={canSave ? "حفظ قائمة المواد" : "يتطلب ارتباط التصميم بأمر بيع وأسعارًا مسجلة لكل مادة"}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <PackageCheck className="h-4 w-4" /> {saving ? "جاري الحفظ..." : "حفظ قائمة المواد"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

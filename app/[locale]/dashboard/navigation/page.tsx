"use client";

import { useEffect, useState } from "react";

type NavItem = {
  id: string;
  label: string;
  href: string;
  enabled: boolean;
};

const defaultNavItems: NavItem[] = [
  { id: "1", label: "الرئيسية", href: "/", enabled: true },
  { id: "2", label: "الغرف", href: "/rooms", enabled: true },
  { id: "3", label: "طلب عرض أسعار", href: "/request", enabled: true },
];

export default function NavigationPage() {
  const [navItems, setNavItems] = useState<NavItem[]>(defaultNavItems);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);

  const loadTenant = async () => {
    try {
      const response = await fetch("/api/tenant");
      const data = await response.json();
      if (data.ok && data.tenant) {
        setTenantId(data.tenant.id);
        await loadNavigation(data.tenant.id);
      }
    } catch (error) {
      console.error('Failed to load tenant:', error);
      setMessage({ type: "error", text: "فشل في تحميل بيانات المستأجر" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTenant();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadNavigation = async (id: string) => {
    try {
      const response = await fetch(`/api/navigation?tenantId=${id}`);
      const data = await response.json();
      if (response.ok && data.items) {
        setNavItems(data.items);
      }
    } catch (error) {
      console.error('Failed to load navigation:', error);
      // Use defaults
    }
  };

  const handleSave = async () => {
    if (!tenantId) return;

    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/navigation?tenantId=${tenantId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: navItems }),
      });

      if (!response.ok) {
        throw new Error("Failed to save navigation");
      }

      setMessage({ type: "success", text: "تم حفظ قائمة التنقل بنجاح" });
    } catch (error) {
      console.error('Failed to save navigation:', error);
      setMessage({ type: "error", text: "فشل في حفظ قائمة التنقل" });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setNavItems(defaultNavItems);
    setMessage({ type: "success", text: "تم إعادة تعيين القائمة إلى الافتراضي" });
  };

  const updateItem = (id: string, field: keyof NavItem, value: string | boolean) => {
    setNavItems(items =>
      items.map(item =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  };

  const removeItem = (id: string) => {
    setNavItems(items => items.filter(item => item.id !== id));
  };

  const addItem = () => {
    const newId = Date.now().toString();
    setNavItems(items => [...items, { id: newId, label: "عنصر جديد", href: "/", enabled: true }]);
  };

  return (
    <main className="px-8 py-12">
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.28em] text-brand-primary/70">Navigation menu</p>
            <h1 className="mt-3 font-serif text-4xl text-white md:text-5xl">قائمة التنقل</h1>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleReset}
              disabled={loading || saving}
              className="rounded-full border border-white/10 px-6 py-3 text-sm text-white/70 transition hover:border-brand-primary hover:text-brand-primary disabled:opacity-50"
            >
              إعادة تعيين
            </button>
            <button
              onClick={handleSave}
              disabled={saving || loading || !tenantId}
              className="rounded-full bg-brand-primary px-6 py-3 text-sm font-semibold text-brand-accent transition hover:bg-[#d8b56d] disabled:opacity-50"
            >
              {saving ? "جاري الحفظ..." : "حفظ القائمة"}
            </button>
          </div>
        </div>

        {message && (
          <div className={`rounded-lg p-4 ${message.type === "success" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
            {message.text}
          </div>
        )}

        <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-8">
          <h2 className="text-2xl font-semibold text-white">عناصر القائمة</h2>
          <p className="mt-2 text-sm text-white/60">إدارة عناصر قائمة التنقل في الموقع.</p>
          {loading ? (
            <div className="mt-6 flex items-center justify-center py-8">
              <div className="text-white/60">جاري التحميل...</div>
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {navItems.map((item) => (
                <div key={item.id} className="flex items-center gap-4 rounded-lg border border-white/10 bg-white/[0.02] p-4">
                  <input
                    type="text"
                    value={item.label}
                    onChange={(e) => updateItem(item.id, "label", e.target.value)}
                    className="flex-1 rounded border border-white/20 bg-transparent px-3 py-1 text-sm text-white"
                    placeholder="عنوان العنصر"
                  />
                  <input
                    type="text"
                    value={item.href}
                    onChange={(e) => updateItem(item.id, "href", e.target.value)}
                    className="w-32 rounded border border-white/20 bg-transparent px-3 py-1 text-sm text-white"
                    placeholder="/path"
                  />
                  <label className="flex items-center gap-2 text-sm text-white/70">
                    <input
                      type="checkbox"
                      checked={item.enabled}
                      onChange={(e) => updateItem(item.id, "enabled", e.target.checked.toString())}
                      className="rounded border border-white/20 bg-transparent"
                    />
                    مفعل
                  </label>
                  <button
                    onClick={() => removeItem(item.id)}
                    className="text-white/50 hover:text-red-400 transition"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                onClick={addItem}
                className="w-full rounded-lg border border-dashed border-white/20 py-4 text-white/50 hover:border-brand-primary hover:text-brand-primary transition"
              >
                + إضافة عنصر جديد
              </button>
            </div>
          )}
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-8">
          <h2 className="text-2xl font-semibold text-white">معاينة القائمة</h2>
          <p className="mt-2 text-sm text-white/60">كيف ستظهر قائمة التنقل على الموقع.</p>
          <div className="mt-6">
            <nav className="flex gap-6 p-4 bg-black/20 rounded-lg">
              {navItems.filter(item => item.enabled).map((item) => (
                <a
                  key={item.id}
                  href={item.href}
                  className="text-white/80 hover:text-brand-primary transition"
                >
                  {item.label}
                </a>
              ))}
            </nav>
          </div>
        </div>
      </div>
    </main>
  );
}
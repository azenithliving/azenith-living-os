"use client";

import { useEffect, useState } from "react";

type TenantData = {
  id: string;
  name: string;
  domain: string;
  logo: string | null;
  primary_color: string | null;
  whatsapp: string | null;
};

export default function SettingsPage() {
  const [tenant, setTenant] = useState<TenantData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    loadTenant();
  }, []);

  const loadTenant = async () => {
    try {
      const response = await fetch("/api/tenant");
      const data = await response.json();
      if (data.ok && data.tenant) {
        setTenant(data.tenant);
      }
    } catch (error) {
      console.error('Failed to load tenant:', error);
      setMessage({ type: "error", text: "فشل في تحميل بيانات المستأجر" });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (formData: FormData) => {
    if (!tenant) return;

    setSaving(true);
    setMessage(null);

    try {
      const updates = {
        name: formData.get("name") as string,
        logo: formData.get("logo") as string,
        primary_color: formData.get("primary_color") as string,
        whatsapp: formData.get("whatsapp") as string,
      };

      const response = await fetch("/api/tenant", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error("Failed to update tenant");
      }

      setTenant({ ...tenant, ...updates });
      setMessage({ type: "success", text: "تم حفظ التغييرات بنجاح" });
    } catch {
      setMessage({ type: "error", text: "فشل في حفظ التغييرات" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="px-8 py-12">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-8 text-center">
            <p className="text-white">جاري تحميل إعدادات الشركة...</p>
          </div>
        </div>
      </main>
    );
  }

  if (!tenant) {
    return (
      <main className="px-8 py-12">
        <div className="mx-auto max-w-5xl rounded-[2rem] border border-white/10 bg-white/[0.03] p-8 text-right">
          <p className="text-sm uppercase tracking-[0.28em] text-brand-primary/70">Tenant settings</p>
          <h1 className="mt-4 font-serif text-4xl text-white md:text-5xl">لا توجد شركة مفعلة لهذا الدومين.</h1>
          <p className="mt-4 max-w-2xl text-base leading-8 text-white/65">يجب إنشاء شركة جديدة أو ربط الدومين بشركة موجودة.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="px-8 py-12">
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.28em] text-brand-primary/70">Tenant manager</p>
            <h1 className="mt-3 font-serif text-4xl text-white md:text-5xl">إعدادات الشركة</h1>
          </div>
          <button
            form="tenant-form"
            type="submit"
            disabled={saving}
            className="rounded-full bg-brand-primary px-6 py-3 text-sm font-semibold text-brand-accent transition hover:bg-[#d8b56d] disabled:opacity-50"
          >
            {saving ? "جاري الحفظ..." : "حفظ التغييرات"}
          </button>
        </div>

        {message && (
          <div className={`rounded-lg p-4 ${message.type === "success" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
            {message.text}
          </div>
        )}

        <form id="tenant-form" action={handleSave} className="space-y-8">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-8">
            <h2 className="text-2xl font-semibold text-white">معلومات الشركة</h2>
            <div className="mt-6 grid gap-6 md:grid-cols-2">
              <div>
                <label htmlFor="name" className="block text-sm text-white/65">اسم الشركة</label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  defaultValue={tenant.name}
                  className="mt-2 w-full rounded border border-white/20 bg-transparent px-3 py-2 text-white"
                  required
                />
              </div>
              <div>
                <label htmlFor="domain" className="block text-sm text-white/65">الدومين</label>
                <input
                  id="domain"
                  type="text"
                  defaultValue={tenant.domain}
                  className="mt-2 w-full rounded border border-white/20 bg-transparent px-3 py-2 text-white/60"
                  disabled
                />
                <p className="mt-1 text-xs text-white/50">لا يمكن تعديل الدومين</p>
              </div>
              <div>
                <label htmlFor="logo" className="block text-sm text-white/65">رابط الشعار</label>
                <input
                  id="logo"
                  name="logo"
                  type="url"
                  defaultValue={tenant.logo || ""}
                  placeholder="https://example.com/logo.png"
                  className="mt-2 w-full rounded border border-white/20 bg-transparent px-3 py-2 text-white"
                />
              </div>
              <div>
                <label htmlFor="primary_color" className="block text-sm text-white/65">اللون الأساسي</label>
                <div className="mt-2 flex gap-3">
                  <input
                    id="primary_color"
                    name="primary_color"
                    type="color"
                    defaultValue={tenant.primary_color || "#C5A059"}
                    className="h-10 w-16 rounded border border-white/20 bg-transparent"
                  />
                  <input
                    type="text"
                    value={tenant.primary_color || "#C5A059"}
                    className="flex-1 rounded border border-white/20 bg-transparent px-3 py-2 text-white"
                    readOnly
                  />
                </div>
              </div>
              <div className="md:col-span-2">
                <label htmlFor="whatsapp" className="block text-sm text-white/65">رقم واتساب</label>
                <input
                  id="whatsapp"
                  name="whatsapp"
                  type="tel"
                  defaultValue={tenant.whatsapp || ""}
                  placeholder="+966501234567"
                  className="mt-2 w-full rounded border border-white/20 bg-transparent px-3 py-2 text-white"
                />
              </div>
            </div>
          </div>
        </form>
      </div>
    </main>
  );
}
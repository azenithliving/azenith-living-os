"use client";

import { useEffect, useState } from "react";

type TenantRecord = {
  id: string;
  name: string;
  domain: string;
  logo: string | null;
  primary_color: string | null;
  whatsapp: string | null;
  created_at: string;
};

type FormState = {
  name: string;
  domain: string;
  logo: string;
  primary_color: string;
  whatsapp: string;
};

const defaultForm: FormState = {
  name: "",
  domain: "",
  logo: "",
  primary_color: "#C5A059",
  whatsapp: "",
};

export default function TenantsPage() {
  const [tenants, setTenants] = useState<TenantRecord[]>([]);
  const [form, setForm] = useState<FormState>(defaultForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    loadTenants();
  }, []);

  const loadTenants = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/tenants");
      const data = await response.json();
      if (response.ok && data.tenants) {
        setTenants(data.tenants);
      }
    } catch (error) {
      console.error("Failed to load tenants:", error);
      setMessage({ type: "error", text: "فشل في تحميل بيانات المستأجرين" });
    } finally {
      setLoading(false);
    }
  };

  const handleInput = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch("/api/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || "Failed to create tenant");
      }

      setMessage({ type: "success", text: "تم إنشاء المستأجر بنجاح" });
      setForm(defaultForm);
      loadTenants();
    } catch (error) {
      console.error("Failed to create tenant:", error);
      setMessage({ type: "error", text: "فشل في إنشاء المستأجر" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="px-8 py-12">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.28em] text-brand-primary/70">Tenant system</p>
            <h1 className="mt-3 font-serif text-4xl text-white md:text-5xl">إدارة المستأجرين</h1>
          </div>
          <p className="max-w-xl text-sm text-white/60">الآن يمكنك إدارة شركات متعددة من لوحة التحكم الاحترافية. تم إعداد البنية الأساسية لإضافة المستأجرين لاحقًا.</p>
        </div>

        {message && (
          <div className={`rounded-lg p-4 ${message.type === "success" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
            {message.text}
          </div>
        )}

        <section className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-8">
          <h2 className="text-2xl font-semibold text-white">قائمة المستأجرين</h2>
          <p className="mt-2 text-sm text-white/60">عرض جميع الشركات المرتبطة بالنظام.</p>
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10 text-left text-sm text-white/75">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-white/80">الاسم</th>
                  <th className="px-4 py-3 text-white/80">الدومين</th>
                  <th className="px-4 py-3 text-white/80">اللون الأساسي</th>
                  <th className="px-4 py-3 text-white/80">واتساب</th>
                  <th className="px-4 py-3 text-white/80">التاريخ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {loading ? (
                  <tr><td colSpan={5} className="px-4 py-10 text-center text-white/60">جاري التحميل...</td></tr>
                ) : tenants.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-10 text-center text-white/60">لا توجد شركات مضافة بعد.</td></tr>
                ) : (
                  tenants.map((tenant) => (
                    <tr key={tenant.id} className="hover:bg-white/5 transition">
                      <td className="px-4 py-4">{tenant.name}</td>
                      <td className="px-4 py-4">{tenant.domain}</td>
                      <td className="px-4 py-4">{tenant.primary_color || "-"}</td>
                      <td className="px-4 py-4">{tenant.whatsapp || "-"}</td>
                      <td className="px-4 py-4">{new Date(tenant.created_at).toLocaleDateString("ar-EG")}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-8">
          <h2 className="text-2xl font-semibold text-white">إضافة مستأجر جديد</h2>
          <p className="mt-2 text-sm text-white/60">يمكنك إنشاء شركة جديدة لاحقًا عند بدء تسويق النظام.</p>
          <form className="mt-6 grid gap-6 lg:grid-cols-2" onSubmit={handleCreate}>
            <div>
              <label htmlFor="name" className="block text-sm text-white/65">اسم الشركة</label>
              <input
                id="name"
                value={form.name}
                onChange={(e) => handleInput("name", e.target.value)}
                className="mt-2 w-full rounded border border-white/20 bg-transparent px-3 py-3 text-white"
                required
              />
            </div>
            <div>
              <label htmlFor="domain" className="block text-sm text-white/65">دومين الشركة</label>
              <input
                id="domain"
                value={form.domain}
                onChange={(e) => handleInput("domain", e.target.value)}
                placeholder="example.com"
                className="mt-2 w-full rounded border border-white/20 bg-transparent px-3 py-3 text-white"
                required
              />
            </div>
            <div>
              <label htmlFor="logo" className="block text-sm text-white/65">رابط الشعار</label>
              <input
                id="logo"
                value={form.logo}
                onChange={(e) => handleInput("logo", e.target.value)}
                placeholder="https://..."
                className="mt-2 w-full rounded border border-white/20 bg-transparent px-3 py-3 text-white"
              />
            </div>
            <div>
              <label htmlFor="whatsapp" className="block text-sm text-white/65">رقم واتساب</label>
              <input
                id="whatsapp"
                value={form.whatsapp}
                onChange={(e) => handleInput("whatsapp", e.target.value)}
                placeholder="+9665..."
                className="mt-2 w-full rounded border border-white/20 bg-transparent px-3 py-3 text-white"
              />
            </div>
            <div className="lg:col-span-2">
              <label htmlFor="primary_color" className="block text-sm text-white/65">اللون الأساسي</label>
              <input
                id="primary_color"
                type="color"
                value={form.primary_color}
                onChange={(e) => handleInput("primary_color", e.target.value)}
                className="mt-2 h-12 w-20 rounded border border-white/20 bg-transparent"
              />
            </div>
            <div className="lg:col-span-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-full bg-brand-primary px-8 py-4 text-sm font-semibold text-brand-accent transition hover:bg-[#d8b56d] disabled:opacity-50"
              >
                {saving ? "جاري الإنشاء..." : "إنشاء مستأجر جديد"}
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}

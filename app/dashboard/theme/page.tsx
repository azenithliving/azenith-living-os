"use client";

import { useEffect, useState } from "react";

type ThemeSettings = {
  primaryColor: string;
  secondaryColor: string;
  headingFont: string;
  bodyFont: string;
};

export default function ThemePage() {
  const [settings, setSettings] = useState<ThemeSettings>({
    primaryColor: "#c9a96e",
    secondaryColor: "#1a1a1a",
    headingFont: "serif",
    bodyFont: "sans",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    loadThemeSettings();
  }, []);

  const loadThemeSettings = async () => {
    try {
      const response = await fetch("/api/theme");
      const data = await response.json();
      if (data.ok && data.settings) {
        setSettings(data.settings);
      }
    } catch {
      // Use defaults
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch("/api/theme", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        throw new Error("Failed to save theme settings");
      }

      setMessage({ type: "success", text: "تم حفظ إعدادات المظهر بنجاح" });
    } catch {
      setMessage({ type: "error", text: "فشل في حفظ إعدادات المظهر" });
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (key: keyof ThemeSettings, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <main className="px-8 py-12">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-8 text-center">
            <p className="text-white">جاري تحميل إعدادات المظهر...</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="px-8 py-12">
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.28em] text-brand-primary/70">Theme settings</p>
            <h1 className="mt-3 font-serif text-4xl text-white md:text-5xl">إعدادات المظهر</h1>
          </div>
          <button
            onClick={handleSave}
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

        <div className="grid gap-8 md:grid-cols-2">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-8">
            <h2 className="text-2xl font-semibold text-white">ألوان العلامة التجارية</h2>
            <p className="mt-2 text-sm text-white/60">تخصيص ألوان الموقع لتتناسب مع هويتك البصرية.</p>
            <div className="mt-6 space-y-4">
<div className="flex items-center gap-4">
                <label htmlFor="theme-primary-color" className="text-sm text-white/80">اللون الأساسي:</label>
                <input
                  id="theme-primary-color"
                  type="color"
                  value={settings.primaryColor}
                  onChange={(e) => updateSetting("primaryColor", e.target.value)}
                  className="h-10 w-20 rounded border border-white/20 bg-transparent"
                />
                <span className="text-sm text-white/60">{settings.primaryColor}</span>
              </div>

<div className="flex items-center gap-4">
                <label htmlFor="theme-secondary-color" className="text-sm text-white/80">اللون الثانوي:</label>
                <input
                  id="theme-secondary-color"
                  type="color"
                  value={settings.secondaryColor}
                  onChange={(e) => updateSetting("secondaryColor", e.target.value)}
                  className="h-10 w-20 rounded border border-white/20 bg-transparent"
                />
                <span className="text-sm text-white/60">{settings.secondaryColor}</span>
              </div>

            </div>
          </div>
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-8">
            <h2 className="text-2xl font-semibold text-white">خطوط النصوص</h2>
            <p className="mt-2 text-sm text-white/60">اختيار خطوط مناسبة للمحتوى والعناوين.</p>
            <div className="mt-6 space-y-4">
              <div>
                <label htmlFor="theme-heading-font" className="text-sm text-white/80">خط العناوين:</label>
                <select
                  id="theme-heading-font"
                  value={settings.headingFont}
                  onChange={(e) => updateSetting("headingFont", e.target.value)}
                  className="mt-2 w-full rounded border border-white/20 bg-transparent px-3 py-2 text-white"
                >
                  <option value="serif">خط Serif</option>
                  <option value="sans">خط Sans Serif</option>
                  <option value="mono">خط Monospace</option>
                </select>
              </div>

              <div>
                <label htmlFor="theme-body-font" className="text-sm text-white/80">خط النصوص:</label>
                <select
                  id="theme-body-font"
                  value={settings.bodyFont}
                  onChange={(e) => updateSetting("bodyFont", e.target.value)}
                  className="mt-2 w-full rounded border border-white/20 bg-transparent px-3 py-2 text-white"
                >
                  <option value="sans">خط Sans Serif</option>
                  <option value="serif">خط Serif</option>
                  <option value="mono">خط Monospace</option>
                </select>
              </div>

            </div>
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-8">
          <h2 className="text-2xl font-semibold text-white">معاينة المظهر</h2>
          <p className="mt-2 text-sm text-white/60">كيف سيبدو المظهر الجديد على الموقع.</p>
          <div className="mt-6 space-y-6">
            <div
              className="rounded-lg p-6"
              style={{
                backgroundColor: settings.secondaryColor,
                color: settings.primaryColor,
                fontFamily: settings.bodyFont === "serif" ? "serif" : settings.bodyFont === "mono" ? "monospace" : "sans-serif"
              }}
            >
              <h3
                className="text-xl font-bold mb-2"
                style={{
                  color: settings.primaryColor,
                  fontFamily: settings.headingFont === "serif" ? "serif" : settings.headingFont === "mono" ? "monospace" : "sans-serif"
                }}
              >
                عنوان تجريبي
              </h3>
              <p className="text-sm opacity-80">
                هذا نص تجريبي لمعاينة كيف سيبدو المظهر الجديد على الموقع. يمكنك تعديل الألوان والخطوط لرؤية التغييرات فورًا.
              </p>
              <button
                className="mt-4 px-4 py-2 rounded text-sm font-semibold transition"
                style={{
                  backgroundColor: settings.primaryColor,
                  color: settings.secondaryColor
                }}
              >
                زر تجريبي
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
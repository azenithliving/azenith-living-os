"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Check,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Settings,
  Trash2,
} from "lucide-react";

type SiteSetting = {
  key: string;
  value: unknown;
  updated_at?: string;
};

type SettingsResponse = {
  success?: boolean;
  error?: string;
  raw?: SiteSetting[];
};

function stringifyValue(value: unknown) {
  return typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

function parseValue(value: string): unknown {
  const trimmed = value.trim();
  if (!trimmed) return "";

  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<SiteSetting[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/settings", { cache: "no-store" });
      const data = (await response.json()) as SettingsResponse;
      if (!response.ok || !data.success) {
        throw new Error(data.error || "تعذر تحميل الإعدادات.");
      }

      const raw = Array.isArray(data.raw) ? data.raw : [];
      setSettings(raw);
      setDrafts(Object.fromEntries(raw.map((setting) => [setting.key, stringifyValue(setting.value)])));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "تعذر تحميل الإعدادات.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const saveSetting = async (key: string, value: string, isNew = false) => {
    const normalizedKey = key.trim();
    if (!normalizedKey) {
      setError("اكتب اسمًا واضحًا للإعداد أولًا.");
      return false;
    }

    setSavingKey(normalizedKey);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: normalizedKey, value: parseValue(value) }),
      });
      const data = (await response.json()) as SettingsResponse;
      if (!response.ok || !data.success) {
        throw new Error(data.error || "تعذر حفظ الإعداد.");
      }

      setNotice(isNew ? "تمت إضافة الإعداد." : "تم حفظ التغيير.");
      if (isNew) {
        setNewKey("");
        setNewValue("");
      }
      await loadSettings();
      return true;
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "تعذر حفظ الإعداد.");
      return false;
    } finally {
      setSavingKey(null);
    }
  };

  const deleteSetting = async (key: string) => {
    if (deleteConfirmation !== key) {
      setDeleteConfirmation(key);
      setNotice("اضغط «تأكيد الحذف» مرة ثانية لإزالة هذا الإعداد.");
      return;
    }

    setSavingKey(key);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(`/api/admin/settings?key=${encodeURIComponent(key)}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as SettingsResponse;
      if (!response.ok || !data.success) {
        throw new Error(data.error || "تعذر حذف الإعداد.");
      }

      setDeleteConfirmation(null);
      setNotice("تم حذف الإعداد.");
      await loadSettings();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "تعذر حذف الإعداد.");
    } finally {
      setSavingKey(null);
    }
  };

  const submitNewSetting = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await saveSetting(newKey, newValue, true);
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-4 lg:p-8" dir="rtl">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <Settings className="h-8 w-8 text-[#C5A059]" />
            <h1 className="text-3xl font-black text-white">إعدادات الموقع</h1>
          </div>
          <p className="mt-2 text-sm text-white/50">
            هذه القيم تُحمّل من قاعدة البيانات وتُحفظ فيها مباشرةً.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadSettings()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm text-white/70 transition hover:border-[#C5A059]/50 hover:text-white disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          تحديث
        </button>
      </header>

      {error ? (
        <div className="flex items-start gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-rose-200">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <p>{error}</p>
        </div>
      ) : null}

      {notice ? (
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-100">
          <Check className="mt-0.5 h-5 w-5 shrink-0" />
          <p>{notice}</p>
        </div>
      ) : null}

      <form
        onSubmit={submitNewSetting}
        className="grid gap-3 rounded-3xl border border-[#C5A059]/20 bg-[#C5A059]/5 p-5 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto]"
      >
        <input
          value={newKey}
          onChange={(event) => setNewKey(event.target.value)}
          placeholder="اسم الإعداد، مثال: site_title"
          className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-[#C5A059]"
          aria-label="اسم الإعداد الجديد"
        />
        <input
          value={newValue}
          onChange={(event) => setNewValue(event.target.value)}
          placeholder="قيمة نصية أو JSON صالح"
          className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-[#C5A059]"
          aria-label="قيمة الإعداد الجديد"
        />
        <button
          type="submit"
          disabled={savingKey === newKey.trim() || !newKey.trim()}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#C5A059] px-5 py-3 text-sm font-bold text-black transition hover:bg-[#E5C170] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {savingKey === newKey.trim() ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          إضافة
        </button>
      </form>

      {loading ? (
        <div className="flex min-h-48 items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-[#C5A059]" />
        </div>
      ) : settings.length === 0 ? (
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center text-white/50">
          لا توجد إعدادات محفوظة بعد. أضف أول إعداد من النموذج أعلاه.
        </div>
      ) : (
        <div className="space-y-4">
          {settings.map((setting) => {
            const draft = drafts[setting.key] ?? "";
            const isSaving = savingKey === setting.key;
            const hasChanges = draft !== stringifyValue(setting.value);

            return (
              <article key={setting.key} className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-mono text-sm font-bold text-[#E5C170]">{setting.key}</h2>
                    {setting.updated_at ? (
                      <p className="mt-1 text-xs text-white/35">
                        آخر تعديل: {new Date(setting.updated_at).toLocaleString("ar-EG")}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void saveSetting(setting.key, draft)}
                      disabled={isSaving || !hasChanges}
                      className="inline-flex items-center gap-2 rounded-xl bg-[#C5A059] px-4 py-2 text-xs font-bold text-black transition hover:bg-[#E5C170] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                      حفظ
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteSetting(setting.key)}
                      disabled={isSaving}
                      className="inline-flex items-center gap-2 rounded-xl border border-rose-500/30 px-4 py-2 text-xs font-bold text-rose-300 transition hover:bg-rose-500/10 disabled:opacity-40"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {deleteConfirmation === setting.key ? "تأكيد الحذف" : "حذف"}
                    </button>
                  </div>
                </div>
                <textarea
                  value={draft}
                  onChange={(event) => {
                    setDrafts((current) => ({ ...current, [setting.key]: event.target.value }));
                    if (deleteConfirmation === setting.key) setDeleteConfirmation(null);
                  }}
                  rows={Math.min(12, Math.max(3, draft.split("\n").length + 1))}
                  className="w-full rounded-2xl border border-white/10 bg-black/20 p-4 font-mono text-xs leading-6 text-white outline-none focus:border-[#C5A059]"
                  aria-label={`قيمة الإعداد ${setting.key}`}
                />
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

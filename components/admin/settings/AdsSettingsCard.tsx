"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * التحكم في الإعلانات — two independent switches, because they are two opposite
 * products that both happen to come from Google:
 *
 *  • «إعلانات تُعرض عندك» (AdSense): visitors see Google's ads on this site and
 *    the owner is paid. Needs the publisher id `ca-pub-…`.
 *  • «قياس حملتك على جوجل» (gtag): the owner runs a paid Google Ads campaign /
 *    Analytics property and needs the site to report conversions back. Needs
 *    `AW-…` and/or `G-…`.
 *
 * Both are stored under the existing `seo` settings object so nothing else has
 * to learn a new place to look, and nothing is sent to Google unless the owner
 * turns that switch on AND supplies an id.
 */
type SeoSettings = Record<string, unknown> & {
  adsenseEnabled?: boolean;
  adsenseClient?: string;
  googleAdsId?: string;
  analyticsId?: string;
};

const STARTERS: Array<[keyof SeoSettings & string, string, string]> = [
  ["adsenseClient", "ca-pub-", "مثال: ca-pub-1234567890123456"],
  ["googleAdsId", "AW-", "مثال: AW-123456789"],
  ["analyticsId", "G-", "مثال: G-ABCDEF1234"],
];

export default function AdsSettingsCard() {
  const [seo, setSeo] = useState<SeoSettings | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "saving" | "saved" | "error">("loading");
  const [error, setError] = useState<string>("");

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const r = await fetch("/api/admin/settings?key=seo", { cache: "no-store" });
      const j = await r.json();
      const value = (j?.data?.value ?? j?.value ?? {}) as SeoSettings;
      setSeo({ ...value });
      setStatus("ready");
    } catch {
      setError("موصلتش لإعدادات الموقع");
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!seo) return;
    setStatus("saving");
    setError("");
    try {
      const r = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "seo", value: seo }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j?.success === false) throw new Error(j?.error || `HTTP ${r.status}`);
      setStatus("saved");
    } catch (e) {
      setError(e instanceof Error ? e.message : "فشل الحفظ");
      setStatus("error");
    }
  };

  const set = (k: keyof SeoSettings, v: unknown) => setSeo((s) => (s ? { ...s, [k]: v } : s));

  const adsenseOn = seo?.adsenseEnabled === true;
  const gtagOn = Boolean(seo?.googleAdsId || seo?.analyticsId);

  const field = (key: string, label: string, hint: string, placeholder: string) => (
    <label className="block">
      <span className="text-xs text-white/55">{label}</span>
      <input
        dir="ltr"
        className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 font-mono text-sm text-white placeholder:text-white/25 focus:border-[#C5A059] focus:outline-none"
        value={String((seo?.[key] as string) ?? "")}
        placeholder={placeholder}
        onChange={(e) => set(key, e.target.value.trim())}
      />
      <span className="mt-1 block text-[11px] text-white/35">{hint}</span>
    </label>
  );

  return (
    <section className="rounded-[1.5rem] border border-white/10 bg-white/[0.02] p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white">الإعلانات والقياس</h2>
          <p className="mt-1 text-xs text-white/45">كل مفتاح لوحده — ومفيش أي بيانات بتروحات لجوجل غير لما تفتحه انت.</p>
        </div>
        <span className="rounded-full border border-white/10 px-3 py-1 text-[11px] text-white/50">
          {status === "loading" ? "برضه يستنى…" : status === "saving" ? "بيحفظ…" : status === "saved" ? "اتحفظ ✓" : status === "error" ? "حصل خطأ" : "جاهز"}
        </span>
      </div>

      {!seo && status !== "error" ? (
        <p className="mt-6 text-sm text-white/40">…</p>
      ) : seo ? (
        <div className="mt-5 space-y-6">
          <div className="rounded-2xl border border-white/10 p-4">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 accent-[#C5A059]"
                checked={adsenseOn}
                onChange={(e) => set("adsenseEnabled", e.target.checked)}
              />
              <span>
                <span className="block text-sm font-semibold text-white">إعلانات جوجل تُعرض عندك (انت بتكسب)</span>
                <span className="mt-0.5 block text-xs text-white/45">
                  جوجل يحط إعلانات في صفحات الموقع، والحساب بتاعك على AdSense هو اللي بيستقبل الأرباح.
                </span>
              </span>
            </label>
            <div className="mt-4">
              {field("adsenseClient", "كود الناشر", "بيبدأ بـ ca-pub- — تلاقيه في حساب AdSense بتاعك", "ca-pub-…")}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 p-4">
            <div className="flex items-start gap-3">
              <span className="mt-1 inline-flex h-4 w-4 items-center justify-center rounded bg-white/10 text-[10px] text-white/60">
                {gtagOn ? "✓" : ""}
              </span>
              <span>
                <span className="block text-sm font-semibold text-white">متابعة حملتك على جوجل (انت بتدفع لجوجل)</span>
                <span className="mt-0.5 block text-xs text-white/45">
                  لو عامل إعلان مدفوع على جوجل، الكود ده يقول لهم إن اللي دخل من إعلانهم فعلاً طلب من موقعك.
                  الكود بيتعمل من لوحة Google Ads، وكل رقم تحطيه بيشتغل لوحده.
                </span>
              </span>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {field("googleAdsId", "كود تحويل جوجل إعلاني", "بيبدأ بـ AW- من لوحة Google Ads", "AW-…")}
              {field("analyticsId", "كود تحليلات جوجل", "بيبدأ بـ G- من Google Analytics", "G-…")}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={save}
              disabled={status === "saving"}
              className="rounded-xl bg-[#C5A059] px-5 py-2 text-sm font-semibold text-black transition hover:bg-[#d7b26a] disabled:opacity-50"
            >
              {status === "saving" ? "بيحفظ…" : "احفظ"}
            </button>
            {STARTERS.every(([k, prefix]) => !String(seo?.[k] ?? "").startsWith(prefix)) ? (
              <span className="text-[11px] text-white/35">مللحوظة: دلوقتي مفيش أي مفتاح شغال — الصفحة ما بتبعتش حاجة لجوج.</span>
            ) : null}
          </div>

          {error ? <p className="text-xs text-rose-300">{error}</p> : null}
          <p className="text-[11px] leading-6 text-white/35">
            بعد الحفظ، الصفحة الرئيسية بتتحدّث لوحدها. لو لسه ظاهر لك القديم، جدّد بعد ثانية — التحزين على السيرفر بيخلص
            ترتيبه.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          <p className="text-sm text-rose-300">{error}</p>
          <button onClick={load} className="rounded-xl border border-white/15 px-4 py-2 text-xs text-white/70">
            إعادة المحاولة
          </button>
        </div>
      )}
    </section>
  );
}

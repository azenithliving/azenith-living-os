"use client";

import { useCallback, useEffect, useState } from "react";
import { arNum } from "@/lib/ops/metricLabels";

/**
 * The owner's numbers card: change the store's number, add more, mark which one a customer's button
 * opens. Everything is saved as one list through one door, and the same list is what every page on
 * the site reads — so a number changed here is changed on the home page, the catalogue and the
 * request form in the same breath.
 */

type StoreNumber = { value: string; label: string; primary: boolean };

type State = "loading" | "ready" | "error";

export function StoreNumbersCard() {
  const [numbers, setNumbers] = useState<StoreNumber[]>([]);
  const [state, setState] = useState<State>("loading");
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [newNumber, setNewNumber] = useState("");
  const [newLabel, setNewLabel] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/numbers", { cache: "no-store" });
      const json = (await res.json()) as { success?: boolean; numbers?: StoreNumber[]; error?: string };
      if (!res.ok || !json.success) {
        setLoadError(json.error || `السجل ردّ بكود ${res.status}`);
        setState("error");
        return;
      }
      setNumbers(json.numbers ?? []);
      setState("ready");
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "السجل ما وصلش");
      setState("error");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(list: StoreNumber[]) {
    setSaving(true);
    setNotice("");
    try {
      const res = await fetch("/api/admin/numbers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ numbers: list }),
      });
      const json = (await res.json()) as { success?: boolean; error?: string; wrote?: number; stored?: number };
      setNotice(
        json.success
          ? `اتسجّلت (${arNum(json.stored ?? 0)})`
          : `ما اتسجّلتش: ${json.error || `المزود ردّ بكود ${res.status}`}`
      );
      if (json.success) await load();
    } catch (error) {
      setNotice(`الطلب فوقّع: ${error instanceof Error ? error.message : "مفيش رد"}`);
    } finally {
      setSaving(false);
    }
  }

  function setPrimary(value: string) {
    void save(numbers.map((n) => ({ ...n, primary: n.value === value })));
  }

  function remove(value: string) {
    if (confirmRemove !== value) {
      setConfirmRemove(value);
      setNotice("اضغط «أؤكد الإزالة» تاني — الرقم يفضل في السجل لو ما أكّدتش.");
      return;
    }
    const rest = numbers.filter((n) => n.value !== value);
    if (rest.length === 0) {
      setNotice("آخر رقم في المتجر ما بيتشال — المتجر لازم يوصله عميل.");
      return;
    }
    if (!rest.some((n) => n.primary)) rest[0] = { ...rest[0], primary: true };
    setConfirmRemove(null);
    void save(rest);
  }

  function add(event: React.FormEvent) {
    event.preventDefault();
    const digits = newNumber.replace(/\D/g, "");
    if (digits.length < 10) {
      setNotice("الرقم ناقص — اكتبه بصيغة ٠١٠… أو بكود الدولة.");
      return;
    }
    if (numbers.some((n) => n.value.endsWith(digits.slice(-9)))) {
      setNotice("الرقم ده مسجّل قبل كده.");
      return;
    }
    const list = [...numbers, { value: digits, label: newLabel.trim() || "رقم المتجر", primary: numbers.length === 0 }];
    setNewNumber("");
    setNewLabel("");
    void save(list);
  }

  return (
    <section className="space-y-3 rounded-[2rem] border border-white/10 bg-white/[0.02] p-5" data-numbers-card>
      <div className="space-y-1">
        <h2 className="text-[15px] font-black text-white">أرقام التواصل</h2>
        <p className="text-[11px] leading-relaxed text-white/70">
          الرقم اللي عليه علامة «الأساسي» هو اللي أزرار واتساب في الموقع كلها بتفتح عليه. أي رقم
          تضيفه بيتسجّل في نفس المكان وبيقرأه كل سطح.
        </p>
      </div>

      {state === "loading" ? <p className="text-[12px] text-white/70">بأقرأ الأرقام…</p> : null}
      {state === "error" ? (
        <p className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-[12px] leading-relaxed text-rose-200">
          الأرقام ما وصلتش: {loadError}
        </p>
      ) : null}

      <ul className="space-y-2">
        {numbers.map((n) => (
          <li key={n.value} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] px-4 py-3">
            <div className="min-w-0">
              <p className="text-[12px] font-bold text-white" dir="ltr">
                {n.value}
              </p>
              <p className="text-[11px] text-white/70">
                {n.label} · {n.primary ? "الأساسي" : "ثانوي"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {n.primary ? null : (
                <button
                  type="button"
                  onClick={() => setPrimary(n.value)}
                  disabled={saving}
                  className="rounded-xl border border-white/15 px-3 py-1.5 text-[11px] font-bold text-white transition-colors hover:border-[#C5A059]/50 disabled:opacity-60"
                >
                  خليه الأساسي
                </button>
              )}
              <button
                type="button"
                onClick={() => remove(n.value)}
                disabled={saving}
                aria-label={confirmRemove === n.value ? `أؤكد إزالة ${n.label}` : `أزل ${n.label} من قائمة المتجر`}
                className="rounded-xl border border-rose-500/30 px-3 py-1.5 text-[11px] font-bold text-rose-200 transition-colors hover:bg-rose-500/10 disabled:opacity-60"
              >
                {confirmRemove === n.value ? "أؤكد الإزالة" : "أزله"}
              </button>
            </div>
          </li>
        ))}
      </ul>

      <form onSubmit={add} className="grid gap-2 rounded-2xl border border-dashed border-white/15 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
        <label className="sr-only" htmlFor="new-number">
          الرقم الجديد
        </label>
        <input
          id="new-number"
          dir="ltr"
          inputMode="tel"
          value={newNumber}
          onChange={(e) => setNewNumber(e.target.value)}
          placeholder="010…"
          className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-left text-[12px] text-white placeholder:text-white/70"
        />
        <label className="sr-only" htmlFor="new-label">
          اسم الرقم
        </label>
        <input
          id="new-label"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder="المبيعات"
          className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[12px] text-white placeholder:text-white/70"
        />
        <button
          type="submit"
          disabled={saving || !newNumber.trim()}
          className="rounded-xl bg-[#C5A059] px-4 py-2 text-[12px] font-bold text-[#1A1A1B] transition disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "بأسجّل…" : "أضف الرقم"}
        </button>
      </form>

      {notice ? <p className="text-[11px] leading-relaxed text-white/70">{notice}</p> : null}
    </section>
  );
}

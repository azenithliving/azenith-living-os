"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * الجاهز من الكلام — the sentences the consultant is allowed to say on its own.
 *
 * These rows are the only place a visitor gets an automatic answer, so this card
 * is not a content editor, it is a signature board: a row answers the public only
 * while it has an approver and is switched on. Switching off is preferred over
 * deleting — the shop keeps the record that the sentence was ever said.
 */
interface FaqRow {
  id: string;
  question: string;
  answer: string;
  approved_by: string | null;
  is_active: boolean;
}

export default function ConsultantFaqCard() {
  const [rows, setRows] = useState<FaqRow[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const r = await fetch("/api/consultant/faq", { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
      setRows((j.faq || []) as FaqRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "موصلتش لدفتر الكلام الجاهز");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // The row id travels in the query string, exactly like the endpoint reads it.
  const post = async (init: RequestInit, id?: string) => {
    setBusy(true);
    setError("");
    try {
      const r = await fetch(id ? `/api/consultant/faq?id=${encodeURIComponent(id)}` : "/api/consultant/faq", init);
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j?.error) throw new Error(j?.error || `HTTP ${r.status}`);
      await load();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "حصل خطأ");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const add = async () => {
    if (!question.trim() || !answer.trim()) return;
    const ok = await post({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: question.trim(), answer: answer.trim() }),
    });
    if (ok) {
      setQuestion("");
      setAnswer("");
    }
  };

  const toggle = (row: FaqRow) =>
    post({
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !row.is_active }),
    }, row.id).then(() => undefined);

  const remove = (row: FaqRow) => post({ method: "DELETE" }, row.id).then(() => undefined);

  return (
    <section className="rounded-[1.5rem] border border-white/10 bg-white/[0.02] p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white">الكلام اللي المستشار بيقوله لوحده</h2>
          <p className="mt-1 text-xs text-white/45">
            السطر ده بيتقال للزائر زي ما هو، لما سؤاله يشابه السؤال المسجل. من غير توقيعك ما بيتقالش.
          </p>
        </div>
        <span className="rounded-full border border-white/10 px-3 py-1 text-[11px] text-white/50">
          {rows === null ? (error ? "حصل خطأ" : "برضه يستنى…") : `${rows.length} سطر`}
        </span>
      </div>

      {error ? <p className="mt-3 text-xs text-rose-300">{error}</p> : null}

      <div className="mt-5 space-y-3">
        {rows?.length === 0 ? (
          <p className="text-sm text-white/40">مفيش سطر جاهز دلوقتي — كل أسئلة الزوار بتروح للمحادثة العادية.</p>
        ) : null}

        {rows?.map((row) => (
          <div key={row.id} className="rounded-2xl border border-white/10 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">{row.question}</p>
                <p className="mt-1 text-xs leading-6 text-white/55">{row.answer}</p>
                <p className="mt-2 text-[11px] text-white/35">
                  {row.approved_by ? `بتوقيع ${row.approved_by}` : "من غير توقيع — ما بيتقالش للزوار"}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <button
                  onClick={() => toggle(row)}
                  disabled={busy}
                  className={`rounded-xl border px-3 py-1 text-[11px] transition disabled:opacity-50 ${
                    row.is_active
                      ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200"
                      : "border-white/15 text-white/50"
                  }`}
                >
                  {row.is_active ? "شغال" : "مقفول"}
                </button>
                <button
                  onClick={() => remove(row)}
                  disabled={busy}
                  className="rounded-xl border border-rose-400/30 px-3 py-1 text-[11px] text-rose-200 transition hover:bg-rose-400/10 disabled:opacity-50"
                >
                  مسح
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-3">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="السؤال زي ما الزائر بيقوله"
          className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/25 focus:border-[#C5A059] focus:outline-none"
        />
        <textarea
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          rows={3}
          placeholder="الرد اللي عايزه يتقال حرفيًا"
          className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm leading-7 text-white placeholder:text-white/25 focus:border-[#C5A059] focus:outline-none"
        />
        <button
          onClick={add}
          disabled={busy || !question.trim() || !answer.trim()}
          className="w-fit rounded-xl bg-[#C5A059] px-5 py-2 text-sm font-semibold text-black transition hover:bg-[#d7b26a] disabled:opacity-50"
        >
          {busy ? "برضه يستنى…" : "سجّله ووقّعه"}
        </button>
      </div>
    </section>
  );
}

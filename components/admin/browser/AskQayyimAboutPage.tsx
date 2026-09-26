"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";

/**
 * Ask the commander about the page that is open in the admin viewer.
 *
 * The viewer already lets the owner look at a competitor or a page of the
 * store by eye. This turns that same view into a measurement the swarm can act
 * on: the URL is sent to the commander, which reads the page and reports what
 * it finds. Nothing is invented — the answer comes from the same tools the chat
 * uses, and the request is sent with the owner's own admin session.
 */
const ASK = (url: string) =>
  `افتح الصفحة دي بالظبط وقولي إيه اللي فيها: ${url}\n` +
  `قياس مش انطباع: عناوين الصفحة، الصور بدون بديل، الروابط المعطوبة، والأسعار اللي باينة. ` +
  `لو الصفحة مش موقعي، قولّي إيه اللي يقدروا عليه واحنا لأ.`;

export default function AskQayyimAboutPage({ url }: { url: string | null }) {
  const [state, setState] = useState<"idle" | "asking" | "done" | "error">("idle");
  const [answer, setAnswer] = useState("");

  const ask = async () => {
    if (!url) return;
    setState("asking");
    setAnswer("");
    try {
      const res = await fetch("/api/admin/agents/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        // The commander can take half a minute when it really reads a page.
        signal: AbortSignal.timeout(240_000),
        body: JSON.stringify({ agent_key: "ops-lead", message: ASK(url) }),
      });
      const j = (await res.json().catch(() => ({}))) as { data?: { message?: string } };
      const text = j?.data?.message?.trim();
      if (!res.ok || !text) throw new Error(`HTTP ${res.status}`);
      setAnswer(text);
      setState("done");
    } catch (e) {
      setAnswer(e instanceof Error ? e.message : "خطأ غير معروف");
      setState("error");
    }
  };

  return (
    <>
      <button
        onClick={ask}
        disabled={!url || state === "asking"}
        title="يبعت الصفحة دي لقائد السرب يقرأها ويقول اللي فيه"
        className="flex items-center gap-2 rounded-2xl border border-[#C5A059]/40 bg-[#C5A059]/10 px-4 py-2 text-sm font-medium text-[#e6cf9d] transition hover:bg-[#C5A059]/20 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/5 disabled:text-white/30"
      >
        <Sparkles className="h-4 w-4" />
        {state === "asking" ? "بيقرأ الصفحة…" : "اسأل قيّم الدار عن الصفحة"}
      </button>

      {state !== "idle" ? (
        <div className="mt-4 w-full rounded-2xl border border-white/10 bg-black/40 p-4">
          <p className="mb-2 text-xs text-white/40" dir="rtl">
            {state === "asking" ? "ممكن ياخد نص دقيقة — بيقرأ فعلاً مش بيخمن." : state === "error" ? "تعذّر القراءة:" : "ردّ قائد السرب:"}
          </p>
          <p className="whitespace-pre-wrap text-sm leading-7 text-white/85" dir="rtl">
            {state === "asking" ? "…" : answer}
          </p>
        </div>
      ) : null}
    </>
  );
}

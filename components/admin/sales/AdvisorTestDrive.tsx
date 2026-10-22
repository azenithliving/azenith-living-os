"use client";

/**
 * AdvisorTestDrive — ask the advisor what a customer would ask, and see the answer he actually sends.
 *
 * The old sales screen carried chat state and a send handler, but rendered neither a composer nor a
 * message list, so this capability never existed on any surface. The door answers with `reply`; the
 * dead handler used to read `response`, a field the door has never sent.
 *
 * Two things this panel refuses to hide: a door that does not answer is reported as not answering
 * (never as a reply), and every question typed here is written into the customer ledger like a real
 * visitor's, because that is what the door does.
 */
import { useRef, useState } from "react";
import { AlertTriangle, Loader2, MessagesSquare, SendHorizontal, User } from "lucide-react";

interface Turn {
  from: "owner" | "advisor";
  text: string;
}

/** A session id of the owner's own making, so his test is tellable apart from a visitor's chat. */
function testSessionId(): string {
  return `تجربة-المالك-${Math.random().toString(36).slice(2, 8)}`;
}

export function AdvisorTestDrive() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [waiting, setWaiting] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const sessionRef = useRef<string>(testSessionId());

  const send = async () => {
    const text = draft.trim();
    if (!text || waiting) return;
    setWaiting(true);
    setNote(null);
    setTurns((prev) => [...prev, { from: "owner", text }]);
    setDraft("");
    try {
      const res = await fetch("/api/consultant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, sessionId: sessionRef.current, language: "ar" }),
      });
      const body = (await res.json().catch(() => null)) as
        | { reply?: string; queued?: boolean; error?: string }
        | null;
      if (!res.ok) {
        const given = typeof body?.error === "string" && /[؀-ۿ]/.test(body.error) ? body.error : null;
        setNote(given ?? `باب المستشار ردّ بحالة ${res.status} من غير ما يوصّل سبب بالعربي`);
        return;
      }
      const reply = typeof body?.reply === "string" ? body.reply.trim() : "";
      if (!reply) {
        setNote("الباب ردّ من غير كلام — فمفيش ردّ أوريك.");
        return;
      }
      setTurns((prev) => [...prev, { from: "advisor", text: body?.queued ? `${reply} (الرسالة مستنية ردّ بشري)` : reply }]);
    } catch {
      setNote("الباب ما وصلش أصلًا — اللي فوقه مش ردّ من المستشار.");
    } finally {
      setWaiting(false);
    }
  };

  return (
    <section className="rounded-3xl border border-white/[0.06] bg-white/[0.015] p-4 sm:p-5 space-y-3" aria-labelledby="advisor-test-drive-title">
      <header className="flex flex-wrap items-center gap-2">
        <MessagesSquare className="w-4 h-4 text-amber-300" aria-hidden="true" />
        <h2 id="advisor-test-drive-title" className="text-sm font-black text-white">جرّب كلام المستشار</h2>
        <span className="text-[10px] text-white/70">اسأله سؤال عميل، واللي يوصلك هو نفسه اللي بيوصل الزائر</span>
      </header>

      {turns.length === 0 ? (
        <p className="text-[11px] leading-relaxed text-white/70">
          لسه ما اتسألش. اكتب سؤال زي ما زائر يسأله على الواتساب، واضغط «ابعت».
        </p>
      ) : (
        <ul className="space-y-2" aria-live="polite">
          {turns.map((turn, i) => (
            <li
              key={i}
              className={`max-w-[92%] rounded-2xl border px-3 py-2 text-[11px] leading-relaxed ${
                turn.from === "owner"
                  ? "ml-auto border-white/10 bg-white/[0.05] text-white/90"
                  : "border-amber-500/20 bg-amber-500/[0.06] text-white"
              }`}
            >
              <span className="mb-1 flex items-center gap-1 text-[10px] text-white/70">
                {turn.from === "owner" ? <User className="w-3 h-3" aria-hidden="true" /> : <MessagesSquare className="w-3 h-3" aria-hidden="true" />}
                {turn.from === "owner" ? "سؤالك" : "الردّ اللي هيوصل العميل"}
              </span>
              {turn.text}
            </li>
          ))}
          {waiting ? (
            <li className="flex items-center gap-2 text-[11px] text-white/70">
              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
              المستشار بيكتب ردّه...
            </li>
          ) : null}
        </ul>
      )}

      {note ? (
        <p className="flex items-start gap-2 text-[11px] leading-relaxed text-rose-300">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
          {note}
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        <label className="sr-only" htmlFor="advisor-test-input">سؤال العميل اللي بيجرّبه</label>
        <textarea
          id="advisor-test-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={2}
          placeholder="مثال: الصوفا بتوصل في قد إيه؟"
          className="w-full min-w-0 rounded-xl bg-white/[0.04] border border-white/10 px-3 py-2 text-xs text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={send}
            disabled={!draft.trim() || waiting}
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/20 border border-amber-500/30 px-2.5 py-1 text-[11px] font-bold text-amber-200 disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
          >
            <SendHorizontal className="w-3 h-3" aria-hidden="true" />
            ابعت
          </button>
          <button
            type="button"
            onClick={() => { setTurns([]); setNote(null); sessionRef.current = testSessionId(); }}
            className="rounded-lg border border-white/10 px-2.5 py-1 text-[11px] text-white/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
          >
            ابدأ محادثة جديدة
          </button>
        </div>
      </div>

      <p className="text-[10px] leading-relaxed text-white/70">
        كل سؤال هنا بيتسجّل كمحادثة في دفتر العملاء، زي سؤال الزائر بالظبط — عشان الباب نفسه هو اللي بيكتبه.
      </p>
    </section>
  );
}

export default AdvisorTestDrive;

"use client";

/**
 * KnowledgeDesk — the sales manager's memory, on his desk in the new house.
 *
 * This is the capability that stayed behind when the sales office moved: the rules the advisor was
 * taught, the customer questions it could not answer, and the auditor that hunts for gaps. The old
 * screen held them in a 1,261-line page; the new office only had the chat, the pre-call file and the
 * customer ledger — so the manager could talk but could not be corrected.
 *
 * Three brakes carried from the rest of this store:
 *  • a door that answers badly says so on the panel, instead of showing an empty list that looks like
 *    an empty shop (`lede` under each section carries the refusal in words);
 *  • there is no delete button here. Retiring a rule the owner taught the store is his word, so the
 *    desk can add and correct, and it says why it cannot erase;
 *  • every number on this screen is his digits, and no machine identifier reaches his eyes.
 */
import { useCallback, useEffect, useState } from "react";
import { BookOpen, Brain, HelpCircle, Loader2, Pencil, Plus, RefreshCw, X } from "lucide-react";
import { arDigits, arNum } from "@/lib/ops/metricLabels";

interface Learning {
  id: string;
  instruction: string;
  created_at?: string;
}
interface Question {
  id: string;
  question: string;
  created_at?: string;
}

async function readDoor(url: string, init?: RequestInit): Promise<{ data: unknown | null; error: string | null }> {
  const what = url.split("?")[0].split("/").slice(-2).join(" ");
  try {
    const res = await fetch(url, init);
    const body = await res.json().catch(() => null);
    const given = (body as { error?: string } | null)?.error;
    // The owner reads Arabic only, so a door that answers with a Latin machine sentence must not reach
    // his eyes as one. The status code stays in the sentence because it is the part he can act on.
    if (!res.ok) {
      const usable = typeof given === "string" && /[؀-ۿ]/.test(given) ? given : null;
      return { data: null, error: usable ?? `باب ${what} ردّ بحالة ${arDigits(String(res.status))} من غير ما يوصّل سبب بالعربي` };
    }
    return { data: body, error: null };
  } catch (e) {
    return { data: null, error: `باب ${what} ما وصلش أصلًا: ${e instanceof Error && /[؀-ۿ]/.test(e.message) ? e.message : "الاتصال انقطع"}` };
  }
}

function Section({ icon: Icon, title, note, count, children }: {
  icon: typeof BookOpen;
  title: string;
  note?: string | null;
  count?: number | null;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
      <header className="flex items-center gap-2">
        <Icon className="w-4 h-4 shrink-0 text-amber-300" aria-hidden="true" />
        <h3 className="text-sm font-bold text-white">{title}</h3>
        {typeof count === "number" ? (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/25 text-amber-300">
            {arNum(count)}
          </span>
        ) : null}
      </header>
      {note ? <p className="mt-2 text-[11px] leading-relaxed text-rose-300">{note}</p> : null}
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

export default function KnowledgeDesk() {
  const [learnings, setLearnings] = useState<Learning[]>([]);
  const [learningsError, setLearningsError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Learning | null>(null);
  const [editText, setEditText] = useState("");
  const [actionNote, setActionNote] = useState<string | null>(null);

  const [questions, setQuestions] = useState<Question[]>([]);
  const [questionsError, setQuestionsError] = useState<string | null>(null);
  const [answering, setAnswering] = useState<Question | null>(null);
  const [answer, setAnswer] = useState("");

  const [gaps, setGaps] = useState<Question[]>([]);
  const [auditing, setAuditing] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);

  const loadLearnings = useCallback(async () => {
    const { data, error } = await readDoor("/api/consultant/learnings");
    if (error) {
      setLearningsError(error);
      return;
    }
    setLearningsError(null);
    setLearnings(((data as { learnings?: Learning[] } | null)?.learnings ?? []).filter((row) => typeof row?.instruction === "string"));
  }, []);

  const loadQuestions = useCallback(async () => {
    const { data, error } = await readDoor("/api/consultant/pending-questions");
    if (error) {
      setQuestionsError(error);
      return;
    }
    setQuestionsError(null);
    setQuestions(((data as { questions?: Question[] } | null)?.questions ?? []).filter((row) => typeof row?.question === "string"));
  }, []);

  useEffect(() => {
    void loadLearnings();
    void loadQuestions();
  }, [loadLearnings, loadQuestions]);

  const addRule = async () => {
    const instruction = draft.trim();
    if (!instruction || saving) return;
    setSaving(true);
    setActionNote(null);
    const { error } = await readDoor("/api/consultant/learnings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instruction }),
    });
    setSaving(false);
    if (error) {
      setActionNote(`القاعدة ما اتسجلتش: ${error}`);
      return;
    }
    setDraft("");
    await loadLearnings();
  };

  const saveEdit = async () => {
    const instruction = editText.trim();
    if (!editing || !instruction) return;
    setSaving(true);
    setActionNote(null);
    const { error } = await readDoor(`/api/consultant/learnings?id=${encodeURIComponent(editing.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instruction }),
    });
    setSaving(false);
    if (error) {
      setActionNote(`التصحيح ما اتعملش: ${error}`);
      return;
    }
    setEditing(null);
    setEditText("");
    await loadLearnings();
  };

  const answerQuestion = async () => {
    const text = answer.trim();
    if (!answering || !text) return;
    setSaving(true);
    setActionNote(null);
    // One act, one door: the desk hands the answer over and the question's own door turns it into
    // a rule. This panel used to write a rule beside that one, so every answer taught the manager
    // the same thing twice, in two shapes.
    const { data, error } = await readDoor(`/api/consultant/pending-questions?id=${encodeURIComponent(answering.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answered_reply: text }),
    });
    setSaving(false);
    if (error) {
      setActionNote(`الردّ ما اتسجلش: ${error}`);
      return;
    }
    const compiled = (data as { compiled?: { saved: boolean; note: string } } | null)?.compiled;
    if (compiled && !compiled.saved) {
      setActionNote(compiled.note);
      return;
    }
    setActionNote(compiled?.note ?? null);
    setAnswering(null);
    setAnswer("");
    await Promise.all([loadLearnings(), loadQuestions()]);
  };

  const runAudit = async () => {
    setAuditing(true);
    setAuditError(null);
    const { data, error } = await readDoor("/api/admin/knowledge/audit", { method: "POST" });
    setAuditing(false);
    if (error) {
      setAuditError(error);
      return;
    }
    setGaps(((data as { questions?: Question[] } | null)?.questions ?? []).filter((row) => typeof row?.question === "string"));
  };

  return (
    <div className="rounded-3xl border border-white/[0.06] bg-white/[0.015] p-4 sm:p-5 space-y-4">
      <header className="flex flex-wrap items-center gap-2">
        <Brain className="w-4 h-4 text-amber-300" aria-hidden="true" />
        <h2 className="text-sm font-black text-white">معرفة مدير المبيعات</h2>
        <span className="text-[10px] text-white/70">اللي علّمته له، واللي لسه ما عرفوش، واللي بيدوّر على الفجوات</span>
      </header>

      {actionNote ? <p className="text-[11px] leading-relaxed text-rose-300">{actionNote}</p> : null}

      <Section icon={BookOpen} title="القواعد اللي علّمتها له" count={learnings.length} note={learningsError}>
        <div className="flex flex-col gap-2">
          <label className="sr-only" htmlFor="knowledge-new">قاعدة جديدة يعلّمها المستشار</label>
          <textarea
            id="knowledge-new"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={2}
            placeholder="مثال: أسأل عن المقاس قبل اللون، والكرسي المفرد ما ينفعش يوصل قبل الصوفا"
            className="w-full min-w-0 rounded-xl bg-white/[0.04] border border-white/10 px-3 py-2 text-xs text-white placeholder:text-white/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
          />
          <button
            type="button"
            onClick={addRule}
            disabled={!draft.trim() || saving}
            className="self-start inline-flex items-center gap-1.5 rounded-xl bg-amber-500/20 border border-amber-500/30 px-3 py-1.5 text-[11px] font-bold text-amber-200 disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> : <Plus className="w-3.5 h-3.5" aria-hidden="true" />}
            علّمه دي
          </button>
        </div>

        {learnings.length === 0 && !learningsError ? (
          <p className="text-[11px] text-white/70">مفيش قاعدة مسجلة لحد دلوقتي — أول حاجة تقولهالها هنا هي أول حاجة يتعلمها.</p>
        ) : null}
        <ul className="space-y-2">
          {learnings.map((row) => (
            <li key={row.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
              {editing?.id === row.id ? (
                <div className="space-y-2">
                  <label className="sr-only" htmlFor="knowledge-edit">تصحيح القاعدة</label>
                  <textarea
                    id="knowledge-edit"
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    rows={2}
                    className="w-full min-w-0 rounded-xl bg-white/[0.04] border border-white/10 px-3 py-2 text-xs text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={saveEdit} disabled={!editText.trim() || saving} className="rounded-lg bg-amber-500/20 border border-amber-500/30 px-2.5 py-1 text-[11px] font-bold text-amber-200 disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70">
                      احفظ التصحيح
                    </button>
                    <button type="button" onClick={() => { setEditing(null); setEditText(""); }} className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1 text-[11px] text-white/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70">
                      <X className="w-3 h-3" aria-hidden="true" /> ألغي
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[11px] leading-relaxed text-white/85">{row.instruction}</p>
                  <button type="button" onClick={() => { setEditing(row); setEditText(row.instruction); }} className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-[10px] text-white/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70">
                    <Pencil className="w-3 h-3" aria-hidden="true" /> صحّح
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
        <p className="text-[10px] leading-relaxed text-white/70">المسح مش في الأيد دي: قاعدة اتعلّمها الدار ما تتشالش بزر — دي كلمة منك.</p>
      </Section>

      <Section icon={HelpCircle} title="أسئلة الزوار اللي لسه بلا رد" count={questions.length} note={questionsError}>
        {questions.length === 0 && !questionsError ? (
          <p className="text-[11px] text-white/70">مفيش سؤال علّق — كل ما زائر يسأل حاجة المستشار ما يعرفهاش، بتظهر هنا.</p>
        ) : null}
        <ul className="space-y-2">
          {questions.map((q) => (
            <li key={q.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
              <p className="text-[11px] leading-relaxed text-white/85">{q.question}</p>
              {answering?.id === q.id ? (
                <div className="mt-2 space-y-2">
                  <label className="sr-only" htmlFor="question-answer">ردك على السؤال</label>
                  <textarea
                    id="question-answer"
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    rows={2}
                    className="w-full min-w-0 rounded-xl bg-white/[0.04] border border-white/10 px-3 py-2 text-xs text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={answerQuestion} disabled={!answer.trim() || saving} className="rounded-lg bg-amber-500/20 border border-amber-500/30 px-2.5 py-1 text-[11px] font-bold text-amber-200 disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70">
                      علّمه الرد
                    </button>
                    <button type="button" onClick={() => { setAnswering(null); setAnswer(""); }} className="rounded-lg border border-white/10 px-2.5 py-1 text-[11px] text-white/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70">
                      ألغي
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => { setAnswering(q); setAnswer(""); }} className="mt-2 rounded-lg border border-white/10 px-2.5 py-1 text-[10px] text-white/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70">
                  رد عليه
                </button>
              )}
            </li>
          ))}
        </ul>
      </Section>

      <Section icon={RefreshCw} title="تدقيق المعرفة" count={auditing ? null : gaps.length} note={auditError}>
        <button type="button" onClick={runAudit} disabled={auditing} className="inline-flex items-center gap-1.5 rounded-xl bg-white/[0.05] border border-white/10 px-3 py-1.5 text-[11px] font-bold text-white/85 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70">
          {auditing ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> : <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />}
          {auditing ? "بيدوّر..." : "دوّر على الفجوات"}
        </button>
        {!auditing && gaps.length === 0 && !auditError ? (
          <p className="text-[11px] text-white/70">لما تدوّر ولقي فجوة في معرفتك، الأسئلة دي تظهر هنا واحد واحد.</p>
        ) : null}
        <ul className="space-y-2">
          {gaps.map((g) => (
            <li key={g.id ?? g.question} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
              <p className="text-[11px] leading-relaxed text-white/85">{g.question}</p>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

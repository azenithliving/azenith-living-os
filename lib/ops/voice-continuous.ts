/**
 * Continuous dictation — the thinking part, kept out of the browser.
 *
 * The Web Speech recognizer is a poor narrator: it emits half-words it has not
 * decided on yet, it ends the session by itself in the middle of a thought, and
 * it fires no event at all when the room simply goes quiet. So the rules of
 * «he finished his sentence» live here as plain data over an injected clock:
 * a settled phrase, no interim words still in flight, and a real pause.
 *
 * The component owns the microphone; this owns the decision.
 */
import { arNum } from "@/lib/ops/metricLabels";

/** Long enough to be a breath between clauses, short enough to feel instant. */
export const CONTINUOUS_SILENCE_MS = 1_200;

export interface Dictation {
  /** Settled words that have not been sent yet. */
  pending: string;
  /** Words the recognizer is still revising — he may still be talking. */
  interim: string;
  lastSpeechAt: number;
  /** The owner switched continuous mode on and has not switched it off. */
  armed: boolean;
  /** How many sentences this session already sent — reported, never guessed. */
  sentCount: number;
}

export interface Heard {
  finalText: string;
  interimText: string;
}

export function createDictation(now: number, armed = true): Dictation {
  return { pending: "", interim: "", lastSpeechAt: now, armed, sentCount: 0 };
}

function join(left: string, right: string): string {
  return `${left} ${right}`.replace(/\s+/g, " ").trim();
}

/** Fold one recognizer event into the state. Settled words extend the sentence;
 * interim words only prove he is still speaking. */
export function record(d: Dictation, heard: Heard, now: number): Dictation {
  const finalText = (heard.finalText || "").trim();
  const interimText = heard.interimText || "";
  if (!finalText && !interimText.trim()) return { ...d, lastSpeechAt: now };
  return {
    ...d,
    pending: finalText ? join(d.pending, finalText) : d.pending,
    interim: interimText.trim() ? interimText : "",
    lastSpeechAt: now,
  };
}

/**
 * The sentence to send now, or null. Silent while unarmed: a stop button that
 * sends one last thing behind the owner's back is not a stop button.
 */
export function dueToSend(d: Dictation, now: number, silenceMs = CONTINUOUS_SILENCE_MS): string | null {
  if (!d.armed) return null;
  if (!d.pending.trim()) return null;
  if (d.interim.trim()) return null;
  if (now - d.lastSpeechAt < silenceMs) return null;
  return d.pending.trim();
}

export function markSent(d: Dictation, now: number): Dictation {
  return { ...d, pending: "", interim: "", lastSpeechAt: now, sentCount: d.sentCount + 1 };
}

/** Pressing stop must not swallow the last half-sentence: it is handed back. */
export function stopDictation(d: Dictation): { dictation: Dictation; leftover: string | null } {
  const leftover = d.pending.trim() ? d.pending.trim() : null;
  return { dictation: { ...d, armed: false, pending: "", interim: "" }, leftover };
}

/**
 * Chrome ends a recognition session on its own after a pause. While the owner is
 * armed that is a restart; once he pressed stop it is the end.
 */
export function shouldRestart(state: { armed: boolean; stoppedByOwner: boolean }): boolean {
  return state.armed && !state.stoppedByOwner;
}

/** What the voice says when it stopped early. An omission has to be announced. */
export const SPEAK_TRUNCATED_MARK = "كمّل في الشاشة";

/**
 * Turn an agent reply into something worth listening to.
 *
 * The screen can hold a whole audit; a speaker holding the owner in traffic
 * cannot. So: markdown and links go, Latin identifiers go (they are unreadable
 * out loud in an Arabic sentence), it stops at a sentence boundary inside the
 * budget, and when anything was left behind the voice says so rather than
 * sounding like a complete answer.
 */
export function speakableSummary(text: string | null | undefined, budget = 240): string {
  if (!text) return "";
  const clean = String(text)
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/https?:\/\/\S+/g, "رابط")
    .replace(/[*#`>|_]/g, " ")
    .replace(/[-—]{2,}/g, "،")
    // Latin runs are unreadable spoken inside Arabic — the URL above already
    // became «رابط». Digits stay: a number the owner cannot hear is no number.
    .replace(/[A-Za-zÀ-ÿ_.\/-]{2,}/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return "";
  if (clean.length <= budget) return clean;

  const window = clean.slice(0, budget);
  const lastStop = Math.max(window.lastIndexOf("."), window.lastIndexOf("؟"), window.lastIndexOf("!"));
  const cut = lastStop >= Math.floor(budget / 3) ? window.slice(0, lastStop + 1) : window.slice(0, window.lastIndexOf(" ")).trim();
  const said = cut.replace(/[،,\s-]+$/g, "");
  return `${said}… ${SPEAK_TRUNCATED_MARK}`;
}

/**
 * Read a real `SpeechRecognitionEvent`. `results` is a live result list, not an
 * array, and each row is index-addressed — hence the defensive walk: the shapes
 * below are what browsers and tests actually hand over.
 */
export function transcriptOf(event: unknown): Heard {
  const results = (event as { results?: unknown })?.results;
  if (!results || typeof (results as { length?: number }).length !== "number") {
    return { finalText: "", interimText: "" };
  }

  // A real browser hands over the WHOLE session in every event — the list grows and
  // `resultIndex` marks where this event's news begins. Reading from zero re-added
  // every settled sentence, so «اعرض قائمة العملاء» arrived as «اعرض اعرض قائمة
  // العملاء»: the owner speaks once and the machine hears itself twice.
  const startAt = (event as { resultIndex?: unknown }).resultIndex;
  const from = typeof startAt === "number" && startAt > 0 ? startAt : 0;

  let finalText = "";
  let interimText = "";
  for (let i = from; i < (results as ArrayLike<unknown>).length; i++) {
    const row = (results as ArrayLike<Record<string, unknown>>)[i] as
      | { isFinal?: boolean; 0?: { transcript?: unknown } }
      | undefined;
    const transcript = typeof row?.[0]?.transcript === "string" ? row[0]!.transcript as string : "";
    if (!transcript) continue;
    if (row?.isFinal) finalText += transcript;
    else interimText += transcript;
  }
  return { finalText, interimText };
}

/**
 * The ten-second morning brief — what the cockpit says out loud when he presses «اسمع».
 *
 * He reads his phone, he does not scroll it. The rule that keeps this worth listening to is the one
 * the daily report learned the hard way: a voice that recites everything is a voice he switches off
 * after one morning. So it names only what waits for him, in his numerals, and when nothing waits it
 * says that instead of reading zeros.
 */

/** ≈ ten seconds of Arabic at a slowed rate. Longer and he stops pressing it. */
export const BRIEF_BUDGET = 170;

/** Arabic counts the noun after the number, so each band needs its own shape. */
function decisionPhrase(n: number): string {
  if (n === 1) return "قرار واحد مستني";
  if (n === 2) return "قراران مستنيين";
  if (n >= 3 && n <= 10) return `${arNum(n)} قرارات مستنية`;
  return `${arNum(n)} قرار مستني`;
}

function messagePhrase(n: number): string {
  if (n === 1) return "رسالة جديدة";
  if (n === 2) return `${arNum(n)} رسالتين جديدتين`;
  if (n >= 3 && n <= 10) return `${arNum(n)} رسائل جديدة`;
  return `${arNum(n)} رسالة جديدة`;
}

/** Zero is an answer («مفيش»), a missing read is not — only a real number counts as known. */
const readCount = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;

/**
 * A count he never gave is left out of the sentence rather than guessed — «مفيش» is a fact, a
 * missing read is not.
 */
export function morningBrief({ decisions, unread }: { decisions: unknown; unread: unknown }): string {
  const waiting = readCount(decisions);
  const fresh = readCount(unread);

  if (waiting === null && fresh === null) return "صباح الخير. قولّي عايز تسمع إيه.";
  if (waiting === null) return `صباح الخير. عندك ${messagePhrase(fresh!)}.`;
  if (fresh === null) return `صباح الخير. ${decisionPhrase(waiting)}.`;

  if (waiting === 0 && fresh === 0) return "صباح الخير. مفيش قرار مستني ومفيش رسالة جديدة — الدار ماشية.";
  if (waiting === 0) return `صباح الخير. مفيش قرار مستني، وعندك ${messagePhrase(fresh)}.`;
  if (fresh === 0) return `صباح الخير. ${decisionPhrase(waiting)}، ومفيش رسالة جديدة.`;
  return `صباح الخير. ${decisionPhrase(waiting)}، وعندك ${messagePhrase(fresh)}. أفتح القرارات الأول؟`;
}

export interface VoiceLike {
  lang?: string;
  name?: string;
}

/**
 * The voice to read with, from whatever list the phone has loaded.
 *
 * `getVoices()` arrives asynchronously and is often empty on the first call, so an empty list is a
 * normal answer and not a failure — the caller retries and, if the phone truly has no Arabic voice,
 * says so instead of reading his Arabic with an English accent.
 */
export function pickArabicVoice<T extends VoiceLike>(voices: T[] | null | undefined): T | null {
  const list = Array.isArray(voices) ? voices : [];
  return (
    list.find((v) => v?.lang === "ar-EG") ||
    list.find((v) => v?.lang?.startsWith("ar") && /google|microsoft|female|salma|maged|hoda/i.test(v?.name ?? "")) ||
    list.find((v) => v?.lang?.startsWith("ar")) ||
    null
  );
}

/**
 * What to do the moment he presses the brief.
 *
 * Measured on his phone 2026-10-06: the button answered «مفيش صوت عربي على الجهاز ده» — and the
 * honest cause is that Chrome hands out an EMPTY voice list on the first call and fills it a moment
 * later through `voiceschanged`. Refusing before that list exists is my bug, not his phone's. So the
 * three outcomes are separated: speak, wait for the list, or — only when a loaded list truly holds
 * no Arabic voice — say so and name how many voices the phone does have.
 */
export function nextVoiceStep({
  voicesTotal,
  arabicFound,
}: {
  voicesTotal: number;
  arabicFound: boolean;
}): "speak" | "wait" | "unavailable" {
  if (arabicFound) return "speak";
  if (!Number.isFinite(voicesTotal) || voicesTotal <= 0) return "wait";
  return "unavailable";
}

/** The reason line, worded by what the phone actually has — never a bare failure. */
export function voiceShortfallLine(voicesTotal: number): string {
  const n = Number.isFinite(voicesTotal) && voicesTotal > 0 ? voicesTotal : 0;
  return n === 0
    ? "مفيش صوت على الجهاز ده خالص — النطق متوقف."
    : `جهازك فيه ${arNum(n)} صوت، ولا واحد عربي — نزّل الصوت العربي من إعدادات نظامك.`;
}

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
  let finalText = "";
  let interimText = "";
  for (let i = 0; i < (results as ArrayLike<unknown>).length; i++) {
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

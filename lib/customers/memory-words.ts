/**
 * memory-words.ts — the pure half of the customer memory: his kinds, his labels, the one sentence.
 *
 * Split from `memory.ts` by the store's standing rule: the file that opens the record carries
 * `server-only`, and a surface the owner or the customer reads must be able to say the same words
 * without dragging the database credential into the browser bundle.
 *
 * A fact here is something HE gave — a colour he stopped on, the area he typed, the room on his paper.
 * Nothing is guessed, and `evidence` names where it came from so the shop can say «من ورقتك».
 */
import { FAMILY_LABELS, type PaletteFamily } from "@/lib/cad/palette";
import { roomTypeName } from "@/lib/cad/room-labels";
import { STYLE_LABELS } from "@/lib/constants/rooms";

export const MEMORY_KINDS = ["style", "colour", "area", "room", "budget", "note"] as const;
export type MemoryKind = (typeof MEMORY_KINDS)[number];

/** The owner's word for each kind — one place, so no surface invents another. */
export const KIND_LABELS: Record<MemoryKind, string> = {
  style: "طرازه",
  colour: "ألوانه",
  area: "منطقته",
  room: "غرفته",
  budget: "ميزانيته",
  note: "كلمة منه",
};

/** Where a fact came from, in words the owner can read over the phone. */
export const SOURCES = {
  sheetColours: "اختارها بنفسه على ورقته",
  sheetRoom: "نوع الغرفة اللي رسمها",
  sheetArea: "كتب منطقته على ورقته",
  advisorWords: "قالها بنفسه في كلامه مع المسترشد",
  leadForm: "من استمارة النخبة",
} as const;

export type Fact = { kind: MemoryKind; value: string; source: string; evidence?: string | null };

export type MemoryRow = {
  kind: MemoryKind;
  value: string;
  source: string;
  evidence: string | null;
  first_seen_at: string;
  last_seen_at: string;
};

export const MAX_FACT_LENGTH = 120;

/** His own words, trimmed to what the column can hold. Nothing is invented here. */
export function cleanValue(raw: unknown): string | null {
  const text = String(raw ?? "").replace(/[\u0000-\u001f<>]/g, " ").replace(/\s+/g, " ").trim();
  if (!text) return null;
  return text.slice(0, MAX_FACT_LENGTH);
}

export function isMemoryKind(raw: unknown): raw is MemoryKind {
  return (MEMORY_KINDS as readonly string[]).includes(String(raw));
}

/** His words stay his; only the machine keys are read through the store's single label maps. */
export function displayValue(kind: MemoryKind, value: string): string {
  if (kind === "colour") return FAMILY_LABELS[value as PaletteFamily] ?? value;
  if (kind === "style") return STYLE_LABELS[value] ?? value;
  if (kind === "room") return roomTypeName(value) ?? value;
  return value;
}

/**
 * His words, or nothing. A value that still comes back wearing Latin letters is not something either
 * of them reads: the label maps own the four bank keys, and everything else is a page slug or an
 * outside spelling. Measured 2026-10-15 in the store's own taste column: `elite-brief` on 14 rows,
 * «مودرن (Modern)» on 2, `modern` on 1.
 *
 * The customer's sentence and the owner's file both go through here, because a machine key printed on
 * either surface reads as the shop remembering a word nobody ever used.
 */
export function readableValue(kind: MemoryKind, value: string): string | null {
  const shown = displayValue(kind, value);
  return /[A-Za-z]/.test(shown) ? null : shown;
}

/**
 * The one sentence the customer and the advisor both read: «طرازه مودرن · ألوانه رمادي وبيج دافئ».
 * Empty when nothing is stored — the caller prints the gap instead of this line.
 */
export function memoryLine(rows: MemoryRow[], limit = 6): string | null {
  if (!rows.length) return null;
  const byKind = new Map<MemoryKind, string[]>();
  for (const row of rows) {
    if (!isMemoryKind(row.kind)) continue;
    const shown = readableValue(row.kind, row.value);
    if (!shown) continue;
    const list = byKind.get(row.kind) ?? [];
    if (!list.includes(shown)) list.push(shown);
    byKind.set(row.kind, list);
  }
  const parts: string[] = [];
  for (const kind of MEMORY_KINDS) {
    const values = byKind.get(kind);
    if (!values?.length) continue;
    parts.push(`${KIND_LABELS[kind]} ${values.slice(0, 3).join(" و")}`);
    if (parts.length >= limit) break;
  }
  return parts.length ? parts.join(" · ") : null;
}

/** The same memory as owner-facing fact lines, so no screen has to know the machine keys. */
export function ownerMemoryFacts(rows: MemoryRow[], limit = 8): { label: string; value: string; source: string }[] {
  const seen = new Set<string>();
  const facts: { label: string; value: string; source: string }[] = [];
  for (const row of rows) {
    if (!isMemoryKind(row.kind)) continue;
    const value = readableValue(row.kind, row.value);
    if (!value) continue;
    const id = `${row.kind}:${value}`;
    if (seen.has(id)) continue;
    seen.add(id);
    facts.push({ label: KIND_LABELS[row.kind], value, source: row.source });
    if (facts.length >= limit) break;
  }
  return facts;
}

/** The one prefix every surface uses when it says what the shop remembers about him. */
export const MEMORY_PREFIX = "الدار فاكر";

/** His sheet, his chat and the owner's file all say the same three words, from here. */
export function memorySentence(line: string | null): string | null {
  return line ? `${MEMORY_PREFIX}: ${line}` : null;
}

/**
 * The facts the advisor's own conversation carries, read off the answers the chat's existing readers
 * already named (the area, the style, the room). The budget and anything a model summarised stay out:
 * a memory is only what HE wrote, so an invented number can never come back to him as his own word.
 */
export function factsFromHisWords(named: {
  style?: string | null;
  area?: string | null;
  roomType?: string | null;
}): Fact[] {
  const facts: Fact[] = [];
  const add = (kind: MemoryKind, value: unknown) => {
    const text = cleanValue(value);
    if (text) facts.push({ kind, value: text, source: SOURCES.advisorWords, evidence: "قالها في كلامه مع المسترشد" });
  };
  add("style", named.style);
  add("area", named.area);
  add("room", named.roomType);
  return facts;
}

/**
 * The facts one paper of his carries: the room he drew, the colours he stopped on, the area he typed.
 * Read off the row itself, so a paper that says nothing produces no memory.
 */
export function factsFromPaper(paper: {
  room?: string | null;
  customer_city?: string | null;
  colour_picks?: unknown;
}): Fact[] {
  const facts: Fact[] = [];
  const room = cleanValue(paper.room);
  if (room) facts.push({ kind: "room", value: room, source: SOURCES.sheetRoom, evidence: "ورقته" });
  const city = cleanValue(paper.customer_city);
  if (city) facts.push({ kind: "area", value: city, source: SOURCES.sheetArea, evidence: "كتبها على ورقته" });
  const picks = Array.isArray(paper.colour_picks) ? (paper.colour_picks as Array<{ family?: string }>) : [];
  for (const pick of picks) {
    const family = cleanValue(pick?.family);
    if (family) facts.push({ kind: "colour", value: family, source: SOURCES.sheetColours, evidence: "اختاره على ورقته" });
  }
  return facts;
}

/**
 * dead-map.ts — the verdict a dead surface gets without being erased.
 *
 * The census counts doors nobody calls and furniture no screen reaches. The owner's brake says a
 * delete is his word, so the map never proposes removal: it proposes one of four verdicts, and a
 * verdict the measured facts cannot support stays named as «لسه ما اتصنفش». Guessing a verdict is
 * how surfaces quietly disappeared in the earlier rounds.
 */
import { arDigits } from "../ops/metricLabels.ts";

export type DeadFacts = {
  id: string;
  /** The route answers POST/PUT/PATCH/DELETE. */
  writes: boolean;
  /** It writes into money or orders — the owner's own brake, so his word is required. */
  money: boolean;
  /** Another surface that is still reachable answers the same resource. */
  twin: boolean;
  /** It stands on a path the project retired on purpose. */
  retired: boolean;
  /** Every table it names is absent from the migrations — it cannot answer anything. */
  tableMissing?: boolean;
};

export const DEAD_VERDICTS = [
  { id: "owner-word", label: "قرار المالك", why: "يلمس فلوس أو طلبات" },
  { id: "retire", label: "يتقاعد", why: "واقف على سطح متقاعد عمدًا" },
  { id: "repair", label: "يُصلَح", why: "نفس المورد لسه بيجاوب من سطح حيّ" },
  { id: "needs-verdict", label: "لسه ما اتصنفش", why: "مفيش قياس يرجّح جهة" },
] as const;

export type DeadVerdict = (typeof DEAD_VERDICTS)[number]["id"];

const ABSENT = (field: string) => new Error(`ما اتقارش: ${field} — التصنيف بلا قياس مرفوض`);

export function verdictOf(facts: DeadFacts): DeadVerdict {
  for (const field of ["writes", "money", "twin", "retired"] as const) {
    if (typeof facts[field] !== "boolean") throw ABSENT(field);
  }
  if (!facts.id) throw ABSENT("اسم الباب");
  if (facts.money) return "owner-word";
  if (facts.retired || facts.tableMissing) return "retire";
  if (facts.twin) return "repair";
  return "needs-verdict";
}

export function labelOfVerdict(id: string): string {
  return DEAD_VERDICTS.find((v) => v.id === id)?.label ?? "لسه ما اتصنفش";
}

/** `app/api/admin/agents/tasks/route.ts` -> `admin/agents/tasks` — the door's resource. */
export function resourceOfDoor(path: string): string {
  return path.split("\\").join("/").replace("app/api/", "").replace("/route.ts", "");
}

export function leafOf(resource: string): string {
  return resource.split("/").pop() ?? resource;
}

/**
 * The scheduler is a caller. A cron door listed in vercel.json runs every day even though no screen
 * fetches it — measured 2026-11-05, two of the 77 «orphan» doors were daily jobs.
 */
export function scheduledByCron(path: string, cronPaths: string[]): boolean {
  return cronPaths.includes(`/api/${resourceOfDoor(path)}`);
}

export type DeadTally = {
  doors: number | null;
  furniture: number | null;
  counts: Record<string, number> | null;
};

export function formatDeadLine(tally: DeadTally): string {
  if (tally.doors === null || tally.counts === null) {
    const missing = [
      tally.doors === null ? "عدد الأبواب اليتيمة" : null,
      tally.furniture === null ? "عدد العفش اللي ما يوصلوش حد" : null,
      tally.counts === null ? "تصنيف الأبواب" : null,
    ].filter(Boolean);
    return `ما اتقارش: ${missing.join("، ")} — الجرد ما ردّش`;
  }
  const parts = DEAD_VERDICTS.map((v) => `${v.label} ${arDigits(tally.counts![v.id] ?? 0)}`);
  const furniture =
    tally.furniture === null
      ? "العفش ما اتقارش"
      : `و${arDigits(tally.furniture)} قطعة عفش مالهاش وصول`;
  return `${arDigits(tally.doors)} باب يتيم · ${parts.join(" · ")} · ${furniture}`;
}

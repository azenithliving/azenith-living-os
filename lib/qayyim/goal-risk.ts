/**
 * هل الهدف في خطر؟ — one answer, used by the daily round and by the
 * `qayyim_goals_risk` tool.
 *
 * Both callers used to carry their own copy of this logic, and both copies
 * read `title`, `progress_percentage` and `target_date` — columns that do not
 * exist on `qayyim_goals` (the real ones are `name`, `target_value`,
 * `current_value`, `deadline`). PostgREST rejects such a select, the callers
 * ignored the error, and the swarm answered «لا أهداف مهددة» from a query that
 * never returned anything. The shared helpers below read the real columns and
 * refuse to turn a failed read into an all-clear.
 */

export interface GoalRow {
  id: string;
  name?: string | null;
  target_value?: number | string | null;
  current_value?: number | string | null;
  deadline?: string | null;
  status?: string | null;
}

export interface GoalRisk {
  id: string;
  name: string;
  /** null = unmeasurable (no target recorded), which is NOT the same as 0%. */
  progressPct: number | null;
  overdue: boolean;
  reasons: string[];
}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export function assessGoals(rows: GoalRow[] | null, now: Date = new Date()): GoalRisk[] {
  const out: GoalRisk[] = [];
  for (const g of rows || []) {
    const target = num(g.target_value);
    const current = num(g.current_value);
    const measurable = target !== null && target > 0;
    const progressPct = measurable ? Math.min(100, Math.round(((current ?? 0) / target!) * 100)) : null;

    let overdue = false;
    if (g.deadline) {
      const due = new Date(g.deadline).getTime();
      overdue = Number.isFinite(due) && due < now.getTime();
    }

    const reasons: string[] = [];
    if (overdue) reasons.push("تجاوز موعده");
    if (progressPct === null) reasons.push("بدون مستهدف مسجّل — لا يمكن قياس تقدمه");
    else if (progressPct < 25) reasons.push("أقل من ربع المستهدف");

    if (reasons.length) {
      out.push({ id: g.id, name: g.name?.trim() || "هدف بلا اسم", progressPct, overdue, reasons });
    }
  }
  return out;
}

const pct = (v: number | null) => (v === null ? "غير قابل للقياس" : `${v}%`);

export function renderGoalRisk(rows: GoalRow[] | null, error: string | null, risks: GoalRisk[]): string {
  if (error) return `لم أستطع قراءة الأهداف من القاعدة (${error}) — لن أعلن أن كل شيء بخلاف ذلك.`;
  const goals = rows || [];
  if (!goals.length) return "لا يوجد هدف نشط مسجّل حاليًا — لا شيء يمكن أن يكون مهددًا.";
  if (!risks.length) return `كل الأهداف النشطة (${goals.length}) داخل المسار — لا هدف مهدد.`;
  return [
    `لديك ${risks.length} هدف مهدد من ${goals.length} هدف نشط:`,
    ...risks.map((r) => `• ${r.name} — تقدم ${pct(r.progressPct)} · ${r.reasons.join("، ")}`),
  ].join("\n");
}

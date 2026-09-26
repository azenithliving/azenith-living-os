/**
 * The daily story — what the swarm sends the owner in the morning.
 *
 * Pure on purpose: numbers and strings in, Arabic out. The transport lives in
 * `admin-telegram-summon.ts` (already wired, already reads its own config), and
 * this module never learns anything about tokens.
 *
 * Two rules that came from watching real rounds misreport:
 *  • a measured score and an unmeasured one are different sentences — «غير متاح»
 *    must never be smoothed into a number;
 *  • failed reads are part of the story. A round that silently reports nothing
 *    is the failure mode P6 was started to kill.
 */

/** Telegram's own budget is 4096; the owner's attention is far shorter. */
export const STORY_LIMIT = 1000;

const DASHBOARD_PATH = "/admin/v2/agents/ops";

export interface StoryInput {
  dateKey: string;
  luxuryScore: number | null;
  luxuryNote?: string | null;
  activeGoals?: number | null;
  atRiskCount: number;
  goalsSummary?: string | null;
  anomalyDigest?: string | null;
  anomalyReadError?: string | null;
  rivals?: { crawled: number; failed: number; skipped: number } | null;
  errors: string[];
  proposalId?: string | null;
  siteUrl: string;
}

export interface DailyStory {
  title: string;
  text: string;
  href: string;
}

function trimUrl(siteUrl: string): string {
  return siteUrl.replace(/\/+$/, "");
}

export function buildDailyStory(input: StoryInput): DailyStory {
  const root = trimUrl(input.siteUrl);
  const href = input.proposalId ? `${root}${DASHBOARD_PATH}?proposal=${input.proposalId}` : `${root}${DASHBOARD_PATH}`;

  const lines: string[] = [];
  lines.push(
    input.luxuryScore !== null
      ? `• الفخامة (مقيس): ${input.luxuryScore} من 100`
      : `• الفخامة: ${input.luxuryNote ?? "غير متاح"}`,
  );
  lines.push(
    `• الأهداف المهددة: ${input.atRiskCount}` +
      (input.activeGoals === null || input.activeGoals === undefined ? "" : ` (النشط ${input.activeGoals})`),
  );

  if (input.anomalyDigest) lines.push(`• حركة الزوار:\n${input.anomalyDigest}`);
  if (input.anomalyReadError) lines.push(`• حركة الزوار: قراتها فشلت — ${input.anomalyReadError}`);
  if (input.rivals) {
    lines.push(`• المنافسون: قِيس ${input.rivals.crawled} — فشل ${input.rivals.failed} — متجاهَل ${input.rivals.skipped}`);
  }
  if (input.errors.length) {
    lines.push(`• قراءات فشلت في الجولة: ${input.errors.length} — أولها: ${input.errors[0]}`);
  }
  // The link is the part the owner acts on, so it is written first and the
  // details are trimmed to fit around it — not cut off mid-sentence at the end.
  // It also gets a line of its own: a URL inside an Arabic sentence scrambles
  // the whole line on screen.
  const linkLine = input.proposalId
    ? "• فيه اقتراح محتاج قرارك:"
    : "• الدار ماشية من غير حاجة منك:";
  const tail = `${linkLine}\n${href}`;
  const budget = STORY_LIMIT - tail.length - 1;
  const kept: string[] = [];
  let used = 0;
  for (const line of lines) {
    if (used + line.length + 1 > budget) {
      kept.push("• … وبقية التفاصيل في اللوحة");
      break;
    }
    kept.push(line);
    used += line.length + 1;
  }

  const text = clamp([...kept, tail].join("\n"), STORY_LIMIT);
  return { title: `مدير تشغيل المحتوى — صباح ${input.dateKey}`, text, href };
}

/** Telegram rejects an over-long message outright, so the story is cut short and
 * says so rather than failing to arrive. */
function clamp(text: string, limit: number): string {
  if (text.length <= limit) return text;
  return `${text.slice(0, limit - 1)}…`;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * The story as Telegram wants it: HTML, with the link hidden behind words.
 *
 * The digests and the database error strings are escaped because they are built
 * from table contents and driver messages — one angle bracket in there must not
 * turn the morning report into a parse error and silently lose the message.
 * The length budget is spent on the plain text before escaping; entity codes add
 * a few characters at most, and Telegram's own ceiling (4096) is far above it.
 */
export function renderTelegramHtml(story: DailyStory): string {
  const escapedHref = escapeHtml(story.href);
  const body = escapeHtml(story.text).replace(escapedHref, `<a href="${escapedHref}">افتح الدار</a>`);
  return `<b>${escapeHtml(story.title)}</b>\n\n${body}`;
}

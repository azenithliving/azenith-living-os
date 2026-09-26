/**
 * The decision card — what the Telegram morning link opens.
 *
 * `lib/qayyim/daily-story.ts` sends the owner one proposal per story with a deep
 * link to `/admin/v2/agents/qayyim?proposal=<id>`. This is the other end of that
 * link: read the id, find the real row, and give him the three answers a
 * decision has — do it, do it better, no.
 *
 * Pure again, because the interesting failures are all data questions: an id that
 * is not an id, a row that was decided yesterday, a window that closed.
 */

export interface ProposalRow {
  id: string;
  description?: string | null;
  risk_level?: string | null;
  status?: string | null;
  created_at?: string | null;
  expires_at?: string | null;
  metadata?: { userMessage?: string; intent?: { kind?: string } } | null;
}

/** Ids here are uuids or short internal slugs. The shape check is not cosmetics:
 * the value comes from a URL the owner taps, and it goes into a query. */
const ID_SHAPE = /^[A-Za-z0-9_-]{6,64}$/;

export function parseProposalId(search: string | null | undefined): string | null {
  if (!search) return null;
  const raw = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search).get("proposal");
  const id = (raw || "").trim();
  return ID_SHAPE.test(id) ? id : null;
}

export function findProposal(
  rows: ProposalRow[] | null | undefined,
  id: string,
): ProposalRow | null {
  if (!rows?.length) return null;
  return rows.find((r) => r && typeof r.id === "string" && r.id === id) ?? null;
}

/** The body `POST /api/admin/agents/approval/decision` already speaks. */
export function decisionRequest(
  approvalId: string,
  decision: "approved" | "rejected",
): { approval_id: string; decision: string } {
  return { approval_id: approvalId, decision };
}

/**
 * «عايز أحسن» sends a real turn back to the swarm, carrying the subject of the
 * proposal so the agent improves something instead of inventing a new task.
 */
export function betterRequestMessage(proposal: ProposalRow): string {
  const subject = (proposal.description || "").trim() || (proposal.metadata?.userMessage || "").trim();
  return subject
    ? `مش مقتنع بالاقتراح ده: ${subject} — اعمل نسخة أحسن واعرضها عليّ قبل ما ترفض الأصل`
    : "عايز نسخة أحسن من الاقتراح اللي وصلني، اعملها واعرضها قبل ما ترفض الأصل";
}

export function isExpired(proposal: ProposalRow, now: number = Date.now()): boolean {
  if (!proposal.expires_at) return false;
  const at = Date.parse(proposal.expires_at);
  if (Number.isNaN(at)) return false;
  return at < now;
}

const STATUS_LABELS: Record<string, string> = {
  pending: "في انتظارك",
  approved: "اتنفذت",
  executed: "اتنفذت",
  rejected: "اترفضت",
  expired: "انتهت مدتها",
  failed: "نفذتها فشلت",
};

export function proposalStatusLabel(status?: string | null): string {
  const key = (status || "").trim().toLowerCase();
  return STATUS_LABELS[key] || "اتخد عليها قرار";
}

const RISK_LABELS: Record<string, string> = {
  low: "منخفضة",
  medium: "متوسطة",
  high: "عالية",
  critical: "حرجة",
};

/** `risk_level` is stored in Latin. It must not arrive inside an Arabic sentence. */
export function riskLabel(level?: string | null): string {
  return RISK_LABELS[(level || "").trim().toLowerCase()] || "غير مصنّفة";
}

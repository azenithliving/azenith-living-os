/**
 * Shaping an approval request before it reaches the database.
 *
 * `approval_requests` is stricter than its callers: `action_id` is a NOT NULL
 * uuid, `risk_level` is NOT NULL inside a CHECK list, and `description` has to
 * say something. Until now each caller discovered that from a Postgres error —
 * which is what the decision card behind the Telegram link was showing instead
 * of a proposal.
 *
 * The errors come back in Arabic on purpose: this route's failure text is
 * rendered to the owner, not to a log.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The ladder the column's CHECK allows. Anything else aborts the insert. */
export const APPROVAL_RISKS = ["info", "normal", "critical", "forbidden"] as const;

/** Two thousand characters is still a card; more than that is a document. */
export const DESCRIPTION_LIMIT = 2000;

/** Same window `createAdminProposal` uses, so both doors agree. */
export const APPROVAL_WINDOW_MS = 48 * 3_600_000;

export interface ApprovalRow {
  action_id: string;
  action_type: string;
  description: string;
  risk_level: string;
  status: "pending";
  requested_at: string;
  expires_at: string;
  created_at: string;
  metadata: Record<string, unknown>;
  company_id: string | null;
}

export type IntakeResult = { ok: true; row: ApprovalRow } | { ok: false; error: string };

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value.trim());
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function buildApprovalRow(
  body: unknown,
  companyId: string | null,
  now: () => Date = () => new Date(),
): IntakeResult {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "محتوى الطلب غير صالح" };
  }
  const input = body as Record<string, unknown>;

  const description = text(input.description);
  if (!description) return { ok: false, error: "الوصف مطلوب عشان القرار يبقى مفهوم" };

  const actionType = text(input.action_type);
  if (!actionType) return { ok: false, error: "نوع الإجراء مطلوب" };

  const requested = now();

  return {
    ok: true,
    row: {
      // A caller that sends prose here is naming the action, not identifying a
      // row — so keep the name in metadata and give the column a real uuid.
      action_id: isUuid(input.action_id) ? input.action_id.trim() : crypto.randomUUID(),
      action_type: actionType.slice(0, 200),
      description:
        description.length > DESCRIPTION_LIMIT ? `${description.slice(0, DESCRIPTION_LIMIT - 1)}…` : description,
      risk_level: APPROVAL_RISKS.includes(text(input.risk_level).toLowerCase() as (typeof APPROVAL_RISKS)[number])
        ? text(input.risk_level).toLowerCase()
        : "normal",
      status: "pending",
      requested_at: requested.toISOString(),
      expires_at: input.expires_at ? String(input.expires_at) : new Date(requested.getTime() + APPROVAL_WINDOW_MS).toISOString(),
      created_at: requested.toISOString(),
      metadata: asRecord(input.metadata),
      company_id: text(companyId) || null,
    },
  };
}

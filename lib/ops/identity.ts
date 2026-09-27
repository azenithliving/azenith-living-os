/**
 * The swarm's identity, in one place.
 *
 * P7 retired «قيّم الدار»: the leader is a job title, the swarm belongs to the
 * store, and the members are roles. Anything that needs a key or a name reads it
 * here, so a rename can never again be half-done across forty files.
 */
export const AGENT_KEYS = [
  "ops-lead", "ops-content", "ops-visual", "ops-seo",
  "ops-ux", "ops-analytics", "ops-dev", "ops-qa",
] as const;

export type OpsAgentKey = (typeof AGENT_KEYS)[number];

export const LEADER_TITLE = "مدير تشغيل المحتوى";
export const SWARM_NAME = "سرب أزينث";

/**
 * Every key the leader has been stored under, the live one first.
 *
 * Rows written before either rename are still in the table for any company that
 * was using the swarm then, so a surface that filters on one key alone silently
 * reports zero for the same leader's real work. Doors accept the retired stamps and
 * fold them here; nothing else in shipped code spells them.
 */
export const LEADER_KEYS: string[] = ["ops-lead", "prime", "qayyim-core"];

const LABELS: Record<OpsAgentKey, string> = {
  "ops-lead": LEADER_TITLE,
  "ops-content": "وكيل المحتوى",
  "ops-visual": "وكيل المرئيات",
  "ops-seo": "وكيل الظهور",
  "ops-ux": "وكيل التجربة",
  "ops-analytics": "وكيل التحليلات",
  "ops-dev": "وكيل التطوير",
  "ops-qa": "وكيل الجودة",
};

const LEGACY: Record<OpsAgentKey, string> = {
  "ops-lead": "qayyim-core",
  "ops-content": "qayyim-cont",
  "ops-visual": "qayyim-vis",
  "ops-seo": "qayyim-seo",
  "ops-ux": "qayyim-ux",
  "ops-analytics": "qayyim-ana",
  "ops-dev": "qayyim-dev",
  "ops-qa": "qayyim-qa",
};

/**
 * The leader's FIRST retired name. It predates «قيّم الدار» and is retired the same
 * way, but unlike the swarm keys it never had a stored form to migrate — it survived
 * as an extra row in the chat's own metadata table, which is how a retired identity
 * keeps a job description of its own on the owner's screen. One alias, one target:
 * every door and every label that receives it answers as the leader.
 */
const FROM_LEGACY = {
  ...Object.fromEntries(
    (Object.keys(LEGACY) as OpsAgentKey[]).map((ops) => [LEGACY[ops], ops])
  ),
  prime: "ops-lead",
} as Record<string, OpsAgentKey>;

export function isOpsKey(value: string): value is OpsAgentKey {
  return (AGENT_KEYS as readonly string[]).includes(value);
}

/** Unknown input is returned unchanged — a wrong key must never become a guess. */
export function legacyToOps(key: string): OpsAgentKey {
  return FROM_LEGACY[key] ?? (key as OpsAgentKey);
}

/**
 * The signature a human reads under a message.
 *
 * `agent_messages.sender_name` holds the key upper-cased — that shape is the stored
 * record and P7 deliberately kept writing it. But the chat surfaces printed the
 * column straight out, so the owner's Arabic thread was signed «OPS-LEAD», and every
 * bubble written before the rename still reads «QAYYIM-CORE»: a retired name is not
 * retired while it is still signing old messages he scrolls past. Mapping at the
 * render covers both the live key and the historic stamps without touching a row.
 *
 * Anything that is not a swarm key returns unchanged — his own label, the system
 * label, and the field agents, who belong to a different product.
 */
export function senderDisplayName(stored: string): string {
  const key = legacyToOps(String(stored || "").toLowerCase());
  return isOpsKey(key) ? agentLabel(key) : stored;
}

export function opsToLegacy(key: string): string | null {
  const ops = legacyToOps(key);
  return LEGACY[ops] ?? null;
}

export function agentLabel(key: string): string {
  const ops = legacyToOps(key);
  return LABELS[ops] ?? key;
}

/** `agent_messages.sender_name` stores the key upper-cased; keep that shape. */
export function storedSenderName(key: string): string {
  return legacyToOps(key).toUpperCase();
}

/**
 * The retired product name in the two spellings a model produces — with and
 * without the emphasis mark on the ي, either carrying the leading article.
 *
 * P7 swept the source and the stored rows and both came back empty, yet a
 * development agent still answered the owner «بصفتي **قيّم الدار**»: the name came
 * out of the model's memory of what this product was called. A prompt cannot be
 * trusted with a name that no longer exists, so the reply boundary rewrites it.
 *
 * «الدار» is required, and the lookbehind refuses an Arabic letter in front, so
 * «تقييم الدار» and «قيّم جودتها» (a verb) and «القيّم على القسم» (a custodian) are
 * ordinary Arabic this function must never touch.
 */
const RETIRED_PRODUCT_NAME =
  /(?<![\u0600-\u06FF])(?:ال)?قيّم الدار|(?<![\u0600-\u06FF])(?:ال)?قيم الدار/g;

export function scrubRetiredProductName(text: string, replacement: string): string {
  return text.replace(RETIRED_PRODUCT_NAME, replacement);
}

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

const FROM_LEGACY = Object.fromEntries(
  (Object.keys(LEGACY) as OpsAgentKey[]).map((ops) => [LEGACY[ops], ops])
) as Record<string, OpsAgentKey>;

export function isOpsKey(value: string): value is OpsAgentKey {
  return (AGENT_KEYS as readonly string[]).includes(value);
}

/** Unknown input is returned unchanged — a wrong key must never become a guess. */
export function legacyToOps(key: string): OpsAgentKey {
  return FROM_LEGACY[key] ?? (key as OpsAgentKey);
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

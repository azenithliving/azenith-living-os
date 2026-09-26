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

/**
 * «المالك رجل» — the owner is المهندس علاء عزيز and everything in this shop
 * addresses him in the masculine.
 *
 * Two leaks caused this file to exist: Arabic UI copy that spoke to him in the
 * feminine, and the swarm answering him the same way because no prompt anywhere
 * said who it was talking to — a free-tier model defaults to the feminine
 * register Arabic support copy usually uses.
 *
 * The copy half is caught by `tests/qayyim/ownerAddress.test.ts`. This is the
 * other half: one rule, applied at the two places where an agent's prose is
 * generated, so no persona has to remember it and no new agent can forget it.
 *
 * The rule deliberately does not quote the forbidden forms: the guard test scans
 * `lib/` as well, and an example of the bug inside the fix would fail it.
 */

export const OWNER_ADDRESS_RULE =
  "المالك الذي تخاطبه هو المهندس علاء عزيز — رجل. خاطبه دائماً بصيغة المذكر: «أنت»، «لو عايز تفتحه»، «احفظه»، «جرّبه». " +
  "ممنوع صيغ المؤنث في أي كلام موجه له، حتى لو كان الكلام عن صفحة أو منتج.";

/** Idempotent: personas wrap each other (orchestrator → base → fallback), and a
 * rule repeated twice reads like noise to a small model. */
export function withOwnerRule(systemPrompt: string): string {
  return systemPrompt.includes(OWNER_ADDRESS_RULE) ? systemPrompt : `${systemPrompt}\n\n${OWNER_ADDRESS_RULE}`;
}

/** Apply the rule to a chat message list: only the system turn carries identity,
 * so only it is touched. */
export function withOwnerRuleOnMessages<T extends { role: string; content: string }>(messages: T[]): T[] {
  return messages.map((m) => (m.role === "system" ? { ...m, content: withOwnerRule(m.content) } : m));
}

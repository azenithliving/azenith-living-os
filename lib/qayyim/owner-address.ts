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

/**
 * The same rule the owner gave me about how he reads: a Latin word, a bracket or
 * an arrow inside an Arabic sentence does not just confuse him — the bidi
 * renderer flips the whole line, so it is physically scrambled. The rule is
 * therefore about line shape, not vocabulary: Arabic only, foreign names on a
 * line of their own, plain digits.
 */
export const PLAIN_ARABIC_RULE =
  "اكتب بالعربية المصرية فقط. ممنوع كلمة إنجليزية أو لاتينية في وسط الجملة العربية، وممنوع الأقواس والأسهم والشرطة المائلة بين الكلمات العربية. " +
  "أي اسم أجنبي لازم يبقى في سطر لوحده. الأرقام تكتب بالأرقام العادية زي 15 مش بالحروف.";

/** Applied to the system turn of every prose-generating call. */
const RULES = `${OWNER_ADDRESS_RULE}\n\n${PLAIN_ARABIC_RULE}`;

/** Idempotent: personas wrap each other (orchestrator → base → fallback), and a
 * rule repeated twice reads like noise to a small model. */
export function withOwnerRule(systemPrompt: string): string {
  return systemPrompt.includes(OWNER_ADDRESS_RULE) ? systemPrompt : `${systemPrompt}\n\n${RULES}`;
}

/** Apply the rule to a chat message list: only the system turn carries identity,
 * so only it is touched. */
export function withOwnerRuleOnMessages<T extends { role: string; content: string }>(messages: T[]): T[] {
  return messages.map((m) => (m.role === "system" ? { ...m, content: withOwnerRule(m.content) } : m));
}

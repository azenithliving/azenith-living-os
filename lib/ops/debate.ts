/**
 * debate.ts — P5-M5 "الحرب الودودة": an internal critic pass over the
 * leader's draft-grade answers before the admin sees them.
 *
 * Proposer (swarm/core) → Critic (fast free model) → one revision, or the
 * critique is surfaced transparently. Runs only for actionable long answers
 * so short replies stay instant.
 */

import { askGroqMessages, askGoogleMessages } from "@/lib/ai-orchestrator";

const CRITIC_SYSTEM =
  "أنت ناقد جودة صارم داخل سرب أزينث. راجع رد الوكيل مقابل سؤال المستخدم. " +
  "أعد كلمة OK فقط إذا الرد دقيق وعملي ولا يهلوس روابط أو أرقامًا. " +
  "وإلا أعد في سطرين كحد أقصى بالعربية ما يجب إصلاحه تحديدًا. لا تختلق مشاكل تافهة.";

export function isCriticVerdictOk(verdict: string): boolean {
  const t = verdict.trim();
  return t.length < 8 || /^ok\b/i.test(t) || /^تمام|^سليم/i.test(t);
}

export async function critiqueAndPolish(
  userMessage: string,
  draftReply: string
): Promise<{ reply: string; critiqued: boolean }> {
  try {
    const critic = await askGroqMessages(
      [
        { role: "system", content: CRITIC_SYSTEM },
        { role: "user", content: `سؤال المستخدم:\n${userMessage.slice(0, 400)}\n\nرد الوكيل:\n${draftReply.slice(0, 2500)}` },
      ],
      { temperature: 0.2, maxTokens: 200 }
    );
    if (!critic.success || !critic.content) return { reply: draftReply, critiqued: false };
    if (isCriticVerdictOk(critic.content)) return { reply: draftReply, critiqued: true };

    // One polish pass by the deeper model, told exactly what the critic rejected.
    const polish = await askGoogleMessages(
      [
        { role: "system", content: "أنت مدير تشغيل المحتوى. أعد صياغة ردك أدناه مع إصلاح ملاحظات الناقد فقط، وحافظ على كل معلومة موثقة. احذف أي رابط أو رقم غير موثق بدل تبريره." },
        { role: "user", content: `الرد الأصلي:\n${draftReply.slice(0, 2500)}\n\nملاحظات الناقد:\n${critic.content.slice(0, 400)}` },
      ],
      { temperature: 0.3 }
    );
    if (polish.success && polish.content) {
      return { reply: `${polish.content}\n\n✓ راجعه ناقد السرب وصححه داخليًا`, critiqued: true };
    }
    return { reply: `${draftReply}\n\n🧠 ملاحظة ناقد السرب: ${critic.content}`, critiqued: true };
  } catch {
    return { reply: draftReply, critiqued: false };
  }
}

/** Only long, actionable leader answers deserve the extra pass. */
export function shouldDebate(text: string): boolean {
  if (!text || text.length < 220) return false;
  return /مسودة|أنشئ|اقترح|تحسين|خطة|خطوات/i.test(text);
}

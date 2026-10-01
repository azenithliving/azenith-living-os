import type { ClassifiedIntent } from "./admin-intent-types";

export function buildExecutionPlan(
  message: string,
  intent: ClassifiedIntent
): string {
  const plans: Record<string, string> = {
    command: `سأنفّذ أمر الإدارة المناسب لطلبك.`,
    agents: `سأوزّع المهمة على الوكلاء: تحليل، ثم أمن، ثم تنفيذ.`,
    architect: `سأحدّث إعدادات الموقع أو الأتمتة حسب طلبك.`,
    analytics: `سأجلب تقرير التحليلات.`,
    health: `سأفحص صحة النظام.`,
    ultimate_tool: `سأشغّل أداة Ultimate المناسبة.`,
    genesis: `سأمرّر طلبك على محرك Genesis للتكوين.`,
    // Not «I will answer you with artificial intelligence»: measured on the published
    // cockpit, that promise was followed in the same message by «I cannot tell you». A plan
    // line says what changes in the store, and nothing changes for a conversation.
    conversation: `هرد عليك في المحادثة من غير ما أغيّر حاجة في المتجر.`,
  };
  const base = plans[intent.kind] || plans.conversation;
  const preview =
    message.length > 60 ? `${message.slice(0, 57)}...` : message;
  return `📋 الخطة: ${base}\nطلبك: «${preview}»`;
}

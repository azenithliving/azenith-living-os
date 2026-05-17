import type { ClassifiedIntent } from "./admin-intent-types";

export function buildExecutionPlan(
  message: string,
  intent: ClassifiedIntent
): string {
  const plans: Record<string, string> = {
    command: `سأنفّذ أمر الإدارة المناسب لطلبك.`,
    agents: `سأوزّع المهمة على الوكلاء السحابيين (تحليل → أمن → تنفيذ).`,
    architect: `سأحدّث إعدادات الموقع أو الأتمتة حسب طلبك.`,
    analytics: `سأجلب تقرير التحليلات.`,
    health: `سأفحص صحة النظام.`,
    ultimate_tool: `سأشغّل أداة Ultimate المناسبة.`,
    genesis: `سأمرّر طلبك على محرك Genesis للتكوين.`,
    conversation: `سأرد عليك بالذكاء الاصطناعي.`,
  };
  const base = plans[intent.kind] || plans.conversation;
  const preview =
    message.length > 60 ? `${message.slice(0, 57)}...` : message;
  return `📋 الخطة: ${base}\nطلبك: «${preview}»`;
}

/**
 * Admin assistant scenario matrix — simulates years of owner requests.
 * Each row: message + expected intent kind (heuristic path, skipAi).
 */

export type ScenarioExpectation = {
  message: string;
  kind:
    | "command"
    | "agents"
    | "architect"
    | "analytics"
    | "health"
    | "ultimate_tool"
    | "genesis"
    | "conversation";
  command?: string;
  toolName?: string;
  note?: string;
};

export const ADMIN_SCENARIO_MATRIX: ScenarioExpectation[] = [
  // ── Keys & API ──
  { message: "ورّيني حالة كل مفاتيح الذكاء الاصطناعي", kind: "command", command: "list_keys" },
  { message: "list_keys groq", kind: "command", command: "list_keys" },
  { message: "كم مفتاح openrouter عندنا؟", kind: "command", command: "list_keys" },
  { message: "فحص المفاتيح", kind: "command", command: "check_keys" },
  { message: "check keys usage", kind: "command", command: "check_keys" },
  { message: "أضف مفتاح groq gsk-test123", kind: "command", command: "add_key" },
  { message: "احذف مفتاح mistral", kind: "command", command: "remove_key" },
  { message: "rate_limit groq", kind: "command", command: "rate_limit" },

  // ── System commands ──
  { message: "show_stats 14", kind: "command", command: "show_stats" },
  { message: "إحصائيات آخر أسبوع", kind: "command", command: "show_stats" },
  { message: "امسح الكاش", kind: "command", command: "clear_cache" },
  { message: "clear cache", kind: "command", command: "clear_cache" },
  { message: "backup_db", kind: "command", command: "backup_db" },
  { message: "نسخ احتياطي لقاعدة البيانات", kind: "command", command: "backup_db" },
  { message: "evolve", kind: "command", command: "evolve" },
  { message: "تطور ذاتي من الأخطاء", kind: "command", command: "evolve" },
  { message: "help", kind: "command", command: "help" },
  { message: "ما الأوامر المتاحة؟", kind: "command", command: "help" },
  { message: "أرسل إشعار صيانة الليلة", kind: "command", command: "send_notification" },
  { message: "restart_service redis", kind: "command", command: "restart_service" },

  // ── Analytics & health ──
  { message: "كم زوار الموقع آخر 30 يوم؟", kind: "analytics" },
  { message: "analytics last 90 days", kind: "analytics" },
  { message: "conversion rate", kind: "analytics" },
  { message: "هل الموقع شغال تمام؟", kind: "health" },
  { message: "افحص صحة النظام", kind: "health" },
  { message: "health check please", kind: "health" },

  // ── Architect ──
  { message: "غيّر اللون للذهبي", kind: "architect" },
  { message: "theme gold", kind: "architect" },
  { message: "أنشئ قاعدة أتمتة للزوار", kind: "architect" },

  // ── Ultimate tools ──
  { message: "حلّل SEO للموقع", kind: "ultimate_tool", toolName: "seo_analyze" },
  { message: "صلح مشاكل SEO", kind: "ultimate_tool", toolName: "seo_fix_issues" },
  { message: "اعمل نسخة احتياطية للإعدادات", kind: "ultimate_tool", toolName: "backup_create" },
  { message: "أنشئ قسم جديد في الصفحة الرئيسية", kind: "ultimate_tool", toolName: "section_create" },
  { message: "حلّل سرعة الموقع", kind: "ultimate_tool", toolName: "speed_analyze" },
  { message: "حسّن سرعة الصفحة", kind: "ultimate_tool", toolName: "speed_optimize" },
  { message: "حلّل الإيرادات", kind: "ultimate_tool", toolName: "revenue_analyze" },
  { message: "مؤشرات لحظية", kind: "ultimate_tool", toolName: "metrics_realtime" },
  { message: "أنشئ هدف تحويل 10%", kind: "ultimate_tool", toolName: "goal_create" },
  { message: "اعرض الأهداف", kind: "ultimate_tool", toolName: "goal_list" },

  // ── Genesis ──
  { message: "كوّن موقع ذهبي جديد", kind: "genesis" },
  { message: "Genesis order for luxury homepage", kind: "genesis" },

  // ── Multi-agent missions ──
  { message: "حلل الموقع كامل وشوف المشاكل وصلحها", kind: "agents" },
  { message: "راجع أمان الموقع وشغّل الاختبارات", kind: "agents" },
  { message: "analyze site and then fix conversion issues", kind: "agents" },
  { message: "full system audit and deploy", kind: "agents" },
  { message: "حسّن الموقع للتحويل والأمان", kind: "agents" },
  { message: "اعمل تقرير شامل عن كل شيء", kind: "agents" },

  // ── Greetings (conversation) ──
  { message: "ازيك", kind: "conversation" },
  { message: "مرحبا", kind: "conversation" },
  { message: "who are you?", kind: "conversation" },
  { message: "شكراً", kind: "conversation" },

  // ── Future / unprogrammed action requests → agents escalation ──
  { message: "حدّث أسعار غرفة الماستر سويت", kind: "agents", note: "action-fallback" },
  { message: "ترجم صفحة about للإنجليزية", kind: "agents", note: "action-fallback" },
  { message: "ابني حملة واتساب للعملاء الذهبيين", kind: "agents" },
  { message: "صنّف العملاء حسب آخر تفاعل", kind: "agents", note: "action-fallback" },
  { message: "generate blog post about luxury living", kind: "agents", note: "action-fallback" },
  { message: "migrate old furniture data to new schema", kind: "agents", note: "action-fallback" },
  { message: "قارن أداء الصفحات هذا الشهر", kind: "agents", note: "action-fallback" },
  { message: "فعّل تنبيه عند lead جديد", kind: "agents", note: "action-fallback" },
  { message: "استورد 50 صورة من pexels للصالون", kind: "agents", note: "action-fallback" },
  { message: "audit GDPR compliance for forms", kind: "agents", note: "action-fallback" },

  // ── Edge cases ──
  { message: "  list_keys  ", kind: "command", command: "list_keys" },
  { message: "/وكلاء فحص أمن", kind: "agents" },
  { message: "LIST_KEYS", kind: "command", command: "list_keys" },
  { message: "ورّيني المفاتيح وكمان الإحصائيات", kind: "command", note: "first match wins" },
  { message: "ممكن تشوف لو في مشكلة في الموقع؟", kind: "health" },
];

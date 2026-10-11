/**
 * The Arabic words this store uses for its own machinery.
 *
 * Measured on the published owner screens 2026-10-11: after the employee names were fixed, 84 Latin
 * places were left, and the author census (scratch/census-english-authors.cjs) showed part of them is
 * written by this repository itself — the approval report pasting the command it is about to run
 * («تنفيذ أمر إداري: send_notification ...»), the activity feed printing a row's machine event type
 * («command», «system»), and the command door alerting him in English on Telegram.
 *
 * Those sentences are fixed here, at the source, so the next surface that mentions a command reads the
 * same word rather than inventing one at render. Two rules the tests hold:
 *
 * - A name is never guessed. An unknown command is «أمر إداري», not the closest label — a wrong name
 *   tells the owner something will happen that will not.
 * - An unknown event type prints nothing. The badge is decoration beside the sentence; the sentence
 *   carries the fact.
 */

/** Every command the executor answers to, in the words the owner reads. */
export const COMMAND_LABELS: Record<string, string> = {
  add_key: "إضافة مفتاح جديد",
  remove_key: "حذف مفتاح",
  list_keys: "عرض المفاتيح مقنّعة",
  add_backup_key: "إضافة مفتاح احتياطي",
  check_keys: "مراقبة استخدام المفاتيح",
  rate_limit: "تحديث حد الطلبات",
  send_notification: "إرسال إشعار",
  show_stats: "عرض الإحصائيات",
  clear_cache: "مسح الذاكرة المؤقتة",
  restart_service: "إعادة تشغيل خدمة",
  backup_db: "نسخة احتياطية من البيانات",
  evolve: "تحسين الموقع الذاتي",
  read: "قراءة صفحة من الويب",
  help: "عرض الأوامر المتاحة",
};

/**
 * The Arabic name of a command line. The first word is the command; everything after it is an
 * argument the owner has no reason to read.
 */
export function commandLabel(raw: string | null | undefined): string {
  const name = String(raw ?? "").trim().split(/\s+/)[0]?.toLowerCase() ?? "";
  return COMMAND_LABELS[name] ?? "أمر إداري";
}

/** The event types the activity feed's rows carry. */
export const EVENT_LABELS: Record<string, string> = {
  command: "أمر",
  system: "النظام",
  task: "مهمة",
  tool: "أداة",
  alert: "تنبيه",
  approval: "موافقة",
  evolution: "تحسين ذاتي",
};

/** An unknown type answers with silence, which the feed renders as no badge at all. */
export function eventLabel(type: string | null | undefined): string {
  return EVENT_LABELS[String(type ?? "").trim().toLowerCase()] ?? "";
}

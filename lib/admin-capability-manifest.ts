/**
 * Single source of truth for what the unified assistant can do.
 * Used in fallbacks, AI prompts, and scenario audits.
 *
 * The summary sentence is the floor of the owner's chat: `lib/admin-natural-brain.ts` answers with
 * it when no model replied. It is therefore written in his words and his numerals, and every count
 * in it comes from a register in this repository — a typed number here is a number that will stop
 * being true without failing anything.
 */

import { TOOL_REGISTRY } from "@/lib/agent-tools/tool-registry";
import { CAPABILITIES, NO_KEY_MESSAGE } from "@/lib/ops/capability-tiers";
import { arNum } from "@/lib/ops/metricLabels";

export const ADMIN_COMMANDS = [
  "add_key",
  "remove_key",
  "list_keys",
  "check_keys",
  "rate_limit",
  "send_notification",
  "show_stats",
  "clear_cache",
  "restart_service",
  "backup_db",
  "evolve",
  "help",
  "search",
  "read",
  "add_backup_key",
  "simulate_key_usage",
] as const;

/**
 * The one rule that decides whether a tool answers or only pretends to. The maturity report used
 * to carry its own copy of it, which is how a card and a sentence could disagree about the same
 * register.
 */
export function isLiveTool(tool: { handler: unknown }): boolean {
  return !/not yet implemented/i.test(String(tool.handler));
}

export function listUltimateToolNames(): string[] {
  return Object.keys(TOOL_REGISTRY);
}

export function buildCapabilitySummaryForUser(): string {
  const tools = Object.values(TOOL_REGISTRY);
  const live = tools.filter(isLiveTool).length;
  const bullets = CAPABILITIES.map((capability) => `• ${capability.label} — ${capability.does}`);
  const stubs = tools.length - live;
  return (
    [
      `أقدر أعمل معاك ${arNum(CAPABILITIES.length)} حاجات، وكل واحدة ليها أرضية بترد بصفر مفتاح:`,
      ...bullets,
      "",
      `عندي ${arNum(live)} أداة شغّالة من ${arNum(tools.length)}، و${arNum(ADMIN_COMMANDS.length)} أمر محفوظ.`,
      ...(stubs > 0
        ? [`في ${arNum(stubs)} أداة لسه ما اشتغلتش، وما بنفّذهاش قدامك ولا بعدّدّها قدرة.`]
        : []),
      `اللي بيرد دلوقتي من غير نموذج: القواعد والحساب والأرقام من السجلات نفسها. ${NO_KEY_MESSAGE}`,
      "الحساس يمر بموافقتك — لكنه قدرة كاملة وليس «قريباً».",
    ].join("\n")
  );
}

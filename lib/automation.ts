import { getSupabaseAdminClient } from "./supabase-admin";
import { getCurrentTenant } from "./tenant";
import { notifyDiamondLeadAsync } from "./lead-dossier";

export interface AutomationTrigger {
  type: "booking_status_changed" | "lead_created" | "lead_updated";
  bookingId?: string;
  oldStatus?: string;
  newStatus?: string;
  bookingData?: Record<string, unknown>;
  leadId?: string;
  leadData?: Record<string, unknown>;
}

export interface AutomationAction {
  type: "send_telegram" | "update_lead_score" | "update_lead_intent";
  message?: string;
  phoneNumber?: string;
  score?: number;
  intent?: string;
}

export interface AutomationRule {
  id: string;
  name: string;
  trigger: AutomationTrigger["type"];
  conditions: Record<string, unknown>;
  actions: AutomationAction[];
  enabled: boolean;
}

export async function processAutomation(trigger: AutomationTrigger) {
  try {
    const tenant = await getCurrentTenant();
    if (!tenant) return;

    const rules = await getAutomationRules(tenant.id, trigger.type);

    for (const rule of rules) {
      if (await checkConditions(rule, trigger)) {
        const tenantForExecution = {
          id: tenant.id,
          name: tenant.name,
        };
        await executeActions(rule.actions, trigger, tenantForExecution);
      }
    }
  } catch (error) {
    console.error("Automation processing error:", error);
  }
}

async function getDefaultAutomationRules(): Promise<AutomationRule[]> {
  return [
    {
      id: "booking_accepted_telegram",
      name: "إشعار قبول الحجز عبر تليجرام",
      trigger: "booking_status_changed",
      conditions: { newStatus: "accepted" },
      actions: [
        {
          type: "send_telegram",
          message: "تم قبول حجزك! سنتواصل معك قريباً لترتيب التفاصيل.",
        },
      ],
      enabled: true,
    },
    {
      id: "booking_rejected_telegram",
      name: "إشعار رفض الحجز عبر تليجرام",
      trigger: "booking_status_changed",
      conditions: { newStatus: "rejected" },
      actions: [
        {
          type: "send_telegram",
          message:
            "نعتذر، لم نتمكن من قبول حجزك حالياً. سنتواصل معك لمناقشة البدائل.",
        },
      ],
      enabled: true,
    },
    {
      id: "diamond_lead_telegram",
      name: "إشعار Lead ماسي جديد - أولوية عالية",
      trigger: "lead_created",
      conditions: { isDiamond: true },
      actions: [
        {
          type: "send_telegram",
          message:
            "🚨 LEAD MASI: New high-value inquiry received! Check dashboard immediately for details.",
        },
      ],
      enabled: true,
    },
    {
      id: "lead_high_score_intent",
      name: "تحديث نية العميل عالي النتيجة",
      trigger: "lead_updated",
      conditions: { score: { gte: 30 } },
      actions: [
        {
          type: "update_lead_intent",
          intent: "buyer",
        },
      ],
      enabled: true,
    },
    {
      id: "lead_medium_score_intent",
      name: "تحديث نية العميل متوسط النتيجة",
      trigger: "lead_updated",
      conditions: { score: { gte: 15, lt: 30 } },
      actions: [
        {
          type: "update_lead_intent",
          intent: "interested",
        },
      ],
      enabled: true,
    },
  ];
}

async function getAutomationRules(
  tenantId: string,
  triggerType: string
): Promise<AutomationRule[]> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new Error("Supabase not initialized");

  try {
    const { data: dbRules, error } = await supabase
      .from("automation_rules")
      .select("*");

    if (error) {
      console.warn(
        "Error loading automation rules from DB, falling back to defaults:",
        error
      );
      const defaults = await getDefaultAutomationRules();
      return defaults.filter(
        (rule) => rule.trigger === triggerType && rule.enabled
      );
    }

    const rows = (dbRules ?? []) as Array<{
      id: string;
      name: string;
      trigger: string;
      conditions: Record<string, unknown>;
      actions: AutomationAction[];
      enabled: boolean;
    }>;

    if (rows && rows.length > 0) {
      return rows
        .filter((row) => row.trigger === triggerType && row.enabled)
        .map((row) => ({
          id: row.id,
          name: row.name,
          trigger: row.trigger as AutomationTrigger["type"],
          conditions: row.conditions,
          actions: row.actions,
          enabled: row.enabled,
        }));
    }

    const defaults = await getDefaultAutomationRules();
    return defaults.filter(
      (rule) => rule.trigger === triggerType && rule.enabled
    );
  } catch (err) {
    console.error("Unexpected error loading automation rules:", err);
    const defaults = await getDefaultAutomationRules();
    return defaults.filter(
      (rule) => rule.trigger === triggerType && rule.enabled
    );
  }
}

async function checkConditions(
  rule: AutomationRule,
  trigger: AutomationTrigger
): Promise<boolean> {
  for (const [key, condition] of Object.entries(rule.conditions)) {
    const triggerValue = trigger[key as keyof AutomationTrigger];

    if (
      typeof condition === "object" &&
      condition !== null &&
      !Array.isArray(condition)
    ) {
      const condObj = condition as Record<string, unknown>;
      if (
        "gte" in condObj &&
        typeof triggerValue === "number" &&
        typeof condObj.gte === "number"
      ) {
        if (triggerValue < condObj.gte) return false;
      }
      if (
        "lt" in condObj &&
        typeof triggerValue === "number" &&
        typeof condObj.lt === "number"
      ) {
        if (triggerValue >= condObj.lt) return false;
      }
    } else {
      if (triggerValue !== condition) return false;
    }
  }
  return true;
}

async function executeActions(
  actions: AutomationAction[],
  trigger: AutomationTrigger,
  tenant: { id: string; name: string }
) {
  for (const action of actions) {
    try {
      await executeAction(action, trigger, tenant);
    } catch (error) {
      console.error(`Failed to execute action ${action.type}:`, error);
    }
  }
}

async function executeAction(
  action: AutomationAction,
  trigger: AutomationTrigger,
  tenant: { id: string; name: string }
) {
  switch (action.type) {
    case "send_telegram":
      await sendTelegramNotification(action, trigger, tenant);
      break;
    case "update_lead_score":
      if (action.score !== undefined && trigger.leadId) {
        await updateLeadScore(trigger.leadId, action.score, tenant.id);
      }
      break;
    case "update_lead_intent":
      if (action.intent && trigger.leadId) {
        await updateLeadIntent(trigger.leadId, action.intent, tenant.id);
      }
      break;
    default:
      console.warn(`Unknown action type: ${(action as AutomationAction).type}`);
  }
}

async function sendTelegramNotification(
  action: AutomationAction,
  trigger: AutomationTrigger,
  tenant: { id: string; name: string }
) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new Error("Supabase not initialized");

  const message = action.message;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  // Diamond leads: send full dossier via Telegram (non-blocking)
  if (trigger.type === "lead_created" && trigger.leadId) {
    const { data: user } = await supabase
      .from("users")
      .select("id, phone, full_name, score, tier")
      .eq("id", trigger.leadId)
      .eq("company_id", tenant.id)
      .single();

    if (!user) {
      console.log("[Automation] Lead not found:", trigger.leadId);
      return;
    }

    if (trigger.leadData?.isDiamond) {
      console.log(
        `[Automation] 🚨 DIAMOND LEAD — triggering Telegram dossier for ${user.full_name}`
      );
      notifyDiamondLeadAsync(trigger.leadId, tenant.id);
      console.log(`[Automation] ✅ Telegram dossier queued for background processing`);
    }

    // Log event for audit trail
    await supabase.from("events").insert({
      company_id: tenant.id,
      user_id: user.id,
      type: "automation_telegram_sent",
      value: "notification",
      metadata: {
        message,
        trigger: trigger.type,
        leadId: trigger.leadId,
        leadName: user.full_name,
        leadScore: user.score,
        isDiamond: trigger.leadData?.isDiamond,
      },
    });

    return;
  }

  // Booking status changes: send short Telegram alert to admin
  if (trigger.bookingId) {
    const { data: request } = await supabase
      .from("requests")
      .select("user_id")
      .eq("id", trigger.bookingId)
      .eq("company_id", tenant.id)
      .single();

    if (!request) return;

    const { data: events } = await supabase
      .from("events")
      .select("metadata")
      .eq("company_id", tenant.id)
      .eq("type", "booking_request")
      .eq("metadata->>requestId", trigger.bookingId);

    const event = events?.[0];
    const clientPhone = event?.metadata?.phone as string | undefined;

    const alertText = [
      `📋 <b>تحديث حجز</b>`,
      `<b>الحالة:</b> ${trigger.newStatus === "accepted" ? "✅ مقبول" : "❌ مرفوض"}`,
      clientPhone ? `<b>تليفون العميل:</b> ${clientPhone}` : "",
      `<b>رقم الحجز:</b> ${trigger.bookingId}`,
      message ? `<b>الرسالة:</b> ${message}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    if (token && chatId) {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: alertText,
          parse_mode: "HTML",
        }),
      }).catch((err) =>
        console.error("[Automation] Telegram booking alert failed:", err)
      );
    }

    await supabase.from("events").insert({
      company_id: tenant.id,
      user_id: request.user_id,
      type: "automation_telegram_sent",
      value: "notification",
      metadata: {
        message,
        trigger: trigger.type,
        bookingId: trigger.bookingId,
        oldStatus: trigger.oldStatus,
        newStatus: trigger.newStatus,
      },
    });
  }
}

async function updateLeadScore(
  leadId: string,
  score: number,
  tenantId: string
) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new Error("Supabase not initialized");

  const { error } = await supabase
    .from("users")
    .update({ score })
    .eq("id", leadId)
    .eq("company_id", tenantId);

  if (error) {
    console.error("Failed to update lead score:", error);
  } else {
    console.log(`Updated lead ${leadId} score to ${score}`);
  }
}

async function updateLeadIntent(
  leadId: string,
  intent: string,
  tenantId: string
) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new Error("Supabase not initialized");

  const { error } = await supabase
    .from("users")
    .update({ intent })
    .eq("id", leadId)
    .eq("company_id", tenantId);

  if (error) {
    console.error("Failed to update lead intent:", error);
  } else {
    console.log(`Updated lead ${leadId} intent to ${intent}`);
  }
}

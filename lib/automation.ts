import { getSupabaseAdminClient } from "./supabase-admin";
import { getCurrentTenant } from "./tenant";
import { notifyDiamondLead } from "./whatsapp-dossier";

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
  type: "send_whatsapp" | "update_lead_score" | "update_lead_intent";
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

    // Get active automation rules for this tenant
    const rules = await getAutomationRules(tenant.id, trigger.type);

    for (const rule of rules) {
      if (await checkConditions(rule, trigger)) {
        // Convert tenant to execution format (ensure whatsapp is not null)
        const tenantForExecution = {
          id: tenant.id,
          whatsapp: tenant.whatsapp ?? "",
          name: tenant.name
        };
        await executeActions(rule.actions, trigger, tenantForExecution);
      }
    }
  } catch (error) {
    console.error("Automation processing error:", error);
  }
}

async function getDefaultAutomationRules(): Promise<AutomationRule[]> {
  // Default rules seeded for new tenants
  return [
    {
      id: "booking_accepted_whatsapp",
      name: "إشعار قبول الحجز عبر واتساب",
      trigger: "booking_status_changed",
      conditions: { newStatus: "accepted" },
      actions: [{
        type: "send_whatsapp",
        message: "تم قبول حجزك! سنتواصل معك قريباً لترتيب التفاصيل."
      }],
      enabled: true
    },
    {
      id: "booking_rejected_whatsapp",
      name: "إشعار رفض الحجز عبر واتساب",
      trigger: "booking_status_changed",
      conditions: { newStatus: "rejected" },
      actions: [{
        type: "send_whatsapp",
        message: "نعتذر، لم نتمكن من قبول حجزك حالياً. سنتواصل معك لمناقشة البدائل."
      }],
      enabled: true
    },
    {
      id: "diamond_lead_whatsapp",
      name: "إشعار Lead ماسي جديد - أولوية عالية",
      trigger: "lead_created",
      conditions: { isDiamond: true },
      actions: [{
        type: "send_whatsapp",
        message: "🚨 LEAD MASI: New high-value inquiry received! Check dashboard immediately for details."
      }],
      enabled: true
    },
    {
      id: "lead_high_score_intent",
      name: "تحديث نية العميل عالي النتيجة",
      trigger: "lead_updated",
      conditions: { score: { gte: 30 } },
      actions: [{
        type: "update_lead_intent",
        intent: "buyer"
      }],
      enabled: true
    },
    {
      id: "lead_medium_score_intent",
      name: "تحديث نية العميل متوسط النتيجة",
      trigger: "lead_updated",
      conditions: { score: { gte: 15, lt: 30 } },
      actions: [{
        type: "update_lead_intent",
        intent: "interested"
      }],
      enabled: true
    }
  ];
}

async function getAutomationRules(tenantId: string, triggerType: string): Promise<AutomationRule[]> {
  const supabase = getSupabaseAdminClient();

  try {
    // Try to load rules from database
    const { data: dbRules, error } = await supabase
      .from("automation_rules")
      .select("*");

    if (error) {
      console.warn("Error loading automation rules from DB, falling back to defaults:", error);
      const defaults = await getDefaultAutomationRules();
      return defaults.filter(rule => rule.trigger === triggerType && rule.enabled);
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
      // Convert database rows to AutomationRule objects
      return rows
        .filter(row => row.trigger === triggerType && row.enabled)
        .map(row => ({
          id: row.id,
          name: row.name,
          trigger: row.trigger as AutomationTrigger["type"],
          conditions: row.conditions,
          actions: row.actions,
          enabled: row.enabled
        }));
    }

    // No database rules found, return defaults
    const defaults = await getDefaultAutomationRules();
    return defaults.filter(rule => rule.trigger === triggerType && rule.enabled);
  } catch (err) {
    console.error("Unexpected error loading automation rules:", err);
    const defaults = await getDefaultAutomationRules();
    return defaults.filter(rule => rule.trigger === triggerType && rule.enabled);
  }
}

async function checkConditions(rule: AutomationRule, trigger: AutomationTrigger): Promise<boolean> {
  for (const [key, condition] of Object.entries(rule.conditions)) {
    const triggerValue = trigger[key as keyof AutomationTrigger];

    if (typeof condition === 'object' && condition !== null && !Array.isArray(condition)) {
      // Handle range conditions like { gte: 30, lt: 50 }
      const condObj = condition as Record<string, unknown>;
      if ('gte' in condObj && typeof triggerValue === 'number' && typeof condObj.gte === 'number') {
        if (triggerValue < condObj.gte) return false;
      }
      if ('lt' in condObj && typeof triggerValue === 'number' && typeof condObj.lt === 'number') {
        if (triggerValue >= condObj.lt) return false;
      }
    } else {
      // Simple equality check
      if (triggerValue !== condition) {
        return false;
      }
    }
  }
  return true;
}

async function executeActions(
  actions: AutomationAction[],
  trigger: AutomationTrigger,
  tenant: { id: string; whatsapp: string; name: string }
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
  tenant: { id: string; whatsapp: string; name: string }
) {
  switch (action.type) {
    case "send_whatsapp":
      await sendWhatsAppMessage(action, trigger, tenant);
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
      console.warn(`Unknown action type: ${action.type}`);
  }
}

async function sendWhatsAppMessage(
  action: AutomationAction,
  trigger: AutomationTrigger,
  tenant: { id: string; whatsapp: string; name: string }
) {
  const supabase = getSupabaseAdminClient();
  const message = action.message;
  let userId: string | null = null;
  let phoneNumber: string | null = null;
  let metadata: Record<string, unknown> = {};

  // Handle lead_created trigger
  if (trigger.type === "lead_created" && trigger.leadId) {
    // Get lead details from users table
    const { data: user } = await supabase
      .from("users")
      .select("id, phone, full_name, score, tier")
      .eq("id", trigger.leadId)
      .eq("company_id", tenant.id)
      .single();

    if (!user?.phone) {
      console.log("[Automation] No phone number for lead:", trigger.leadId);
      return;
    }

    userId = user.id;
    phoneNumber = user.phone;
    metadata = {
      leadId: trigger.leadId,
      leadName: user.full_name,
      leadScore: user.score,
      leadTier: user.tier,
      isDiamond: trigger.leadData?.isDiamond,
      scope: trigger.leadData?.scope,
      budget: trigger.leadData?.budget,
    };

    // Send to admin WhatsApp number for Diamond leads
    if (tenant.whatsapp && trigger.leadData?.isDiamond) {
      console.log(`[Automation] 🚨 DIAMOND LEAD ALERT to Admin ${tenant.whatsapp}: ${message}`);
      console.log(`[Automation] Lead Details: ${user.full_name} | Score: ${user.score} | Scope: ${trigger.leadData?.scope}`);
      
      // Trigger full WhatsApp dossier for Diamond leads
      console.log(`[Automation] Triggering notifyDiamondLead for lead ${trigger.leadId}`);
      const result = await notifyDiamondLead(trigger.leadId, tenant.id, tenant.whatsapp);
      if (result.success) {
        console.log(`[Automation] ✅ WhatsApp dossier sent successfully`);
      } else {
        console.error(`[Automation] ❌ Failed to send WhatsApp dossier:`, result.error);
      }
    }
  }
  // Handle booking_status_changed trigger
  else if (trigger.bookingId) {
    // Get booking request details
    const { data: request } = await supabase
      .from("requests")
      .select("user_id")
      .eq("id", trigger.bookingId)
      .eq("company_id", tenant.id)
      .single();

    if (!request) return;

    // Get user session data and events for phone number
    const { data: events } = await supabase
      .from("events")
      .select("metadata")
      .eq("company_id", tenant.id)
      .eq("type", "booking_request")
      .eq("metadata->>requestId", trigger.bookingId);

    const event = events?.[0];
    if (!event?.metadata?.phone) return;

    userId = request.user_id;
    phoneNumber = event.metadata.phone;
    metadata = {
      bookingId: trigger.bookingId,
      oldStatus: trigger.oldStatus,
      newStatus: trigger.newStatus,
    };
  }

  if (!phoneNumber || !userId) {
    console.log("[Automation] Missing phone or user ID, skipping WhatsApp");
    return;
  }

  // Log the automation action
  // Note: In production, integrate with WhatsApp Business API to send actual messages
  // This logs the message intent for audit trail and admin monitoring
  console.log(`[Automation] Sending WhatsApp to ${phoneNumber}: ${message}`);

  await supabase
    .from("events")
    .insert({
      company_id: tenant.id,
      user_id: userId,
      type: "automation_whatsapp_sent",
      value: "notification",
      metadata: {
        message: message,
        phoneNumber: phoneNumber,
        trigger: trigger.type,
        ...metadata,
      }
    });
}

async function updateLeadScore(leadId: string, score: number, tenantId: string) {
  const supabase = getSupabaseAdminClient();

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

async function updateLeadIntent(leadId: string, intent: string, tenantId: string) {
  const supabase = getSupabaseAdminClient();

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
import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { analyzeStyleDNAFast, StyleDNA } from "@/lib/pdf-generator";
import { fireAndForget } from "@/lib/background-processor";

/**
 * Lead Dossier System — Telegram Edition
 * Generates and sends comprehensive lead briefs to consultants via Telegram
 */

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "";

export type AestheticAdvice = {
  visualHarmony: string;
  spaceOptimization: string;
  designStyleDirection: string;
  inspirationalSummary: string;
};

export type InvestmentSelection = {
  tier: "Essential" | "Refined" | "Bespoke";
  rangeEGP: string;
  description: string;
};

export type LeadDossier = {
  leadId: string;
  fullName: string;
  phone: string;
  email?: string;
  scope: string;
  budget: string;
  timeline: string;
  blueprintAvailable: boolean;
  specialRequests?: string;
  styleDNA: StyleDNA;
  qualification: {
    tier: "Diamond" | "Gold" | "Silver";
    score: number;
    priority: "urgent" | "high" | "medium" | "low";
  };
  viewedImages: string[];
  createdAt: string;
  language?: "ar" | "en";
  aestheticAdvice?: AestheticAdvice | null;
  investmentSelection?: InvestmentSelection | null;
  uploadedSpaceImages?: string[];
  adminTranslation?: {
    original: string;
    arabic: string;
    summary: string;
  };
};

/**
 * Build comprehensive lead dossier from database
 */
export async function buildLeadDossier(
  leadId: string,
  tenantId: string
): Promise<LeadDossier | null> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new Error("Supabase not initialized");

  const { data: user, error: userError } = await supabase
    .from("users")
    .select("*")
    .eq("id", leadId)
    .eq("company_id", tenantId)
    .single();

  if (userError || !user) {
    console.error("[LeadDossier] Failed to fetch user:", userError);
    return null;
  }

  const { data: request, error: requestError } = await supabase
    .from("requests")
    .select("*")
    .eq("user_id", leadId)
    .eq("company_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (requestError) {
    console.error("[LeadDossier] Failed to fetch request:", requestError);
  }

  const { data: events } = await supabase
    .from("events")
    .select("metadata")
    .eq("user_id", leadId)
    .eq("company_id", tenantId)
    .eq("type", "image_view")
    .order("created_at", { ascending: false })
    .limit(10);

  const viewedImages =
    (events?.map((e) => e.metadata?.imageUrl).filter(Boolean) as string[]) ||
    [];

  const score = user.score || 0;
  let tier: LeadDossier["qualification"]["tier"] = "Silver";
  let priority: LeadDossier["qualification"]["priority"] = "low";

  if (score >= 60) {
    tier = "Diamond";
    priority = "urgent";
  } else if (score >= 45) {
    tier = "Gold";
    priority = "high";
  } else if (score >= 30) {
    tier = "Silver";
    priority = "medium";
  }

  let styleDNA: StyleDNA;
  if (viewedImages.length > 0) {
    const { styleDNA: fastResult } = await analyzeStyleDNAFast(viewedImages, {
      userId: leadId,
      tenantId,
    });
    styleDNA = fastResult;
  } else {
    styleDNA = {
      dominantStyles: user.style ? [user.style] : ["modern-luxury"],
      colorPalette: ["neutral", "elegant"],
      materials: ["premium"],
      moodKeywords: ["sophisticated"],
      complexity: "balanced",
    };
  }

  const quoteSnapshot = request?.quote_snapshot as Record<string, any> | null;
  const contact = quoteSnapshot?.contact;

  return {
    leadId,
    fullName:
      user.full_name || contact?.fullName || user.session_id || "Unknown",
    phone: user.phone || contact?.phone || "N/A",
    email: user.email || contact?.email,
    scope: user.room_type || request?.room_type || "Not specified",
    budget: user.budget || request?.budget || "Not specified",
    timeline: user.service_type || "Not specified",
    blueprintAvailable: false,
    specialRequests: quoteSnapshot?.notes as string | undefined,
    styleDNA,
    qualification: { tier, score, priority },
    viewedImages,
    createdAt: user.created_at || new Date().toISOString(),
  };
}

/**
 * Format lead dossier as a Telegram HTML message
 */
export function formatDossierMessage(dossier: LeadDossier): string {
  const tierEmoji = {
    Diamond: "💎",
    Gold: "🥇",
    Silver: "🥈",
  }[dossier.qualification.tier];

  const priorityEmoji = {
    urgent: "🔴",
    high: "🟠",
    medium: "🟡",
    low: "🔵",
  }[dossier.qualification.priority];

  const escape = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const lines = [
    `${tierEmoji} <b>NEW ${dossier.qualification.tier.toUpperCase()} LEAD</b> ${tierEmoji}`,
    "",
    `<b>Client:</b> ${escape(dossier.fullName)}`,
    `<b>Phone:</b> ${escape(dossier.phone)}`,
    dossier.email ? `<b>Email:</b> ${escape(dossier.email)}` : "",
    "",
    `<b>Project Scope:</b> ${escape(dossier.scope)}`,
    `<b>Investment:</b> ${escape(dossier.budget)}`,
    `<b>Timeline:</b> ${escape(dossier.timeline)}`,
    "",
    `<b>Priority:</b> ${priorityEmoji} ${dossier.qualification.priority.toUpperCase()}`,
    `<b>Score:</b> ${dossier.qualification.score}/100`,
    "",
    "<b>Style DNA Analysis:</b>",
    `• Styles: ${escape(dossier.styleDNA.dominantStyles.join(", "))}`,
    `• Colors: ${escape(dossier.styleDNA.colorPalette.join(", "))}`,
    "",
    "✅ افتح لوحة التحكم لمتابعة هذا العميل",
  ];

  return lines.filter((l) => l !== undefined && l !== null).join("\n");
}

/**
 * Send lead dossier to admin via Telegram
 */
export async function sendTelegramDossier(
  dossier: LeadDossier,
  tenantId: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new Error("Supabase not initialized");

  const token = TELEGRAM_BOT_TOKEN;
  const chatId = TELEGRAM_CHAT_ID;

  try {
    const message = formatDossierMessage(dossier);

    if (token && chatId) {
      const url = `https://api.telegram.org/bot${token}/sendMessage`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: "HTML",
          disable_notification: dossier.qualification.priority !== "urgent",
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error("[LeadDossier] Telegram send failed:", err);
      } else {
        console.log(
          `[LeadDossier] Telegram dossier sent for ${dossier.fullName}`
        );
      }
    } else {
      console.log(
        "[LeadDossier] Telegram not configured — dossier logged only:",
        message
      );
    }

    // Log event
    await supabase.from("events").insert({
      company_id: tenantId,
      user_id: dossier.leadId,
      type: "telegram_dossier_sent",
      value: dossier.qualification.tier,
      metadata: {
        tier: dossier.qualification.tier,
        score: dossier.qualification.score,
        channel: "telegram",
      },
    });

    return { success: true, messageId: crypto.randomUUID() };
  } catch (error: any) {
    console.error("[LeadDossier] Failed to send:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Notify admin of a Diamond lead via Telegram
 */
export async function notifyDiamondLead(
  leadId: string,
  tenantId: string
): Promise<{ success: boolean; error?: string }> {
  const dossier = await buildLeadDossier(leadId, tenantId);
  if (!dossier) return { success: false, error: "Failed to build lead dossier" };
  if (dossier.qualification.tier !== "Diamond") return { success: true };
  return sendTelegramDossier(dossier, tenantId);
}

/**
 * Non-blocking Diamond lead notification
 */
export function notifyDiamondLeadAsync(
  leadId: string,
  tenantId: string
): void {
  fireAndForget(
    async () => {
      await notifyDiamondLead(leadId, tenantId);
    },
    (error) => console.error(`[notifyDiamondLeadAsync] Error:`, error)
  );
}

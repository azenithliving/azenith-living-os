import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { analyzeStyleDNAFast, LeadDossier, StyleDNA } from "@/lib/pdf-generator";
import { fireAndForget } from "@/lib/background-processor";
import { whatsAppManager } from "./whatsapp-proxy";

/**
 * WhatsApp Lead Dossier System
 * Generates and sends comprehensive lead briefs to consultants
 */

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

export type WhatsAppDossier = {
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
  // New fields for Creative Visionary Suite
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
export async function buildLeadDossier(leadId: string, tenantId: string): Promise<WhatsAppDossier | null> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new Error('Supabase not initialized');

  // Fetch user/lead data
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("*")
    .eq("id", leadId)
    .eq("company_id", tenantId)
    .single();

  if (userError || !user) {
    console.error("[WhatsAppDossier] Failed to fetch user:", userError);
    return null;
  }

  // Fetch latest request for this user
  const { data: request, error: requestError } = await supabase
    .from("requests")
    .select("*")
    .eq("user_id", leadId)
    .eq("company_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (requestError) {
    console.error("[WhatsAppDossier] Failed to fetch request:", requestError);
  }

  // Fetch recent events for viewed images
  const { data: events } = await supabase
    .from("events")
    .select("metadata")
    .eq("user_id", leadId)
    .eq("company_id", tenantId)
    .eq("type", "image_view")
    .order("created_at", { ascending: false })
    .limit(10);

  const viewedImages = events
    ?.map((e) => e.metadata?.imageUrl)
    .filter(Boolean) as string[] || [];

  // Determine qualification based on score
  const score = user.score || 0;
  let tier: WhatsAppDossier["qualification"]["tier"] = "Silver";
  let priority: WhatsAppDossier["qualification"]["priority"] = "low";

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

  // Analyze Style DNA
  let styleDNA: StyleDNA;
  if (viewedImages.length > 0) {
    const { styleDNA: fastResult } = await analyzeStyleDNAFast(viewedImages, {
      userId: leadId,
      tenantId: tenantId,
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
    fullName: user.full_name || contact?.fullName || user.session_id || "Unknown",
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
 * Format lead dossier as WhatsApp message
 */
export function formatWhatsAppDossier(dossier: WhatsAppDossier): string {
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

  const lines = [
    `${tierEmoji} *NEW ${dossier.qualification.tier.toUpperCase()} LEAD* ${tierEmoji}`,
    "",
    `*Client:* ${dossier.fullName}`,
    `*Phone:* ${dossier.phone}`,
    dossier.email ? `*Email:* ${dossier.email}` : "",
    "",
    `*Project Scope:* ${dossier.scope}`,
    `*Investment:* ${dossier.budget}`,
    `*Timeline:* ${dossier.timeline}`,
    "",
    `*Priority:* ${priorityEmoji} ${dossier.qualification.priority.toUpperCase()}`,
    `*Score:* ${dossier.qualification.score}/100`,
    "",
    "*Style DNA Analysis:*",
    `• Styles: ${dossier.styleDNA.dominantStyles.join(", ")}`,
    `• Colors: ${dossier.styleDNA.colorPalette.join(", ")}`,
    "",
    "Reply READY to claim this lead"
  ];

  return lines.filter(Boolean).join("\n");
}

/**
 * Send WhatsApp dossier to admin
 */
export async function sendWhatsAppDossier(
  dossier: WhatsAppDossier,
  adminPhone: string,
  tenantId: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new Error('Supabase not initialized');

  try {
    const message = formatWhatsAppDossier(dossier);
    
    // Call the actual WhatsApp proxy
    try {
      await whatsAppManager.sendMessage(adminPhone, message);
    } catch (sendErr: any) {
      console.error(`[WhatsAppDossier] Proxy Send Failed:`, sendErr.message);
    }

    // Log event
    await supabase.from("events").insert({
      company_id: tenantId,
      user_id: dossier.leadId,
      type: "whatsapp_dossier_sent",
      value: dossier.qualification.tier,
      metadata: { to: adminPhone, tier: dossier.qualification.tier },
    });

    return { success: true, messageId: crypto.randomUUID() };
  } catch (error: any) {
    console.error("[WhatsAppDossier] Failed to send:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Auto-trigger WhatsApp for Diamond leads
 */
export async function notifyDiamondLead(
  leadId: string,
  tenantId: string,
  adminPhone: string
): Promise<{ success: boolean; error?: string }> {
  const dossier = await buildLeadDossier(leadId, tenantId);
  if (!dossier) return { success: false, error: "Failed to build lead dossier" };
  if (dossier.qualification.tier !== "Diamond") return { success: true };
  return sendWhatsAppDossier(dossier, adminPhone, tenantId);
}

/**
 * Auto-trigger WhatsApp for Diamond leads - ASYNC VERSION
 */
export function notifyDiamondLeadAsync(
  leadId: string,
  tenantId: string,
  adminPhone: string
): void {
  fireAndForget(async () => {
    await notifyDiamondLead(leadId, tenantId, adminPhone);
  }, (error) => console.error(`[notifyDiamondLeadAsync] Error:`, error));
}

/**
 * ────────────────────────────────────────────────────────────────────────────
 * VANGUARD – Tone Adapter
 * ────────────────────────────────────────────────────────────────────────────
 * Phase 3: Task 6 – Adjust response tone per channel
 * 
 * Adapts VANGUARD's communication style based on channel:
 * - WhatsApp: Casual, emoji-friendly, concise
 * - Email: Formal, structured, detailed
 * - Web Chat: Balanced, professional but approachable
 * 
 * Also considers conversation context (urgency, relationship stage, etc.)
 */

import { logger } from "@/lib/vanguard/observability/logger";
import type { ChannelType } from "./channel_router";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ToneProfile {
  channelType: ChannelType;
  formality: "casual" | "balanced" | "formal"; // Formality level
  emojiUsage: "frequent" | "moderate" | "rare" | "none"; // Emoji frequency
  messageLength: "short" | "medium" | "long"; // Preferred message length
  greetingStyle: "friendly" | "professional" | "formal"; // Greeting approach
  closingStyle: "warm" | "neutral" | "formal"; // Closing approach
  useArabicEmojis: boolean; // Use Arabic-context emojis
  useBulletPoints: boolean; // Structure with bullet points
  includeCallToAction: boolean; // Include explicit CTAs
}

export interface ToneContext {
  urgency?: "low" | "medium" | "high"; // Message urgency
  relationshipStage?: "new" | "familiar" | "established"; // Customer relationship
  conversationTopic?: "sales" | "support" | "general"; // Topic category
  customerMood?: "positive" | "neutral" | "frustrated"; // Detected mood
}

export interface AdaptedMessage {
  text: string;
  formattedText: string; // With emojis, formatting, etc.
  metadata: {
    toneProfile: ToneProfile;
    adjustments: string[]; // List of applied adjustments
  };
}

// ─── Channel Tone Profiles ───────────────────────────────────────────────────

const CHANNEL_PROFILES: Record<ChannelType, ToneProfile> = {
  whatsapp: {
    channelType: "whatsapp",
    formality: "casual",
    emojiUsage: "frequent",
    messageLength: "short",
    greetingStyle: "friendly",
    closingStyle: "warm",
    useArabicEmojis: true,
    useBulletPoints: false, // WhatsApp prefers flowing text
    includeCallToAction: true,
  },
  email: {
    channelType: "email",
    formality: "formal",
    emojiUsage: "rare",
    messageLength: "long",
    greetingStyle: "formal",
    closingStyle: "formal",
    useArabicEmojis: false,
    useBulletPoints: true, // Emails benefit from structure
    includeCallToAction: true,
  },
  webchat: {
    channelType: "webchat",
    formality: "balanced",
    emojiUsage: "moderate",
    messageLength: "medium",
    greetingStyle: "professional",
    closingStyle: "neutral",
    useArabicEmojis: true,
    useBulletPoints: false,
    includeCallToAction: true,
  },
};

// ─── Arabic Emoji Library ────────────────────────────────────────────────────

const ARABIC_EMOJIS = {
  greeting: ["👋", "🙋‍♂️", "😊"],
  positive: ["✨", "🎉", "👏", "💫", "🌟"],
  thinking: ["🤔", "💭", "🧐"],
  confirmed: ["✅", "👍", "💯"],
  attention: ["⚠️", "📌", "🔔"],
  success: ["🎊", "🏆", "💪"],
  document: ["📄", "📋", "📝"],
  money: ["💰", "💵", "📈"],
  calendar: ["📅", "🕐", "⏰"],
  contact: ["📞", "💬", "📧"],
  location: ["📍", "🏢", "🏠"],
  question: ["❓", "🤷‍♂️"],
  thanks: ["🙏", "💚", "😊"],
};

// ─── Tone Adapter Class ──────────────────────────────────────────────────────

export class ToneAdapter {
  // ── Adapt Message ────────────────────────────────────────────────────────

  adaptMessage(
    text: string,
    channelType: ChannelType,
    context?: ToneContext
  ): AdaptedMessage {
    const profile = CHANNEL_PROFILES[channelType];
    const adjustments: string[] = [];

    let adaptedText = text;

    // 1. Adjust formality
    if (profile.formality === "casual") {
      adaptedText = this.makeCasual(adaptedText);
      adjustments.push("casual_tone");
    } else if (profile.formality === "formal") {
      adaptedText = this.makeFormal(adaptedText);
      adjustments.push("formal_tone");
    }

    // 2. Adjust length
    if (profile.messageLength === "short" && adaptedText.length > 500) {
      adaptedText = this.shorten(adaptedText);
      adjustments.push("shortened");
    } else if (profile.messageLength === "long" && adaptedText.length < 200) {
      adaptedText = this.expand(adaptedText);
      adjustments.push("expanded");
    }

    // 3. Add greeting
    const greeting = this.selectGreeting(profile, context);
    if (greeting) {
      adaptedText = `${greeting}\n\n${adaptedText}`;
      adjustments.push("greeting_added");
    }

    // 4. Add closing
    const closing = this.selectClosing(profile, context);
    if (closing) {
      adaptedText = `${adaptedText}\n\n${closing}`;
      adjustments.push("closing_added");
    }

    // 5. Add emojis
    if (profile.emojiUsage !== "none") {
      adaptedText = this.addEmojis(adaptedText, profile, context);
      adjustments.push("emojis_added");
    }

    // 6. Structure with bullet points (email only)
    if (profile.useBulletPoints && this.shouldUseBulletPoints(adaptedText)) {
      adaptedText = this.addBulletPoints(adaptedText);
      adjustments.push("bullet_points");
    }

    // 7. Context-specific adjustments
    if (context?.urgency === "high") {
      adaptedText = this.emphasizeUrgency(adaptedText, profile);
      adjustments.push("urgency_emphasized");
    }

    if (context?.customerMood === "frustrated") {
      adaptedText = this.addEmpathy(adaptedText, profile);
      adjustments.push("empathy_added");
    }

    logger.debug("[ToneAdapter] Message adapted", {
      channelType,
      originalLength: text.length,
      adaptedLength: adaptedText.length,
      adjustments,
    });

    return {
      text: adaptedText,
      formattedText: adaptedText,
      metadata: {
        toneProfile: profile,
        adjustments,
      },
    };
  }

  // ── Private: Make Casual ─────────────────────────────────────────────────

  private makeCasual(text: string): string {
    return text
      .replace(/حضرتك/g, "أنت")
      .replace(/سيادتك/g, "أنت")
      .replace(/نرجو/g, "نتمنى")
      .replace(/يُرجى/g, "ممكن")
      .replace(/نأمل/g, "نتمنى");
  }

  // ── Private: Make Formal ─────────────────────────────────────────────────

  private makeFormal(text: string): string {
    return text
      .replace(/\bانت\b/g, "حضرتك")
      .replace(/\bأنت\b/g, "حضرتك")
      .replace(/\bممكن\b/g, "يُرجى")
      .replace(/\bنتمنى\b/g, "نأمل");
  }

  // ── Private: Shorten ─────────────────────────────────────────────────────

  private shorten(text: string): string {
    // Remove redundant phrases, keep core message
    return text
      .replace(/في الواقع،?/g, "")
      .replace(/بالإضافة إلى ذلك،?/g, "")
      .replace(/علاوة على ذلك،?/g, "")
      .replace(/في الحقيقة،?/g, "")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .slice(0, 5) // Keep first 5 paragraphs
      .join("\n");
  }

  // ── Private: Expand ─────────────────────────────────────────────────────

  private expand(text: string): string {
    // Add more context and details
    return text + "\n\nإذا كان لديك أي استفسارات إضافية أو تحتاج إلى مزيد من التوضيح، فلا تتردد في التواصل معنا.";
  }

  // ── Private: Select Greeting ─────────────────────────────────────────────

  private selectGreeting(profile: ToneProfile, context?: ToneContext): string {
    const timeOfDay = this.getTimeOfDay();

    if (profile.greetingStyle === "friendly") {
      const emoji = profile.useArabicEmojis ? " 👋" : "";
      return `${timeOfDay}!${emoji}`;
    } else if (profile.greetingStyle === "professional") {
      return `${timeOfDay}`;
    } else if (profile.greetingStyle === "formal") {
      return `${timeOfDay}، وأهلاً بحضرتك`;
    }

    return "";
  }

  // ── Private: Select Closing ──────────────────────────────────────────────

  private selectClosing(profile: ToneProfile, context?: ToneContext): string {
    if (profile.closingStyle === "warm") {
      return profile.useArabicEmojis ? "نتطلع للعمل معك! 🚀" : "نتطلع للعمل معك!";
    } else if (profile.closingStyle === "neutral") {
      return "شكراً لتواصلك معنا.";
    } else if (profile.closingStyle === "formal") {
      return "مع خالص الشكر والتقدير،\nفريق VANGUARD";
    }

    return "";
  }

  // ── Private: Add Emojis ──────────────────────────────────────────────────

  private addEmojis(text: string, profile: ToneProfile, context?: ToneContext): string {
    if (!profile.useArabicEmojis) return text;

    const frequency = profile.emojiUsage;
    let result = text;

    // Add contextual emojis based on content
    if (frequency === "frequent" || frequency === "moderate") {
      // Success/positive
      if (text.includes("نجاح") || text.includes("ممتاز") || text.includes("رائع")) {
        result = result.replace(/(نجاح|ممتاز|رائع)/, (match) =>
          `${match} ${this.randomEmoji(ARABIC_EMOJIS.positive)}`
        );
      }

      // Confirmation
      if (text.includes("تم") || text.includes("أكدنا") || text.includes("موافق")) {
        result = result.replace(/(تم|أكدنا|موافق)/, (match) =>
          `${match} ${this.randomEmoji(ARABIC_EMOJIS.confirmed)}`
        );
      }

      // Questions
      if (text.includes("؟")) {
        result = result.replace(/\?|؟/, (match) =>
          `${match} ${this.randomEmoji(ARABIC_EMOJIS.question)}`
        );
      }

      // Documents/quotes
      if (text.includes("عرض") || text.includes("مستند") || text.includes("ملف")) {
        result = result.replace(/(عرض|مستند|ملف)/, (match) =>
          `${match} ${this.randomEmoji(ARABIC_EMOJIS.document)}`
        );
      }

      // Money/pricing
      if (text.includes("جنيه") || text.includes("سعر") || text.includes("تكلفة")) {
        result = result.replace(/(جنيه|سعر|تكلفة)/, (match) =>
          `${match} ${this.randomEmoji(ARABIC_EMOJIS.money)}`
        );
      }
    }

    return result;
  }

  // ── Private: Add Bullet Points ───────────────────────────────────────────

  private addBulletPoints(text: string): string {
    const lines = text.split("\n");
    if (lines.length <= 2) return text;

    return lines
      .map((line, i) => {
        line = line.trim();
        if (line.length === 0) return line;
        if (i === 0 || i === lines.length - 1) return line; // Don't bullet first/last
        if (line.startsWith("•") || line.startsWith("-")) return line; // Already has bullet
        return `• ${line}`;
      })
      .join("\n");
  }

  // ── Private: Should Use Bullet Points ────────────────────────────────────

  private shouldUseBulletPoints(text: string): boolean {
    const lines = text.split("\n").filter((l) => l.trim().length > 0);
    // Use bullets if 3+ lines and looks like a list
    return lines.length >= 3 && lines.length <= 10;
  }

  // ── Private: Emphasize Urgency ───────────────────────────────────────────

  private emphasizeUrgency(text: string, profile: ToneProfile): string {
    const urgentPrefix = profile.useArabicEmojis ? "⚠️ عاجل: " : "عاجل: ";
    return `${urgentPrefix}${text}`;
  }

  // ── Private: Add Empathy ─────────────────────────────────────────────────

  private addEmpathy(text: string, profile: ToneProfile): string {
    const empathyPrefix =
      "نتفهم تماماً شعورك، ونعتذر عن أي إزعاج. سنبذل قصارى جهدنا لحل الأمر.\n\n";
    return `${empathyPrefix}${text}`;
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private getTimeOfDay(): string {
    const hour = new Date().getHours();
    if (hour < 12) return "صباح الخير";
    if (hour < 18) return "مساء الخير";
    return "مساء الخير";
  }

  private randomEmoji(emojiList: string[]): string {
    return emojiList[Math.floor(Math.random() * emojiList.length)];
  }

  // ── Get Profile ──────────────────────────────────────────────────────────

  getProfile(channelType: ChannelType): ToneProfile {
    return CHANNEL_PROFILES[channelType];
  }
}

// ─── Helper: Create Tone Adapter ─────────────────────────────────────────────

export function createToneAdapter(): ToneAdapter {
  return new ToneAdapter();
}

// ─── Helper: Quick Adapt (Singleton) ─────────────────────────────────────────

let _toneAdapter: ToneAdapter | null = null;

export function adaptTone(
  text: string,
  channelType: ChannelType,
  context?: ToneContext
): string {
  if (!_toneAdapter) {
    _toneAdapter = new ToneAdapter();
  }
  return _toneAdapter.adaptMessage(text, channelType, context).text;
}

export type Intent = "browsing" | "interested" | "buyer";

export type SessionProfile = {
  roomType?: string;
  budget?: string;
  style?: string;
  serviceType?: string;
  intent?: Intent;
};

type ScoreInputs = {
  clicks?: number;
  timeSpent?: number;
  views?: number;
  whatsappClicks?: number;
};

const EVENT_WEIGHTS: Record<string, number> = {
  page_view: 1,
  click_cta: 2,
  scroll_depth: 1,
  time_spent: 2,
  page_depth: 1,
  stepper_select: 2,
  stepper_next: 2,
  stepper_complete: 5,
  whatsapp_click: 7,
  request_submit: 6,
  quote_view: 3,
  booking_start: 4,
  booking_confirm: 6,
  offer_accept: 5,
  experiment_exposure: 1,
};

export function getEventWeight(type: string): number {
  return EVENT_WEIGHTS[type] ?? 0;
}

export function calculateScore({
  clicks = 0,
  timeSpent = 0,
  views = 0,
  whatsappClicks = 0,
}: ScoreInputs): number {
  return Math.round((clicks * 2) + (timeSpent * 1.5) + views + (whatsappClicks * 7));
}

export function classifyIntent(score: number): Intent {
  if (score > 70) {
    return "buyer";
  }

  if (score > 30) {
    return "interested";
  }

  return "browsing";
}

export function getPrimaryCta(intent: Intent): string {
  switch (intent) {
    case "buyer":
      return "ابدأ التنفيذ فورًا";
    case "interested":
      return "احصل على تصميم مجاني";
    default:
      return "شاهد أفكار";
  }
}

export function buildWhatsAppMessage(
  profile: SessionProfile,
  brandNameAr: string,
): string {
  const parts = [
    `مرحبًا، أريد التواصل مع ${brandNameAr}.`,
    profile.roomType ? `نوع المساحة: ${profile.roomType}` : null,
    profile.budget ? `الميزانية: ${profile.budget}` : null,
    profile.style ? `الطابع المفضل: ${profile.style}` : null,
    profile.serviceType ? `نوع الخدمة: ${profile.serviceType}` : null,
    profile.intent ? `النية الحالية: ${profile.intent}` : null,
  ].filter(Boolean);

  return parts.join("\n");
}

export function buildWhatsAppUrl(
  phoneNumber: string,
  profile: SessionProfile,
  brandNameAr: string,
): string {
  const message = buildWhatsAppMessage(profile, brandNameAr);
  return `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
}

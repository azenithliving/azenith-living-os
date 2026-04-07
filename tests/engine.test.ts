import { describe, expect, it } from "vitest";

import {
  buildWhatsAppMessage,
  buildWhatsAppUrl,
  calculateScore,
  classifyIntent,
  getPrimaryCta,
} from "../lib/conversion-engine";

describe("conversion engine helpers", () => {
  it("calculates score using the contract formula", () => {
    expect(calculateScore({ clicks: 3, timeSpent: 10, views: 4, whatsappClicks: 1 })).toBe(32);
  });

  it("maps score to intent bands", () => {
    expect(classifyIntent(10)).toBe("browsing");
    expect(classifyIntent(31)).toBe("interested");
    expect(classifyIntent(71)).toBe("buyer");
  });

  it("maps intent to the primary CTA copy", () => {
    expect(getPrimaryCta("browsing")).toBe("شاهد أفكار");
    expect(getPrimaryCta("interested")).toBe("احصل على تصميم مجاني");
    expect(getPrimaryCta("buyer")).toBe("ابدأ التنفيذ فورًا");
  });

  it("builds a WhatsApp message with profile details", () => {
    const message = buildWhatsAppMessage({ roomType: "مطبخ", budget: "5500 EGP", style: "مودرن", serviceType: "تصميم وتنفيذ", intent: "interested" }, "أزينث");
    expect(message).toContain("أزينث");
    expect(message).toContain("نوع المساحة: مطبخ");
    expect(message).toContain("الميزانية: 5500 EGP");
  });

  it("builds an encoded WhatsApp URL", () => {
    const url = buildWhatsAppUrl("201090819584", { roomType: "غرفة معيشة", intent: "buyer" }, "أزينث");
    expect(url).toContain("https://wa.me/201090819584?text=");
    expect(url).toContain(encodeURIComponent("غرفة معيشة"));
  });
});

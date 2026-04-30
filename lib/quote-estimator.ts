import { packageLadder } from "@/lib/site-content";

type QuoteInput = {
  roomType: string;
  budget: string;
  style: string;
  serviceType: string;
};

const roomMultipliers: Record<string, number> = {
  "غرف النوم الرئيسية": 1.2,
  "غرف المعيشة": 1.15,
  المطابخ: 1.35,
  "غرف الملابس": 1.1,
  "المكاتب المنزلية": 1,
  "غرف الشباب والأطفال": 0.95,
};

const serviceMultipliers: Record<string, number> = {
  "تصميم فقط": 1,
  "تصميم وتجهيز": 1.35,
  "تصميم وتنفيذ": 1.8,
  "تجديد لمساحة قائمة": 1.25,
};

const budgetAnchors: Record<string, number> = {
  "2,500 - 5,500 EGP": 3500,
  "5,500 - 12,000 EGP": 7500,
  "12,000 - 25,000 EGP": 15000,
  "25,000+ EGP": 25000,
};

export function estimateQuote(input: QuoteInput) {
  const budgetAnchor = budgetAnchors[input.budget] ?? 5500;
  const roomFactor = roomMultipliers[input.roomType] ?? 1;
  const serviceFactor = serviceMultipliers[input.serviceType] ?? 1;
  const styleFactor = input.style === "هادئ فاخر" ? 1.15 : input.style === "صناعي ناعم" ? 1.1 : 1;

  const estimated = Math.round(budgetAnchor * roomFactor * serviceFactor * styleFactor);
  const designFee = Math.max(2500, Math.round(estimated * 0.12));
  const executionEnvelope = Math.round(estimated * 0.88);

  return {
    estimated,
    designFee,
    executionEnvelope,
    packageKey:
      estimated >= 18000 ? "premium" :
      estimated >= 8000 ? "full" :
      "basic",
  };
}

export function getPackageRecommendations(input: QuoteInput) {
  const quote = estimateQuote(input);
  const preferredIndex = packageLadder.findIndex((item) => item.key === quote.packageKey);
  const ordered = [...packageLadder];

  if (preferredIndex > 0) {
    const [preferred] = ordered.splice(preferredIndex, 1);
    ordered.unshift(preferred);
  }

  return ordered.slice(0, 3);
}

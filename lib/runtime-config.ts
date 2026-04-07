import "server-only";

import { getCurrentTenant } from "@/lib/tenant";

export type RuntimeConfig = {
  brandName: string;
  brandNameAr: string;
  freeHookOffer: string;
  whatsappNumber: string | null;
  primaryDomain: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  businessAddress: string | null;
  logoPath: string;
  faviconPath: string;
  primaryColor: string;
};

function readEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function normalizePhoneNumber(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const digitsOnly = value.replace(/\D/g, "");
  return digitsOnly.length > 0 ? digitsOnly : null;
}

export async function getRuntimeConfig(): Promise<RuntimeConfig> {
  let tenant = null;

  try {
    tenant = await getCurrentTenant();
  } catch (error) {
    console.warn("getRuntimeConfig: unable to resolve tenant, falling back to defaults.", error);
    tenant = null;
  }

  // Fallback to environment variables if no tenant found
  const brandName = tenant?.name ?? readEnv("BRAND_NAME") ?? "Azenith Living";
  const whatsappNumber = tenant?.whatsapp ? normalizePhoneNumber(tenant.whatsapp) : normalizePhoneNumber(readEnv("WHATSAPP_DEFAULT_NUMBER"));
  const primaryColor = tenant?.primary_color ?? "#C5A059";

  return {
    brandName,
    brandNameAr: readEnv("BRAND_NAME_AR") ?? "أزينث",
    freeHookOffer: readEnv("FREE_HOOK_OFFER") ?? "تصميم مبدئي خلال 24 ساعة",
    whatsappNumber,
    primaryDomain: readEnv("PRIMARY_DOMAIN"),
    contactEmail: readEnv("CONTACT_EMAIL"),
    contactPhone: normalizePhoneNumber(readEnv("CONTACT_PHONE")),
    businessAddress: readEnv("BUSINESS_ADDRESS"),
    logoPath: tenant?.logo ?? "/logo.png",
    faviconPath: "/favicon.png",
    primaryColor,
  };
}


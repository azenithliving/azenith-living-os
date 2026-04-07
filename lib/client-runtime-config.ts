

export type RuntimeConfig = {
  brandName: string;
  brandNameAr: string;
  freeHookOffer: string;
  whatsappNumber: string | null;
  logoPath: string;
  faviconPath: string;
  primaryColor: string;
};

// readEnv defined locally - no import issue
function readEnvClient(name: string): string | null {
  const value = (typeof process !== 'undefined' ? process.env[name] : null)?.trim();
  return value ? value : null;
}


function normalizePhoneNumber(value: string | null): string | null {
  if (!value) {
    return null;
  }
  const digitsOnly = value.replace(/\D/g, "");
  return digitsOnly.length > 0 ? digitsOnly : null;
}

export const getClientRuntimeConfig = (): RuntimeConfig => ({
  brandName: readEnvClient("BRAND_NAME") ?? "Azenith Living",
  brandNameAr: readEnvClient("BRAND_NAME_AR") ?? "أزينث",
  freeHookOffer: readEnvClient("FREE_HOOK_OFFER") ?? "تصميم مبدئي خلال 24 ساعة",
  whatsappNumber: normalizePhoneNumber(readEnvClient("WHATSAPP_DEFAULT_NUMBER")),
  logoPath: "/logo.png",
  faviconPath: "/favicon.png",
  primaryColor: "#C5A059",
});


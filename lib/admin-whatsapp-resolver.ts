/**
 * Resolves admin WhatsApp number from env, tenant, or company — no single env required.
 */

import { createClient } from "@supabase/supabase-js";

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function normalizePhone(raw: string): string {
  return raw.replace(/[^\d+]/g, "").replace(/^00/, "+");
}

export async function resolveAdminWhatsAppPhone(opts?: {
  override?: string;
  tenantId?: string;
  companyId?: string;
}): Promise<{ phone: string | null; source: string }> {
  if (opts?.override?.trim()) {
    return { phone: normalizePhone(opts.override), source: "param" };
  }

  const envCandidates: Array<[string, string | undefined]> = [
    ["WHATSAPP_ADMIN_PHONE", process.env.WHATSAPP_ADMIN_PHONE],
    ["MASTER_ADMIN_WHATSAPP", process.env.MASTER_ADMIN_WHATSAPP],
    ["WHATSAPP_DEFAULT_NUMBER", process.env.WHATSAPP_DEFAULT_NUMBER],
    ["NEXT_PUBLIC_WHATSAPP_NUMBER", process.env.NEXT_PUBLIC_WHATSAPP_NUMBER],
  ];

  for (const [name, val] of envCandidates) {
    if (val?.trim()) {
      return { phone: normalizePhone(val), source: name };
    }
  }

  const supabase = getServiceSupabase();
  if (!supabase) return { phone: null, source: "none" };

  const companyId = opts?.companyId || opts?.tenantId || process.env.MASTER_COMPANY_ID;
  if (companyId) {
    const { data: company } = await supabase
      .from("companies")
      .select("whatsapp")
      .eq("id", companyId)
      .maybeSingle();
    if (company?.whatsapp) {
      return { phone: normalizePhone(String(company.whatsapp)), source: "companies" };
    }
  }

  if (opts?.tenantId) {
    const { data: tenant } = await supabase
      .from("companies")
      .select("whatsapp, name")
      .eq("id", opts.tenantId)
      .maybeSingle();
    if (tenant?.whatsapp) {
      return { phone: normalizePhone(String(tenant.whatsapp)), source: "tenant" };
    }
  }

  const { data: anyCompany } = await supabase
    .from("companies")
    .select("whatsapp")
    .not("whatsapp", "is", null)
    .limit(1)
    .maybeSingle();
  if (anyCompany?.whatsapp) {
    return { phone: normalizePhone(String(anyCompany.whatsapp)), source: "companies_fallback" };
  }

  return { phone: null, source: "none" };
}

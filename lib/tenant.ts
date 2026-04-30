import "server-only";
import { headers } from "next/headers";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";

// DEFAULT TENANT: Fallback when DB is empty
const DEFAULT_TENANT: TenantRecord = {
  id: "00000000-0000-0000-0000-000000000001",
  name: "Azenith Living",
  domain: "localhost",
  logo: null,
  primary_color: "#C5A059",
  whatsapp: "201090819584",
};

export type TenantRecord = {
  id: string;
  name: string;
  domain: string;
  logo: string | null;
  primary_color: string | null;
  whatsapp: string | null;
};

export function normalizeHost(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const normalized = value
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    .split(":")[0]
    .trim()
    .toLowerCase();

  return normalized || null;
}

export async function getRequestHost(headers: Headers) {
  return normalizeHost(
    headers.get("x-forwarded-host") ??
      headers.get("host") ??
      headers.get("x-original-host"),
  );
}


export async function getTenantByHost(host: string | null): Promise<TenantRecord | null> {
  const normalizedHost = normalizeHost(host);

  if (!normalizedHost) {
    console.warn("[tenant] No host provided, returning default tenant");
    return DEFAULT_TENANT;
  }

  try {
    const supabase = getSupabaseAdminClient();
    if (!supabase) {
      console.warn("[tenant] Supabase client not available, returning default tenant");
      return DEFAULT_TENANT;
    }

    const { data, error } = await supabase
      .from("companies")
      .select("id, name, domain, logo, primary_color, whatsapp")
      .eq("domain", normalizedHost)
      .maybeSingle<TenantRecord>();

    if (error) {
      if (error.code === "PGRST205") {
        console.warn("[tenant] Supabase schema not initialized, using default tenant");
        return DEFAULT_TENANT;
      }
      if (error.code === "42P01") {
        console.warn("[tenant] Table 'companies' does not exist, using default tenant");
        return DEFAULT_TENANT;
      }
      console.error("[tenant] Database error:", error.message);
      return DEFAULT_TENANT;
    }

    if (data) {
      return data;
    }

    // No tenant found for this host - try wildcard or return default
    console.warn(`[tenant] No tenant found for host: ${normalizedHost}, using default`);
    return DEFAULT_TENANT;

  } catch (err) {
    console.error("[tenant] Unexpected error:", err);
    return DEFAULT_TENANT;
  }
}

export async function getCurrentTenant(): Promise<TenantRecord | null> {
  // During static build, return default tenant (no headers available)
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return DEFAULT_TENANT;
  }
  
  try {
    const headerStore = await headers();
    const host = normalizeHost(
      headerStore.get("x-forwarded-host") ||
      headerStore.get("host") ||
      headerStore.get("x-original-host")
    );
    return getTenantByHost(host);
  } catch (err) {
    console.error("[tenant] Failed to get current tenant:", err);
    return DEFAULT_TENANT;
  }
}

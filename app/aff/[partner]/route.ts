import { NextRequest, NextResponse } from "next/server";

import { resolvePrimaryCompanyId } from "@/lib/company-resolver";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const ALLOWED_HOSTS_BY_PARTNER: Record<string, string[]> = {
  amazon: ["amazon.com", "www.amazon.com", "amazon.eg", "www.amazon.eg"],
  ikea: ["ikea.com", "www.ikea.com"],
  noon: ["noon.com", "www.noon.com"],
};

function isAllowedDestination(partner: string, destinationUrl: string): boolean {
  try {
    const u = new URL(destinationUrl);
    if (u.protocol !== "https:") return false;

    const allowedHosts = ALLOWED_HOSTS_BY_PARTNER[partner] || [];
    if (allowedHosts.length === 0) return false;

    const host = u.hostname.toLowerCase();
    return allowedHosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest, context: { params: { partner: string } }) {
  const partner = (context.params.partner || "").toLowerCase();
  const destination = request.nextUrl.searchParams.get("to") || "";

  if (!partner || !destination) {
    return NextResponse.json({ success: false, error: "Missing partner/to" }, { status: 400 });
  }

  if (!isAllowedDestination(partner, destination)) {
    return NextResponse.json(
      { success: false, error: "Blocked redirect destination" },
      { status: 400 }
    );
  }

  // Best-effort logging (do not block the redirect).
  try {
    const supabase = getSupabaseAdminClient();
    if (supabase) {
      const companyId = await resolvePrimaryCompanyId();
      const ua = request.headers.get("user-agent") || null;
      const referer = request.headers.get("referer") || null;
      const ip = request.headers.get("x-forwarded-for") || null;

      await supabase.from("events").insert({
        company_id: companyId,
        type: "affiliate_click",
        value: partner,
        metadata: { to: destination, ua, referer, ip },
      });
    }
  } catch {}

  return NextResponse.redirect(destination, 302);
}


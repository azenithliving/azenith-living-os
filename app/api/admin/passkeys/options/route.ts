import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { generateRegistrationOptions } from "@simplewebauthn/server";

import { requireAdminApi } from "@/lib/admin-api-guard";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  ENROLL_CHALLENGE_COOKIE,
  PASSKEY_RP_NAME,
  challengeCookieOptions,
  passkeyRpId,
} from "@/lib/passkey-params";

/**
 * GET /api/admin/passkeys/options — the challenge the owner's device must answer.
 *
 * The challenge goes into an httpOnly cookie, not a server-side map: measured on this platform, state
 * held in a request dies with the request, and a challenge nobody can produce again means every
 * enrollment fails with a verification error nobody can read.
 */
export async function GET() {
  try {
    const { user, unauthorized } = await requireAdminApi();
    if (unauthorized) return unauthorized;

    const supabase = getSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json({ error: "مفتاح المتجر مش ضابط — التحدي ما اتعملش" }, { status: 503 });
    }

    const { data: existing } = await supabase
      .from("user_public_keys")
      .select("credential_id, transports")
      .eq("user_id", user?.id);

    const options = await generateRegistrationOptions({
      rpName: PASSKEY_RP_NAME,
      rpID: passkeyRpId(),
      userName: user?.email ?? "",
      userDisplayName: user?.email ?? "",
      attestationType: "none",
      authenticatorSelection: { residentKey: "preferred", userVerification: "required" },
      excludeCredentials: (existing ?? []).map((row: { credential_id: string; transports: string | null }) => ({
        id: row.credential_id,
        transports: row.transports ? row.transports.split(",") : [],
      })),
    });

    const store = await cookies();
    store.set(ENROLL_CHALLENGE_COOKIE, options.challenge, challengeCookieOptions());

    return NextResponse.json(options);
  } catch (error) {
    console.error("[PasskeyOptions]", error);
    return NextResponse.json({ error: "التحدي ما اتعملش — السبب اتسجل في اللوج" }, { status: 500 });
  }
}

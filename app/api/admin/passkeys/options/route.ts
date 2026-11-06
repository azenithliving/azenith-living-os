import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { generateRegistrationOptions } from "@simplewebauthn/server";

import { requireAdminApi } from "@/lib/admin-api-guard";
import { resolveSiteUrl } from "@/lib/admin-env-resolver";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** The one cookie name the enrollment pair shares, and the one place its lifetime is decided. */
export const CHALLENGE_COOKIE = "passkey_enroll_challenge";
export const CHALLENGE_TTL_SECONDS = 300;

/**
 * The address the browser will bind the key to.
 *
 * A passkey is minted for one origin and never works on another, so this comes from the store's own
 * site-url owner (`resolveSiteUrl`) rather than a second hardcoded host — the same fact already has an
 * owner, and a second one is how a key gets enrolled that can never be used.
 */
export function rpHost(): string {
  return new URL(resolveSiteUrl()).hostname;
}

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
      rpName: "أزينث",
      rpID: rpHost(),
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
    store.set(CHALLENGE_COOKIE, options.challenge, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: CHALLENGE_TTL_SECONDS,
      path: "/api/admin/passkeys",
    });

    return NextResponse.json(options);
  } catch (error) {
    console.error("[PasskeyOptions]", error);
    return NextResponse.json({ error: "التحدي ما اتعملش — السبب اتسجل في اللوج" }, { status: 500 });
  }
}

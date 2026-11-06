import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { generateAuthenticationOptions } from "@simplewebauthn/server";

import { LOGIN_CHALLENGE_COOKIE, challengeCookieOptions, passkeyRpId } from "@/lib/passkey-params";

/**
 * POST /api/admin/passkeys/authenticate/options — the challenge that opens the dashboard.
 *
 * This is the one passkey door an anonymous browser is allowed to knock on: it exists precisely to
 * make a session, so asking for a session first would be a circle. What replaces the password is the
 * device's signed answer to a challenge nobody else can produce.
 *
 * `allowCredentials` is left empty on purpose. The keys here are resident on the owner's own device,
 * so the device picks which one matches this address — no email is typed, and the store never learns
 * or guesses which account is about to walk in before the signature is checked.
 */
export async function POST() {
  try {
    const options = await generateAuthenticationOptions({
      rpID: passkeyRpId(),
      userVerification: "required",
      allowCredentials: [],
    });

    const store = await cookies();
    store.set(LOGIN_CHALLENGE_COOKIE, options.challenge, challengeCookieOptions());

    return NextResponse.json(options);
  } catch (error) {
    console.error("[PasskeyLoginOptions]", error);
    return NextResponse.json({ error: "التحدي ما اتعملش — السبب اتسجل في اللوج" }, { status: 500 });
  }
}

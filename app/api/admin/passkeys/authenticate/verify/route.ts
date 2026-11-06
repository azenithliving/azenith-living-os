import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";

import { isAuthorizedAdminEmail } from "@/lib/admin-access";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { LOGIN_CHALLENGE_COOKIE, passkeyOrigin, passkeyRpId } from "@/lib/passkey-params";
import { telegramAlert, telegramTime } from "@/lib/telegram-copy";
import { sendSecurityAlert } from "@/lib/telegram-notify";
import { createClient } from "@/utils/supabase/server";

type KeyRow = {
  id: string;
  user_id: string;
  credential_id: string;
  public_key: string | null;
  counter: number | null;
  label: string;
};

/**
 * POST /api/admin/passkeys/authenticate/verify — the device's signed answer becomes a session.
 *
 * The order of the refusals is the design:
 *  1. no challenge issued → nothing is asked of anybody;
 *  2. the stored key is read *before* the verifier runs, because verification needs the public key and
 *     a missing row is a different fact from a bad signature;
 *  3. the verifier's `verified` flag decides, never the presence of a response;
 *  4. the account the key belongs to is checked against the admin allow-list before any session is
 *     minted — a customer's fingerprint must not open the dashboard;
 *  5. the session is minted from the key alone. No password is asked, carried, or compared here, and
 *     the password door stays exactly where it was as the way out if a device is ever lost.
 *
 * The record answers refusals as values, so every step names the refusal it got instead of reading a
 * silence as a «no».
 */
export async function POST(request: NextRequest) {
  const store = await cookies();
  const expectedChallenge = store.get(LOGIN_CHALLENGE_COOKIE)?.value;
  // One attempt per challenge: leaving it set would let the same signed answer open the door twice.
  const clearChallenge = () => store.delete(LOGIN_CHALLENGE_COOKIE);

  const refuse = (status: number, message: string) => {
    clearChallenge();
    return NextResponse.json({ success: false, message }, { status });
  };

  if (!expectedChallenge) {
    return refuse(400, "مفيش تحدي مطلوب من المتصفح — اطلب التحدي الأول");
  }

  const body = await request.json().catch(() => ({}));
  const response = body?.response;
  const credentialId: string = response?.id ?? response?.rawId ?? "";
  if (!credentialId || !response) {
    return refuse(400, "المتصفح بعتش ردّ جهاز — الدخول ما كملش");
  }

  const supabaseAdmin = getSupabaseAdminClient();
  if (!supabaseAdmin) {
    return refuse(503, "مفتاح المتجر مش ضابط — الدخول ما كملش");
  }

  const { data: keyRow, error: lookupError } = await supabaseAdmin
    .from("user_public_keys")
    .select("id, user_id, credential_id, public_key, counter, label")
    .eq("credential_id", credentialId)
    .maybeSingle<KeyRow>();

  if (lookupError) {
    console.error("[PasskeyLogin] keys drawer refused:", lookupError);
    return refuse(500, "المخزن ما ردّش على دفتر مفاتيح الدخول — الدخول ما اتقارش");
  }
  if (!keyRow) {
    return refuse(401, "المفتاح ده مش مسجّل على المتجر — جرّب مفتاح تاني أو كلمة السر");
  }
  if (!keyRow.public_key) {
    return refuse(401, "المفتاح ده مسجّل من غير نصّ المفتاح — مفيش حاجة نتحقق بيها");
  }

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: passkeyOrigin(),
      expectedRPID: passkeyRpId(),
      requireUserVerification: true,
      credential: {
        id: keyRow.credential_id,
        publicKey: Uint8Array.from(Buffer.from(keyRow.public_key, "base64url")),
        counter: Number(keyRow.counter ?? 0),
      },
    });
  } catch (error) {
    console.error("[PasskeyLogin] the device answer could not be read:", error);
    return refuse(400, "الجهاز ما ردّش على التحدي — الدخول ما كملش");
  }

  if (!verification?.verified) {
    return refuse(401, "التحقق من ردّ الجهاز ما تمّش — الدخول ما كملش");
  }
  const info = verification.authenticationInfo;

  const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(keyRow.user_id);
  if (userError) {
    console.error("[PasskeyLogin] account drawer refused:", userError);
    return refuse(500, "المخزن ما ردّش على حساب المفتاح — الدخول ما اتقارش");
  }
  const email = userData?.user?.email ?? "";
  if (!userData?.user) {
    return refuse(401, "المفتاح ده مربوط بحساب مش موجود — الدخول ما كملش");
  }
  if (!isAuthorizedAdminEmail(email)) {
    // Measured, not assumed: the key is real, the signature is real, and the account still has no
    // place in the dashboard. Saying «wrong key» here would send the owner to enroll again.
    return refuse(403, "المفتاح ده لحساب مالوش صلاحية على لوحة التحكم — الدخول اترفض");
  }

  const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  const tokenHash = linkData?.properties?.hashed_token;
  if (linkError || !tokenHash) {
    console.error("[PasskeyLogin] session token refused:", linkError);
    return refuse(500, "الدخول ما كملش — المتجر ما قدرش يفتح الجلسة");
  }

  const supabase = await createClient();
  const { error: sessionError } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "email" });
  if (sessionError) {
    console.error("[PasskeyLogin] session could not be established:", sessionError);
    return refuse(500, "الدخول ما كملش — الجلسة ما اتفتحتش");
  }

  // The counter is what makes a replayed answer detectable, so it is written back — and read back,
  // because a refusal here is a silent loss of that protection. The login already happened; the note
  // says what could not be confirmed rather than pretending it was.
  const { data: counterReadBack } = await supabaseAdmin
    .from("user_public_keys")
    .update({ counter: Number(info.newCounter ?? 0), last_used_at: new Date().toISOString() })
    .eq("id", keyRow.id)
    .select("counter, last_used_at")
    .single();

  const counterNote = counterReadBack
    ? null
    : "عدد مرات الاستخدام ما اتأكدش — المفتاح فتح اللوحة بس القراية ما رجعتش السطر";

  await sendSecurityAlert(
    telegramAlert("🔑", "دخول المدير ببصمة على مفتاح مسجّل", [
      ["المفتاح", keyRow.label],
      ["الوقت", telegramTime()],
      ["العنوان", request.headers.get("x-forwarded-for") || "غير معروف"],
    ])
  );

  clearChallenge();

  const message = `البصمة فتحت اللوحة بمفتاح «${keyRow.label}» — من غير كلمة سر.`;
  return NextResponse.json({
    success: true,
    signedIn: true,
    message,
    ...(counterNote ? { counterNote } : {}),
  });
}

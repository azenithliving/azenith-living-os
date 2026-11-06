import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyRegistrationResponse } from "@simplewebauthn/server";

import { requireAdminApi } from "@/lib/admin-api-guard";
import { resolveSiteUrl } from "@/lib/admin-env-resolver";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

import { CHALLENGE_COOKIE, rpHost } from "../options/route";

function refuse(status: number, message: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ saved: false, message, ...extra }, { status });
}

/**
 * POST /api/admin/passkeys/enroll — the device's answer becomes a stored key, or nothing.
 *
 * Three refusals are the point of this door: no challenge issued, the verifier not satisfied, and a
 * row that cannot be read back. The third is this store's own law — a write whose refusal comes back
 * as a value has to be confirmed by reading it, or the owner is told «saved» about a row that does
 * not exist.
 */
export async function POST(request: NextRequest) {
  const { user, unauthorized } = await requireAdminApi();
  if (unauthorized) return unauthorized;

  const body = await request.json().catch(() => ({}));
  const store = await cookies();
  const expectedChallenge = store.get(CHALLENGE_COOKIE)?.value;

  if (!expectedChallenge) {
    return refuse(400, "مفيش تحدي مطلوب من المتصفح — اطلب التحدي الأول");
  }

  // The challenge answers once. Leaving it set would let the same device answer be replayed.
  const clearChallenge = () => store.delete(CHALLENGE_COOKIE);

  const label = typeof body?.label === "string" ? body.label.trim() : "";
  if (!label) {
    clearChallenge();
    return refuse(400, "المفتاح محتاج اسم من عندك — الاسم ده اللي هيظهر في اللوحة");
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    clearChallenge();
    return refuse(503, "مفتاح المتجر مش ضابط — المفتاح ما اتسجلش");
  }

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: body?.response,
      expectedChallenge,
      expectedOrigin: resolveSiteUrl(),
      expectedRPID: rpHost(),
      requireUserVerification: true,
    });
  } catch (error) {
    console.error("[PasskeyEnroll] verification threw:", error);
    clearChallenge();
    return refuse(400, "الجهاز ما ردّش على التحدي — المفتاح ما اتسجلش");
  }

  const info = verification?.verified ? verification.registrationInfo : null;
  if (!info) {
    clearChallenge();
    return refuse(400, "التحقق من ردّ الجهاز ما تمّش — المفتاح ما اتسجلش");
  }

  // The shape is read from the installed types, not from the package's own prose above them: v14
  // returns `registrationInfo.credential` = { id, publicKey, counter, transports } while the comment
  // block still describes flat `credentialID` / `credentialPublicKey` fields. The types win.
  // bytea over the record's HTTP door is a hex literal, measured by the live enrollment proof:
  // a raw byte array is refused, and the base64 text column beside it is what the older doors read.
  const bytes = Buffer.from(info.credential.publicKey);
  const row = {
    user_id: user?.id,
    credential_id: info.credential.id,
    credential_public_key: `\\x${bytes.toString("hex")}`,
    public_key: bytes.toString("base64url"),
    key_type: "public-key",
    aaguid: info.aaguid ?? null,
    counter: Number(info.credential.counter ?? 0),
    device_type: info.credentialDeviceType ?? "singleDevice",
    backed_up: Boolean(info.credentialBackedUp),
    transports: Array.isArray(info.credential.transports) ? info.credential.transports.join(",") : null,
    origin: info.origin ?? null,
    label,
  };

  const { data: stored, error } = await supabase.from("user_public_keys").insert(row).select("id").single();
  clearChallenge();

  if (error) {
    console.error("[PasskeyEnroll] insert refused:", error);
    if ((error as { code?: string }).code === "23505") {
      return refuse(409, "المفتاح ده مسجّل قبل كده على الحساب — جرّب جهاز تاني");
    }
    return refuse(500, "المفتاح ما اتسجلش — السبب اتسجل في اللوج", { reason: String((error as { message?: string })?.message ?? error).slice(0, 120) });
  }

  if (!stored) {
    return refuse(500, "المفتاح ما اتأكدش إنه اتخزن — اللوحة ما بتقولش «اتسجل» من غير قراية رجوع");
  }

  return NextResponse.json({
    saved: true,
    message: `مفتاح «${label}» اتسجل، والقراية من المخزن أكّدته.`,
    key: { label, enrolledAt: new Date().toISOString() },
  });
}

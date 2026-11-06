import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { requireAdminApi } from "@/lib/admin-api-guard";

/**
 * What a drawer actually said, measured against the record 2026-11-06: an empty `.single()` is not
 * `{data:null, error:null}` — it answers error `PGRST116` («Cannot coerce the result to a single JSON
 * object»), which means the drawer answered and held nothing. `PGRST205` (no such table) and `42501`
 * (locked) are refusals, and a refusal must never be printed as «off» or «none».
 */
function drawerOutcome(error: unknown, data: unknown): "answered" | "empty" | "refused" {
  if (!error) return data ? "answered" : "empty";
  if ((error as { code?: string })?.code === "PGRST116") return "empty";
  return "refused";
}

/**
 * The owner's protection state, read with the store's own credential.
 *
 * This door used the browser key until the keys drawer was created (2026-11-06). Measured the same
 * day: with row level security on and no policy, a browser-key read returns ZERO rows and answers
 * PGRST116 — the very code that means «the drawer is empty». The door would have gone on saying
 * «مفيش مفتاح» after the owner enrolled one, and no test could see it. The store's law since
 * 2026-10-15 is that its tables answer only to the service credential, and this is an admin door.
 */
export async function GET() {
  try {
    const { user, unauthorized } = await requireAdminApi();
    if (unauthorized) return unauthorized;

    const supabase = getSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json(
        {
          twoFactorState: "not-measured",
          publicKeyState: "not-measured",
          twoFactorNote: "مفتاح المتجر مش ضابط — حالة التحقق بالكود ما اتقارش",
          publicKeyNote: "مفتاح المتجر مش ضابط — حالة مفتاح الدخول ما اتقارش",
        },
        { status: 503 },
      );
    }

    const { data: user2FA, error: fetchError } = await supabase
      .from("user_2fa")
      .select("is_enabled, created_at, updated_at")
      .eq("user_id", user?.id)
      .single();

    const { data: publicKey, error: keyError } = await supabase
      .from("user_public_keys")
      .select("created_at, label")
      .eq("user_id", user?.id)
      .single();

    const faOutcome = drawerOutcome(fetchError, user2FA);
    const keyOutcome = drawerOutcome(keyError, publicKey);
    if (faOutcome === "refused") console.error("[2FA Status] code drawer refused:", fetchError);
    if (keyOutcome === "refused") console.error("[2FA Status] keys drawer refused:", keyError);

    const twoFactorState = faOutcome === "refused" ? "not-measured" : user2FA?.is_enabled ? "on" : "off";
    const publicKeyState = keyOutcome === "refused" ? "not-measured" : publicKey ? "enrolled" : "none";

    const body: Record<string, unknown> = {
      twoFactorState,
      publicKeyState,
      setupDate: user2FA?.created_at ?? null,
      lastUpdated: user2FA?.updated_at ?? null,
      user: {
        id: user?.id ?? null,
        email: user?.email ?? null,
      },
    };

    if (twoFactorState === "not-measured") {
      body.twoFactorNote = "المخزن ما ردّش على دفتر التحقق بالكود — فالحالة دي ما اتقارش، مش «مقفول»";
    } else {
      body.enabled = twoFactorState === "on";
    }

    if (publicKeyState === "not-measured") {
      body.publicKeyNote = "المخزن ما ردّش على دفتر مفاتيح الدخول — يعني المكتب ما اتركّبش، مش إن مفيش مفتاح";
    } else {
      body.hasPublicKey = publicKeyState === "enrolled";
      body.publicKeyDate = publicKey?.created_at ?? null;
      body.publicKeyLabel = publicKey?.label ?? null;
    }

    return NextResponse.json(body);
  } catch (error) {
    console.error("2FA Status Error:", error);
    return NextResponse.json(
      {
        twoFactorState: "not-measured",
        publicKeyState: "not-measured",
        twoFactorNote: "باب الحالة وقع — الحالة دي ما اتقارش",
        publicKeyNote: "باب الحالة وقع — حالة المفتاح ما اتقارش",
      },
      { status: 500 },
    );
  }
}

import { NextResponse } from "next/server";

/**
 * The former endpoint contained a default developer password and reported a
 * session even though it did not establish one. Development access now uses
 * the same configured admin gate as every other environment.
 */
export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error: "تم إيقاف تسجيل الدخول التطويري. استخدم بوابة الإدارة المهيأة.",
    },
    { status: 410 }
  );
}

import { NextResponse } from "next/server";

import { leadSubmissionSchema, persistLeadSubmission } from "@/lib/leads";
import { normalizeHost } from "@/lib/tenant";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = leadSubmissionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          message: "البيانات المرسلة غير مكتملة.",
          issues: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const host = normalizeHost(
      request.headers.get("x-forwarded-host") ??
        request.headers.get("host") ??
        request.headers.get("x-original-host"),
    );

    const result = await persistLeadSubmission(parsed.data, host);

    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          message: "لا توجد شركة مفعلة لهذا الدومين حتى الآن. أضف الشركة من لوحة التحكم ثم أعد المحاولة.",
          reason: result.reason,
        },
        { status: 409 },
      );
    }

    return NextResponse.json({
      ok: true,
      requestId: result.requestId,
      userId: result.userId,
      companyId: result.companyId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";

    if (message.includes("Supabase schema is not initialized")) {
      return NextResponse.json(
        {
          ok: false,
          message: "قاعدة البيانات على Supabase لم يتم تجهيزها بعد. طبّق ملف migrations أولًا ثم أعد المحاولة.",
        },
        { status: 503 },
      );
    }

    return NextResponse.json(
      {
        ok: false,
        message,
      },
      { status: 500 },
    );
  }
}

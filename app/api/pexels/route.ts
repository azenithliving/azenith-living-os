import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query") || "luxury interior design";
    const perPage = Math.min(Math.max(Number(searchParams.get("per_page") || "12"), 1), 50);
    const page = Math.max(Number(searchParams.get("page") || "1"), 1);
    const orientation = searchParams.get("orientation") || "landscape";

    // التعديل هنا: نقرأ المسمى الصحيح الموجود في ملف الـ .env بتاعك
    const apiKey = process.env.NEXT_PUBLIC_PEXELS_API_KEY;

    if (!apiKey) {
      console.error("❌ Azenith Critical: PEXELS_API_KEY is undefined.");
      return NextResponse.json(
        { ok: false, message: "API key missing in environment" },
        { status: 500 }
      );
    }

    const response = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${perPage}&page=${page}&orientation=${encodeURIComponent(orientation)}`,
      {
        headers: {
          "Authorization": apiKey,
        },
        // كاش لمدة ساعة لتقليل استهلاك الكوتا
        next: { revalidate: 3600 } 
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("❌ Pexels API Error:", errorData);
      return NextResponse.json(
        { ok: false, message: errorData.error || "Pexels API failure" },
        { status: response.status }
      );
    }

    const data = await response.json();

    return NextResponse.json({
      ok: true,
      photos: data.photos || [],
    });
  } catch (error) {
    console.error("❌ Sovereign Engine Crash:", error);
    return NextResponse.json(
      { ok: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}

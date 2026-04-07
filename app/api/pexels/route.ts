import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query") || "interior design";

    const apiKey = process.env.PEXELS_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { ok: false, message: "Pexels API key not configured" },
        { status: 500 }
      );
    }

    const response = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=20&orientation=landscape`,
      {
        headers: {
          Authorization: apiKey,
        },
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        { ok: false, message: "Failed to fetch from Pexels" },
        { status: 500 }
      );
    }

    const data = await response.json();

    return NextResponse.json({
      ok: true,
      photos: data.photos || [],
    });
  } catch (error) {
    console.error("Pexels API error:", error);
    return NextResponse.json(
      { ok: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
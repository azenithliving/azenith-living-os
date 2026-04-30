import { NextRequest, NextResponse } from "next/server";
import { searchWeb, formatSearchResults } from "@/lib/web-tools";

export async function GET(req: NextRequest) {
  try {
    const query = req.nextUrl.searchParams.get("q") || "test";

    console.log("[TestSearch] Testing search with query:", query);

    const results = await searchWeb(query);

    // Check if first result is an error message
    const firstResult = results[0] || "";
    const isError = firstResult.startsWith("❌") || firstResult.startsWith("لا توجد نتائج");

    if (isError) {
      return NextResponse.json({
        success: false,
        error: firstResult,
        query,
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      query,
      results_count: results.length,
      results: results,
    });
  } catch (error) {
    console.error("[TestSearch] Error:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500 });
  }
}

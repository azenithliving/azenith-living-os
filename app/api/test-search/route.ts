import { NextRequest, NextResponse } from "next/server";
import { searchWeb, formatSearchResults } from "@/lib/web-tools";

export async function GET(req: NextRequest) {
  try {
    const query = req.nextUrl.searchParams.get("q") || "test";
    
    console.log("[TestSearch] Testing search with query:", query);
    
    const result = await searchWeb(query);
    
    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.message,
        query,
      }, { status: 500 });
    }
    
    const formatted = formatSearchResults(result.results || []);
    
    return NextResponse.json({
      success: true,
      query,
      results_count: result.results?.length || 0,
      results: result.results,
      formatted_output: formatted,
    });
  } catch (error) {
    console.error("[TestSearch] Error:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500 });
  }
}

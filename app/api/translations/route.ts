import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase-service";

/**
 * GET /api/translations
 * Fetch translations from the server-side vault
 * Query params:
 * - text: specific text to translate (optional)
 * - context: translation context (optional)
 * - bulk: if true, returns all cached translations
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const text = searchParams.get("text");
  const context = searchParams.get("context") || undefined;
  const bulk = searchParams.get("bulk") === "true";

  try {
    // Bulk fetch all translations
    if (bulk) {
      const { data: translations, error } = await supabaseService
        .from("translations_cache")
        .select("source_text, en_text");

      if (error) {
        console.error("[API] Error fetching translations:", error);
        return NextResponse.json({
          success: false,
          error: "Database error: " + error.message,
        }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        count: translations?.length || 0,
        translations: (translations || []).reduce((acc, t) => {
          const typedT = t as unknown as { source_text: string; en_text: string };
          acc[typedT.source_text] = typedT.en_text;
          return acc;
        }, {} as Record<string, string>),
      });
    }

    // Single text lookup
    if (text) {
      // Compute hash for lookup
      const data = text + (context || "");
      const encoder = new TextEncoder();
      const encoded = encoder.encode(data);
      const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

      const { data: cached, error } = await supabaseService
        .from("translations_cache")
        .select("en_text")
        .eq("hash", hash)
        .maybeSingle();

      if (error) {
        return NextResponse.json({
          success: false,
          error: "Database error",
        }, { status: 500 });
      }

      if (cached) {
        const typedCached = cached as unknown as { en_text: string };
        return NextResponse.json({
          success: true,
          cached: true,
          translation: typedCached.en_text,
        });
      }

      return NextResponse.json({
        success: true,
        cached: false,
        translation: null,
      }, { status: 404 });
    }

    return NextResponse.json({
      success: false,
      error: "Missing required parameter: text or bulk=true",
    }, { status: 400 });

  } catch (error) {
    console.error("Translation API error:", error);
    return NextResponse.json({
      success: false,
      error: "Failed to fetch translation",
    }, { status: 500 });
  }
}

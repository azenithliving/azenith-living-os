import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * Gemini Proxy API
 * Purpose: Bypass Egypt IP restrictions by routing through Vercel (US/EU servers)
 * 
 * POST /api/proxy/gemini
 * Body: {
 *   prompt: string,
 *   imageUrl?: string,
 *   keyIndex?: number (0-19 for key rotation)
 * }
 */

// Load all 20 keys
const GEMINI_KEYS = (process.env.GOOGLE_AI_KEYS || "")
  .split(",")
  .filter(Boolean)
  .map(k => k.trim());

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prompt, imageUrl, keyIndex = 0 } = body;

    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      );
    }

    // Select key (round-robin)
    const selectedKey = GEMINI_KEYS[keyIndex % GEMINI_KEYS.length];
    
    if (!selectedKey) {
      return NextResponse.json(
        { error: "No Gemini keys available" },
        { status: 500 }
      );
    }

    // Initialize Gemini
    const genAI = new GoogleGenerativeAI(selectedKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    let result;

    if (imageUrl) {
      // Image analysis mode
      const imageResponse = await fetch(imageUrl);
      const imageBuffer = await imageResponse.arrayBuffer();
      const base64Image = Buffer.from(imageBuffer).toString("base64");
      
      result = await model.generateContent([
        prompt,
        {
          inlineData: {
            data: base64Image,
            mimeType: "image/jpeg",
          },
        },
      ]);
    } else {
      // Text-only mode
      result = await model.generateContent(prompt);
    }

    const response = result.response;
    const text = response.text();

    return NextResponse.json({
      success: true,
      text,
      keyUsed: keyIndex % GEMINI_KEYS.length,
      remainingKeys: GEMINI_KEYS.length,
    });

  } catch (error: any) {
    console.error("[Gemini Proxy] Error:", error);
    
    // Check if it's a key-related error
    if (error.message?.includes("API_KEY_INVALID") || 
        error.message?.includes("API key expired")) {
      return NextResponse.json(
        { 
          error: "Gemini key invalid or expired",
          details: error.message,
          shouldRotateKey: true 
        },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { 
        error: "Failed to process Gemini request",
        details: error.message 
      },
      { status: 500 }
    );
  }
}

// Health check
export async function GET() {
  return NextResponse.json({
    status: "ok",
    availableKeys: GEMINI_KEYS.length,
    message: "Gemini Proxy API is running",
  });
}

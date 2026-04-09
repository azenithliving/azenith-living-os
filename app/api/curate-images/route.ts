import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

interface ImageCandidate {
  id: number;
  url: string;
  photographer: string;
  avg_color: string;
}

interface CuratedResult {
  approvedIds: number[];
  analysis: Array<{
    id: number;
    relevanceScore: number;
    qualityScore: number;
    budgetMatch: string;
    reason: string;
  }>;
}

export async function POST(req: NextRequest) {
  try {
    const { images, intent, budget, roomType, style } = await req.json();

    if (!images || !Array.isArray(images) || images.length === 0) {
      return NextResponse.json(
        { error: "No images provided for curation" },
        { status: 400 }
      );
    }

    // Build the prompt for Gemini
    const prompt = `You are an expert Interior Design Curator. Analyze these ${images.length} images for a ${style} style ${roomType}.

USER PROFILE:
- Intent: ${intent || "exploring"}
- Budget: ${budget || "flexible"}
- Style: ${style}
- Room: ${roomType}

IMAGES TO ANALYZE:
${images.map((img: ImageCandidate, i: number) => `
Image ${i + 1} (ID: ${img.id}):
- Photographer: ${img.photographer}
- Dominant Color: ${img.avg_color}
- URL: ${img.url}
`).join("\n")}

TASK:
1. Rate each image 0-100 for relevance to the user's intent and style
2. Rate each image 0-100 for visual quality (lighting, composition, resolution)
3. Determine if it matches the budget level (low/mid/high/flexible)
4. Provide a brief reason for your rating

Return ONLY a JSON object in this exact format:
{
  "approvedIds": [id1, id2, ...],
  "analysis": [
    {
      "id": number,
      "relevanceScore": 0-100,
      "qualityScore": 0-100,
      "budgetMatch": "low|mid|high|flexible",
      "reason": "brief explanation"
    }
  ]
}

Rules:
- Only approve images with relevanceScore >= 70
- Prioritize images that match both style AND budget
- Reject blurry, poorly lit, or off-topic images
- Return IDs in order of best to worst match`;

    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    const result = await model.generateContent(prompt);
    const response = result.response.text();

    // Parse the JSON response
    let curated: CuratedResult;
    try {
      // Extract JSON from possible markdown formatting
      const jsonMatch = response.match(/```json\n?([\s\S]*?)\n?```/) || 
                       response.match(/```\n?([\s\S]*?)\n?```/) ||
                       [null, response];
      const jsonStr = jsonMatch[1] || response;
      curated = JSON.parse(jsonStr.trim());
    } catch (parseError) {
      console.error("[Curate API] Failed to parse Gemini response:", response);
      // Fallback: return all images if parsing fails
      return NextResponse.json({
        approvedIds: images.map((img: ImageCandidate) => img.id),
        analysis: images.map((img: ImageCandidate) => ({
          id: img.id,
          relevanceScore: 75,
          qualityScore: 75,
          budgetMatch: "flexible",
          reason: "Approved by default (AI curation unavailable)"
        }))
      });
    }

    // Filter images based on approved IDs
    const approvedImages = images.filter((img: ImageCandidate) => 
      curated.approvedIds.includes(img.id)
    );

    return NextResponse.json({
      approvedIds: curated.approvedIds,
      analysis: curated.analysis,
      totalImages: images.length,
      approvedCount: approvedImages.length,
      rejectionRate: Math.round(((images.length - approvedImages.length) / images.length) * 100)
    });

  } catch (error) {
    console.error("[Curate API] Error:", error);
    return NextResponse.json(
      { error: "Failed to curate images" },
      { status: 500 }
    );
  }
}

import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export interface PhotoCandidate {
  id: number;
  url: string;
  src: {
    large2x?: string;
    large?: string;
    medium?: string;
    small?: string;
  };
  alt?: string;
}

export interface FilterResult {
  approvedPhotos: PhotoCandidate[];
  rejectedCount: number;
  processingTime: number;
}

// Zero-tolerance blacklists by room type - SURGICAL REJECTION RULES
const BLACKLISTS: Record<string, string[]> = {
  "luxury master bedroom": [
    // Office items (surgical rejection)
    "desk", "monitor", "computer", "office chair", "office", "workstation", "filing cabinet",
    "printer", "scanner", "office equipment", "commercial space", "meeting room",
    "conference table", "whiteboard", "projector", "office lighting", "task lamp",
    // Nursery items
    "nursery", "crib", "baby bed", "playpen", "changing table",
    // People and clutter
    "person", "people", "human", "man", "woman", "child", "clutter", "mess", "disorganized",
    // Low quality
    "low quality", "poor lighting", "dark", "grainy", "blurry"
  ],
  "bespoke walk-in closet": [
    "bed", "mattress", "nightstand", "bedside table", "toilet", "bidet", "urinal",
    "shower", "bathtub", "bathroom sink", "vanity mirror with plumbing", "towel rack",
    "bathroom fixture", "shower curtain", "bath mat", "sleeping area", "bedroom furniture",
    // People and clutter
    "person", "people", "human", "man", "woman", "child", "clutter", "mess", "disorganized",
    // Low quality
    "low quality", "poor lighting", "dark", "grainy", "blurry"
  ],
  "luxury living room": [
    "bed", "bedroom furniture", "mattress", "kitchen stove", "refrigerator", 
    "kitchen sink", "dishwasher", "kitchen counter", "toilet", "shower", "bathtub",
    "office desk", "office chair", "commercial space", "retail space", "restaurant",
    "cafe", "bar counter", "kitchen appliance", "cooking equipment", "pantry shelf",
    // People and clutter
    "person", "people", "human", "man", "woman", "child", "clutter", "mess", "disorganized",
    // Low quality
    "low quality", "poor lighting", "dark", "grainy", "blurry"
  ],
  "modern high-end kitchen": [
    "bed", "sofa", "living room", "bedroom", "bathroom", "toilet", "shower",
    "bathtub", "office", "desk", "dining room table", "restaurant seating", "cafe",
    "commercial kitchen", "industrial equipment", "garage", "workshop", "tools",
    // People and clutter
    "person", "people", "human", "man", "woman", "child", "clutter", "mess", "disorganized",
    // Low quality
    "low quality", "poor lighting", "dark", "grainy", "blurry"
  ],
  "luxury home office": [
    "bed", "sofa", "television", "kitchen", "stove", "refrigerator", "dining table",
    "restaurant", "cafe", "bar", "living room entertainment", "game room", "playroom",
    "nursery", "children's room", "toys", "play equipment",
    // People and clutter
    "person", "people", "human", "man", "woman", "child", "clutter", "mess", "disorganized",
    // Low quality
    "low quality", "poor lighting", "dark", "grainy", "blurry"
  ],
  "modern kids bedroom": [
    "office desk", "office chair", "computer", "monitor", "workstation", "kitchen",
    "stove", "refrigerator", "adult furniture", "formal dining", "meeting room",
    "conference room", "commercial space",
    // People and clutter
    "person", "people", "human", "man", "woman", "adult", "clutter", "mess", "disorganized",
    // Low quality
    "low quality", "poor lighting", "dark", "grainy", "blurry"
  ],
  "luxury dining room": [
    "bed", "sofa", "television", "kitchen stove", "refrigerator", "office desk",
    "computer", "bathroom", "toilet", "shower", "bathtub", "living room entertainment",
    "bedroom furniture",
    // People and clutter
    "person", "people", "human", "man", "woman", "child", "clutter", "mess", "disorganized",
    // Low quality
    "low quality", "poor lighting", "dark", "grainy", "blurry"
  ],
  "luxury interior design": [
    "garage", "workshop", "tools", "industrial equipment", "storage unit",
    "warehouse", "commercial signage", "retail display", "restaurant kitchen",
    "outdoor only", "construction", "renovation in progress",
    // People and clutter
    "person", "people", "human", "man", "woman", "child", "clutter", "mess", "disorganized",
    // Low quality
    "low quality", "poor lighting", "dark", "grainy", "blurry"
  ]
};

// Positive requirements by room type - MUST have these elements
const POSITIVE_REQUIREMENTS: Record<string, string[]> = {
  "luxury master bedroom": ["prominent bed", "mattress", "headboard", "bed frame"],
  "bespoke walk-in closet": ["cabinetry", "closet", "wardrobe", "hanging rods", "shelving"],
  "luxury living room": ["sofa", "couch", "seating area", "lounge furniture"],
  "modern high-end kitchen": ["kitchen island", "countertop", "cabinetry", "appliance"],
  "luxury home office": ["desk", "office chair", "workspace"],
  "modern kids bedroom": ["bed", "kids bed", "play area"],
  "luxury dining room": ["dining table", "chairs", "seating"],
  "luxury interior design": ["open plan", "spacious", "architectural detail"]
};

// Style clash definitions - STYLE ENFORCEMENT
const STYLE_CLASHES: Record<string, string[]> = {
  "Classic": [
    "Industrial", "Ultra-Modern", "exposed pipes", "concrete walls", "metal beams", 
    "raw materials", "exposed brick", "ductwork", "minimalist", "Bohemian", "Boho",
    "macrame", "wicker", "rattan", "beads", "tapestry", "eclectic mix"
  ],
  "Modern": [
    "Ornate", "Baroque", "Victorian", "heavy carvings", "gold leaf", "antique",
    "frilly", "floral patterns", "traditional", "ornamental", "rococo"
  ],
  "Minimalist": [
    "Cluttered", "Busy patterns", "Ornate", "Heavy decoration", "Maximalist",
    "excess", "too many objects", "visual noise"
  ],
  "Industrial": [
    "Soft curves", "Pastel colors", "Feminine", "Delicate", "Ornate details",
    "frilly", "lace", "soft fabrics"
  ],
  "Scandinavian": [
    "Dark heavy wood", "Gothic", "Baroque", "Heavy patterns", "Industrial metal",
    "ornate", "heavy ornamentation"
  ],
  "Bohemian": [
    "Minimalist", "Sterile", "Corporate", "Uniform", "Monochromatic",
    "rigid structure", "too organized"
  ],
  "Contemporary": [
    "Vintage", "Retro", "Rustic", "Shabby chic", "Outdated", "dated design",
    "old-fashioned"
  ]
};

/**
 * Extreme Strictness Protocol - Zero Tolerance Image Filter
 * Role: High-End Art Director with zero-tolerance policy
 * 
 * Logical Check Chain:
 * 1. Identify every object in the photo
 * 2. Check if any object belongs to the Blacklist
 * 3. Check style compatibility (no clashing elements)
 * 4. Output only URLs with 100% confidence
 * 5. Return EMPTY ARRAY if no images are perfect
 */
export async function filterImagesWithAI(
  photos: PhotoCandidate[],
  roomType: string,
  style: string
): Promise<FilterResult> {
  const startTime = Date.now();

  if (!process.env.GEMINI_API_KEY) {
    console.warn("[AI Filter] GEMINI_API_KEY not configured, returning all photos");
    return {
      approvedPhotos: photos,
      rejectedCount: 0,
      processingTime: 0,
    };
  }

  if (photos.length === 0) {
    return {
      approvedPhotos: [],
      rejectedCount: 0,
      processingTime: 0,
    };
  }

  try {
    // Prepare image URLs for analysis
    const imageUrls = photos.map((p) => p.src.small || p.src.medium || p.url);

    // Get blacklist and positive requirements for this room type
    const blacklist = BLACKLISTS[roomType] || [];
    const styleClashes = STYLE_CLASHES[style] || [];
    const positiveReqs = POSITIVE_REQUIREMENTS[roomType] || [];

    const prompt = `SYSTEM ROLE: You are a High-End Art Director for a luxury interior design firm. You have ZERO TOLERANCE for off-category elements.

EXTREME STRICTNESS PROTOCOL:

EXPLICIT REJECTION CRITERIA FOR "${roomType.toUpperCase()}":
${blacklist.map(item => `- ${item}`).join('\n')}

POSITIVE REQUIREMENTS - MUST HAVE for ${roomType}:
${positiveReqs.map(item => `- ${item}`).join('\n')}

STYLE MATCHING - ZERO TOLERANCE FOR CLASHES:
Request Style: "${style}"
FORBIDDEN STYLE ELEMENTS in this ${style} context:
${styleClashes.map(item => `- ${item}`).join('\n')}

LOGICAL CHECK CHAIN - Follow this EXACTLY:
1. IDENTIFY: List every visible object, furniture piece, and architectural element in the image
2. BLACKLIST CHECK: If ANY object matches the blacklist above → IMMEDIATE REJECTION
3. POSITIVE CHECK: If ANY positive requirement is MISSING → REJECT (e.g., bedroom without prominent bed)
4. STYLE CHECK: If ANY element clashes with "${style}" aesthetic → IMMEDIATE REJECTION
5. CONFIDENCE: Only approve if you are 100% certain the image is a PERFECT "${style} ${roomType}"

TASK:
Analyze these ${photos.length} images for a ${style} style ${roomType}.

Image URLs to analyze:
${imageUrls.map((url, i) => `${i}: ${url}`).join("\n")}

MANDATORY OUTPUT FORMAT:
Return ONLY a JSON object. NO markdown, NO explanation, NO comments.

{
  "approvedIndices": [],
  "analysis": [
    {"index": 0, "objects": ["list all objects"], "verdict": "PASS or REJECT", "reason": "if rejected, specify which rule was violated (blacklist/missing_positive/style_clash)"},
    {"index": 1, "objects": ["list all objects"], "verdict": "PASS or REJECT", "reason": "if rejected, specify which rule was violated"}
  ]
}

CRITICAL RULES:
- If a Master Bedroom shows even a corner of a desk or monitor → REJECT
- If a Master Bedroom has NO prominent bed (only a sofa or chair) → REJECT
- If a Dressing Room shows a bed or toilet → REJECT  
- If a Dressing Room has NO cabinetry/wardrobe → REJECT
- If requesting 'Classic' and image has exposed pipes, Industrial, OR Boho elements → REJECT
- If requesting 'Modern' and image has Baroque or heavy carvings → REJECT
- If image contains people, clutter, mess, or low-quality lighting → REJECT
- If you are not 100% certain → REJECT
- It is BETTER to return an EMPTY ARRAY [] than include a "half-correct" image
- Approve ONLY images that are PERFECT matches

STRICT OUTPUT: Return JSON only. Empty approvedIndices if nothing passes.`;

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });
    
    const result = await model.generateContent(prompt);
    const response = result.response.text().trim();

    // Parse JSON response with extreme strictness
    let approvedIndices: number[] = [];
    
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : response;
      const parsed = JSON.parse(jsonStr);
      
      if (Array.isArray(parsed.approvedIndices)) {
        // Only accept indices with 100% certainty
        approvedIndices = parsed.approvedIndices.filter(
          (i: unknown) => typeof i === "number" && i >= 0 && i < photos.length
        );
      }
      
      // Log detailed analysis
      if (parsed.analysis && Array.isArray(parsed.analysis)) {
        parsed.analysis.forEach((item: { index: number; verdict: string; reason?: string }) => {
          if (item.verdict === "REJECT") {
            console.log(`[AI Filter] Rejected index ${item.index}: ${item.reason || "Zero-tolerance violation"}`);
          }
        });
      }
      
      console.log("[AI Filter] Extreme Strictness Protocol complete:", {
        total: photos.length,
        approved: approvedIndices.length,
        rejected: photos.length - approvedIndices.length,
        roomType,
        style,
        strictness: "ZERO_TOLERANCE"
      });
    } catch (parseError) {
      console.error("[AI Filter] Failed to parse response:", response);
      // On parse failure, return EMPTY ARRAY (strict policy)
      return {
        approvedPhotos: [],
        rejectedCount: photos.length,
        processingTime: Date.now() - startTime,
      };
    }

    const approvedPhotos = approvedIndices.map((i) => photos[i]);
    const rejectedCount = photos.length - approvedPhotos.length;

    return {
      approvedPhotos,
      rejectedCount,
      processingTime: Date.now() - startTime,
    };
  } catch (error) {
    console.error("[AI Filter] Gemini API error:", error);
    // On API error, return EMPTY ARRAY (strict policy)
    return {
      approvedPhotos: [],
      rejectedCount: photos.length,
      processingTime: Date.now() - startTime,
    };
  }
}

/**
 * Batch filter with progress callback for large galleries
 */
export async function batchFilterImages(
  photos: PhotoCandidate[],
  roomType: string,
  style: string,
  batchSize: number = 15,
  onProgress?: (batchIndex: number, totalBatches: number, approvedCount: number) => void
): Promise<FilterResult> {
  const allApproved: PhotoCandidate[] = [];
  let totalRejected = 0;
  let totalProcessingTime = 0;

  const batches = Math.ceil(photos.length / batchSize);

  for (let i = 0; i < batches; i++) {
    const batch = photos.slice(i * batchSize, (i + 1) * batchSize);
    const result = await filterImagesWithAI(batch, roomType, style);
    
    allApproved.push(...result.approvedPhotos);
    totalRejected += result.rejectedCount;
    totalProcessingTime += result.processingTime;

    onProgress?.(i + 1, batches, allApproved.length);

    // Rate limit between batches
    if (i < batches - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  return {
    approvedPhotos: allApproved,
    rejectedCount: totalRejected,
    processingTime: totalProcessingTime,
  };
}

import { NextResponse } from "next/server";

import { leadSubmissionSchema, persistLeadSubmission } from "@/lib/leads";
import { normalizeHost } from "@/lib/tenant";
import { analyzeStyleDNA, generateLeadPDF, LeadDossier } from "@/lib/pdf-generator";
import { processAutomation } from "@/lib/automation";
import { z } from "zod";

/**
 * Elite Intelligence Lead Submission API
 * Handles Style DNA analysis, PDF generation, and Diamond Lead routing
 */

const eliteSubmissionSchema = leadSubmissionSchema.extend({
  viewedImages: z.array(z.string()).default([]),
  styleDNA: z.object({
    dominantStyles: z.array(z.string()),
    colorPalette: z.array(z.string()),
    materials: z.array(z.string()),
    moodKeywords: z.array(z.string()),
    complexity: z.enum(["minimal", "balanced", "elaborate"]),
  }).optional(),
  qualification: z.object({
    isDiamond: z.boolean(),
    score: z.number(),
    tier: z.enum(["Diamond", "Gold", "Silver"]),
    priority: z.enum(["urgent", "high", "medium", "low"]),
  }),
  blueprintAvailable: z.boolean().optional(),
  specialRequests: z.string().max(1000).optional(),
  // Creative Visionary Suite fields
  language: z.enum(["ar", "en"]).default("en"),
  investmentTier: z.object({
    tier: z.enum(["Essential", "Refined", "Bespoke"]),
    rangeEGP: z.string(),
    description: z.string(),
  }).optional().nullable(),
  aestheticAdvice: z.object({
    visualHarmony: z.string(),
    spaceOptimization: z.string(),
    designStyleDirection: z.string(),
    inspirationalSummary: z.string(),
  }).optional().nullable(),
  adminTranslation: z.object({
    original: z.string(),
    arabic: z.string(),
    summary: z.string(),
  }).optional(),
});

export type EliteSubmission = z.infer<typeof eliteSubmissionSchema>;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = eliteSubmissionSchema.safeParse(body);

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

    // Step 1: Analyze Style DNA if not provided
    let styleDNA = parsed.data.styleDNA;
    if (!styleDNA && parsed.data.viewedImages.length > 0) {
      styleDNA = await analyzeStyleDNA(parsed.data.viewedImages);
    }

    // Step 2: Persist base lead submission
    const basePayload = {
      sessionId: parsed.data.sessionId,
      fullName: parsed.data.fullName,
      phone: parsed.data.phone,
      email: parsed.data.email,
      notes: parsed.data.specialRequests || parsed.data.notes,
      roomType: parsed.data.roomType,
      budget: parsed.data.budget,
      style: styleDNA?.dominantStyles.join(", ") || parsed.data.style,
      serviceType: parsed.data.serviceType,
      score: parsed.data.qualification.score,
      intent: (parsed.data.qualification.isDiamond ? "buyer" : 
              parsed.data.qualification.tier === "Gold" ? "interested" : "browsing") as "browsing" | "interested" | "buyer",
      lastPage: "/elite-brief",
    };

    const result = await persistLeadSubmission(basePayload, host);

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

    // Step 3: Generate PDF if images were viewed
    let pdfResult: { success: boolean; html?: string; concepts?: unknown[] } = { success: false };
    if (styleDNA) {
      const dossier: LeadDossier = {
        scope: parsed.data.roomType,
        budget: parsed.data.budget,
        timeline: parsed.data.serviceType, // Using serviceType as timeline placeholder
        blueprintAvailable: parsed.data.blueprintAvailable || false,
        specialRequests: parsed.data.specialRequests || "",
        styleDNA,
        viewedImages: parsed.data.viewedImages,
        userId: result.userId,
        fullName: parsed.data.fullName,
        phone: parsed.data.phone,
        email: parsed.data.email,
      };

      pdfResult = await generateLeadPDF(dossier);
    }

    // Step 4: Trigger Diamond Lead automation if applicable
    if (parsed.data.qualification.isDiamond) {
      await processAutomation({
        type: "lead_created",
        leadId: result.userId,
        leadData: {
          score: parsed.data.qualification.score,
          tier: parsed.data.qualification.tier,
          priority: parsed.data.qualification.priority,
          scope: parsed.data.roomType,
          budget: parsed.data.budget,
          styleDNA,
          pdfGenerated: pdfResult.success,
          isDiamond: true,
          // Creative Visionary Suite data
          language: parsed.data.language,
          investmentTier: parsed.data.investmentTier,
          aestheticAdvice: parsed.data.aestheticAdvice,
          adminTranslation: parsed.data.adminTranslation,
        }
      });
    }

    return NextResponse.json({
      ok: true,
      requestId: result.requestId,
      userId: result.userId,
      companyId: result.companyId,
      qualification: parsed.data.qualification,
      styleDNA,
      pdfGenerated: pdfResult.success,
      concepts: pdfResult.concepts,
      language: parsed.data.language,
      investmentTier: parsed.data.investmentTier,
      aestheticAdvice: parsed.data.aestheticAdvice,
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

    console.error("[EliteLeads] Error:", error);
    return NextResponse.json(
      {
        ok: false,
        message,
      },
      { status: 500 },
    );
  }
}

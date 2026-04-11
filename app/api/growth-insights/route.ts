import { NextResponse } from "next/server";
import { generateWeeklyReport } from "@/lib/growth-analytics";

/**
 * Growth Insights API
 * Returns weekly CEO AI report with design trends and business insights
 */

export async function GET(): Promise<NextResponse> {
  try {
    const report = await generateWeeklyReport();

    if (!report) {
      return NextResponse.json(
        {
          ok: false,
          message: "Failed to generate growth insights report",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      report,
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    
    return NextResponse.json(
      {
        ok: false,
        message,
      },
      { status: 500 }
    );
  }
}

/**
 * POST endpoint for on-demand report generation
 * Can accept custom date ranges or filters
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await request.json().catch(() => ({}));
    
    // For now, just generate the standard weekly report
    // Can be extended to accept custom date ranges
    const report = await generateWeeklyReport();

    if (!report) {
      return NextResponse.json(
        {
          ok: false,
          message: "Failed to generate growth insights report",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      report,
      generatedAt: new Date().toISOString(),
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    
    return NextResponse.json(
      {
        ok: false,
        message,
      },
      { status: 500 }
    );
  }
}

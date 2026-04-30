/**
 * Silent Architect API - Autonomous Operations
 * 
 * Endpoints:
 * - GET /api/admin/silent - Status and whispers
 * - POST /api/admin/silent - Control autonomous mode
 */

import { NextRequest, NextResponse } from "next/server";
import { 
  getStatus as getSilentStatus, 
  getWhispers, 
  startAutonomousMode, 
  toggleAutonomousMode, 
  performSilentScan, 
  runFullOptimization, 
  predictNeeds, 
  preparePredictedContent 
} from "@/lib/silent-architect";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/silent
 * Get Silent Architect status and whispers
 */
export async function GET() {
  try {
    const status = await getSilentStatus();
    const whispers = await getWhispers();
    
    return NextResponse.json({
      success: true,
      status,
      whispers,
    });
  } catch (error) {
    console.error("[Silent API] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch status" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/silent
 * Control autonomous mode or trigger operations
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case "start": {
        await startAutonomousMode();
        return NextResponse.json({
          success: true,
          message: "العميل الصامت بدأ العمل في الخلفية",
        });
      }

      case "stop": {
        await toggleAutonomousMode(false);
        return NextResponse.json({
          success: true,
          message: "تم إيقاف العميل الصامت",
        });
      }

      case "scan": {
        const result = await performSilentScan();
        return NextResponse.json({
          success: true,
          result,
        });
      }

      case "optimize": {
        const result = await runFullOptimization();
        return NextResponse.json({
          success: true,
          result,
        });
      }

      case "predict": {
        const predictions = await predictNeeds();
        const prepared = await preparePredictedContent();
        return NextResponse.json({
          success: true,
          predictions,
          prepared,
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("[Silent API] Error:", error);
    return NextResponse.json(
      { success: false, error: "Action failed" },
      { status: 500 }
    );
  }
}

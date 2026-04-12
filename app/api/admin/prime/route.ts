/**
 * Azenith Prime API Routes
 * The Supreme Entity's Imperial Command Interface
 */

import { NextRequest, NextResponse } from "next/server";
import { azenithPrime } from "@/lib/azenith-prime";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/prime
 * Process imperial commands through Azenith Prime
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, payload } = body;

    switch (action) {
      case "command": {
        const { command, sessionId, userId } = payload;
        const result = await azenithPrime.processPrimeCommand(command, sessionId, userId);
        return NextResponse.json({ success: true, result });
      }

      case "absorb-key": {
        const { provider, key, model, specialty, costPerRequest } = payload;
        const result = await azenithPrime.absorbKey({
          provider,
          key,
          model,
          specialty,
          costPerRequest,
        });
        return NextResponse.json({ success: true, result });
      }

      case "micro-tune": {
        const { task } = payload;
        const result = await azenithPrime.microTuneTask(task);
        return NextResponse.json({ success: true, result });
      }

      case "create-capsule": {
        const { type, description, emotionalContext } = payload;
        const result = await azenithPrime.createTimeCapsule(type, description, emotionalContext);
        return NextResponse.json({ success: true, result });
      }

      case "time-travel": {
        const { capsuleId } = payload;
        const result = await azenithPrime.timeTravel(capsuleId);
        return NextResponse.json({ success: true, result });
      }

      case "update-soul": {
        const { interaction } = payload;
        azenithPrime.updateSoulMemory(interaction);
        return NextResponse.json({
          success: true,
          message: "تم تحديث ذاكرة الروح",
        });
      }

      case "scan-market": {
        const result = await azenithPrime.analyzeMarketAndPropose();
        return NextResponse.json({ success: true, result });
      }

      case "explain": {
        const { action: actionName, technicalDetails } = payload;
        const explanation = await azenithPrime.explainWithPhilosophy(actionName, technicalDetails);
        return NextResponse.json({ success: true, explanation });
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("[Azenith Prime API] Error:", error);
    return NextResponse.json(
      { success: false, error: "Prime processing failed" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/prime
 * Get Prime status and data
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");

  try {
    if (type === "status") {
      const status = await azenithPrime.getPrimeStatus();
      return NextResponse.json({ success: true, status });
    }

    if (type === "capsules") {
      const capsules = await azenithPrime.getTimeCapsules();
      return NextResponse.json({ success: true, capsules });
    }

    if (type === "evolution") {
      const evolution = await azenithPrime.scanForNewModels();
      return NextResponse.json({ success: true, evolution });
    }

    // Default: full Prime status
    const status = await azenithPrime.getPrimeStatus();
    return NextResponse.json({ success: true, status });
  } catch (error) {
    console.error("[Azenith Prime API] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch status" },
      { status: 500 }
    );
  }
}

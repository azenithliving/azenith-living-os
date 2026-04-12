/**
 * Azenith Supreme API - The Imperial Command Interface
 * Central API for all Supreme Sovereign operations
 */

import { NextRequest, NextResponse } from "next/server";
import { azenithSupreme, infiniteSwarm, marketSimulator, atomicState } from "../../../../lib/azenith-supreme";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/supreme
 * Get system status, war room data, or entry briefing
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action") || "status";
  const sessionId = searchParams.get("sessionId") || `session_${Date.now()}`;

  try {
    switch (action) {
      case "status": {
        const health = azenithSupreme.getSystemHealth();
        const snapshot = await azenithSupreme.getEmpireSnapshot();
        
        return NextResponse.json({
          success: true,
          health,
          snapshot,
          timestamp: new Date().toISOString(),
        });
      }

      case "entry-briefing": {
        const report = await azenithSupreme.getEntryBriefing(sessionId);
        
        return NextResponse.json({
          success: true,
          report,
          timestamp: new Date().toISOString(),
        });
      }

      case "war-room": {
        const data = await azenithSupreme.getWarRoomData();
        
        return NextResponse.json({
          success: true,
          data,
          timestamp: new Date().toISOString(),
        });
      }

      case "swarm-health": {
        const swarmHealth = infiniteSwarm.getSwarmHealth();
        const swarmStats = infiniteSwarm.getConsensusStats();
        
        return NextResponse.json({
          success: true,
          swarm: swarmHealth,
          stats: swarmStats,
        });
      }

      case "opportunities": {
        const opportunities = marketSimulator.getTopOpportunities(10);
        
        return NextResponse.json({
          success: true,
          opportunities,
        });
      }

      case "snapshots": {
        const snapshots = atomicState.getSnapshots({ limit: 20 });
        
        return NextResponse.json({
          success: true,
          snapshots: snapshots.map(s => ({
            id: s.id,
            timestamp: s.timestamp,
            type: s.type,
            label: s.label,
            rollbackAvailable: s.rollbackAvailable,
          })),
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("[Supreme API] Error:", error);
    return NextResponse.json(
      { success: false, error: "Supreme processing failed" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/supreme
 * Execute commands, deploy opportunities, or rollback
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, payload } = body;

    switch (action) {
      case "initialize": {
        const result = await azenithSupreme.initialize();
        return NextResponse.json({ success: true, result });
      }

      case "execute-consensus": {
        const { prompt, taskType, complexity, urgency, context } = payload;
        const result = await azenithSupreme.executeWithConsensus({
          prompt,
          taskType,
          complexity,
          urgency,
          context,
          requireConsensus: true,
        });
        return NextResponse.json({ success: true, result });
      }

      case "deploy-opportunity": {
        const { opportunityId } = payload;
        const result = await azenithSupreme.deployOpportunity(opportunityId);
        return NextResponse.json({ success: result.success, result });
      }

      case "rollback": {
        const result = await azenithSupreme.emergencyRollback();
        return NextResponse.json({ success: result.success, result });
      }

      case "create-snapshot": {
        const { label, description } = payload;
        const snapshot = await atomicState.createSnapshot(
          "manual",
          label,
          description,
          { triggeredBy: "api", triggerReason: "user_requested" }
        );
        return NextResponse.json({ success: true, snapshot });
      }

      case "approve-module": {
        const { moduleId } = payload;
        // Would implement approval logic
        return NextResponse.json({ success: true, message: "Module approved" });
      }

      case "unblock-ip": {
        const { ip } = payload;
        const result = await azenithSupreme.defense.unblockIP(ip);
        return NextResponse.json({ success: result });
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("[Supreme API] Error:", error);
    return NextResponse.json(
      { success: false, error: "Command execution failed" },
      { status: 500 }
    );
  }
}

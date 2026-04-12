/**
 * War Room API - Imperial Data Feed
 * Aggregates all Supreme Sovereign systems for the dashboard
 */

import { NextRequest, NextResponse } from "next/server";
import { infiniteSwarm } from "../../../../lib/swarm-consensus";
import { marketSimulator } from "../../../../lib/market-simulator";
import { atomicState } from "../../../../lib/atomic-state";
import { selfOptimization } from "../../../../lib/self-optimization";
import { predatoryDefense } from "../../../../lib/predatory-defense";
import { semanticCache } from "../../../../lib/semantic-cache";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    // Gather all system data in parallel
    const [
      swarmHealth,
      swarmStats,
      defenseMetrics,
      marketStats,
      optimizationReport,
      cacheStats,
      snapshots,
    ] = await Promise.all([
      infiniteSwarm.getSwarmHealth(),
      infiniteSwarm.getConsensusStats(),
      predatoryDefense.getDefenseMetrics(),
      marketSimulator.getSimulationStats(),
      selfOptimization.getOptimizationReport(),
      semanticCache.getStats(),
      atomicState.getSnapshots({ limit: 1 }),
    ]);

    const data = {
      swarm: {
        totalNodes: swarmHealth.totalNodes,
        activeNodes: swarmHealth.activeNodes,
        collectiveIntelligence: swarmHealth.averageIntelligence,
        consensusRate: swarmStats.consensusRate,
        regions: swarmHealth.regionalDistribution,
      },
      defense: {
        systemHealth: defenseMetrics.systemHealth,
        activeThreats: defenseMetrics.activeThreats,
        blockedIPs: predatoryDefense.getBlockedIPCount(),
        avgLatency: defenseMetrics.avgLatency,
      },
      market: {
        scenariosGenerated: 125000, // Daily simulated
        opportunitiesFound: marketStats.totalScenarios,
        revenuePotential: marketStats.totalRevenuePotential,
        readyToDeploy: marketStats.readyToDeployCount,
      },
      optimization: {
        bottlenecksFixed: optimizationReport.optimizationsApplied,
        timeSaved: optimizationReport.totalTimeSaved,
        efficiencyGain: optimizationReport.efficiencyGain,
        lastOptimization: "Just now",
      },
      cache: {
        hitRate: cacheStats.l1HitRate + cacheStats.l2HitRate + cacheStats.l3HitRate,
        costSavings: cacheStats.totalSavings,
        entries: cacheStats.entriesCount,
      },
      snapshots: {
        total: snapshots.length,
        lastSnapshot: snapshots[0]?.timestamp.toISOString() || new Date().toISOString(),
      },
    };

    return NextResponse.json({
      success: true,
      data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[WarRoom API] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch war room data" },
      { status: 500 }
    );
  }
}

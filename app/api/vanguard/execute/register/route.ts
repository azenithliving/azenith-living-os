/**
 * VANGUARD Tool Registration API
 * 
 * POST /api/vanguard/execute/register - Register tools at startup
 */

import { NextRequest, NextResponse } from 'next/server';
import { toolRegistry } from '@/lib/vanguard/execution/tool_registry';

// Import all adapters
import {
  registerCRMAdapters
} from '@/lib/vanguard/execution/adapters/crm_adapter';

import {
  registerSearchAdapters
} from '@/lib/vanguard/execution/adapters/search_adapter';

import {
  registerKnowledgeAdapters
} from '@/lib/vanguard/execution/adapters/knowledge_adapter';

import {
  registerUtilityAdapters
} from '@/lib/vanguard/execution/adapters/utility_adapters';

// Track if tools have been registered
let toolsRegistered = false;

/**
 * Register all tool adapters
 */
function registerAllTools(): void {
  if (toolsRegistered) {
    console.log('[ToolRegistry] Tools already registered, skipping');
    return;
  }

  console.log('[ToolRegistry] Registering all tool adapters...');

  try {
    // Register CRM adapters (6 tools)
    registerCRMAdapters(toolRegistry);
    console.log('[ToolRegistry] ✓ CRM adapters registered');

    // Register search adapters (3 tools)
    registerSearchAdapters(toolRegistry);
    console.log('[ToolRegistry] ✓ Search adapters registered');

    // Register knowledge adapters (6 tools)
    registerKnowledgeAdapters(toolRegistry);
    console.log('[ToolRegistry] ✓ Knowledge adapters registered');

    // Register utility adapters (5 tools)
    registerUtilityAdapters(toolRegistry);
    console.log('[ToolRegistry] ✓ Utility adapters registered');

    toolsRegistered = true;

    const stats = toolRegistry.getStats();
    console.log('[ToolRegistry] Registration complete', {
      totalTools: stats.totalTools,
      byCategory: stats.toolsByCategory,
      byRisk: stats.toolsByRisk
    });
  } catch (error) {
    console.error('[ToolRegistry] Registration failed:', error);
    throw error;
  }
}

// ============================================================================
// POST /api/vanguard/execute/register - Register tools
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    registerAllTools();

    const stats = toolRegistry.getStats();

    return NextResponse.json({
      success: true,
      data: {
        registered: true,
        stats: {
          totalTools: stats.totalTools,
          byCategory: stats.toolsByCategory,
          byRisk: stats.toolsByRisk
        },
        tools: toolRegistry.getAllTools().map(tool => ({
          id: tool.id,
          name: tool.name,
          nameAr: tool.nameAr,
          category: tool.category,
          riskLevel: tool.riskLevel
        }))
      }
    });
  } catch (error) {
    console.error('[ToolRegistry] POST /api/vanguard/execute/register error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'REGISTRATION_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          messageAr: 'خطأ في تسجيل الأدوات'
        }
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET /api/vanguard/execute/register - Check registration status
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const stats = toolRegistry.getStats();

    return NextResponse.json({
      success: true,
      data: {
        registered: toolsRegistered,
        stats: {
          totalTools: stats.totalTools,
          byCategory: stats.toolsByCategory,
          byRisk: stats.toolsByRisk,
          totalCalls: stats.totalCalls,
          callsByTool: stats.callsByTool
        }
      }
    });
  } catch (error) {
    console.error('[ToolRegistry] GET /api/vanguard/execute/register error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          messageAr: 'خطأ داخلي'
        }
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// Auto-register tools on module load (for serverless environments)
// ============================================================================

// Uncomment this to auto-register tools when the module is loaded
// registerAllTools();

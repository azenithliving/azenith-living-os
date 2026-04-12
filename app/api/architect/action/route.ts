/**
 * Architect Action API - Execute AI-Generated Actions
 * 
 * Actions:
 * - apply-code: Write code to file
 * - preview-file: Read file for preview
 * - modify-file: Apply modifications
 * - scan-codebase: Analyze project structure
 * - create-notification: Send notification to user
 */

import { NextRequest, NextResponse } from "next/server";
import { applyCode, getCodebaseOverview, createNotification } from "@/lib/supreme-architect";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, payload } = body;

    switch (action) {
      case "apply-code": {
        const { filePath, code } = payload;
        if (!filePath || !code) {
          return NextResponse.json(
            { success: false, error: "Missing filePath or code" },
            { status: 400 }
          );
        }

        const result = await applyCode(filePath, code);
        return NextResponse.json(result);
      }

      case "preview-file": {
        const { filePath } = payload;
        if (!filePath) {
          return NextResponse.json(
            { success: false, error: "Missing filePath" },
            { status: 400 }
          );
        }

        // Read file using the architect's file system
        const { readFileSync } = await import("fs");
        const { resolve } = await import("path");
        
        try {
          const fullPath = resolve(process.cwd(), filePath);
          const content = readFileSync(fullPath, "utf-8");
          return NextResponse.json({ success: true, content });
        } catch (error) {
          return NextResponse.json(
            { success: false, error: String(error) },
            { status: 500 }
          );
        }
      }

      case "scan-codebase": {
        const overview = await getCodebaseOverview();
        return NextResponse.json({ success: true, overview });
      }

      case "create-notification": {
        const { userId, title, message, priority } = payload;
        await createNotification(userId, title, message, priority);
        return NextResponse.json({ success: true, message: "Notification created" });
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("[Architect Action API] Error:", error);
    return NextResponse.json(
      { success: false, error: "Action execution failed" },
      { status: 500 }
    );
  }
}

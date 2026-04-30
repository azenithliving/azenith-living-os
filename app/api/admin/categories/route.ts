import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { executeTool } from "@/lib/real-tool-executor";

// GET /api/admin/categories - List categories
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await executeTool(
      "category_list",
      {},
      {
        executionId: crypto.randomUUID(),
        actorUserId: user.id,
      }
    );

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// POST /api/admin/categories - Create category
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    const result = await executeTool(
      "category_create",
      body,
      {
        executionId: crypto.randomUUID(),
        actorUserId: user.id,
      },
      { autoApprove: false }
    );

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

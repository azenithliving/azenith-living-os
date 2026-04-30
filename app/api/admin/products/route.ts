import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { executeTool } from "@/lib/real-tool-executor";

// GET /api/admin/products - List products
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get("categoryId") || undefined;
    const limit = parseInt(searchParams.get("limit") || "50");
    const includeInactive = searchParams.get("includeInactive") === "true";

    const result = await executeTool(
      "product_list",
      { categoryId, limit, includeInactive },
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

// POST /api/admin/products - Create product
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    const result = await executeTool(
      "product_create",
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

// PATCH /api/admin/products - Update product
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    const result = await executeTool(
      "product_update",
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

// DELETE /api/admin/products - Delete product
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const productId = searchParams.get("productId");

    if (!productId) {
      return NextResponse.json(
        { success: false, error: "Product ID is required" },
        { status: 400 }
      );
    }

    const result = await executeTool(
      "product_delete",
      { productId },
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

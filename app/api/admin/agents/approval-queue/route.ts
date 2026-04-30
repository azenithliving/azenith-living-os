// API Route: approval-queue - طلبات الـ Agents اللي محتاجة موافقة
import { NextRequest, NextResponse } from 'next/server';

// GET: جلب كل الطلبات المعلقة
export async function GET() {
  try {
    // TODO: Connect to Supabase when migrations are fixed
    // For now, return empty array
    return NextResponse.json({
      approvals: []
    });
  } catch (error) {
    console.error('Error fetching approvals:', error);
    return NextResponse.json(
      { error: 'Failed to fetch approvals' },
      { status: 500 }
    );
  }
}

// POST: إضافة طلب جديد للموافقة
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // TODO: Connect to Supabase when migrations are fixed
    // For now, return success
    return NextResponse.json({
      success: true,
      id: crypto.randomUUID(),
      message: 'Approval request created'
    });
  } catch (error) {
    console.error('Error creating approval:', error);
    return NextResponse.json(
      { error: 'Failed to create approval' },
      { status: 500 }
    );
  }
}

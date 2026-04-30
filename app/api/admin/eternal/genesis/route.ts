import { NextResponse } from 'next/server';
import { SovereignArchitect } from '@/lib/sovereign-architect';

export async function POST(req: Request) {
  try {
    const { intent } = await req.json();
    
    if (!intent) {
      return NextResponse.json({ success: false, error: "Intent is required" }, { status: 400 });
    }

    const architect = SovereignArchitect.getInstance();
    const result = await architect.manifest(intent);
    
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("❌ Genesis API Error:", error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || String(error) 
    }, { status: 500 });
  }
}

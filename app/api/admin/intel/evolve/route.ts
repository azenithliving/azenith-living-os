import { NextResponse } from 'next/server';
import { runRecursiveOptimization } from '@/lib/recursive-engine';

export async function POST() {
  try {
    console.log("🚀 API: Starting recursive optimization...");
    const result = await runRecursiveOptimization();
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("❌ API Error in evolve route:", error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || String(error),
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}

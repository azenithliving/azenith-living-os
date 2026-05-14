import { NextRequest, NextResponse } from 'next/server';
import { whatsAppManager } from '@/lib/whatsapp-proxy';

export async function GET() {
  console.log('[WhatsApp API] GET /status - Checking service status...');
  try {
    const status = whatsAppManager.getStatus();
    const qr = whatsAppManager.getQR();
    
    console.log(`[WhatsApp API] GET /status - Status: ${status}, QR Present: ${!!qr}`);

    return NextResponse.json({
      success: true,
      status,
      qr: status === 'QR_READY' ? qr : null
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// Initialize the client if not already started
export async function POST() {
  try {
    console.log('[WhatsApp API] POST /status hit - Triggering initialization');
    // Start initialization in background to avoid API timeout
    whatsAppManager.initialize().catch(err => {
      console.error('[WhatsApp API] Background initialization failed:', err);
    });
    
    return NextResponse.json({ 
      success: true, 
      message: 'Initialization process started in background' 
    });
  } catch (error: any) {
    console.error('[WhatsApp API] POST error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

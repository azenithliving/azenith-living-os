import { NextRequest, NextResponse } from 'next/server';
import { whatsAppManager } from '@/lib/whatsapp-proxy';

export async function POST(request: NextRequest) {
  try {
    const { to, message } = await request.json();

    if (!to || !message) {
      return NextResponse.json({ success: false, error: 'Missing to or message' }, { status: 400 });
    }

    if (whatsAppManager.getStatus() !== 'READY') {
      return NextResponse.json({ success: false, error: 'WhatsApp is not ready' }, { status: 503 });
    }

    const result = await whatsAppManager.sendMessage(to, message);

    return NextResponse.json({
      success: true,
      messageId: result.id.id
    });
  } catch (error: any) {
    console.error('[WhatsApp API] Send error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

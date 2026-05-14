import { whatsAppManager } from './whatsapp-proxy';

export interface WhatsAppMessageResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface WhatsAppTemplate {
  name: string;
  language: string;
  components?: unknown[];
}

/**
 * Send a WhatsApp message (Real Implementation)
 */
export async function sendMessage(
  to: string,
  message: string,
  template?: WhatsAppTemplate | string
): Promise<WhatsAppMessageResult> {
  try {
    // We only send from server-side
    if (typeof window !== 'undefined') {
      // In client-side, we should call an API route
      const response = await fetch('/api/admin/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, message })
      });
      return await response.json();
    }

    const result = await whatsAppManager.sendMessage(to, message);
    
    return {
      success: true,
      messageId: result.id.id,
    };
  } catch (error: any) {
    console.error("[WhatsApp Service] Error sending message:", error);
    return {
      success: false,
      error: error.message || "Unknown error",
    };
  }
}

/**
 * Check if WhatsApp service is ready/initialized
 */
export function isReady(): boolean {
  if (typeof window !== 'undefined') return false;
  return whatsAppManager.getStatus() === 'READY';
}

/**
 * Initialize WhatsApp service
 */
export async function initialize(): Promise<boolean> {
  if (typeof window !== 'undefined') return false;
  
  console.log("[WhatsApp Service] Initializing real client...");
  await whatsAppManager.initialize();
  return true;
}

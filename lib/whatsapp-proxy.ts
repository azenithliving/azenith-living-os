import EventEmitter from 'events';
import axios from 'axios';

export class WhatsAppManager extends EventEmitter {
  private static instance: WhatsAppManager;
  private status: 'DISCONNECTED' | 'INITIALIZING' | 'QR_READY' | 'READY' = 'DISCONNECTED';
  private qrCode: string | null = null;
  private serviceUrl = process.env.WHATSAPP_SERVICE_URL || 'http://localhost:3001';

  private constructor() {
    super();
    console.log('[WhatsApp Proxy] Instance created, starting poll...');
    this.pollStatus();
  }

  public static getInstance(): WhatsAppManager {
    if (!WhatsAppManager.instance) {
      // @ts-ignore
      if (global.whatsAppManagerProxy) {
        // @ts-ignore
        WhatsAppManager.instance = global.whatsAppManagerProxy;
      } else {
        WhatsAppManager.instance = new WhatsAppManager();
        // @ts-ignore
        global.whatsAppManagerProxy = WhatsAppManager.instance;
      }
    }
    return WhatsAppManager.instance;
  }

  private async pollStatus() {
    setInterval(async () => {
      try {
        const response = await axios.get(`${this.serviceUrl}/health`);
        // The script returns { status, connected, timestamp }
        const { status, connected } = response.data;
        
        const currentStatus = connected ? 'READY' : 'INITIALIZING';

        if (this.status !== currentStatus) {
          console.log(`[WhatsApp Proxy] Status update: ${currentStatus}`);
          this.status = currentStatus as any;
          this.emit('statusChange', this.status);
        }
      } catch (error: any) {
        if (this.status !== 'DISCONNECTED') {
          this.status = 'DISCONNECTED';
          this.qrCode = null;
          this.emit('statusChange', this.status);
        }
      }
    }, 5000); // Poll every 5s
  }

  public async initialize() {
    // In the current script, initialization is automatic on startup
    console.log('[WhatsApp Proxy] Station is managed externally.');
  }

  public getStatus() {
    return this.status;
  }

  public getQR() {
    return this.qrCode; // Script shows QR in terminal
  }

  public async sendMessage(to: string, message: string) {
    try {
      const response = await axios.post(`${this.serviceUrl}/send-message`, { phone: to, message });
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || error.message);
    }
  }
}

export const whatsAppManager = WhatsAppManager.getInstance();

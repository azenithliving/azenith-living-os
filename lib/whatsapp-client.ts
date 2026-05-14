import EventEmitter from 'events';
import axios from 'axios';

export class WhatsAppManager extends EventEmitter {
  private static instance: WhatsAppManager;
  private status: 'DISCONNECTED' | 'INITIALIZING' | 'QR_READY' | 'READY' = 'DISCONNECTED';
  private qrCode: string | null = null;
  private serviceUrl = 'http://localhost:3006';

  private constructor() {
    super();
    this.pollStatus();
  }

  public static getInstance(): WhatsAppManager {
    if (!WhatsAppManager.instance) {
      // @ts-ignore
      if (global.whatsAppManager) {
        // @ts-ignore
        WhatsAppManager.instance = global.whatsAppManager;
      } else {
        WhatsAppManager.instance = new WhatsAppManager();
        // @ts-ignore
        global.whatsAppManager = WhatsAppManager.instance;
      }
    }
    return WhatsAppManager.instance;
  }

  private async pollStatus() {
    console.log('[WhatsApp Client] Starting status polling from service...');
    setInterval(async () => {
      try {
        const response = await axios.get(`${this.serviceUrl}/status`);
        const { status, qr } = response.data;
        
        if (this.status !== status || this.qrCode !== qr) {
          console.log(`[WhatsApp Client] Status changed: ${this.status} -> ${status}`);
          this.status = status;
          this.qrCode = qr;
          this.emit('statusChange', this.status);
          if (qr) this.emit('qr', qr);
        }
      } catch (error: any) {
        if (this.status !== 'DISCONNECTED') {
          console.log('[WhatsApp Client] Service unreachable, setting status to DISCONNECTED');
          this.status = 'DISCONNECTED';
          this.qrCode = null;
          this.emit('statusChange', this.status);
        }
      }
    }, 2000);
  }

  public async initialize() {
    try {
      await axios.post(`${this.serviceUrl}/initialize`);
      this.status = 'INITIALIZING';
      this.emit('statusChange', this.status);
    } catch (error: any) {
      console.error('[WhatsApp Client] Failed to trigger init:', error.message);
    }
  }

  public getStatus() {
    return this.status;
  }

  public getQR() {
    return this.qrCode;
  }

  public async sendMessage(to: string, message: string) {
    try {
      const response = await axios.post(`${this.serviceUrl}/send`, { to, message });
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || error.message);
    }
  }
}

export const whatsAppManager = WhatsAppManager.getInstance();

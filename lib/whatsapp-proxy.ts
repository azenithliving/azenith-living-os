import EventEmitter from 'events';
import axios from 'axios';

export class WhatsAppManager extends EventEmitter {
  private static instance: WhatsAppManager;
  private status: 'DISCONNECTED' | 'INITIALIZING' | 'QR_READY' | 'READY' = 'DISCONNECTED';
  private qrCode: string | null = null;
  private serviceUrl = 'http://localhost:3006';

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
        const response = await axios.get(`${this.serviceUrl}/status`);
        const { status, qr } = response.data;
        
        if (this.status !== status || this.qrCode !== qr) {
          console.log(`[WhatsApp Proxy] Status update: ${status}`);
          this.status = status;
          this.qrCode = qr;
          this.emit('statusChange', this.status);
          if (qr) this.emit('qr', qr);
        }
      } catch (error: any) {
        if (this.status !== 'DISCONNECTED') {
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
    } catch (error: any) {
      console.error('[WhatsApp Proxy] Init trigger failed:', error.message);
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

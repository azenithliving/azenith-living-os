/**
 * Mobile Agent Bridge Service
 * Connects to Android devices via Scrcpy for mobile agent control
 * 100% free, uses open-source Scrcpy
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

export interface MobileDevice {
  id: string;
  serial: string;
  name: string;
  model: string;
  android_version: string;
  screen_width: number;
  screen_height: number;
  status: 'connected' | 'disconnected' | 'busy';
  battery_level?: number;
}

export interface ScrcpySession {
  deviceId: string;
  process: ChildProcess;
  wsUrl: string;
  startedAt: Date;
}

export class MobileAgentBridge extends EventEmitter {
  private scrcpyPath: string;
  private activeSessions: Map<string, ScrcpySession> = new Map();
  private connectedDevices: Map<string, MobileDevice> = new Map();

  constructor() {
    super();
    this.scrcpyPath = process.env.SCRCPY_PATH || 'scrcpy';
  }

  /**
   * Discover connected Android devices via ADB
   */
  async discoverDevices(): Promise<MobileDevice[]> {
    try {
      const { execSync } = await import('child_process');
      
      // Get list of devices
      const output = execSync('adb devices -l', { encoding: 'utf8' });
      const lines = output.split('\n').slice(1); // Skip header

      const devices: MobileDevice[] = [];

      for (const line of lines) {
        const match = line.match(/^(\S+)\s+device\s+(.+)$/);
        if (match) {
          const serial = match[1];
          const props = match[2];
          
          // Get device info
          const deviceInfo = this.parseDeviceInfo(props);
          
          // Get screen size
          const sizeOutput = execSync(
            `adb -s ${serial} shell wm size`,
            { encoding: 'utf8' }
          ).trim();
          const sizeMatch = sizeOutput.match(/(\d+)x(\d+)/);

          // Get battery level
          const batteryOutput = execSync(
            `adb -s ${serial} shell dumpsys battery | grep level`,
            { encoding: 'utf8' }
          ).trim();
          const batteryMatch = batteryOutput.match(/level:\s*(\d+)/);

          const device: MobileDevice = {
            id: `mobile-${serial}`,
            serial,
            name: deviceInfo.model || 'Unknown Device',
            model: deviceInfo.model || 'Unknown',
            android_version: deviceInfo.release || 'Unknown',
            screen_width: sizeMatch ? parseInt(sizeMatch[1]) : 1080,
            screen_height: sizeMatch ? parseInt(sizeMatch[2]) : 1920,
            status: 'connected',
            battery_level: batteryMatch ? parseInt(batteryMatch[1]) : undefined
          };

          devices.push(device);
          this.connectedDevices.set(serial, device);
        }
      }

      return devices;
    } catch (error) {
      console.error('[MobileBridge] Discover error:', error);
      return [];
    }
  }

  private parseDeviceInfo(props: string): Record<string, string> {
    const info: Record<string, string> = {};
    const pairs = props.split(' ');
    
    for (const pair of pairs) {
      const [key, value] = pair.split(':');
      if (key && value) {
        info[key] = value;
      }
    }

    return info;
  }

  /**
   * Start Scrcpy session for a device
   */
  async startSession(deviceSerial: string, options?: {
    port?: number;
    maxSize?: number;
    bitRate?: number;
    noControl?: boolean;
  }): Promise<{ success: boolean; wsUrl?: string; error?: string }> {
    try {
      // Check if session already exists
      if (this.activeSessions.has(deviceSerial)) {
        const session = this.activeSessions.get(deviceSerial)!;
        return {
          success: true,
          wsUrl: session.wsUrl,
          error: 'Session already active'
        };
      }

      const port = options?.port || 27183;
      const maxSize = options?.maxSize || 1024;
      const bitRate = options?.bitRate || 8000000;

      // Build Scrcpy command
      const args = [
        '-s', deviceSerial,
        '--max-size', maxSize.toString(),
        '--bit-rate', bitRate.toString(),
        '--tunnel-forward',
        '--stay-awake'
      ];

      if (options?.noControl) {
        args.push('--no-control');
      }

      // Start Scrcpy process
      const process = spawn(this.scrcpyPath, args, {
        detached: false
      });

      const session: ScrcpySession = {
        deviceId: deviceSerial,
        process,
        wsUrl: `ws://localhost:${port}`,
        startedAt: new Date()
      };

      this.activeSessions.set(deviceSerial, session);

      // Handle process events
      process.on('error', (error) => {
        console.error(`[MobileBridge] Scrcpy error for ${deviceSerial}:`, error);
        this.emit('error', { deviceSerial, error });
        this.stopSession(deviceSerial);
      });

      process.on('exit', (code) => {
        console.log(`[MobileBridge] Scrcpy exited for ${deviceSerial} with code ${code}`);
        this.activeSessions.delete(deviceSerial);
        this.emit('disconnected', { deviceSerial, code });
      });

      // Wait a moment for service to start
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Update device status
      const device = this.connectedDevices.get(deviceSerial);
      if (device) {
        device.status = 'busy';
      }

      this.emit('connected', { deviceSerial, wsUrl: session.wsUrl });

      return {
        success: true,
        wsUrl: session.wsUrl
      };
    } catch (error) {
      console.error('[MobileBridge] Start session error:', error);
      return {
        success: false,
        error: String(error)
      };
    }
  }

  /**
   * Stop Scrcpy session
   */
  async stopSession(deviceSerial: string): Promise<boolean> {
    const session = this.activeSessions.get(deviceSerial);
    
    if (!session) {
      return false;
    }

    try {
      // Kill the process
      session.process.kill('SIGTERM');
      
      // Force kill after 5 seconds if still running
      setTimeout(() => {
        if (!session.process.killed) {
          session.process.kill('SIGKILL');
        }
      }, 5000);

      this.activeSessions.delete(deviceSerial);

      // Update device status
      const device = this.connectedDevices.get(deviceSerial);
      if (device) {
        device.status = 'connected';
      }

      this.emit('stopped', { deviceSerial });
      return true;
    } catch (error) {
      console.error('[MobileBridge] Stop session error:', error);
      return false;
    }
  }

  /**
   * Execute ADB command on device
   */
  async executeAdbCommand(deviceSerial: string, command: string): Promise<string> {
    try {
      const { execSync } = await import('child_process');
      const output = execSync(
        `adb -s ${deviceSerial} ${command}`,
        { encoding: 'utf8', timeout: 30000 }
      );
      return output.trim();
    } catch (error) {
      console.error('[MobileBridge] ADB command error:', error);
      throw error;
    }
  }

  /**
   * Simulate touch on device
   */
  async simulateTouch(deviceSerial: string, x: number, y: number, action: 'tap' | 'swipe' = 'tap'): Promise<boolean> {
    try {
      const command = action === 'tap'
        ? `shell input tap ${x} ${y}`
        : `shell input swipe ${x} ${y} ${x} ${y} 100`;

      await this.executeAdbCommand(deviceSerial, command);
      return true;
    } catch (error) {
      console.error('[MobileBridge] Touch simulation error:', error);
      return false;
    }
  }

  /**
   * Simulate text input
   */
  async simulateText(deviceSerial: string, text: string): Promise<boolean> {
    try {
      // Escape special characters
      const escapedText = text.replace(/ /g, '%s').replace(/'/g, "\\'");
      await this.executeAdbCommand(deviceSerial, `shell input text "${escapedText}"`);
      return true;
    } catch (error) {
      console.error('[MobileBridge] Text input error:', error);
      return false;
    }
  }

  /**
   * Capture screenshot from device
   */
  async captureScreenshot(deviceSerial: string): Promise<Buffer | null> {
    try {
      const { execSync } = await import('child_process');
      
      // Capture to device
      await this.executeAdbCommand(deviceSerial, 'shell screencap -p /sdcard/screenshot.png');
      
      // Pull to local
      const screenshot = execSync(
        `adb -s ${deviceSerial} pull /sdcard/screenshot.png -`,
        { encoding: null, timeout: 10000 }
      );
      
      // Clean up device
      await this.executeAdbCommand(deviceSerial, 'shell rm /sdcard/screenshot.png');
      
      return screenshot;
    } catch (error) {
      console.error('[MobileBridge] Screenshot error:', error);
      return null;
    }
  }

  /**
   * Get active sessions
   */
  getActiveSessions(): Array<{ deviceId: string; wsUrl: string; startedAt: Date }> {
    return Array.from(this.activeSessions.entries()).map(([deviceId, session]) => ({
      deviceId,
      wsUrl: session.wsUrl,
      startedAt: session.startedAt
    }));
  }

  /**
   * Check if Scrcpy is installed
   */
  async isAvailable(): Promise<boolean> {
    try {
      const { execSync } = await import('child_process');
      execSync(`${this.scrcpyPath} --version`, { encoding: 'utf8' });
      return true;
    } catch {
      return false;
    }
  }
}

export const mobileAgentBridge = new MobileAgentBridge();

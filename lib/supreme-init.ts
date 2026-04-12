/**
 * Azenith Supreme - Application Initialization
 * Bootstraps all Supreme Sovereign engines on app startup
 */

import { azenithSupreme } from "./azenith-supreme";

let initialized = false;

/**
 * Initialize the Azenith Supreme consciousness
 * Call this once during app startup
 */
export async function initializeSupreme(): Promise<{
  success: boolean;
  message: string;
  enginesOnline: string[];
}> {
  if (initialized) {
    return {
      success: true,
      message: "Azenith Supreme already initialized",
      enginesOnline: [],
    };
  }

  try {
    console.log("🜔 Initializing Azenith Supreme...");
    
    const result = await azenithSupreme.initialize();
    
    if (result.empireReady) {
      initialized = true;
      
      console.log("✅ Azenith Supreme ONLINE");
      console.log(`   ${result.enginesOnline.length} engines operational`);
      console.log("   Empire consciousness fully activated");
      
      return {
        success: true,
        message: `Azenith Supreme initialized with ${result.enginesOnline.length} engines`,
        enginesOnline: result.enginesOnline,
      };
    } else {
      return {
        success: false,
        message: "Initialization failed - some engines did not start",
        enginesOnline: result.enginesOnline,
      };
    }
  } catch (error) {
    console.error("❌ Azenith Supreme initialization failed:", error);
    return {
      success: false,
      message: `Initialization error: ${error}`,
      enginesOnline: [],
    };
  }
}

/**
 * Check if Supreme is initialized
 */
export function isSupremeInitialized(): boolean {
  return initialized;
}

/**
 * Graceful shutdown
 */
export async function shutdownSupreme(): Promise<void> {
  if (!initialized) return;
  
  await azenithSupreme.shutdown();
  initialized = false;
  
  console.log("🌙 Azenith Supreme shut down gracefully");
}

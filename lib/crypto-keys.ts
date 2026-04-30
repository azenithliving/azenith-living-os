/**
 * Digital Signature System using Web Crypto API
 * Sovereign HyperMind - Absolute Security
 * 
 * Uses Ed25519 for high-security signatures
 * All keys are generated client-side - private key never leaves the browser
 */

export interface KeyPair {
  publicKey: CryptoKey;
  privateKey: CryptoKey;
}

export interface ExportedKeyPair {
  publicKeyBase64: string;
  privateKeyBase64: string;
}

/**
 * Generate a new Ed25519 key pair
 * Used once when setting up the admin account
 */
export async function generateKeyPair(): Promise<KeyPair> {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: "Ed25519",
    },
    true, // extractable for backup
    ["sign", "verify"]
  );

  return {
    publicKey: keyPair.publicKey,
    privateKey: keyPair.privateKey,
  };
}

/**
 * Export public key to Base64 format for storage
 */
export async function exportPublicKey(publicKey: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey("raw", publicKey);
  return arrayBufferToBase64(exported);
}

/**
 * Export private key to Base64 format (encrypted with session password before storage)
 * WARNING: Only export after encrypting with a strong password!
 */
export async function exportPrivateKey(privateKey: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey("raw", privateKey);
  return arrayBufferToBase64(exported);
}

/**
 * Import public key from Base64 format
 */
export async function importPublicKey(publicKeyBase64: string): Promise<CryptoKey> {
  const raw = base64ToArrayBuffer(publicKeyBase64);
  
  return await crypto.subtle.importKey(
    "raw",
    raw,
    {
      name: "Ed25519",
    },
    false,
    ["verify"]
  );
}

/**
 * Import private key from Base64 format
 */
export async function importPrivateKey(privateKeyBase64: string): Promise<CryptoKey> {
  const raw = base64ToArrayBuffer(privateKeyBase64);
  
  return await crypto.subtle.importKey(
    "raw",
    raw,
    {
      name: "Ed25519",
    },
    false,
    ["sign"]
  );
}

/**
 * Sign a command using the private key
 * Returns Base64-encoded signature
 */
export async function signCommand(
  privateKey: CryptoKey,
  commandText: string
): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(commandText);
  
  const signature = await crypto.subtle.sign(
    {
      name: "Ed25519",
    },
    privateKey,
    data
  );

  return arrayBufferToBase64(signature);
}

/**
 * Verify a command signature using the public key
 */
export async function verifyCommand(
  publicKey: CryptoKey,
  commandText: string,
  signatureBase64: string
): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(commandText);
    const signature = base64ToArrayBuffer(signatureBase64);

    return await crypto.subtle.verify(
      {
        name: "Ed25519",
      },
      publicKey,
      signature,
      data
    );
  } catch (error) {
    console.error("Signature verification error:", error);
    return false;
  }
}

/**
 * Sign command with a raw private key (for server-side verification)
 * Server receives: command, signature, and has stored public key
 */
export async function verifyCommandWithPublicKeyBase64(
  publicKeyBase64: string,
  commandText: string,
  signatureBase64: string
): Promise<boolean> {
  try {
    const publicKey = await importPublicKey(publicKeyBase64);
    return await verifyCommand(publicKey, commandText, signatureBase64);
  } catch (error) {
    console.error("Verification with public key failed:", error);
    return false;
  }
}

/**
 * Generate a secure session password for encrypting private key
 */
export function generateSessionPassword(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return arrayBufferToBase64(array.buffer);
}

/**
 * Hash a command for integrity verification
 * Used to create command_hash for immutable log
 */
export async function hashCommand(
  commandText: string,
  userId: string,
  timestamp: string
): Promise<string> {
  const data = `${commandText}:${userId}:${timestamp}`;
  const encoder = new TextEncoder();
  const encoded = encoder.encode(data);
  
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  return arrayBufferToBase64(hashBuffer);
}

// ==================== Utility Functions ====================

/**
 * Convert ArrayBuffer to Base64 string
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Convert Base64 string to ArrayBuffer
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Check if Web Crypto API is available and supports Ed25519
 */
export async function checkCryptoSupport(): Promise<{
  supported: boolean;
  algorithm: string;
  error?: string;
}> {
  try {
    // Try to generate a test key
    const testKey = await crypto.subtle.generateKey(
      { name: "Ed25519" },
      false,
      ["sign"]
    );
    
    return {
      supported: true,
      algorithm: "Ed25519",
    };
  } catch (error) {
    // Fallback to RSA-PSS if Ed25519 not supported
    try {
      const testKey = await crypto.subtle.generateKey(
        {
          name: "RSA-PSS",
          modulusLength: 2048,
          publicExponent: new Uint8Array([1, 0, 1]),
          hash: "SHA-256",
        },
        false,
        ["sign", "verify"]
      );
      
      return {
        supported: true,
        algorithm: "RSA-PSS",
        error: "Ed25519 not available, using RSA-PSS fallback",
      };
    } catch (fallbackError) {
      return {
        supported: false,
        algorithm: "none",
        error: "Web Crypto API not supported or algorithms unavailable",
      };
    }
  }
}

/**
 * Generate RSA-PSS key pair (fallback)
 */
export async function generateRSAKeyPair(): Promise<KeyPair> {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: "RSA-PSS",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"]
  );

  return {
    publicKey: keyPair.publicKey,
    privateKey: keyPair.privateKey,
  };
}

/**
 * Sign with RSA-PSS (fallback)
 */
export async function signCommandRSA(
  privateKey: CryptoKey,
  commandText: string
): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(commandText);
  
  const signature = await crypto.subtle.sign(
    {
      name: "RSA-PSS",
      saltLength: 32,
    },
    privateKey,
    data
  );

  return arrayBufferToBase64(signature);
}

/**
 * Verify RSA-PSS signature (fallback)
 */
export async function verifyCommandRSA(
  publicKey: CryptoKey,
  commandText: string,
  signatureBase64: string
): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(commandText);
    const signature = base64ToArrayBuffer(signatureBase64);

    return await crypto.subtle.verify(
      {
        name: "RSA-PSS",
        saltLength: 32,
      },
      publicKey,
      signature,
      data
    );
  } catch (error) {
    console.error("RSA verification error:", error);
    return false;
  }
}

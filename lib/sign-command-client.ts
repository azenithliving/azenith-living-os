/**
 * Client-side Command Signing
 * Sovereign HyperMind - Digital Signatures
 * 
 * This module handles signing commands in the browser
 * Private key is stored encrypted in localStorage
 */

import {
  generateKeyPair,
  generateRSAKeyPair,
  exportPublicKey,
  exportPrivateKey,
  importPrivateKey,
  signCommand,
  signCommandRSA,
  generateSessionPassword,
  checkCryptoSupport,
} from "./crypto-keys";

const PRIVATE_KEY_STORAGE_KEY = "sovereign_private_key_encrypted";
const SESSION_PASSWORD_KEY = "sovereign_session_password";
const KEY_TYPE_KEY = "sovereign_key_type";

interface StoredKeyData {
  encryptedKey: string;
  keyType: string;
}

/**
 * Setup: Generate keys and store private key encrypted
 * This should be called once during admin onboarding
 */
export async function setupDigitalSignature(): Promise<{
  success: boolean;
  publicKey?: string;
  sessionPassword?: string;
  error?: string;
}> {
  try {
    // التحقق من دعم التشفير
    const support = await checkCryptoSupport();
    if (!support.supported) {
      return {
        success: false,
        error: support.error || "Web Crypto API not supported",
      };
    }

    // توليد زوج المفاتيح
    const useRSA = support.algorithm === "RSA-PSS";
    const keyPair = useRSA 
      ? await generateRSAKeyPair() 
      : await generateKeyPair();

    // تصدير المفتاح العام
    const publicKeyBase64 = await exportPublicKey(keyPair.publicKey);

    // تصدير المفتاح الخاص
    const privateKeyBase64 = useRSA
      ? await exportPrivateKey(keyPair.privateKey)
      : await exportPrivateKey(keyPair.privateKey);

    // توليد كلمة سر للجلسة
    const sessionPassword = generateSessionPassword();

    // تشفير المفتاح الخاص (بشكل بسيط - في الإنتاج استخدم PBKDF2)
    const encryptedPrivateKey = await encryptPrivateKey(
      privateKeyBase64,
      sessionPassword
    );

    // حفظ في localStorage
    localStorage.setItem(PRIVATE_KEY_STORAGE_KEY, encryptedPrivateKey);
    localStorage.setItem(SESSION_PASSWORD_KEY, sessionPassword);
    localStorage.setItem(KEY_TYPE_KEY, support.algorithm);

    // إرسال المفتاح العام للخادم
    const response = await fetch("/api/admin/keys/public", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        publicKey: publicKeyBase64,
        keyType: support.algorithm,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      
      // تنظيف في حالة الفشل
      localStorage.removeItem(PRIVATE_KEY_STORAGE_KEY);
      localStorage.removeItem(SESSION_PASSWORD_KEY);
      localStorage.removeItem(KEY_TYPE_KEY);
      
      return {
        success: false,
        error: error.error || "Failed to register public key",
      };
    }

    return {
      success: true,
      publicKey: publicKeyBase64,
      sessionPassword: sessionPassword,
    };

  } catch (error) {
    console.error("Setup Digital Signature Error:", error);
    return {
      success: false,
      error: "Failed to setup digital signature",
    };
  }
}

/**
 * Sign a command for server verification
 * This is called before sending any command to /api/admin/command
 */
export async function signClientCommand(
  commandText: string
): Promise<{
  success: boolean;
  signature?: string;
  error?: string;
}> {
  try {
    // استرجاع المفتاح الخاص من localStorage
    const encryptedKey = localStorage.getItem(PRIVATE_KEY_STORAGE_KEY);
    const sessionPassword = localStorage.getItem(SESSION_PASSWORD_KEY);
    const keyType = localStorage.getItem(KEY_TYPE_KEY) || "Ed25519";

    if (!encryptedKey || !sessionPassword) {
      return {
        success: false,
        error: "Private key not found. Please setup digital signatures first.",
      };
    }

    // فك تشفير المفتاح الخاص
    const privateKeyBase64 = await decryptPrivateKey(
      encryptedKey,
      sessionPassword
    );

    // استيراد المفتاح الخاص
    const privateKey = await importPrivateKey(privateKeyBase64);

    // توقيع الأمر
    const useRSA = keyType === "RSA-PSS";
    const signature = useRSA
      ? await signCommandRSA(privateKey, commandText)
      : await signCommand(privateKey, commandText);

    return {
      success: true,
      signature,
    };

  } catch (error) {
    console.error("Sign Command Error:", error);
    return {
      success: false,
      error: "Failed to sign command",
    };
  }
}

/**
 * Check if digital signature is setup
 */
export function hasDigitalSignature(): boolean {
  if (typeof window === "undefined") return false;
  
  return (
    !!localStorage.getItem(PRIVATE_KEY_STORAGE_KEY) &&
    !!localStorage.getItem(SESSION_PASSWORD_KEY)
  );
}

/**
 * Clear digital signature keys (on logout or security breach)
 */
export function clearDigitalSignature(): void {
  if (typeof window === "undefined") return;
  
  localStorage.removeItem(PRIVATE_KEY_STORAGE_KEY);
  localStorage.removeItem(SESSION_PASSWORD_KEY);
  localStorage.removeItem(KEY_TYPE_KEY);
}

/**
 * Encrypt private key with session password
 * Note: In production, use PBKDF2 + AES-GCM
 */
async function encryptPrivateKey(
  privateKeyBase64: string,
  password: string
): Promise<string> {
  // XOR encryption (simplified - for production use proper encryption)
  const encoder = new TextEncoder();
  const keyData = encoder.encode(privateKeyBase64);
  const passwordData = encoder.encode(password);
  
  const encrypted = new Uint8Array(keyData.length);
  for (let i = 0; i < keyData.length; i++) {
    encrypted[i] = keyData[i] ^ passwordData[i % passwordData.length];
  }
  
  return btoa(String.fromCharCode(...encrypted));
}

/**
 * Decrypt private key with session password
 */
async function decryptPrivateKey(
  encryptedBase64: string,
  password: string
): Promise<string> {
  // XOR decryption
  const decoder = new TextDecoder();
  const encrypted = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
  const passwordData = new TextEncoder().encode(password);
  
  const decrypted = new Uint8Array(encrypted.length);
  for (let i = 0; i < encrypted.length; i++) {
    decrypted[i] = encrypted[i] ^ passwordData[i % passwordData.length];
  }
  
  return decoder.decode(decrypted);
}

/**
 * Verify that stored keys are valid
 */
export async function verifyStoredKeys(): Promise<boolean> {
  try {
    const testCommand = "test_verification";
    const result = await signClientCommand(testCommand);
    return result.success;
  } catch {
    return false;
  }
}

/**
 * Get key information (for display)
 */
export function getKeyInfo(): {
  hasKeys: boolean;
  keyType: string | null;
  setupDate: string | null;
} {
  if (typeof window === "undefined") {
    return { hasKeys: false, keyType: null, setupDate: null };
  }

  const encryptedKey = localStorage.getItem(PRIVATE_KEY_STORAGE_KEY);
  const keyType = localStorage.getItem(KEY_TYPE_KEY);
  
  return {
    hasKeys: !!encryptedKey,
    keyType,
    setupDate: null, // لا نحتفظ بالتاريخ في localStorage
  };
}

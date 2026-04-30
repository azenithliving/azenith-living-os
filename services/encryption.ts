/**
 * Local Encryption Service
 * AES-256 encryption for sensitive data
 * 100% local, no cloud key management needed
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync, createHash, CipherGCM, DecipherGCM } from 'crypto';

export class EncryptionService {
  private key: Buffer | null = null;
  private algorithm: string = 'aes-256-gcm';

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    const password = process.env.ENCRYPTION_PASSWORD;
    
    if (!password) {
      console.warn('[Encryption] No ENCRYPTION_PASSWORD set, using fallback');
      // Fallback key (NOT for production!)
      this.key = scryptSync('fallback-key-do-not-use-in-production', 'salt', 32);
      return;
    }

    // Derive 32-byte key from password
    this.key = scryptSync(password, 'azenith-salt-v1', 32);
  }

  /**
   * Encrypt text data
   */
  encrypt(text: string): { encrypted: string; iv: string; tag: string } {
    if (!this.key) {
      throw new Error('Encryption key not initialized');
    }

    try {
      const iv = randomBytes(16);
      const cipher = createCipheriv(this.algorithm, this.key, iv) as CipherGCM;
      
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const tag = cipher.getAuthTag();

      return {
        encrypted,
        iv: iv.toString('hex'),
        tag: tag.toString('hex')
      };
    } catch (error) {
      console.error('[Encryption] Encrypt error:', error);
      throw error;
    }
  }

  /**
   * Decrypt encrypted data
   */
  decrypt(encrypted: string, iv: string, tag: string): string {
    if (!this.key) {
      throw new Error('Encryption key not initialized');
    }

    try {
      const decipher = createDecipheriv(
        this.algorithm,
        this.key,
        Buffer.from(iv, 'hex')
      ) as DecipherGCM;
      
      decipher.setAuthTag(Buffer.from(tag, 'hex'));
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.error('[Encryption] Decrypt error:', error);
      throw new Error('Decryption failed - data may be corrupted or key mismatch');
    }
  }

  /**
   * Encrypt object (JSON)
   */
  encryptObject<T extends Record<string, any>>(obj: T): { encrypted: string; iv: string; tag: string } {
    return this.encrypt(JSON.stringify(obj));
  }

  /**
   * Decrypt to object
   */
  decryptObject<T>(encrypted: string, iv: string, tag: string): T {
    const decrypted = this.decrypt(encrypted, iv, tag);
    return JSON.parse(decrypted);
  }

  /**
   * Hash a value (one-way, for passwords)
   */
  hash(value: string, salt?: string): { hash: string; salt: string } {
    const useSalt = salt || randomBytes(16).toString('hex');
    const hash = createHash('sha256')
      .update(value + useSalt)
      .digest('hex');
    
    return { hash, salt: useSalt };
  }

  /**
   * Verify a hash
   */
  verifyHash(value: string, hash: string, salt: string): boolean {
    const { hash: newHash } = this.hash(value, salt);
    return newHash === hash;
  }

  /**
   * Generate secure random token
   */
  generateToken(length: number = 32): string {
    return randomBytes(length).toString('hex');
  }

  /**
   * Encrypt file content
   */
  encryptBuffer(buffer: Buffer): { encrypted: Buffer; iv: string; tag: string } {
    if (!this.key) {
      throw new Error('Encryption key not initialized');
    }

    const iv = randomBytes(16);
    const cipher = createCipheriv(this.algorithm, this.key, iv) as CipherGCM;
    
    const encrypted = Buffer.concat([
      cipher.update(buffer),
      cipher.final()
    ]);
    
    const tag = (cipher as CipherGCM).getAuthTag();

    return {
      encrypted,
      iv: iv.toString('hex'),
      tag: tag.toString('hex')
    };
  }

  /**
   * Decrypt file content
   */
  decryptBuffer(encrypted: Buffer, iv: string, tag: string): Buffer {
    if (!this.key) {
      throw new Error('Encryption key not initialized');
    }

    const decipher = createDecipheriv(
      this.algorithm,
      this.key,
      Buffer.from(iv, 'hex')
    ) as DecipherGCM;
    
    decipher.setAuthTag(Buffer.from(tag, 'hex'));
    
    return Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]);
  }

  /**
   * Rotate key (re-encrypt with new key)
   * Use when changing encryption password
   */
  async rotateKey(
    encryptedData: Array<{ encrypted: string; iv: string; tag: string }>,
    newPassword: string
  ): Promise<Array<{ encrypted: string; iv: string; tag: string }>> {
    // Save current key
    const oldKey = this.key;
    
    try {
      // Set new key
      this.key = scryptSync(newPassword, 'azenith-salt-v1', 32);
      
      // Decrypt with old key and re-encrypt with new key
      const results = [];
      for (const data of encryptedData) {
        const decrypted = this.decrypt(data.encrypted, data.iv, data.tag);
        results.push(this.encrypt(decrypted));
      }
      
      return results;
    } finally {
      // Restore old key
      this.key = oldKey;
    }
  }
}

export const encryption = new EncryptionService();

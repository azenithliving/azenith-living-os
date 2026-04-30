// Service: Local Storage (Encrypted)
// تخزين مشفر للبيانات الحساسة

import { createHash, createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';

export class LocalStorageService {
  private key: Buffer;
  
  constructor(password: string) {
    // اشتق مفتاح 32 بايت من الباسورد
    this.key = createHash('sha256').update(password).digest();
  }
  
  // تشفير النص
  encrypt(data: string): { encrypted: string; iv: string; tag: string } {
    const iv = randomBytes(16);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const tag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      tag: tag.toString('hex')
    };
  }
  
  // فك التشفير
  decrypt(encrypted: string, iv: string, tag: string): string {
    const decipher = createDecipheriv(
      ALGORITHM,
      this.key,
      Buffer.from(iv, 'hex')
    );
    
    decipher.setAuthTag(Buffer.from(tag, 'hex'));
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
  
  // تخزين بيانات مشفرة
  async storeSecurely(key: string, data: any, userId: string): Promise<void> {
    const { supabaseServer } = await import('@/lib/dal/unified-supabase');
    
    const serialized = JSON.stringify(data);
    const { encrypted, iv, tag } = this.encrypt(serialized);
    
    await supabaseServer
      .from('agent_memory')
      .upsert({
        key,
        user_id: userId,
        memory_type: 'encrypted_data',
        value: { encrypted, iv, tag },
        importance_score: 0.8,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'key'
      });
  }
  
  // جلب بيانات مشفرة
  async retrieveSecurely(key: string, userId: string): Promise<any | null> {
    const { supabaseServer } = await import('@/lib/dal/unified-supabase');
    
    const { data } = await supabaseServer
      .from('agent_memory')
      .select('value')
      .eq('key', key)
      .eq('user_id', userId)
      .eq('memory_type', 'encrypted_data')
      .single();
    
    if (!data?.value) return null;
    
    try {
      const decrypted = this.decrypt(
        data.value.encrypted,
        data.value.iv,
        data.value.tag
      );
      return JSON.parse(decrypted);
    } catch {
      return null;
    }
  }
}

// انسخ الباسورد من متغير البيئة
export const localStorage = new LocalStorageService(
  process.env.ENCRYPTION_PASSWORD || 'default-password-change-in-production'
);

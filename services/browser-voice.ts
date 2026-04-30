// Service: Browser Voice (TTS/STT)
// تحويل النص لكلام والكلام لنص - مجاني عبر Web Speech API

export interface VoiceConfig {
  language: string;
  voice_name?: string;
  rate: number;
  pitch: number;
  volume: number;
}

export class BrowserVoiceService {
  private defaultConfig: VoiceConfig = {
    language: 'ar-SA',  // عربي افتراضي
    rate: 1.0,
    pitch: 1.0,
    volume: 1.0
  };
  
  // إعدادات تحويل النص لكلام (TTS)
  getTTSConfig(overrides?: Partial<VoiceConfig>): VoiceConfig {
    return { ...this.defaultConfig, ...overrides };
  }
  
  // إعدادات تحويل الكلام لنص (STT)
  getSTTConfig(language?: string): { 
    language: string; 
    continuous: boolean; 
    interimResults: boolean;
  } {
    return {
      language: language || 'ar-SA',
      continuous: true,
      interimResults: true
    };
  }
  
  // تحضير بيانات الصوت للـ Client
  async generateVoicePayload(
    text: string, 
    config?: Partial<VoiceConfig>
  ): Promise<{
    text: string;
    config: VoiceConfig;
    cache_key: string;
  }> {
    const finalConfig = this.getTTSConfig(config);
    const cacheKey = this.generateCacheKey(text, finalConfig);
    
    return {
      text,
      config: finalConfig,
      cache_key: cacheKey
    };
  }
  
  // قوالب صوتية جاهزة
  getVoiceTemplate(templateName: string, variables: Record<string, string>): string {
    const templates: Record<string, string> = {
      'task_complete': 'تم إنجاز المهمة: {{task_title}} بنجاح',
      'task_failed': 'فشلت المهمة: {{task_title}}. السبب: {{error}}',
      'approval_needed': 'تحتاج موافقة على: {{item}}. المبلغ: {{amount}}',
      'reminder': 'تذكير: {{message}}',
      'greeting': 'مرحباً {{name}}، أنا {{agent_name}} مساعدك الذكي'
    };
    
    let text: string = templates[templateName] || templateName;
    
    // استبدل المتغيرات
    for (const [key, value] of Object.entries(variables)) {
      text = text.replace(`{{${key}}}`, value);
    }
    
    return text;
  }
  
  private generateCacheKey(text: string, config: VoiceConfig): string {
    return `${Buffer.from(text.slice(0, 50)).toString('base64')}_${config.language}`;
  }
}

export const browserVoice = new BrowserVoiceService();

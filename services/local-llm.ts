// Service: Local LLM (Ollama)
// ذكاء اصطناعي محلي مجاني عبر Ollama

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  content: string;
  model: string;
  done: boolean;
}

export class LocalLLMService {
  private baseUrl: string;
  
  constructor() {
    this.baseUrl = process.env.LOCAL_LLM_URL || 'http://localhost:11434';
  }
  
  // محادثة مع LLM
  async chat(messages: LLMMessage[], model: string = 'llama3.2'): Promise<LLMResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages,
          stream: false,
          options: {
            temperature: 0.7,
            num_predict: 2048
          }
        })
      });
      
      if (!response.ok) {
        throw new Error(`LLM error: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('LLM Chat Error:', error);
      // رجع رد افتراضي لو في مشكلة
      return {
        content: 'عذراً، لا يمكنني الاتصال بنموذج الذكاء الاصطناعي المحلي. تأكد من تشغيل Ollama.',
        model,
        done: true
      };
    }
  }
  
  // توليد كود
  async generateCode(prompt: string, language: string = 'typescript'): Promise<string> {
    const messages: LLMMessage[] = [
      {
        role: 'system',
        content: `أنت مبرمج محترف في ${language}. اكتب كود نظيف و documented. ارجع الكود فقط بدون شرح.`
      },
      { role: 'user', content: prompt }
    ];
    
    const response = await this.chat(messages, 'codellama');
    return response.content;
  }
  
  // تحليل مهمة
  async analyzeTask(taskDescription: string): Promise<{
    steps: string[];
    estimated_time: number;
    tools_needed: string[];
  }> {
    const messages: LLMMessage[] = [
      {
        role: 'system',
        content: 'أنت محلل مهام. قسم المهام لخطوات. رد بـ JSON فقط.'
      },
      {
        role: 'user',
        content: `حلل هذه المهمة: "${taskDescription}". ارجع: {steps: string[], estimated_time: number (minutes), tools_needed: string[]}`
      }
    ];
    
    const response = await this.chat(messages, 'mistral');
    
    try {
      return JSON.parse(response.content);
    } catch {
      // fallback
      return {
        steps: ['مراجعة المتطلبات', 'التنفيذ', 'الاختبار'],
        estimated_time: 60,
        tools_needed: ['browser', 'code_editor']
      };
    }
  }
  
  // اقتراحات تحسين التصميم
  async suggestDesignImprovements(currentDesign: string): Promise<string[]> {
    const messages: LLMMessage[] = [
      {
        role: 'system',
        content: 'أنت خبير في تصميم الأثاث. اقترح تحسينات للتصاميم.'
      },
      {
        role: 'user',
        content: `راجع هذا التصميم واقترح 3-5 تحسينات: "${currentDesign}"`
      }
    ];
    
    const response = await this.chat(messages, 'llama3.2');
    
    // parse bullet points
    return response.content
      .split('\n')
      .filter(line => line.trim().startsWith('-') || line.trim().match(/^\d+\./))
      .map(line => line.replace(/^[\s\-\d.]+/, '').trim())
      .filter(line => line.length > 10);
  }
  
  // تحليل مشاعر العميل (Sentiment Analysis)
  async analyzeSentiment(text: string): Promise<{
    sentiment: 'positive' | 'neutral' | 'negative';
    confidence: number;
    key_phrases: string[];
  }> {
    const messages: LLMMessage[] = [
      {
        role: 'system',
        content: 'أنت محلل مشاعر. حلل النص وحدد المشاعر. رد بـ JSON: {sentiment: string, confidence: number, key_phrases: string[]}'
      },
      {
        role: 'user',
        content: `حلل مشاعر هذا النص: "${text}"`
      }
    ];
    
    const response = await this.chat(messages, 'mistral');
    
    try {
      return JSON.parse(response.content);
    } catch {
      return {
        sentiment: 'neutral',
        confidence: 0.5,
        key_phrases: []
      };
    }
  }
  
  // توليد وصف منتج
  async generateProductDescription(productName: string, features: string[]): Promise<string> {
    const messages: LLMMessage[] = [
      {
        role: 'system',
        content: 'أنت كاتب محتوى متخصص في الأثاث. اكتب وصفاً جذاباً للمنتج.'
      },
      {
        role: 'user',
        content: `اكتب وصفاً للمنتج: ${productName}. المميزات: ${features.join(', ')}`
      }
    ];
    
    const response = await this.chat(messages, 'llama3.2');
    return response.content;
  }
}

export const localLLM = new LocalLLMService();

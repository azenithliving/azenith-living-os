/**
 * Local OCR Service
 * Uses Tesseract.js for text recognition from images
 * 100% free, no cloud APIs needed
 */

export class LocalOCRService {
  private initialized: boolean = false;
  private tesseract: any = null;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Dynamic import to avoid SSR issues
      const { createWorker } = await import('tesseract.js');
      this.tesseract = { createWorker };
      this.initialized = true;
      console.log('[OCR] Tesseract.js initialized');
    } catch (error) {
      console.error('[OCR] Failed to initialize Tesseract.js:', error);
      throw new Error('OCR initialization failed');
    }
  }

  /**
   * Recognize text from an image
   * @param imageSource - URL, File, or Buffer of the image
   * @param language - Language code (default: 'ara+eng' for Arabic + English)
   * @returns Recognized text and confidence
   */
  async recognize(
    imageSource: string | File | Buffer,
    language: string = 'ara+eng'
  ): Promise<{
    text: string;
    confidence: number;
    words: Array<{ text: string; confidence: number; bbox: any }>;
  }> {
    await this.initialize();

    try {
      const worker = await this.tesseract.createWorker(language);
      
      const result = await worker.recognize(imageSource);
      
      await worker.terminate();

      return {
        text: result.data.text,
        confidence: result.data.confidence,
        words: result.data.words.map((w: any) => ({
          text: w.text,
          confidence: w.confidence,
          bbox: w.bbox
        }))
      };
    } catch (error) {
      console.error('[OCR] Recognition error:', error);
      return {
        text: '',
        confidence: 0,
        words: []
      };
    }
  }

  /**
   * Extract specific data patterns from text
   * Useful for extracting phone numbers, prices, dates, etc.
   */
  async extractData(
    imageSource: string | File | Buffer,
    patterns: Array<'phone' | 'price' | 'date' | 'email' | 'id_number'>
  ): Promise<Record<string, string[]>> {
    const { text } = await this.recognize(imageSource);
    
    const results: Record<string, string[]> = {};
    
    const regexPatterns = {
      phone: /(?:\+?2)?0?1[0-2,5]{1}[0-9]{8}/g,
      price: /(?:\d{1,3}(?:,\d{3})*\.?\d*)\s*(?:ج|جنيه|EGP|LE|£|\$)/gi,
      date: /\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/g,
      email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
      id_number: /\d{14}/g
    };

    for (const pattern of patterns) {
      const regex = regexPatterns[pattern];
      if (regex) {
        const matches = text.match(regex) || [];
        results[pattern] = [...new Set(matches)]; // Remove duplicates
      }
    }

    return results;
  }

  /**
   * Batch process multiple images
   */
  async batchRecognize(
    images: Array<string | File | Buffer>,
    language: string = 'ara+eng'
  ): Promise<Array<{ source: number; result: { text: string; confidence: number } }>> {
    const results = [];
    
    for (let i = 0; i < images.length; i++) {
      const result = await this.recognize(images[i], language);
      results.push({ source: i, result });
    }
    
    return results;
  }

  /**
   * Check if OCR is available
   */
  isAvailable(): boolean {
    return this.initialized;
  }
}

export const localOCR = new LocalOCRService();

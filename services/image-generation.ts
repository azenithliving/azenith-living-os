// Service: Image Generation (Stable Diffusion)
// توليد صور بالذكاء الاصطناعي - مجاني عبر Stable Diffusion المحلي

export interface ImageGenerationRequest {
  prompt: string;
  negative_prompt?: string;
  width?: number;
  height?: number;
  steps?: number;
  cfg_scale?: number;
}

export class ImageGenerationService {
  private baseUrl: string;
  
  constructor() {
    this.baseUrl = process.env.STABLE_DIFFUSION_URL || 'http://localhost:7860';
  }
  
  // توليد صورة
  async generateImage(request: ImageGenerationRequest): Promise<{
    image_url: string;
    seed: number;
    generation_time: number;
  }> {
    const payload = {
      prompt: request.prompt,
      negative_prompt: request.negative_prompt || 'blurry, low quality, watermark, text, signature',
      width: request.width || 512,
      height: request.height || 512,
      steps: request.steps || 30,
      cfg_scale: request.cfg_scale || 7,
      sampler_name: 'DPM++ 2M Karras'
    };
    
    try {
      const response = await fetch(`${this.baseUrl}/sdapi/v1/txt2img`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        throw new Error(`Image generation failed: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Convert base64 to data URL
      return {
        image_url: `data:image/png;base64,${data.images[0]}`,
        seed: data.seed,
        generation_time: data.generation_time || 0
      };
    } catch (error) {
      console.error('Image generation error:', error);
      // Return placeholder if SD not running
      return {
        image_url: '/placeholder-furniture.jpg',
        seed: 0,
        generation_time: 0
      };
    }
  }
  
  // توليد تصميم أثاث
  async generateFurnitureDesign(
    style: string,
    roomType: string,
    dimensions: string,
    materialPreferences: string[],
    colorScheme?: string
  ): Promise<{
    design_url: string;
    description: string;
    prompt_used: string;
  }> {
    const prompt = `Custom ${style} furniture for ${roomType}, ${dimensions}, made of ${materialPreferences.join(' and ')}, ${colorScheme || 'warm tones'}, professional furniture photography, studio lighting, white background, high quality render, 4k detailed, photorealistic, interior design magazine style`;
    
    const result = await this.generateImage({
      prompt,
      width: 768,
      height: 512,
      steps: 40
    });
    
    return {
      design_url: result.image_url,
      description: `${style} furniture for ${roomType} (${dimensions})`,
      prompt_used: prompt
    };
  }
  
  // توليد أشكال مختلفة لنفس التصميم
  async generateVariations(basePrompt: string, count: number = 3): Promise<string[]> {
    const variations: string[] = [];
    
    for (let i = 0; i < count; i++) {
      const result = await this.generateImage({
        prompt: `${basePrompt}, variation ${i + 1}, different angle`,
        width: 768,
        height: 512,
        steps: 35
      });
      variations.push(result.image_url);
    }
    
    return variations;
  }
  
  // توليد صورة غرفة كاملة
  async generateRoomVisualization(
    roomType: string,
    style: string,
    furniture: string[],
    colorPalette: string
  ): Promise<{
    room_url: string;
    furniture_placements: string[];
  }> {
    const prompt = `Modern ${roomType} interior design, ${style} style, featuring ${furniture.join(', ')}, ${colorPalette} color palette, natural lighting, spacious layout, high-end furniture, realistic render, architectural visualization, 4k quality`;
    
    const result = await this.generateImage({
      prompt,
      width: 1024,
      height: 768,
      steps: 50,
      cfg_scale: 8
    });
    
    return {
      room_url: result.image_url,
      furniture_placements: furniture
    };
  }
}

export const imageGeneration = new ImageGenerationService();

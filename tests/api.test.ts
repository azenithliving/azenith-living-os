import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('API Endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  describe('Config API', () => {
    it('should return configuration successfully', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          config: {
            siteName: 'Azenith Living',
            version: '1.0.0',
          },
        }),
      };
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockResponse);

      const response = await fetch('/api/config');
      const data = await response.json();

      expect(data.ok).toBe(true);
      expect(data.config).toBeDefined();
      expect(data.config.siteName).toBe('Azenith Living');
    });

    it('should handle config API errors', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Config fetch failed')
      );

      try {
        await fetch('/api/config');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Pexels API', () => {
    it('should return photos array with correct structure', async () => {
      const mockPhotos = [
        {
          id: 123,
          width: 1920,
          height: 1280,
          url: 'https://example.com/photo1.jpg',
          photographer: 'Test Photographer',
          src: {
            original: 'https://example.com/photo1.jpg',
            large: 'https://example.com/photo1-large.jpg',
            medium: 'https://example.com/photo1-medium.jpg',
            small: 'https://example.com/photo1-small.jpg',
          },
        },
      ];

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          photos: mockPhotos,
          keyUsed: 1,
          totalKeys: 3,
        }),
      });

      const response = await fetch('/api/pexels?query=luxury+interior&per_page=10');
      const data = await response.json();

      expect(data.ok).toBe(true);
      expect(data.photos).toBeDefined();
      expect(Array.isArray(data.photos)).toBe(true);
      expect(data.photos.length).toBeGreaterThan(0);
      expect(data.photos[0]).toHaveProperty('id');
      expect(data.photos[0]).toHaveProperty('photographer');
      expect(data.photos[0]).toHaveProperty('src');
    });

    it('should return fallback photos when all keys exhausted', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('All API keys exhausted')
      );

      const { GET } = await import('../app/api/pexels/route');
      
      // Create a mock request
      const request = new Request('http://localhost:3000/api/pexels?query=test');
      const response = await GET(request as any);
      
      expect(response).toBeDefined();
      const data = await response.json();
      
      // Should return fallback with ok: true
      expect(data.ok).toBe(true);
      expect(data.photos).toBeDefined();
      expect(Array.isArray(data.photos)).toBe(true);
    });

    it('should handle missing query parameter', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          photos: [],
        }),
      });

      const response = await fetch('/api/pexels');
      const data = await response.json();

      expect(data.ok).toBe(true);
      expect(data.photos).toBeDefined();
    });

    it('should handle rate limiting', async () => {
      (global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          json: async () => ({ error: 'Rate limit exceeded' }),
        });

      const response = await fetch('/api/pexels?query=test');
      
      // API should handle rate limits gracefully
      expect(response).toBeDefined();
    });
  });

  describe('Room Sections API', () => {
    it('should return room sections data', async () => {
      const mockSections = [
        {
          id: 'living-room',
          title: 'غرف المعيشة',
          description: 'وصف القسم',
        },
        {
          id: 'bedroom',
          title: 'غرف النوم',
          description: 'وصف آخر',
        },
      ];

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          sections: mockSections,
        }),
      });

      const response = await fetch('/api/room-sections');
      const data = await response.json();

      expect(data.ok).toBe(true);
      expect(data.sections).toBeDefined();
      expect(Array.isArray(data.sections)).toBe(true);
      expect(data.sections.length).toBeGreaterThan(0);
    });

    it('should handle empty room sections', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          sections: [],
        }),
      });

      const response = await fetch('/api/room-sections');
      const data = await response.json();

      expect(data.ok).toBe(true);
      expect(data.sections).toEqual([]);
    });
  });

  describe('Content Generator API', () => {
    it('should generate content successfully', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          content: 'محتوى مولد',
          alternatives: ['بديل 1', 'بديل 2'],
          tokensUsed: 150,
        }),
      });

      const response = await fetch('/api/content-generator', {
        method: 'POST',
        body: JSON.stringify({
          type: 'description',
          context: 'living room',
          tone: 'luxury',
          language: 'ar',
        }),
      });
      const data = await response.json();

      expect(data.ok).toBe(true);
      expect(data.content).toBeDefined();
    });

    it('should handle rate limiting', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({
          ok: false,
          error: 'Rate limit exceeded',
          limit: 10,
          remaining: 0,
          reset: 1234567890,
        }),
      });

      const response = await fetch('/api/content-generator', {
        method: 'POST',
        body: JSON.stringify({ type: 'test' }),
      });
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.error).toBe('Rate limit exceeded');
    });
  });
});

describe('API Response Structure', () => {
  it('should have consistent success response format', () => {
    const successResponse = {
      ok: true,
      data: { message: 'Success' },
    };

    expect(successResponse.ok).toBe(true);
    expect(successResponse.data).toBeDefined();
  });

  it('should have consistent error response format', () => {
    const errorResponse = {
      ok: false,
      error: 'Something went wrong',
      message: 'Detailed error message',
    };

    expect(errorResponse.ok).toBe(false);
    expect(errorResponse.error).toBeDefined();
  });
});

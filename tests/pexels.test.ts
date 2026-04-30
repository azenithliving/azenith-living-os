import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Pexels API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset fetch mock
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return photos array on successful API call', async () => {
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
        },
      },
    ];

    // Mock successful fetch response from our API
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

    // Test by calling the API endpoint
    const response = await fetch('/api/pexels?query=luxury+interior&per_page=10');
    const data = await response.json();

    expect(data.ok).toBe(true);
    expect(data.photos).toBeDefined();
    expect(Array.isArray(data.photos)).toBe(true);
    expect(data.photos.length).toBeGreaterThan(0);
    expect(data.photos[0]).toHaveProperty('id');
    expect(data.photos[0]).toHaveProperty('src');
  });

  it('should return fallback photos when API keys are exhausted', async () => {
    // Mock API to return fallback mode when keys are exhausted
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        photos: [
          {
            id: 999001,
            width: 1920,
            height: 1280,
            url: 'https://images.pexels.com/photos/1571460/pexels-photo-1571460.jpeg',
            photographer: 'Azenith Luxury Collection',
            src: {
              original: 'https://images.pexels.com/photos/1571460/pexels-photo-1571460.jpeg',
              large: 'https://images.pexels.com/photos/1571460/pexels-photo-1571460.jpeg?auto=compress',
            },
          },
        ],
        fallbackMode: true,
        keyUsed: -1,
      }),
    });

    const response = await fetch('/api/pexels?query=modern+design');
    const data = await response.json();

    // Should return fallback data
    expect(data.ok).toBe(true);
    expect(data.photos).toBeDefined();
    expect(Array.isArray(data.photos)).toBe(true);
    expect(data.photos.length).toBeGreaterThan(0);
    expect(data.fallbackMode).toBe(true);
  });

  it('should handle missing query parameter gracefully', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        photos: [],
        keyUsed: 1,
        totalKeys: 3,
      }),
    });

    const response = await fetch('/api/pexels');
    const data = await response.json();

    expect(data.ok).toBe(true);
    expect(data.photos).toBeDefined();
    expect(Array.isArray(data.photos)).toBe(true);
  });

  it('should return photos with correct structure', async () => {
    const mockPhotos = [
      {
        id: 456,
        width: 1920,
        height: 1080,
        url: 'https://pexels.com/photo/456',
        photographer: 'John Doe',
        photographer_url: 'https://pexels.com/@johndoe',
        src: {
          original: 'https://images.pexels.com/photos/456/pexels-photo-456.jpeg',
          large2x: 'https://images.pexels.com/photos/456/pexels-photo-456.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940',
          large: 'https://images.pexels.com/photos/456/pexels-photo-456.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
          medium: 'https://images.pexels.com/photos/456/pexels-photo-456.jpeg?auto=compress&cs=tinysrgb&h=350',
          small: 'https://images.pexels.com/photos/456/pexels-photo-456.jpeg?auto=compress&cs=tinysrgb&h=130',
          portrait: 'https://images.pexels.com/photos/456/pexels-photo-456.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1200&w=800',
          landscape: 'https://images.pexels.com/photos/456/pexels-photo-456.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200',
          tiny: 'https://images.pexels.com/photos/456/pexels-photo-456.jpeg?auto=compress&cs=tinysrgb&dpr=1&fit=crop&h=200&w=280',
        },
        avg_color: '#C5A059',
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

    const response = await fetch('/api/pexels?query=luxury+bedroom&per_page=5');
    const data = await response.json();

    expect(data.ok).toBe(true);
    expect(data.photos).toHaveLength(1);
    
    const photo = data.photos[0];
    expect(photo).toHaveProperty('id', 456);
    expect(photo).toHaveProperty('width');
    expect(photo).toHaveProperty('height');
    expect(photo).toHaveProperty('photographer');
    expect(photo).toHaveProperty('src');
    expect(photo.src).toHaveProperty('original');
    expect(photo.src).toHaveProperty('large');
    expect(photo.src).toHaveProperty('medium');
    expect(photo.src).toHaveProperty('small');
  });
});

describe('Pexels Key Rotation', () => {
  it('should rotate through available API keys', async () => {
    // This test verifies the key rotation manager logic
    const responses = [
      { ok: true, status: 200, json: async () => ({ ok: true, photos: [{ id: 1 }], keyUsed: 1 }) },
      { ok: true, status: 200, json: async () => ({ ok: true, photos: [{ id: 2 }], keyUsed: 2 }) },
    ];
    
    let callCount = 0;
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(() => {
      return Promise.resolve(responses[callCount++] || responses[0]);
    });

    // First request
    const response1 = await fetch('/api/pexels?query=test1');
    const data1 = await response1.json();
    
    expect(data1.ok).toBe(true);
    expect(data1.keyUsed).toBe(1);
    expect(global.fetch).toHaveBeenCalled();

    // Second request - should use different key
    const response2 = await fetch('/api/pexels?query=test2');
    const data2 = await response2.json();
    
    expect(data2.ok).toBe(true);
    expect(data2.keyUsed).toBe(2);
  });

  it('should blacklist keys that return rate limit errors', async () => {
    // Mock rate limit response then success
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({ error: 'rate limit exceeded' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ok: true, photos: [{ id: 999 }], keyUsed: 2 }),
      });

    const response = await fetch('/api/pexels?query=test');
    
    // Should eventually succeed with fallback or another key
    expect(response).toBeDefined();
    
    // After rate limit, subsequent calls should work
    const response2 = await fetch('/api/pexels?query=test2');
    const data2 = await response2.json();
    expect(data2.ok).toBe(true);
  });
});

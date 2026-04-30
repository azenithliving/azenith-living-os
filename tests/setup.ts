// Test setup file
import { vi } from 'vitest';

// Mock Next.js modules
vi.mock('next/server', () => ({
  NextRequest: class MockNextRequest {
    url: string;
    constructor(url: string) {
      this.url = url;
    }
  },
  NextResponse: {
    json: (data: unknown, init?: ResponseInit) => {
      return new Response(JSON.stringify(data), {
        ...init,
        headers: { 'Content-Type': 'application/json' },
      });
    },
  },
}));

// Mock environment variables
process.env.NEXT_PUBLIC_PEXELS_API_KEY = 'test-key';
process.env.PEXELS_API_KEY = 'test-key';
process.env.PEXELS_KEYS = 'test-key-1,test-key-2';

/**
 * VANGUARD Search Tool Adapter
 * 
 * أداة البحث على الويب - التكامل مع SerpStack API
 * Web search integration for external knowledge retrieval
 */

import { z } from 'zod';
import { rateLimiter } from '@/lib/vanguard/observability/rate_limiter';
import { cacheManager } from '@/lib/vanguard/observability/cache_manager';
import type {
  ToolAdapter,
  ToolDefinition,
  ToolExecutionContext,
  ToolExecutionResult
} from '../tool_registry';

// ============================================================================
// Types
// ============================================================================

export interface SearchResult {
  title: string;
  snippet: string;
  url: string;
  position: number;
  domain?: string;
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
  totalResults?: number;
  searchTime?: number;
  cached?: boolean;
}

interface SerpStackResponse {
  request: {
    query: string;
    language?: string;
  };
  search_information?: {
    total_results?: number;
    time_taken?: number;
  };
  organic_results?: Array<{
    position: number;
    title: string;
    link: string;
    domain?: string;
    snippet?: string;
    displayed_link?: string;
  }>;
  error?: {
    code: string;
    message: string;
    info: string;
  };
}

// ============================================================================
// Schemas
// ============================================================================

const SearchSchema = z.object({
  query: z.string().min(1).max(500),
  language: z.enum(['ar', 'en']).optional(),
  num: z.number().min(1).max(10).optional(),
  country: z.enum(['eg', 'sa', 'ae', 'us', 'uk']).optional(),
  excludeDomains: z.array(z.string()).optional(),
  useCache: z.boolean().optional()
});

const DomainSearchSchema = z.object({
  query: z.string().min(1).max(500),
  domain: z.string().min(1),
  language: z.enum(['ar', 'en']).optional(),
  num: z.number().min(1).max(10).optional()
});

const CompetitorSearchSchema = z.object({
  product: z.string().min(1),
  competitors: z.array(z.string()).min(1).max(5),
  language: z.enum(['ar', 'en']).optional()
});

// ============================================================================
// Search Adapter
// ============================================================================

class SearchAdapter implements ToolAdapter<z.infer<typeof SearchSchema>, SearchResponse> {
  definition: ToolDefinition = {
    id: 'web_search',
    name: 'Web Search',
    nameAr: 'البحث على الويب',
    description: 'Search the web using SerpStack API',
    descriptionAr: 'البحث في الإنترنت للحصول على معلومات خارجية',
    category: 'search',
    riskLevel: 'LOW',
    parameters: [
      {
        name: 'query',
        type: 'string',
        description: 'Search query',
        required: true,
        examples: ['أسعار الأثاث في مصر', 'modern bedroom furniture Egypt']
      },
      {
        name: 'language',
        type: 'string',
        description: 'Search language (ar or en)',
        required: false,
        default: 'ar',
        examples: ['ar', 'en']
      },
      {
        name: 'num',
        type: 'number',
        description: 'Number of results (1-10)',
        required: false,
        default: 5,
        examples: [5, 10]
      },
      {
        name: 'useCache',
        type: 'boolean',
        description: 'Use cached results if available',
        required: false,
        default: true,
        examples: [true, false]
      }
    ],
    returns: {
      type: 'SearchResponse',
      description: 'Search results with titles, snippets, and URLs',
      descriptionAr: 'نتائج البحث مع العناوين والمقتطفات والروابط'
    },
    examples: [
      {
        input: { query: 'أثاث غرف النوم الفاخر', language: 'ar', num: 5 },
        output: {
          query: 'أثاث غرف النوم الفاخر',
          results: [
            {
              title: 'أثاث غرف النوم الفاخر',
              snippet: 'نقدم أفضل أثاث غرف النوم...',
              url: 'https://example.com',
              position: 1
            }
          ]
        },
        description: 'Search for luxury bedroom furniture in Arabic'
      }
    ],
    rateLimit: {
      maxCalls: 100,
      windowMs: 30 * 24 * 60 * 60 * 1000 // 30 days (SerpStack free tier)
    }
  };

  validate(input: unknown): { valid: boolean; errors?: string[] } {
    const result = SearchSchema.safeParse(input);
    if (result.success) {
      return { valid: true };
    }
    return {
      valid: false,
      errors: result.error.issues.map(e => `${e.path.join('.')}: ${e.message}`)
    };
  }

  async isAvailable(): Promise<boolean> {
    const apiKey = process.env.SERPSTACK_API_KEY;
    return !!apiKey;
  }

  async execute(
    input: z.infer<typeof SearchSchema>,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult<SearchResponse>> {
    const startTime = Date.now();

    try {
      const apiKey = process.env.SERPSTACK_API_KEY;
      if (!apiKey) {
        return {
          success: false,
          error: {
            code: 'API_KEY_MISSING',
            message: 'SERPSTACK_API_KEY environment variable not set',
            messageAr: 'مفتاح API غير متوفر'
          },
          metadata: {
            toolId: this.definition.id,
            executionTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
          }
        };
      }

      // Check rate limit
      const allowed = await rateLimiter.check('serpstack');
      if (!allowed) {
        return {
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'SerpStack rate limit exceeded',
            messageAr: 'تم تجاوز حد الاستخدام المسموح'
          },
          metadata: {
            toolId: this.definition.id,
            executionTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
          }
        };
      }

      // Check cache
      const useCache = input.useCache !== false;
      const cacheKey = `search:${input.query}:${input.language || 'ar'}:${input.num || 5}`;
      
      if (useCache) {
        const cached = await cacheManager.get<SearchResponse>(cacheKey);
        if (cached) {
          return {
            success: true,
            data: { ...cached, cached: true },
            metadata: {
              toolId: this.definition.id,
              executionTimeMs: Date.now() - startTime,
              timestamp: new Date().toISOString(),
              cached: true
            }
          };
        }
      }

      // Build API URL
      const query = encodeURIComponent(input.query);
      const language = input.language || 'ar';
      const num = input.num || 5;
      const country = input.country || (language === 'ar' ? 'eg' : 'us');
      
      const url = `http://api.serpstack.com/search?access_key=${apiKey}&query=${query}&num=${num}&language=${language}&country=${country}`;

      // Make API request
      const response = await fetch(url, {
        signal: AbortSignal.timeout(10000)
      });

      if (!response.ok) {
        return {
          success: false,
          error: {
            code: 'API_REQUEST_FAILED',
            message: `SerpStack API returned ${response.status}`,
            messageAr: 'فشل الاتصال بخدمة البحث'
          },
          metadata: {
            toolId: this.definition.id,
            executionTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
          }
        };
      }

      const data = (await response.json()) as SerpStackResponse;

      // Check for API error
      if (data.error) {
        return {
          success: false,
          error: {
            code: 'SERPSTACK_ERROR',
            message: data.error.message,
            messageAr: 'حدث خطأ في خدمة البحث',
            details: { error: data.error }
          },
          metadata: {
            toolId: this.definition.id,
            executionTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
          }
        };
      }

      // Parse results
      const organicResults = data.organic_results || [];
      const results: SearchResult[] = organicResults
        .filter(r => r.title && r.link)
        .map(r => ({
          title: r.title,
          snippet: r.snippet || '',
          url: r.link,
          position: r.position,
          domain: r.domain
        }));

      // Filter excluded domains
      const excludeDomains = input.excludeDomains || [];
      const filteredResults = results.filter(r => {
        if (!r.domain) return true;
        return !excludeDomains.some(excluded => r.domain?.includes(excluded));
      });

      const searchResponse: SearchResponse = {
        query: input.query,
        results: filteredResults,
        totalResults: data.search_information?.total_results,
        searchTime: data.search_information?.time_taken,
        cached: false
      };

      // Cache results (24 hours)
      if (useCache && filteredResults.length > 0) {
        await cacheManager.set(cacheKey, searchResponse, 24 * 60 * 60 * 1000);
      }

      return {
        success: true,
        data: searchResponse,
        metadata: {
          toolId: this.definition.id,
          executionTimeMs: Date.now() - startTime,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'SEARCH_EXCEPTION',
          message: error instanceof Error ? error.message : 'Unknown error',
          messageAr: 'حدث خطأ أثناء البحث'
        },
        metadata: {
          toolId: this.definition.id,
          executionTimeMs: Date.now() - startTime,
          timestamp: new Date().toISOString()
        }
      };
    }
  }
}

// ============================================================================
// Domain-Specific Search Adapter
// ============================================================================

class DomainSearchAdapter implements ToolAdapter<z.infer<typeof DomainSearchSchema>, SearchResponse> {
  definition: ToolDefinition = {
    id: 'search_domain',
    name: 'Domain-Specific Search',
    nameAr: 'البحث في موقع محدد',
    description: 'Search within a specific domain',
    descriptionAr: 'البحث داخل موقع إلكتروني محدد',
    category: 'search',
    riskLevel: 'LOW',
    parameters: [
      {
        name: 'query',
        type: 'string',
        description: 'Search query',
        required: true,
        examples: ['غرف نوم']
      },
      {
        name: 'domain',
        type: 'string',
        description: 'Domain to search within',
        required: true,
        examples: ['ikea.com', 'homecenter.com.eg']
      },
      {
        name: 'language',
        type: 'string',
        description: 'Search language',
        required: false,
        default: 'ar',
        examples: ['ar', 'en']
      }
    ],
    returns: {
      type: 'SearchResponse',
      description: 'Search results from the specified domain',
      descriptionAr: 'نتائج البحث من الموقع المحدد'
    },
    examples: [
      {
        input: { query: 'غرف نوم', domain: 'ikea.com', language: 'ar' },
        output: { query: 'غرف نوم site:ikea.com', results: [] },
        description: 'Search for bedroom furniture on IKEA website'
      }
    ]
  };

  validate(input: unknown): { valid: boolean; errors?: string[] } {
    const result = DomainSearchSchema.safeParse(input);
    if (result.success) {
      return { valid: true };
    }
    return {
      valid: false,
      errors: result.error.issues.map(e => `${e.path.join('.')}: ${e.message}`)
    };
  }

  async isAvailable(): Promise<boolean> {
    const apiKey = process.env.SERPSTACK_API_KEY;
    return !!apiKey;
  }

  async execute(
    input: z.infer<typeof DomainSearchSchema>,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult<SearchResponse>> {
    // Use the base search adapter with site: operator
    const searchAdapter = new SearchAdapter();
    const siteQuery = `${input.query} site:${input.domain}`;
    
    return searchAdapter.execute(
      {
        query: siteQuery,
        language: input.language,
        num: input.num,
        useCache: true
      },
      context
    );
  }
}

// ============================================================================
// Competitor Search Adapter
// ============================================================================

class CompetitorSearchAdapter implements ToolAdapter<z.infer<typeof CompetitorSearchSchema>, Record<string, SearchResponse>> {
  definition: ToolDefinition = {
    id: 'search_competitors',
    name: 'Competitor Search',
    nameAr: 'البحث عن المنافسين',
    description: 'Search for a product across multiple competitor websites',
    descriptionAr: 'البحث عن منتج في مواقع المنافسين',
    category: 'search',
    riskLevel: 'LOW',
    parameters: [
      {
        name: 'product',
        type: 'string',
        description: 'Product to search for',
        required: true,
        examples: ['غرفة نوم كلاسيك']
      },
      {
        name: 'competitors',
        type: 'array',
        description: 'List of competitor domains',
        required: true,
        examples: [['ikea.com', 'homecenter.com.eg', 'mobilia.com.eg']]
      },
      {
        name: 'language',
        type: 'string',
        description: 'Search language',
        required: false,
        default: 'ar'
      }
    ],
    returns: {
      type: 'object',
      description: 'Search results keyed by competitor domain',
      descriptionAr: 'نتائج البحث مرتبة حسب المنافس'
    },
    examples: [
      {
        input: {
          product: 'غرفة نوم',
          competitors: ['ikea.com', 'homecenter.com.eg'],
          language: 'ar'
        },
        output: {
          'ikea.com': { query: 'غرفة نوم', results: [] },
          'homecenter.com.eg': { query: 'غرفة نوم', results: [] }
        },
        description: 'Search for bedroom set across two competitors'
      }
    ]
  };

  validate(input: unknown): { valid: boolean; errors?: string[] } {
    const result = CompetitorSearchSchema.safeParse(input);
    if (result.success) {
      return { valid: true };
    }
    return {
      valid: false,
      errors: result.error.issues.map(e => `${e.path.join('.')}: ${e.message}`)
    };
  }

  async isAvailable(): Promise<boolean> {
    const apiKey = process.env.SERPSTACK_API_KEY;
    return !!apiKey;
  }

  async execute(
    input: z.infer<typeof CompetitorSearchSchema>,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult<Record<string, SearchResponse>>> {
    const startTime = Date.now();

    try {
      const domainSearchAdapter = new DomainSearchAdapter();
      const results: Record<string, SearchResponse> = {};

      // Search each competitor domain
      for (const competitor of input.competitors) {
        const result = await domainSearchAdapter.execute(
          {
            query: input.product,
            domain: competitor,
            language: input.language,
            num: 3
          },
          context
        );

        if (result.success && result.data) {
          results[competitor] = result.data;
        } else {
          // Store empty results for failed searches
          results[competitor] = {
            query: input.product,
            results: []
          };
        }

        // Small delay between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      return {
        success: true,
        data: results,
        metadata: {
          toolId: this.definition.id,
          executionTimeMs: Date.now() - startTime,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'COMPETITOR_SEARCH_EXCEPTION',
          message: error instanceof Error ? error.message : 'Unknown error',
          messageAr: 'حدث خطأ أثناء البحث عن المنافسين'
        },
        metadata: {
          toolId: this.definition.id,
          executionTimeMs: Date.now() - startTime,
          timestamp: new Date().toISOString()
        }
      };
    }
  }
}

// ============================================================================
// Exports
// ============================================================================

export const searchAdapter = new SearchAdapter();
export const domainSearchAdapter = new DomainSearchAdapter();
export const competitorSearchAdapter = new CompetitorSearchAdapter();

// Register all search adapters
export function registerSearchAdapters(registry: { register: (adapter: ToolAdapter) => void }) {
  registry.register(searchAdapter);
  registry.register(domainSearchAdapter);
  registry.register(competitorSearchAdapter);
}

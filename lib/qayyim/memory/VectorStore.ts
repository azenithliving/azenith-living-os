/**
 * VectorStore - High-level vector operations for pgvector
 * Wrapper around SharedMemory with vector-specific operations
 */

import { sharedMemory, MemoryItem, SearchResult } from "./SharedMemory";

export interface VectorSearchOptions {
  query: string;
  agentKey?: string;
  memoryTypes?: MemoryItem['memory_type'][];
  limit?: number;
  minSimilarity?: number;
  tags?: string[];
  filter?: Record<string, any>;
}

export interface VectorStoreStats {
  totalVectors: number;
  dimensions: number;
  indexType: string;
  indexParams: Record<string, any>;
  memoryByAgent: Record<string, number>;
  memoryByType: Record<string, number>;
}

export class VectorStore {
  private initialized = false;

  constructor() {}

  async initialize(companyId?: string) {
    await sharedMemory.initialize(companyId);
    this.initialized = true;
  }

  /**
   * Add a vector with metadata
   */
  async add(
    content: string,
    metadata: Omit<MemoryItem, 'id' | 'content' | 'embedding' | 'created_at' | 'access_count' | 'last_accessed_at'>
  ): Promise<string> {
    if (!this.initialized) await this.initialize();
    
    return sharedMemory.store({
      content,
      ...metadata,
    });
  }

  /**
   * Search similar vectors
   */
  async search(options: VectorSearchOptions): Promise<SearchResult[]> {
    if (!this.initialized) await this.initialize();
    
    return sharedMemory.searchSimilar(options.query, {
      agentKey: options.agentKey,
      memoryTypes: options.memoryTypes,
      limit: options.limit,
      minSimilarity: options.minSimilarity,
      tags: options.tags,
    });
  }

  /**
   * Search by agent with type filtering
   */
  async searchByAgent(
    agentKey: string,
    query: string,
    options: {
      memoryTypes?: MemoryItem['memory_type'][];
      limit?: number;
      minSimilarity?: number;
    } = {}
  ): Promise<SearchResult[]> {
    return this.search({
      query,
      agentKey,
      memoryTypes: options.memoryTypes,
      limit: options.limit,
      minSimilarity: options.minSimilarity,
    });
  }

  /**
   * Search by memory type across all agents
   */
  async searchByType(
    memoryType: MemoryItem['memory_type'],
    query: string,
    options: {
      agentKey?: string;
      limit?: number;
      minSimilarity?: number;
    } = {}
  ): Promise<SearchResult[]> {
    return this.search({
      query,
      agentKey: options.agentKey,
      memoryTypes: [memoryType],
      limit: options.limit,
      minSimilarity: options.minSimilarity,
    });
  }

  /**
   * Get vector statistics
   */
  async getStats(agentKey?: string): Promise<VectorStoreStats> {
    if (!this.initialized) await this.initialize();
    
    const stats = await sharedMemory.getStats(agentKey);
    
    return {
      totalVectors: stats.totalMemories,
      dimensions: 1536,
      indexType: 'HNSW',
      indexParams: { m: 16, ef_construction: 64 },
      memoryByAgent: stats.byAgent,
      memoryByType: stats.byType,
    };
  }

  /**
   * Delete vectors by filter
   */
  async deleteByFilter(filter: {
    agentKey?: string;
    memoryType?: MemoryItem['memory_type'];
    tags?: string[];
    olderThan?: Date;
  }): Promise<number> {
    if (!this.initialized) await this.initialize();
    
    // This would need a more complex implementation
    // For now, use sharedMemory.delete for individual items
    return 0;
  }

  /**
   * Batch add multiple vectors
   */
  async batchAdd(
    items: Array<{
      content: string;
      metadata: Omit<MemoryItem, 'id' | 'content' | 'embedding' | 'created_at' | 'access_count' | 'last_accessed_at'>;
    }>
  ): Promise<string[]> {
    if (!this.initialized) await this.initialize();
    
    const ids: string[] = [];
    for (const item of items) {
      const id = await sharedMemory.store({
        content: item.content,
        ...item.metadata,
      });
      ids.push(id);
    }
    return ids;
  }

  /**
   * Find nearest neighbors for a given vector ID
   */
  async findNeighbors(
    vectorId: string,
    options: {
      limit?: number;
      minSimilarity?: number;
      excludeSelf?: boolean;
    } = {}
  ): Promise<SearchResult[]> {
    if (!this.initialized) await this.initialize();
    
    const vector = await sharedMemory.getById(vectorId);
    if (!vector || !vector.embedding) return [];
    
    // Convert embedding array back to text for search
    // This is a workaround - in production, you'd query directly by vector
    const query = `[${vector.embedding.join(',')}]`;
    
    return this.search({
      query,
      limit: options.limit || 10,
      minSimilarity: options.minSimilarity || 0.8,
    }).then(results => 
      options.excludeSelf 
        ? results.filter(r => r.item.id !== vectorId)
        : results
    );
  }
}

export const vectorStore = new VectorStore();

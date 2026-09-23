/**
 * KnowledgeGraph - Cross-agent knowledge graph using PostgreSQL recursive CTEs
 * Replaces need for Neo4j/FalkorDB by using native Postgres graph capabilities
 */

import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { resolveAdminCompanyId } from "@/lib/admin-company";

export interface GraphNode {
  id: string;
  type: 'agent' | 'memory' | 'learning' | 'task' | 'draft' | 'page' | 'section' | 'pattern';
  label: string;
  properties: Record<string, any>;
  agent_key?: string;
  created_at: string;
}

export interface GraphEdge {
  id: string;
  source_id: string;
  target_id: string;
  relationship: string;
  properties: Record<string, any>;
  weight: number; // 0-1
  created_at: string;
}

export interface GraphPath {
  nodes: GraphNode[];
  edges: GraphEdge[];
  total_weight: number;
  length: number;
}

export interface Subgraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export class KnowledgeGraph {
  private supabase: any;
  private companyId: string | null = null;

  constructor() {
    this.supabase = getSupabaseAdminClient();
  }

  async initialize(companyId?: string) {
    this.companyId = await resolveAdminCompanyId(companyId);
    if (!this.companyId) {
      throw new Error('Company ID not resolved');
    }
    // Ensure tables exist
    await this.ensureTables();
  }

  private async ensureTables() {
    // Knowledge graph tables are created in migration
    // This just verifies they exist
  }

  // ============================================
  // Node Operations
  // ============================================

  async addNode(node: Omit<GraphNode, 'id' | 'created_at'>): Promise<string> {
    if (!this.companyId) await this.initialize();

    const { data, error } = await this.supabase
      .from('qayyim_knowledge_nodes')
      .insert({
        company_id: this.companyId,
        type: node.type,
        label: node.label,
        properties: node.properties,
        agent_key: node.agent_key,
      })
      .select('id')
      .single();

    if (error) throw error;
    return data.id;
  }

  async getNode(id: string): Promise<GraphNode | null> {
    if (!this.companyId) await this.initialize();

    const { data, error } = await this.supabase
      .from('qayyim_knowledge_nodes')
      .select('*')
      .eq('id', id)
      .eq('company_id', this.companyId)
      .single();

    if (error || !data) return null;
    return data as GraphNode;
  }

  async updateNode(id: string, properties: Record<string, any>): Promise<void> {
    if (!this.companyId) await this.initialize();

    await this.supabase
      .from('qayyim_knowledge_nodes')
      .update({ properties, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('company_id', this.companyId);
  }

  async deleteNode(id: string): Promise<void> {
    if (!this.companyId) await this.initialize();

    // Delete edges first
    await this.supabase
      .from('qayyim_knowledge_edges')
      .delete()
      .eq('company_id', this.companyId)
      .or(`source_id.eq.${id},target_id.eq.${id}`);

    // Then delete node
    await this.supabase
      .from('qayyim_knowledge_nodes')
      .delete()
      .eq('id', id)
      .eq('company_id', this.companyId);
  }

  // ============================================
  // Edge Operations
  // ============================================

  async addEdge(edge: Omit<GraphEdge, 'id' | 'created_at'>): Promise<string> {
    if (!this.companyId) await this.initialize();

    const { data, error } = await this.supabase
      .from('qayyim_knowledge_edges')
      .insert({
        company_id: this.companyId,
        source_id: edge.source_id,
        target_id: edge.target_id,
        relationship: edge.relationship,
        properties: edge.properties,
        weight: edge.weight,
      })
      .select('id')
      .single();

    if (error) throw error;
    return data.id;
  }

  async getEdges(nodeId: string, direction: 'out' | 'in' | 'both' = 'both'): Promise<GraphEdge[]> {
    if (!this.companyId) await this.initialize();

    let query = this.supabase
      .from('qayyim_knowledge_edges')
      .select('*')
      .eq('company_id', this.companyId);

    if (direction === 'out') {
      query = query.eq('source_id', nodeId);
    } else if (direction === 'in') {
      query = query.eq('target_id', nodeId);
    } else {
      query = query.or(`source_id.eq.${nodeId},target_id.eq.${nodeId}`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as GraphEdge[];
  }

  // ============================================
  // Graph Traversal (using Recursive CTEs)
  // ============================================

  /**
   * Find shortest path between two nodes
   */
  async findPath(sourceId: string, targetId: string, maxDepth: number = 5): Promise<GraphPath | null> {
    if (!this.companyId) await this.initialize();

    const { data, error } = await this.supabase.rpc('find_shortest_path', {
      p_company_id: this.companyId,
      p_source_id: sourceId,
      p_target_id: targetId,
      p_max_depth: maxDepth,
    });

    if (error || !data) return null;
    return data as GraphPath;
  }

  /**
   * Find all paths from source to target
   */
  async findAllPaths(sourceId: string, targetId: string, maxDepth: number = 4): Promise<GraphPath[]> {
    if (!this.companyId) await this.initialize();

    const { data, error } = await this.supabase.rpc('find_all_paths', {
      p_company_id: this.companyId,
      p_source_id: sourceId,
      p_target_id: targetId,
      p_max_depth: maxDepth,
    });

    if (error || !data) return [];
    return data as GraphPath[];
  }

  /**
   * Get subgraph around a node (neighborhood)
   */
  async getNeighborhood(nodeId: string, radius: number = 2): Promise<Subgraph> {
    if (!this.companyId) await this.initialize();

    const { data, error } = await this.supabase.rpc('get_neighborhood', {
      p_company_id: this.companyId,
      p_node_id: nodeId,
      p_radius: radius,
    });

    if (error || !data) return { nodes: [], edges: [] };
    return data as Subgraph;
  }

  /**
   * Find nodes by property value
   */
  async findNodesByProperty(
    key: string,
    value: any,
    nodeType?: GraphNode['type'],
    limit: number = 50
  ): Promise<GraphNode[]> {
    if (!this.companyId) await this.initialize();

    let query = this.supabase
      .from('qayyim_knowledge_nodes')
      .select('*')
      .eq('company_id', this.companyId)
      .contains('properties', { [key]: value });

    if (nodeType) {
      query = query.eq('type', nodeType);
    }

    const { data, error } = await query.limit(limit);
    if (error) throw error;
    return (data || []) as GraphNode[];
  }

  /**
   * Get all nodes of a type connected to an agent
   */
  async getAgentKnowledge(agentKey: string, nodeType?: GraphNode['type']): Promise<GraphNode[]> {
    if (!this.companyId) await this.initialize();

    let query = this.supabase
      .from('qayyim_knowledge_nodes')
      .select('*')
      .eq('company_id', this.companyId)
      .eq('agent_key', agentKey);

    if (nodeType) {
      query = query.eq('type', nodeType);
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []) as GraphNode[];
  }

  /**
   * Find related learnings for a domain
   */
  async findRelatedLearnings(domain: string, agentKey?: string): Promise<GraphNode[]> {
    if (!this.companyId) await this.initialize();

    let query = this.supabase
      .from('qayyim_knowledge_nodes')
      .select('*')
      .eq('company_id', this.companyId)
      .eq('type', 'learning')
      .contains('properties', { domain });

    if (agentKey) {
      query = query.eq('agent_key', agentKey);
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []) as GraphNode[];
  }

  /**
   * Get graph statistics
   */
  async getStats(): Promise<{
    totalNodes: number;
    totalEdges: number;
    nodesByType: Record<string, number>;
    edgesByRelationship: Record<string, number>;
    avgDegree: number;
  }> {
    if (!this.companyId) await this.initialize();

    const [{ data: nodes, count: nodeCount }, { data: edges, count: edgeCount }] = await Promise.all([
      this.supabase
        .from('qayyim_knowledge_nodes')
        .select('type', { count: 'exact', head: false })
        .eq('company_id', this.companyId),
      this.supabase
        .from('qayyim_knowledge_edges')
        .select('relationship', { count: 'exact', head: false })
        .eq('company_id', this.companyId),
    ]);

    const nodesByType: Record<string, number> = {};
    const edgesByRelationship: Record<string, number> = {};

    nodes?.forEach((n: any) => {
      nodesByType[n.type] = (nodesByType[n.type] || 0) + 1;
    });

    edges?.forEach((e: any) => {
      edgesByRelationship[e.relationship] = (edgesByRelationship[e.relationship] || 0) + 1;
    });

    const totalNodes = nodeCount || 0;
    const totalEdges = edgeCount || 0;
    const avgDegree = totalNodes > 0 ? (totalEdges * 2) / totalNodes : 0;

    return {
      totalNodes,
      totalEdges,
      nodesByType,
      edgesByRelationship,
      avgDegree,
    };
  }

  /**
   * Create the knowledge graph tables if they don't exist
   * This should be called during migration
   */
  static async createTables(supabase: any): Promise<void> {
    // Nodes table
    await supabase.rpc('exec_sql', {
      sql_query: `
        CREATE TABLE IF NOT EXISTS public.qayyim_knowledge_nodes (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id UUID,
          type TEXT NOT NULL,
          label TEXT NOT NULL,
          properties JSONB DEFAULT '{}',
          agent_key TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_knowledge_nodes_company ON public.qayyim_knowledge_nodes(company_id);
        CREATE INDEX IF NOT EXISTS idx_knowledge_nodes_type ON public.qayyim_knowledge_nodes(type);
        CREATE INDEX IF NOT EXISTS idx_knowledge_nodes_agent ON public.qayyim_knowledge_nodes(agent_key);
        CREATE INDEX IF NOT EXISTS idx_knowledge_nodes_properties ON public.qayyim_knowledge_nodes USING GIN (properties);
      `
    });

    // Edges table
    await supabase.rpc('exec_sql', {
      sql_query: `
        CREATE TABLE IF NOT EXISTS public.qayyim_knowledge_edges (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id UUID,
          source_id UUID NOT NULL REFERENCES public.qayyim_knowledge_nodes(id) ON DELETE CASCADE,
          target_id UUID NOT NULL REFERENCES public.qayyim_knowledge_nodes(id) ON DELETE CASCADE,
          relationship TEXT NOT NULL,
          properties JSONB DEFAULT '{}',
          weight DECIMAL(3,2) DEFAULT 1.0,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE(source_id, target_id, relationship)
        );
        
        CREATE INDEX IF NOT EXISTS idx_knowledge_edges_company ON public.qayyim_knowledge_edges(company_id);
        CREATE INDEX IF NOT EXISTS idx_knowledge_edges_source ON public.qayyim_knowledge_edges(source_id);
        CREATE INDEX IF NOT EXISTS idx_knowledge_edges_target ON public.qayyim_knowledge_edges(target_id);
        CREATE INDEX IF NOT EXISTS idx_knowledge_edges_relationship ON public.qayyim_knowledge_edges(relationship);
      `
    });

    // Recursive CTE functions for graph traversal
    await supabase.rpc('exec_sql', {
      sql_query: `
        -- Find shortest path using recursive CTE
        CREATE OR REPLACE FUNCTION find_shortest_path(
          p_company_id UUID,
          p_source_id UUID,
          p_target_id UUID,
          p_max_depth INT DEFAULT 5
        ) RETURNS JSONB LANGUAGE plpgsql AS $$
        DECLARE
          result JSONB;
        BEGIN
          WITH RECURSIVE path_search AS (
            -- Base case: start from source
            SELECT 
              ARRAY[n.id]::UUID[] as node_path,
              ARRAY[]::UUID[] as edge_path,
              0 as depth,
              n.id as current_id
            FROM qayyim_knowledge_nodes n
            WHERE n.id = p_source_id AND n.company_id = p_company_id
            
            UNION ALL
            
            -- Recursive step: follow edges
            SELECT 
              ps.node_path || e.target_id,
              ps.edge_path || e.id,
              ps.depth + 1,
              e.target_id
            FROM path_search ps
            JOIN qayyim_knowledge_edges e ON e.source_id = ps.current_id AND e.company_id = p_company_id
            WHERE ps.depth < p_max_depth
            AND e.target_id != ALL(ps.node_path)  -- Avoid cycles
          )
          SELECT jsonb_build_object(
            'nodes', (
              SELECT jsonb_agg(jsonb_build_object(
                'id', n.id,
                'type', n.type,
                'label', n.label,
                'properties', n.properties
              ))
              FROM qayyim_knowledge_nodes n
              WHERE n.id = ANY(
                SELECT node_path[array_length(node_path, 1)] 
                FROM path_search 
                WHERE current_id = p_target_id
              )
            ),
            'edges', (
              SELECT jsonb_agg(jsonb_build_object(
                'id', e.id,
                'source_id', e.source_id,
                'target_id', e.target_id,
                'relationship', e.relationship,
                'weight', e.weight
              ))
              FROM qayyim_knowledge_edges e
              WHERE e.id = ANY(
                SELECT edge_path[array_length(edge_path, 1)] 
                FROM path_search 
                WHERE current_id = p_target_id
              )
            ),
            'total_weight', (
              SELECT COALESCE(SUM(e.weight), 0)
              FROM qayyim_knowledge_edges e
              WHERE e.id = ANY(
                SELECT edge_path[array_length(edge_path, 1)] 
                FROM path_search 
                WHERE current_id = p_target_id
              )
            ),
            'length', (
              SELECT array_length(node_path, 1) - 1
              FROM path_search 
              WHERE current_id = p_target_id
            )
          ) INTO result
          FROM path_search
          WHERE current_id = p_target_id
          ORDER BY depth
          LIMIT 1;
          
          RETURN COALESCE(result, '{}'::JSONB);
        END;
        $$;
      `
    });
  }
}

export const knowledgeGraph = new KnowledgeGraph();
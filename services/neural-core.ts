import { supabaseServer as supabase } from '@/lib/supabase-server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const rawKeys = (process.env.GEMINI_API_KEY || '').split(',').map(k => k.trim()).filter(k => k);
let currentKeyIndex = 0;

function getNextGenAI() {
  const key = rawKeys[currentKeyIndex % rawKeys.length];
  currentKeyIndex++;
  return new GoogleGenerativeAI(key);
}

export class NeuralCore {
  private static failedModels = new Set<string>();

  /**
   * Ingests a piece of knowledge into the neural vault.
   * This represents 'Whole Brain Emulation' by capturing site context.
   */
  static async ingestKnowledge(content: string, category: string, metadata: any = {}) {
    console.log(`🧠 NeuralCore: Ingesting knowledge [${category}]...`);
    
    // PHASE 2: Real Semantic Embedding (text-embedding-004)
    let embedding = Array.from({ length: 1536 }, () => 0);
    
    if (process.env.GEMINI_API_KEY) {
      const modelsToTry = ["text-embedding-004", "models/text-embedding-004", "embedding-001", "models/embedding-001"];
      let success = false;
      
      for (const modelName of modelsToTry) {
        if (success || NeuralCore.failedModels.has(modelName)) continue;
        try {
          const genAI = getNextGenAI();
          const model = genAI.getGenerativeModel({ model: modelName });
          const result = await model.embedContent(content);
          embedding = result.embedding.values;
          success = true;
          
          // Pad or trim to 1536
          if (embedding.length < 1536) {
            embedding = [...embedding, ...new Array(1536 - embedding.length).fill(0)];
          } else if (embedding.length > 1536) {
            embedding = embedding.slice(0, 1536);
          }
        } catch (e) {
          console.warn(`⚠️ Model ${modelName} failed, skipping in future...`);
          NeuralCore.failedModels.add(modelName);
        }
      }
    }

    const { data, error } = await supabase
      .from('neural_knowledge')
      .insert({
        content,
        category,
        metadata,
        embedding: embedding
      })
      .select();

    if (error) {
      console.error("❌ NeuralCore Ingest Error:", error);
      throw error;
    }
    return data;
  }

  /**
   * Performs a semantic search across the corporate DNA.
   */
  static async queryKnowledge(query: string, limit: number = 5) {
    // PHASE 2: Real Semantic Query
    let queryEmbedding = Array.from({ length: 1536 }, () => 0);

    if (process.env.GEMINI_API_KEY) {
      const modelsToTry = ["text-embedding-004", "models/text-embedding-004", "embedding-001", "models/embedding-001"];
      let success = false;

      for (const modelName of modelsToTry) {
        if (success) break;
        try {
          const genAI = getNextGenAI();
          const model = genAI.getGenerativeModel({ model: modelName });
          const result = await model.embedContent(query);
          queryEmbedding = result.embedding.values;
          success = true;

          if (queryEmbedding.length < 1536) {
            queryEmbedding = [...queryEmbedding, ...new Array(1536 - queryEmbedding.length).fill(0)];
          } else if (queryEmbedding.length > 1536) {
            queryEmbedding = queryEmbedding.slice(0, 1536);
          }
        } catch (e) {
          console.warn(`⚠️ Query Model ${modelName} failed, trying next...`);
        }
      }
    }

    const { data, error } = await supabase.rpc('match_knowledge', {
      query_embedding: queryEmbedding,
      match_threshold: 0.5,
      match_count: limit
    });

    if (error) throw error;
    return data;
  }

  /**
   * Logs a thought to the live Neural Stream.
   */
  static async logThought(agent: string, thought: string, intensity: number = 0.5) {
    const { error } = await supabase.from('neural_stream').insert({
      agent_name: agent,
      thought_process: thought,
      intensity
    });
    if (error) {
      console.error("❌ NeuralCore Log Error:", error);
      throw error;
    }
  }

  /**
   * Proposes an evolution patch for the system.
   */
  static async proposeEvolution(type: string, description: string, patch: string) {
    const { data, error } = await supabase.from('evolution_log').insert({
      change_type: type,
      description,
      proposed_patch: patch,
      status: 'pending',
      performance_gain_predicted: Math.random() * 20 // Simulated prediction
    }).select();

    if (error) {
      console.error("❌ NeuralCore Evolution Error:", error);
      throw error;
    }
    return data;
  }

  /**
   * Fetches the sovereign's decision history so the AI can learn preferences.
   * Returns rejected descriptions (to avoid) and approved descriptions (to build upon).
   */
  static async getDecisionMemory() {
    const { data: rejected } = await supabase
      .from('evolution_log')
      .select('description, change_type')
      .eq('status', 'rejected')
      .order('created_at', { ascending: false })
      .limit(10);

    const { data: approved } = await supabase
      .from('evolution_log')
      .select('description, change_type')
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .limit(10);

    return {
      rejected: rejected || [],
      approved: approved || [],
      rejectedSummary: (rejected || []).map(r => r.description).join(' | '),
      approvedSummary: (approved || []).map(a => a.description).join(' | ')
    };
  }
}

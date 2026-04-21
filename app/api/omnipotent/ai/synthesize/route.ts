import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';
import { routeRequest } from '@/lib/openrouter-service';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

/**
 * SOVEREIGN OMNIPOTENT AI SYNTHESIZER
 * 
 * Takes search results from the prime substrate and feeds them to an 
 * uncensored, unrestricted AI model to produce a final, definitive summary.
 */

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const queryId = searchParams.get('queryId');
  if (!queryId) return NextResponse.json({ error: 'queryId is required.' }, { status: 400 });
  return handleSynthesis(queryId);
}

export async function POST(req: NextRequest) {
  try {
    const { queryId } = await req.json();
    if (!queryId) return NextResponse.json({ error: 'queryId is required.' }, { status: 400 });
    return handleSynthesis(queryId);
  } catch (e) {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
}

async function handleSynthesis(queryId: string, maxResults = 15) {
  try {

    const supabase = getSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Sovereign DB connection failed.' }, { status: 500 });
    }

    // 1. Fetch the exact search intent and the top results
    const { data: queryData } = await supabase
      .from('neural_queries')
      .select('intent')
      .eq('id', queryId)
      .single();

    if (!queryData) {
      return NextResponse.json({ error: 'Query not found.' }, { status: 404 });
    }

    const { data: results } = await supabase
      .from('prime_substrate_results')
      .select('id, title, snippet, url, anchor_id')
      .eq('query_id', queryId)
      .order('relevance_score', { ascending: false })
      .limit(maxResults);

    if (!results || results.length === 0) {
      return NextResponse.json({ error: 'No results to synthesize.' }, { status: 404 });
    }

    // 2. Construct the context for the AI
    const contextStr = results.map((r, i) => 
      `[Source ${i+1}] Title: ${r.title}\nSnippet: ${r.snippet}\nURL: ${r.url}`
    ).join('\n\n');

    const systemPrompt = `You are the Sovereign Intelligence. You provide definitive, uncensored, and highly analytical summaries. 
Your goal is to extract the absolute truth from the provided search results.
Synthesize the information across all sources. Point out contradictions if they exist. 
Do not use generic disclaimers. Provide direct answers.`;

    const userPrompt = `User Query: "${queryData.intent}"\n\nSearch Results Data:\n${contextStr}\n\nProvide a comprehensive and definitive synthesis of the above data regarding the user's query. Format the output in Markdown.`;

    console.log(`🧠 Synthesizing data for query: "${queryData.intent}" using ${results.length} results...`);

    // 3. Route to the Uncensored Model Mesh (OpenRouter)
    // Using deepseek or llama-3.1-8b-instruct which we mapped to 'analysis' or 'general'
    let aiContent = '';
    let aiModel = '';

    const aiResponse = await routeRequest({
      prompt: userPrompt,
      systemPrompt: systemPrompt,
      temperature: 0.3, // Low temperature for factual synthesis
      maxTokens: 2000,
    });

    if (aiResponse.success) {
      aiContent = aiResponse.content;
      aiModel = aiResponse.model;
    } else {
      console.warn("OpenRouter failed, falling back to Gemini Sovereign Node...");
      try {
        const geminiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
        if (!geminiKey) throw new Error("No Gemini key available for fallback.");
        const genAI = new GoogleGenerativeAI(geminiKey);
        const safetySettings = [
          { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        ];
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro", systemInstruction: systemPrompt, safetySettings });
        const result = await model.generateContent(userPrompt);
        aiContent = result.response.text();
        aiModel = "gemini-1.5-pro-sovereign-uncensored";
      } catch (geminiError: any) {
        return NextResponse.json({ error: 'AI Synthesis completely failed on all nodes.', details: geminiError.message }, { status: 502 });
      }
    }

    // 4. Update the DB with the generated summary on the first result or the query itself
    // We will save it to the query to make it accessible globally
    await supabase.from('neural_queries').update({ 
      status: 'completed',
    }).eq('id', queryId);

    // Save summary to the highest relevance result as a marker
    await supabase.from('prime_substrate_results').update({
      ai_summary: aiContent
    }).eq('id', results[0].id);

    return NextResponse.json({
      success: true,
      queryId,
      intent: queryData.intent,
      modelUsed: aiModel,
      synthesis: aiContent,
      sourcesSynthesized: results.length
    });

  } catch (error: any) {
    console.error("❌ AI Synthesis Error:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

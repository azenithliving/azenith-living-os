/**
 * Lightweight Groq client for AACA agents (no Next.js / Supabase imports).
 */

export async function askGroqLite(
  prompt: string,
  options?: { temperature?: number; maxTokens?: number }
): Promise<{ success: boolean; content?: string; error?: string }> {
  const apiKey =
    process.env.GROQ_API_KEY?.trim() ||
    process.env.GROQ_API_KEYS?.split(",")[0]?.trim();

  if (!apiKey) {
    return { success: false, error: "GROQ_API_KEY not configured" };
  }

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        temperature: options?.temperature ?? 0.3,
        max_tokens: options?.maxTokens ?? 1024,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return { success: false, error: `Groq ${response.status}: ${text.slice(0, 200)}` };
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) return { success: false, error: "Empty Groq response" };
    return { success: true, content };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

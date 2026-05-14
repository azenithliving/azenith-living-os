import { getOrchestratorHealth } from "../lib/ai-orchestrator";

async function testHealth() {
  const health = getOrchestratorHealth();
  console.log("=== AI Orchestrator Key Pool Status ===");
  console.log(`OpenAI Keys: ${health.openai.keys} (${health.openai.healthy ? "HEALTHY" : "EMPTY"})`);
  console.log(`Google Keys: ${health.google.keys} (${health.google.healthy ? "HEALTHY" : "EMPTY"})`);
  console.log(`Groq Keys: ${health.groq.keys} (${health.groq.healthy ? "HEALTHY" : "EMPTY"})`);
  console.log(`OpenRouter Keys: ${health.openrouter.keys} (${health.openrouter.healthy ? "HEALTHY" : "EMPTY"})`);
  console.log(`DeepSeek Keys: ${health.deepseek.keys} (${health.deepseek.healthy ? "HEALTHY" : "EMPTY"})`);
  console.log(`Mistral Keys: ${health.mistral.keys} (${health.mistral.healthy ? "HEALTHY" : "EMPTY"})`);
}

testHealth().catch(console.error);

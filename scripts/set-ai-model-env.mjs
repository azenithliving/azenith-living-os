import { existsSync, readFileSync, writeFileSync } from "node:fs";

const files = [".env.local", ".env.vercel"];
const additions = {
  TOGETHER_MODEL: '"meta-llama/Llama-3.3-70B-Instruct-Turbo"',
  AIMLAPI_MODEL: '"openai/gpt-4.1-mini"',
  CEREBRAS_MODEL: '"gpt-oss-120b"',
  COHERE_MODEL: '"command-a-03-2025"',
};

for (const file of files) {
  if (!existsSync(file)) continue;
  let source = readFileSync(file, "utf8");
  for (const [key, value] of Object.entries(additions)) {
    if (!new RegExp(`^${key}\\s*=`, "m").test(source)) {
      source += `\n${key}=${value}`;
    }
  }
  writeFileSync(file, source, "utf8");
  console.log(`updated ${file}`);
}

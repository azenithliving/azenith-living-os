import { routeRequest } from "./lib/openrouter-service";

async function test() {
  console.log("Testing OpenRouter...");
  const res = await routeRequest({
    prompt: "Hello",
    modelPreference: "moonshotai/kimi-k2",
  });
  console.log(res);
}

test();

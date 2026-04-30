import { config } from "dotenv";
config({ path: ".env.local" });

import { getRecentMemories } from "./lib/ultimate-agent/memory-store";

async function test() {
  const recentMemories = await getRecentMemories(6, ["interaction", "decision", "suggestion"]);
  
  const formattedMemories = recentMemories.memories
    ?.slice(0, 6)
    .reverse() 
    .map((memory) => {
      const role = memory.context?.role === "user" ? "User" : "Agent";
      return `${role}: ${memory.content}`;
    })
    .filter(Boolean) || [];

  console.log("Context:");
  console.log(formattedMemories.join("\n"));
}

test();

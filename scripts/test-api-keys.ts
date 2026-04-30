/**
 * Test Script for API Keys System
 * Usage: npx tsx scripts/test-api-keys.ts
 */

import {
  getKeyFromDB,
  getNextAvailableKey,
  setKeyCooldown,
  getKeyStats,
  loadKeysFromDB,
} from "@/lib/api-keys-service";

async function runTests() {
  console.log("=== API Keys System Test ===\n");

  // Test 1: Load keys from DB
  console.log("Test 1: Loading keys from database...");
  await loadKeysFromDB();
  console.log("✓ Keys loaded successfully\n");

  // Test 2: Get key stats for each provider
  console.log("Test 2: Getting key stats...");
  const providers = ["groq", "openrouter", "mistral", "pexels"] as const;

  for (const provider of providers) {
    const stats = await getKeyStats(provider);
    console.log(`  ${provider}:`, {
      total: stats.total,
      active: stats.active,
      inCooldown: stats.inCooldown,
      requests: stats.totalRequests,
    });
  }
  console.log("✓ Stats retrieved\n");

  // Test 3: Get single key from DB
  console.log("Test 3: Getting single key from DB...");
  for (const provider of providers) {
    const key = await getKeyFromDB(provider);
    console.log(`  ${provider}: ${key ? "Key found" : "No key"}`);
  }
  console.log("✓ Single key retrieval test complete\n");

  // Test 4: Round-robin key selection
  console.log("Test 4: Testing round-robin key selection...");
  for (const provider of ["groq", "mistral", "openrouter"] as const) {
    console.log(`  ${provider}:`);
    for (let i = 0; i < 3; i++) {
      const result = await getNextAvailableKey(provider);
      if (result) {
        const masked = result.key.slice(0, 8) + "..." + result.key.slice(-4);
        console.log(`    [${i + 1}] Index ${result.index}: ${masked}`);
      } else {
        console.log(`    [${i + 1}] No key available`);
      }
    }
  }
  console.log("✓ Round-robin test complete\n");

  // Test 5: Cooldown functionality (commented out by default)
  /*
  console.log("Test 5: Testing cooldown functionality...");
  const testKey = await getKeyFromDB("groq");
  if (testKey) {
    console.log("  Setting 5-second cooldown on key...");
    await setKeyCooldown("groq", testKey, 5000);
    
    console.log("  Attempting to get key during cooldown...");
    const result = await getNextAvailableKey("groq");
    console.log(`  Result: ${result ? "Got key (might be different)" : "No key available"}`);
    
    console.log("  Waiting 5 seconds...");
    await new Promise(r => setTimeout(r, 5000));
    
    console.log("  Getting key after cooldown...");
    const afterCooldown = await getNextAvailableKey("groq");
    console.log(`  Result: ${afterCooldown ? "Key available" : "No key"}`);
  }
  console.log("✓ Cooldown test complete\n");
  */

  console.log("=== All Tests Complete ===");
}

// Run if executed directly
if (require.main === module) {
  runTests().catch((err) => {
    console.error("Test failed:", err);
    process.exit(1);
  });
}

export { runTests };

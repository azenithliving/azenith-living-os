#!/usr/bin/env node
/**
 * API Key Testing Script
 * Tests all API keys for Pexels, Groq, OpenRouter, Mistral, DeepSeek, Gemini
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENV_FILE = path.join(__dirname, '..', '.env.local');

// Colors for terminal output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

// Provider configurations with test endpoints
const PROVIDERS = {
  PEXELS_KEYS: {
    name: 'Pexels',
    testUrl: 'https://api.pexels.com/v1/search?query=test&per_page=1',
    headers: (key) => ({ 'Authorization': key }),
    envVar: 'PEXELS_KEYS'
  },
  GROQ_KEYS: {
    name: 'Groq',
    testUrl: 'https://api.groq.com/openai/v1/models',
    headers: (key) => ({ 'Authorization': `Bearer ${key}` }),
    envVar: 'GROQ_KEYS'
  },
  OPENROUTER_KEYS: {
    name: 'OpenRouter',
    testUrl: 'https://openrouter.ai/api/v1/auth/key',
    headers: (key) => ({ 'Authorization': `Bearer ${key}` }),
    envVar: 'OPENROUTER_KEYS'
  },
  MISTRAL_KEYS: {
    name: 'Mistral',
    testUrl: 'https://api.mistral.ai/v1/models',
    headers: (key) => ({ 'Authorization': `Bearer ${key}` }),
    envVar: 'MISTRAL_KEYS'
  },
  DEEPSEEK_KEYS: {
    name: 'DeepSeek',
    testUrl: 'https://api.deepseek.com/models',
    headers: (key) => ({ 'Authorization': `Bearer ${key}` }),
    envVar: 'DEEPSEEK_KEYS'
  },
  GOOGLE_AI_KEYS: {
    name: 'Gemini',
    testUrl: (key) => `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`,
    headers: () => ({}),
    envVar: 'GOOGLE_AI_KEYS'
  }
};

// Parse .env.local file
function parseEnvFile() {
  if (!fs.existsSync(ENV_FILE)) {
    console.error(`${colors.red}❌ .env.local file not found${colors.reset}`);
    process.exit(1);
  }

  const content = fs.readFileSync(ENV_FILE, 'utf8');
  const env = {};

  for (const line of content.split('\n')) {
    // Skip empty lines and comments
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    // Match KEY="VALUE" format
    const match = trimmed.match(/^([A-Za-z0-9_]+)="(.+)"$/);
    if (match) {
      env[match[1]] = match[2];
    }
  }

  return env;
}

// Test a single API key
async function testKey(provider, key, index) {
  const config = PROVIDERS[provider];
  const keyNum = index + 1;
  const keyPreview = key.substring(0, 20) + '...';

  try {
    let testUrl = config.testUrl;
    let headers = config.headers(key);

    // Handle dynamic URL for Google
    if (typeof testUrl === 'function') {
      testUrl = testUrl(key);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(testUrl, {
      method: 'GET',
      headers,
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (response.ok) {
      console.log(`${colors.green}✅ [${config.name}] Key #${keyNum} VALID${colors.reset}`);
      return { valid: true, key, index };
    } else {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.log(`${colors.red}❌ [${config.name}] Key #${keyNum} FAILED: HTTP ${response.status}${colors.reset}`);
      return { valid: false, key, index, error: `HTTP ${response.status}: ${errorText.substring(0, 100)}` };
    }
  } catch (error) {
    console.log(`${colors.red}❌ [${config.name}] Key #${keyNum} FAILED: ${error.message}${colors.reset}`);
    return { valid: false, key, index, error: error.message };
  }
}

// Test all keys for a provider
async function testProvider(provider, env) {
  const config = PROVIDERS[provider];
  const keysString = env[config.envVar];

  if (!keysString) {
    console.log(`${colors.yellow}⚠️ [${config.name}] No keys found in .env.local${colors.reset}`);
    return { provider, keys: [], results: [] };
  }

  const keys = keysString.split(',').map(k => k.trim()).filter(k => k);
  console.log(`\n${colors.blue}Testing ${config.name} (${keys.length} keys)...${colors.reset}`);

  const results = [];
  for (let i = 0; i < keys.length; i++) {
    const result = await testKey(provider, keys[i], i);
    results.push(result);
  }

  return { provider, keys, results };
}

// Update .env.local with valid keys only
function updateEnvFile(envData) {
  console.log(`\n${colors.blue}Updating .env.local...${colors.reset}`);

  let content = fs.readFileSync(ENV_FILE, 'utf8');
  const deletedVars = [];
  const updatedVars = [];

  for (const { provider, results } of envData) {
    const config = PROVIDERS[provider];
    const validKeys = results.filter(r => r.valid).map(r => r.key);

    if (validKeys.length === 0) {
      // All keys failed - remove entire variable
      const regex = new RegExp(`^${config.envVar}="[^"]*"\n?`, 'gm');
      content = content.replace(regex, '');
      deletedVars.push(config.envVar);
      console.log(`${colors.red}🗑️ Deleted ${config.envVar} (all keys failed)${colors.reset}`);
    } else {
      // Keep only valid keys
      const validKeysString = validKeys.join(',');
      const regex = new RegExp(`^${config.envVar}="[^"]*"`, 'gm');
      content = content.replace(regex, `${config.envVar}="${validKeysString}"`);
      const removedCount = results.length - validKeys.length;
      updatedVars.push(`${config.envVar} (${removedCount} keys removed, ${validKeys.length} kept)`);
      console.log(`${colors.yellow}✏️ Updated ${config.envVar}: removed ${removedCount} failed keys, kept ${validKeys.length}${colors.reset}`);
    }
  }

  // Clean up empty lines
  content = content.replace(/\n{3,}/g, '\n\n');

  fs.writeFileSync(ENV_FILE, content);
  console.log(`${colors.green}✅ .env.local updated${colors.reset}`);

  return { deletedVars, updatedVars };
}

// Generate Vercel commands to remove failed keys
function generateVercelCommands(envData) {
  console.log(`\n${colors.blue}Generating Vercel commands...${colors.reset}`);

  const commands = [];

  for (const { provider, results } of envData) {
    const config = PROVIDERS[provider];
    const hasValidKeys = results.some(r => r.valid);

    if (!hasValidKeys) {
      // All keys failed - remove entire variable from all environments
      commands.push(`echo "Removing ${config.envVar} from Vercel..."`);
      commands.push(`vercel env rm ${config.envVar} production --yes 2>/dev/null || echo "Not in production"`);
      commands.push(`vercel env rm ${config.envVar} preview --yes 2>/dev/null || echo "Not in preview"`);
      commands.push(`vercel env rm ${config.envVar} development --yes 2>/dev/null || echo "Not in development"`);
    }
  }

  return commands;
}

// Main execution
async function main() {
  console.log(`${colors.blue}================================${colors.reset}`);
  console.log(`${colors.blue}   API Key Testing Script${colors.reset}`);
  console.log(`${colors.blue}================================${colors.reset}`);

  const env = parseEnvFile();
  const envData = [];

  // Test all providers
  for (const provider of Object.keys(PROVIDERS)) {
    const result = await testProvider(provider, env);
    envData.push(result);
  }

  // Summary
  console.log(`\n${colors.blue}========== SUMMARY ==========${colors.reset}`);
  for (const { provider, results } of envData) {
    const config = PROVIDERS[provider];
    const valid = results.filter(r => r.valid).length;
    const failed = results.filter(r => !r.valid).length;
    const total = results.length;

    if (total === 0) {
      console.log(`${colors.yellow}⚠️ ${config.name}: No keys found${colors.reset}`);
    } else if (valid === total) {
      console.log(`${colors.green}✅ ${config.name}: ${valid}/${total} keys valid${colors.reset}`);
    } else if (valid === 0) {
      console.log(`${colors.red}❌ ${config.name}: ALL ${total} keys failed${colors.reset}`);
    } else {
      console.log(`${colors.yellow}⚠️ ${config.name}: ${valid}/${total} valid, ${failed} failed${colors.reset}`);
    }
  }

  // Update .env.local
  const { deletedVars, updatedVars } = updateEnvFile(envData);

  // Generate Vercel commands
  const vercelCommands = generateVercelCommands(envData);

  console.log(`\n${colors.blue}========== VERCEL COMMANDS ==========${colors.reset}`);
  if (vercelCommands.length === 0) {
    console.log(`${colors.green}✅ No variables need to be removed from Vercel${colors.reset}`);
  } else {
    console.log(`${colors.yellow}Run these commands to clean up Vercel:${colors.reset}`);
    console.log('\n' + vercelCommands.join('\n') + '\n');

    // Write commands to file for easy execution
    const scriptPath = path.join(__dirname, 'cleanup-vercel.sh');
    fs.writeFileSync(scriptPath, '#!/bin/bash\n\n' + vercelCommands.join('\n') + '\n');
    console.log(`${colors.blue}Commands saved to: ${scriptPath}${colors.reset}`);
  }

  // Final report
  console.log(`\n${colors.blue}========== FINAL REPORT ==========${colors.reset}`);
  console.log(`Deleted from .env.local: ${deletedVars.join(', ') || 'None'}`);
  console.log(`Updated in .env.local: ${updatedVars.join(', ') || 'None'}`);
  console.log(`\n${colors.green}Done!${colors.reset}`);

  // Write JSON report
  const reportPath = path.join(__dirname, 'api-key-test-report.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    results: envData.map(({ provider, results }) => ({
      provider: PROVIDERS[provider].name,
      total: results.length,
      valid: results.filter(r => r.valid).length,
      failed: results.filter(r => !r.valid).length,
      failedDetails: results.filter(r => !r.valid).map(r => ({
        index: r.index + 1,
        error: r.error
      }))
    })),
    deletedVars,
    updatedVars
  }, null, 2));
  console.log(`\n${colors.blue}Report saved to: ${reportPath}${colors.reset}`);
}

main().catch(err => {
  console.error(`${colors.red}Fatal error: ${err.message}${colors.reset}`);
  process.exit(1);
});

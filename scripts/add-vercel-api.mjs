#!/usr/bin/env node
/**
 * Add environment variables to Vercel using REST API
 */

import { execSync } from 'child_process';
import readline from 'readline';

const ENV_VARS = [
  "CLOUDFLARE_ACCOUNT_ID",
  "CLOUDFLARE_API_TOKEN",
  "HUGGINGFACE_API_KEY",
  "COHERE_API_KEY",
  "CEREBRAS_API_KEY",
  "POLLINATIONS_ENABLED",
  "LIBRETTS_ENABLED"
]
  .map((key) => ({
    key,
    value: process.env[key],
    type: key.endsWith("_ENABLED") ? "plain" : "encrypted",
  }))
  .filter((entry) => entry.value);

const ENVIRONMENTS = ['production', 'preview', 'development'];
const PROJECT_ID = 'azenith-living-os';

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

// Get Vercel token from vercel CLI
function getVercelToken() {
  try {
    const result = execSync('vercel tokens list --json', { encoding: 'utf8' });
    const tokens = JSON.parse(result);
    return tokens[0]?.token || null;
  } catch (e) {
    return null;
  }
}

async function addEnvVarAPI(key, value, env, token) {
  const target = env === 'preview' ? ['preview'] : [env];
  const gitBranch = env === 'preview' ? null : undefined;

  const body = {
    key,
    value,
    type: value.length > 20 ? 'encrypted' : 'plain',
    target,
    ...(gitBranch && { gitBranch: null })
  };

  try {
    const response = await fetch(`https://api.vercel.com/v9/projects/${PROJECT_ID}/env`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (response.ok || response.status === 409) {
      if (response.status === 409) {
        console.log(`${colors.yellow}⚠️ ${key} already exists in ${env}${colors.reset}`);
      } else {
        console.log(`${colors.green}✅ Added ${key} to ${env}${colors.reset}`);
      }
      return true;
    } else {
      const error = await response.text();
      console.log(`${colors.red}❌ Failed to add ${key} to ${env}: ${error}${colors.reset}`);
      return false;
    }
  } catch (error) {
    console.log(`${colors.red}❌ Error adding ${key} to ${env}: ${error.message}${colors.reset}`);
    return false;
  }
}

async function main() {
  console.log(`${colors.blue}================================${colors.reset}`);
  console.log(`${colors.blue}   Adding Env Vars to Vercel${colors.reset}`);
  console.log(`${colors.blue}================================${colors.reset}\n`);

  // Try to get token from vercel CLI
  let token = getVercelToken();

  if (!token) {
    console.log(`${colors.yellow}⚠️ Could not auto-detect Vercel token${colors.reset}`);
    console.log(`${colors.yellow}Please run: vercel login${colors.reset}`);
    process.exit(1);
  }

  console.log(`${colors.blue}Using detected Vercel token${colors.reset}\n`);

  let success = 0;
  let failed = 0;

  for (const env of ENVIRONMENTS) {
    console.log(`${colors.blue}--- Environment: ${env.toUpperCase()} ---${colors.reset}`);
    for (const { key, value } of ENV_VARS) {
      const result = await addEnvVarAPI(key, value, env, token);
      if (result) success++; else failed++;
    }
    console.log('');
  }

  console.log(`${colors.green}================================${colors.reset}`);
  console.log(`${colors.green}Success: ${success}, Failed: ${failed}${colors.reset}`);
  console.log(`${colors.green}================================${colors.reset}`);
}

main().catch(err => {
  console.error(`${colors.red}Fatal error: ${err.message}${colors.reset}`);
  process.exit(1);
});

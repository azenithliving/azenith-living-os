#!/usr/bin/env node
/**
 * Add environment variables to Vercel using API
 */

import { execSync } from 'child_process';

const ENV_VARS = [
  { key: 'HUGGINGFACE_KEYS', value: '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,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,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,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' }
];

const ENVIRONMENTS = ['production', 'preview', 'development'];

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

async function addEnvVar(key, value, env) {
  try {
    const fs = await import('fs');
    const path = await import('path');
    const os = await import('os');

    // First, try to remove existing variable
    try {
      const removeFile = path.join(os.tmpdir(), `vercel-remove-${Date.now()}.txt`);
      fs.writeFileSync(removeFile, `y\n`);
      execSync(
        `vercel env rm ${key} ${env} < "${removeFile}"`,
        { encoding: 'utf8', stdio: 'pipe', cwd: 'd:\\azenith living\\my-app' }
      );
      fs.unlinkSync(removeFile);
      console.log(`${colors.yellow}🗑️ Removed existing ${key} from ${env}${colors.reset}`);
    } catch (removeError) {
      // Variable might not exist, that's ok
    }

    // Create input file with responses: value, empty line (all branches), n (not sensitive)
    const inputFile = path.join(os.tmpdir(), `vercel-input-${Date.now()}.txt`);
    fs.writeFileSync(inputFile, `${value}\n\nn\n`);

    const result = execSync(
      `vercel env add ${key} ${env} < "${inputFile}"`,
      { encoding: 'utf8', stdio: 'pipe', cwd: 'd:\\azenith living\\my-app' }
    );

    fs.unlinkSync(inputFile);
    console.log(`${colors.green}✅ Added/Updated ${key} in ${env}${colors.reset}`);
    return true;
  } catch (error) {
    console.log(`${colors.red}❌ Failed to add ${key} to ${env}: ${error.message}${colors.reset}`);
    return false;
  }
}

async function main() {
  console.log(`${colors.blue}================================${colors.reset}`);
  console.log(`${colors.blue}   Adding Env Vars to Vercel${colors.reset}`);
  console.log(`${colors.blue}================================${colors.reset}\n`);

  for (const env of ENVIRONMENTS) {
    console.log(`${colors.blue}--- Environment: ${env.toUpperCase()} ---${colors.reset}`);
    for (const { key, value } of ENV_VARS) {
      await addEnvVar(key, value, env);
    }
    console.log('');
  }

  console.log(`${colors.green}Done!${colors.reset}`);
}

main().catch(err => {
  console.error(`${colors.red}Fatal error: ${err.message}${colors.reset}`);
  process.exit(1);
});

#!/usr/bin/env node
import { spawn } from 'child_process';
import { execSync } from 'child_process';

const ENV_VARS = [
  { key: 'CLOUDFLARE_ACCOUNT_ID', value: 'ec262170b16c9dfa861c6622844657c7' },
  { key: 'CLOUDFLARE_API_TOKEN', value: 'cfat_p3iab6LrauegNvqLNPW4vujMrE9JQz0mzn6wK2VZ33b61785' },
  { key: 'HUGGINGFACE_API_KEY', value: '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' },
  { key: 'COHERE_API_KEY', value: 'bnX37aY0yPhjWiZckvtoR3QLGNmHNvMNWFRFtvX3' },
  { key: 'CEREBRAS_API_KEY', value: 'csk-pxcjmnpmvc3ymwj82rx3hddtm33543c69j4e2h6ct8hrhekp' },
  { key: 'POLLINATIONS_ENABLED', value: 'true' },
  { key: 'LIBRETTS_ENABLED', value: 'true' }
];

const ENVIRONMENTS = ['production', 'preview', 'development'];

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function addEnvVar(key, value, env) {
  return new Promise((resolve) => {
    console.log(`${colors.blue}Adding ${key} to ${env}...${colors.reset}`);

    const proc = spawn('powershell.exe', ['-Command', `vercel env add ${key} ${env}`], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: 'd:\\azenith living\\my-app'
    });

    let output = '';
    let errorOutput = '';

    proc.stdout.on('data', (data) => {
      output += data.toString();
      // Send value when prompted
      if (data.toString().includes('Your value will be encrypted')) {
        proc.stdin.write(value + '\n');
      }
      // Send empty line for branch (preview) or 'n' for sensitive
      if (data.toString().includes('Git branch') && env === 'preview') {
        proc.stdin.write('\n');
      }
      if (data.toString().includes('Mark as sensitive')) {
        proc.stdin.write('n\n');
      }
    });

    proc.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0 || output.includes('Added') || output.includes('already exists')) {
        console.log(`${colors.green}✅ ${key} added to ${env}${colors.reset}`);
        resolve(true);
      } else {
        console.log(`${colors.red}❌ ${key} failed for ${env}: ${errorOutput}${colors.reset}`);
        resolve(false);
      }
    });

    // Send initial value
    setTimeout(() => {
      proc.stdin.write(value + '\n');
    }, 100);

    // Send branch (empty for preview) after 200ms
    if (env === 'preview') {
      setTimeout(() => {
        proc.stdin.write('\n');
      }, 300);
    }

    // Send sensitive response after 400ms
    setTimeout(() => {
      proc.stdin.write('n\n');
    }, 500);
  });
}

async function main() {
  console.log(`${colors.blue}================================${colors.reset}`);
  console.log(`${colors.blue}   Adding Env Vars to Vercel${colors.reset}`);
  console.log(`${colors.blue}================================${colors.reset}\n`);

  let success = 0;
  let failed = 0;

  for (const env of ENVIRONMENTS) {
    console.log(`${colors.blue}--- Environment: ${env.toUpperCase()} ---${colors.reset}`);
    for (const { key, value } of ENV_VARS) {
      const result = await addEnvVar(key, value, env);
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

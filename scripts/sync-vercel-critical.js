
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const envPath = path.join(__dirname, '..', '.env.local');
const envConfig = dotenv.parse(fs.readFileSync(envPath));

const CRITICAL_VARS = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'INTERNAL_API_KEY',
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_CHAT_ID',
  'TELEGRAM_ENABLED',
  'RESEND_API_KEY',
  'BLOB_READ_WRITE_TOKEN'
];

async function syncVars() {
  console.log('🚀 Syncing critical environment variables to Vercel...');

  for (const varName of CRITICAL_VARS) {
    const value = envConfig[varName];
    if (!value) {
      console.warn(`⚠️ Warning: ${varName} not found in .env.local`);
      continue;
    }

    console.log(`📡 Setting ${varName} on Vercel...`);
    try {
      // Use vercel env add to set it for all environments
      // We pipe the value to avoid command line escaping issues
      execSync(`echo "${value}" | vercel env add ${varName} production`, { stdio: 'inherit' });
      execSync(`echo "${value}" | vercel env add ${varName} preview`, { stdio: 'inherit' });
      execSync(`echo "${value}" | vercel env add ${varName} development`, { stdio: 'inherit' });
    } catch (err) {
      // It might already exist, so we use vercel env rm first or just ignore
      console.log(`💡 ${varName} might already exist or failed. Updating...`);
      try {
         execSync(`vercel env rm ${varName} production -y`, { stdio: 'ignore' });
         execSync(`echo "${value}" | vercel env add ${varName} production`, { stdio: 'inherit' });
      } catch (e) {}
    }
  }

  console.log('✅ Critical variables synced.');
}

syncVars().catch(err => {
  console.error('💥 Error:', err);
});

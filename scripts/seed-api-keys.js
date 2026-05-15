
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load .env.local
const envPath = path.join(__dirname, '..', '.env.local');
const envConfig = dotenv.parse(fs.readFileSync(envPath));

const supabaseUrl = envConfig.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = envConfig.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function seedKeys() {
  console.log('🚀 Starting API Key seeding...');

  const providers = [
    { env: 'GROQ_KEYS', name: 'groq' },
    { env: 'OPENROUTER_KEYS', name: 'openrouter' },
    { env: 'MISTRAL_KEYS', name: 'mistral' },
    { env: 'PEXELS_KEYS', name: 'pexels' },
    { env: 'DEEPSEEK_KEYS', name: 'deepseek' },
    { env: 'OPENAI_KEYS', name: 'openai' },
    { env: 'GEMINI_API_KEY', name: 'google' },
    { env: 'GOOGLE_AI_KEYS', name: 'google' },
    { env: 'XAI_KEYS', name: 'xai' },
    { env: 'API_NINJAS_KEYS', name: 'api-ninjas' },
    { env: 'TOGETHER_API_KEYS', name: 'together' }
  ];

  let totalInserted = 0;

  for (const provider of providers) {
    const keysRaw = envConfig[provider.env];
    if (!keysRaw) continue;

    const keys = keysRaw.split(',').map(k => k.trim()).filter(k => k);
    console.log(`📦 Processing ${keys.length} keys for ${provider.name}...`);

    for (const key of keys) {
      const { error } = await supabase
        .from('api_keys')
        .upsert({
          provider: provider.name,
          key: key,
          is_active: true,
          updated_at: new Date().toISOString()
        }, { onConflict: 'provider,key' });

      if (error) {
        console.error(`❌ Failed to insert key for ${provider.name}:`, error.message);
      } else {
        totalInserted++;
      }
    }
  }

  console.log(`✅ Seeding complete. Total keys synced: ${totalInserted}`);
}

seedKeys().catch(err => {
  console.error('💥 Fatal Error:', err);
});

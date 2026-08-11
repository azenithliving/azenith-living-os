#!/usr/bin/env node
/**
 * Import all keys from .env.local to Supabase database
 * Run once to migrate to DB-only mode
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local
config({ path: resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/["']/g, '');
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.replace(/["']/g, '');

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Parse key pools from .env.local
const parseKeys = (envVar) => {
  if (!envVar) return [];
  return envVar.split(',').map(k => k.trim()).filter(Boolean);
};

const ENV_KEYS = {
  groq: parseKeys(process.env.GROQ_KEYS),
  openrouter: parseKeys(process.env.OPENROUTER_KEYS),
  mistral: parseKeys(process.env.MISTRAL_KEYS),
  pexels: parseKeys(process.env.PEXELS_KEYS),
  deepseek: parseKeys(process.env.DEEPSEEK_KEYS),
  openai: parseKeys(process.env.OPENAI_KEYS),
  google: parseKeys(process.env.GOOGLE_AI_KEYS || process.env.GEMINI_API_KEY),
  anthropic: parseKeys(process.env.ANTHROPIC_KEYS),
  sambanova: parseKeys(process.env.SAMBANOVA_KEYS),
  together: parseKeys(process.env.TOGETHER_API_KEYS),
  cerebras: parseKeys(process.env.CEREBRAS_API_KEY),
  cohere: parseKeys(process.env.COHERE_API_KEY),
  xai: parseKeys(process.env.XAI_KEYS),
  api_ninjas: parseKeys(process.env.API_NINJAS_KEYS),
  aimlapi: parseKeys(process.env.AIMLAPI_KEYS),
  apifreellm: parseKeys(process.env.APIFREELLM_KEYS),
  bytez: parseKeys(process.env.BYTEZ_KEYS),
};

async function importKeys() {
  console.log('🚀 Starting import...\n');

  let totalImported = 0;
  let totalSkipped = 0;

  for (const [provider, keys] of Object.entries(ENV_KEYS)) {
    if (keys.length === 0) {
      console.log(`⏭️  ${provider}: No keys found`);
      continue;
    }

    console.log(`📦 ${provider}: Found ${keys.length} keys`);

    // Get existing keys for this provider
    const { data: existing } = await supabase
      .from('api_keys')
      .select('key')
      .eq('provider', provider);

    const existingSet = new Set(existing?.map(k => k.key) || []);
    const keysToInsert = keys.filter(k => !existingSet.has(k));

    if (keysToInsert.length === 0) {
      console.log(`   ✅ All keys already in DB (skipped ${keys.length})`);
      totalSkipped += keys.length;
      continue;
    }

    // Bulk insert
    const { error } = await supabase
      .from('api_keys')
      .insert(
        keysToInsert.map(key => ({
          provider,
          key,
          is_active: true,
          is_backup: false,
          notes: 'Imported from env variables',
          total_requests: 0,
        }))
      );

    if (error) {
      console.error(`   ❌ Failed: ${error.message}`);
      console.error(`   Details:`, JSON.stringify(error, null, 2));
      totalSkipped += keysToInsert.length;
    } else {
      console.log(`   ✅ Imported ${keysToInsert.length}, skipped ${keys.length - keysToInsert.length}`);
      totalImported += keysToInsert.length;
      totalSkipped += (keys.length - keysToInsert.length);
    }
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`✅ Import complete!`);
  console.log(`   Imported: ${totalImported} keys`);
  console.log(`   Skipped:  ${totalSkipped} keys`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
}

importKeys().catch(err => {
  console.error('❌ Import failed:', err);
  process.exit(1);
});

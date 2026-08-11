#!/usr/bin/env node
/**
 * Force import: Delete all existing keys and import fresh from .env.local
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/["']/g, '');
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.replace(/["']/g, '');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const parseKeys = (envVar) => {
  if (!envVar) return [];
  const keys = envVar.split(',').map(k => k.trim()).filter(Boolean);
  return Array.from(new Set(keys)); // Remove duplicates
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

async function forceImport() {
  console.log('⚠️  FORCE IMPORT: This will DELETE all existing keys!\n');
  
  // Step 1: Delete ALL existing keys
  console.log('🗑️  Deleting all existing keys...');
  const { error: deleteError } = await supabase
    .from('api_keys')
    .delete()
    .not('id', 'is', null); // Delete all rows

  if (deleteError) {
    console.error('❌ Failed to delete:', deleteError);
    return;
  }
  console.log('✅ All keys deleted\n');

  // Step 2: Import fresh keys
  console.log('📥 Importing fresh keys from .env.local...\n');
  
  let totalImported = 0;

  for (const [provider, keys] of Object.entries(ENV_KEYS)) {
    if (keys.length === 0) {
      console.log(`⏭️  ${provider}: No keys found`);
      continue;
    }

    console.log(`📦 ${provider}: Importing ${keys.length} keys...`);

    const { error } = await supabase
      .from('api_keys')
      .insert(
        keys.map(key => ({
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
    } else {
      console.log(`   ✅ Imported ${keys.length} keys`);
      totalImported += keys.length;
    }
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`✅ Import complete!`);
  console.log(`   Total imported: ${totalImported} keys`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
}

forceImport().catch(err => {
  console.error('❌ Import failed:', err);
  process.exit(1);
});

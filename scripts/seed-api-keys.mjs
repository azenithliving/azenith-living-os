/**
 * Seed API Keys Script
 * Reads API keys from .env and inserts them into Supabase api_keys table
 * Usage: node scripts/seed-api-keys.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load .env file manually
function loadEnv() {
  const envPath = resolve(process.cwd(), '.env.local');
  const envContent = readFileSync(envPath, 'utf-8');
  const env = {};

  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;

    const key = trimmed.slice(0, eqIndex);
    let value = trimmed.slice(eqIndex + 1);

    // Remove quotes if present
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    env[key] = value;
  }

  return env;
}

// Parse comma-separated keys
function parseKeys(value) {
  if (!value) return [];
  return value.split(',')
    .map(k => k.trim())
    .filter(k => k.length > 0);
}

async function main() {
  console.log('🚀 Loading environment variables...\n');

  const env = loadEnv();

  // Get Supabase credentials
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Error: Missing Supabase credentials in .env.local');
    console.error('   Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  // Parse API keys from env
  const groqKeys = parseKeys(env.GROQ_KEYS);
  const openrouterKeys = parseKeys(env.OPENROUTER_KEYS);
  const mistralKeys = parseKeys(env.MISTRAL_KEYS);
  const pexelsKeys = parseKeys(env.PEXELS_API_KEY);

  console.log('📋 Found keys:');
  console.log(`   GROQ: ${groqKeys.length} keys`);
  console.log(`   OPENROUTER: ${openrouterKeys.length} keys`);
  console.log(`   MISTRAL: ${mistralKeys.length} keys`);
  console.log(`   PEXELS: ${pexelsKeys.length} keys\n`);

  // Create Supabase client with service role
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Prepare all keys to insert
  const keysToInsert = [
    ...groqKeys.map(key => ({ provider: 'groq', key })),
    ...openrouterKeys.map(key => ({ provider: 'openrouter', key })),
    ...mistralKeys.map(key => ({ provider: 'mistral', key })),
    ...pexelsKeys.map(key => ({ provider: 'pexels', key })),
  ];

  if (keysToInsert.length === 0) {
    console.log('⚠️ No API keys found to insert.');
    process.exit(0);
  }

  console.log(`🔑 Total keys to process: ${keysToInsert.length}\n`);

  let inserted = 0;
  let skipped = 0;
  let failed = 0;

  // Insert each key (skipping duplicates)
  for (const { provider, key } of keysToInsert) {
    const maskedKey = key.slice(0, 4) + '****' + key.slice(-4);

    try {
      const { error } = await supabase
        .from('api_keys')
        .insert({ provider, key }, { onConflict: 'provider,key' });

      if (error) {
        if (error.code === '23505') {
          console.log(`⏭️  [${provider}] Key ${maskedKey} already exists (skipped)`);
          skipped++;
        } else {
          console.error(`❌ [${provider}] Error inserting key ${maskedKey}:`, error.message);
          failed++;
        }
      } else {
        console.log(`✅ [${provider}] Key ${maskedKey} inserted successfully`);
        inserted++;
      }
    } catch (err) {
      console.error(`❌ [${provider}] Exception for key ${maskedKey}:`, err.message);
      failed++;
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Inserted: ${inserted}`);
  console.log(`   ⏭️  Skipped: ${skipped}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`\n🎉 Done!`);
}

main().catch(err => {
  console.error('💥 Fatal error:', err);
  process.exit(1);
});

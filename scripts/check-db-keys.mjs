#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/["']/g, '');
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.replace(/["']/g, '');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkDB() {
  console.log('🔍 Checking database...\n');
  
  const { data, error, count } = await supabase
    .from('api_keys')
    .select('provider', { count: 'exact', head: false });

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log(`Total keys in DB: ${count}\n`);
  
  // Count by provider
  const counts = {};
  data.forEach(row => {
    counts[row.provider] = (counts[row.provider] || 0) + 1;
  });

  console.log('Keys per provider:');
  Object.entries(counts).sort((a, b) => b[1] - a[1]).forEach(([provider, count]) => {
    console.log(`  ${provider}: ${count}`);
  });
}

checkDB();

#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/["']/g, '');
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.replace(/["']/g, '');
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const togetherKeys = process.env.TOGETHER_API_KEYS?.split(',').map(k => k.trim()).filter(Boolean) || [];

console.log(`Found ${togetherKeys.length} Together keys`);

// Delete existing together keys first
await supabase.from('api_keys').delete().eq('provider', 'together');
console.log('Deleted old together keys');

// Insert new ones
const { error } = await supabase.from('api_keys').insert(
  togetherKeys.map(key => ({
    provider: 'together',
    key,
    is_active: true,
    is_backup: false,
    notes: 'Imported from env',
    total_requests: 0,
  }))
);

if (error) {
  console.error('Error:', error);
} else {
  console.log(`✅ Imported ${togetherKeys.length} Together keys`);
}

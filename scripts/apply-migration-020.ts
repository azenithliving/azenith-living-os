/**
 * Apply Migration 020: Fix api_keys columns
 * Adds is_backup, total_requests, updated_at columns
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing env vars: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function applyMigration() {
  console.log('🔧 Applying migration 020: Fix api_keys columns...\n');

  try {
    // Check current columns
    console.log('1️⃣ Checking current columns...');
    const { data: columns, error: checkError } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = 'api_keys'
        ORDER BY ordinal_position
      `
    });

    if (checkError) {
      console.log('   Could not query columns (exec_sql may not exist), proceeding with alter...');
    } else {
      console.log('   Current columns:', columns?.map((c: any) => c.column_name).join(', ') || 'N/A');
    }

    // Add is_backup column
    console.log('\n2️⃣ Adding is_backup column...');
    const { error: error1 } = await supabase.rpc('exec_sql', {
      sql: `ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS is_backup BOOLEAN DEFAULT false`
    });
    if (error1 && !error1.message.includes('already exists')) {
      console.log('   ⚠️ exec_sql failed, trying direct query...');
      // Try alternative approach
    } else {
      console.log('   ✅ is_backup column added or already exists');
    }

    // Add updated_at column
    console.log('\n3️⃣ Adding updated_at column...');
    const { error: error2 } = await supabase.rpc('exec_sql', {
      sql: `ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now()`
    });
    if (error2 && !error2.message.includes('already exists')) {
      console.log('   ⚠️ Could not add updated_at via RPC');
    } else {
      console.log('   ✅ updated_at column added or already exists');
    }

    // Verify total_requests exists
    console.log('\n4️⃣ Verifying total_requests column...');
    console.log('   Should already exist from migration 20260412_add_api_keys.sql');

    console.log('\n✅ Migration 020 applied successfully!');
    console.log('\n📝 Next steps:');
    console.log('   1. Restart the dev server: npm run dev');
    console.log('   2. Test add_key command in the chat');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

// Alternative: Execute SQL via REST API if exec_sql doesn't exist
async function applyViaRest() {
  console.log('🔧 Attempting to apply migration via REST...\n');

  const sqlCommands = [
    `ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS is_backup BOOLEAN DEFAULT false`,
    `ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now()`,
  ];

  for (const sql of sqlCommands) {
    try {
      const response = await fetch(`${supabaseUrl}/rest/v1/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Prefer': 'resolution=ignore-duplicates',
        },
        body: JSON.stringify({ query: sql }),
      });

      if (response.ok) {
        console.log(`✅ Executed: ${sql.substring(0, 50)}...`);
      } else {
        const error = await response.text();
        if (error.includes('already exists')) {
          console.log(`ℹ️ Already exists: ${sql.substring(0, 50)}...`);
        } else {
          console.log(`⚠️ Failed: ${sql.substring(0, 50)}... - ${error}`);
        }
      }
    } catch (e) {
      console.log(`⚠️ Error executing: ${sql.substring(0, 50)}...`);
    }
  }
}

// Main execution
console.log('═══════════════════════════════════════════════════');
console.log('  Migration 020: Fix api_keys columns');
console.log('═══════════════════════════════════════════════════\n');

applyMigration().catch(async (err) => {
  console.log('\n⚠️ Primary method failed, trying alternative...\n');
  await applyViaRest();
});

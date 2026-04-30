#!/usr/bin/env ts-node
/**
 * Apply SQL Migration Directly via Supabase PostgREST
 */

import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// SQL statements to execute one by one
const SQL_STATEMENTS = [
  // Add company_id column
  `ALTER TABLE public.room_sections 
   ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE`,
  
  // Add other columns
  `ALTER TABLE public.room_sections ADD COLUMN IF NOT EXISTS slug TEXT`,
  `ALTER TABLE public.room_sections ADD COLUMN IF NOT EXISTS name TEXT`,
  `ALTER TABLE public.room_sections ADD COLUMN IF NOT EXISTS name_ar TEXT`,
  `ALTER TABLE public.room_sections ADD COLUMN IF NOT EXISTS description TEXT`,
  `ALTER TABLE public.room_sections ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0`,
  `ALTER TABLE public.room_sections ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true`,
  `ALTER TABLE public.room_sections ADD COLUMN IF NOT EXISTS icon TEXT`,
  `ALTER TABLE public.room_sections ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb`,
  `ALTER TABLE public.room_sections ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT timezone('utc', now())`,
  `ALTER TABLE public.room_sections ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc', now())`,
  
  // Create unique constraint
  `DO $$
   BEGIN
     IF NOT EXISTS (
       SELECT 1 FROM pg_constraint WHERE conname = 'room_sections_company_slug_key'
     ) THEN
       ALTER TABLE public.room_sections ADD CONSTRAINT room_sections_company_slug_key UNIQUE (company_id, slug);
     END IF;
   END $$`,
  
  // Create indexes
  `CREATE INDEX IF NOT EXISTS idx_room_sections_company_active ON public.room_sections(company_id, is_active, display_order)`,
  `CREATE INDEX IF NOT EXISTS idx_room_sections_slug ON public.room_sections(slug)`,
  
  // Enable RLS
  `ALTER TABLE public.room_sections ENABLE ROW LEVEL SECURITY`,
  
  // Create policy
  `DROP POLICY IF EXISTS room_sections_isolation ON public.room_sections`,
  `CREATE POLICY room_sections_isolation ON public.room_sections 
   FOR ALL USING (company_id = public.current_company_id()) 
   WITH CHECK (company_id = public.current_company_id())`
];

async function applySQL() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║  APPLYING SQL MIGRATION VIA REST API                    ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < SQL_STATEMENTS.length; i++) {
    const sql = SQL_STATEMENTS[i];
    const shortDesc = sql.substring(0, 50).replace(/\n/g, ' ');
    
    console.log(`\n[${i + 1}/${SQL_STATEMENTS.length}] ${shortDesc}...`);
    
    try {
      // Try using the Supabase query endpoint with raw SQL
      const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'apikey': SUPABASE_SERVICE_KEY,
          'Prefer': 'tx=rollback' // Don't commit if this were a transaction
        },
        body: JSON.stringify({ query: sql })
      });

      // Supabase REST doesn't support raw SQL directly, so we need to handle the error
      // and provide manual instructions
      if (!response.ok) {
        const errorText = await response.text();
        
        // Check if it's a "column already exists" error (which is fine)
        if (errorText.includes('already exists') || errorText.includes('duplicate')) {
          console.log('   ✅ Already exists (skipping)');
          successCount++;
        } else {
          console.log(`   ⚠️  Could not apply: ${errorText.substring(0, 100)}`);
          failCount++;
        }
      } else {
        console.log('   ✅ Applied successfully');
        successCount++;
      }
    } catch (err) {
      console.log(`   ⚠️  Error: ${err instanceof Error ? err.message : String(err)}`);
      failCount++;
    }
    
    // Small delay between requests
    await new Promise(r => setTimeout(r, 200));
  }

  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log(`║  RESULTS: ${successCount} succeeded, ${failCount} failed                          ║`);
  console.log('╚════════════════════════════════════════════════════════╝\n');

  if (failCount > 0) {
    console.log('⚠️  Some statements could not be applied automatically.');
    console.log('   Please run the SQL manually in Supabase SQL Editor:');
    console.log('   https://supabase.com/dashboard/project/dmavypdmtbxzwrexqesu/sql-editor\n');
    console.log('--- SQL TO RUN ---');
    SQL_STATEMENTS.forEach((sql, i) => {
      console.log(`\n-- Statement ${i + 1}`);
      console.log(sql + ';');
    });
    process.exit(1);
  }
}

applySQL();

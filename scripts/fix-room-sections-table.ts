#!/usr/bin/env ts-node
/**
 * Fix Room Sections Table Structure
 * Ensures the table has all required columns including company_id
 * 
 * Run: npx tsx scripts/fix-room-sections-table.ts
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

async function fixTable() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║  FIXING ROOM_SECTIONS TABLE STRUCTURE                   ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  if (!SUPABASE_SERVICE_KEY) {
    console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY not found');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    // Step 1: Check if table exists and its structure
    console.log('Step 1: Checking table structure...');
    const { data: columns, error: colError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type')
      .eq('table_name', 'room_sections')
      .eq('table_schema', 'public');

    if (colError) {
      console.log('   Could not query columns via Supabase, checking table existence...');
    } else {
      console.log(`   Found ${columns?.length || 0} columns:`);
      columns?.forEach(col => console.log(`     - ${col.column_name} (${col.data_type})`));
    }

    // Step 2: Try to add missing columns
    console.log('\nStep 2: Adding missing columns...');
    
    // Add company_id column
    const alterSQL = `
      ALTER TABLE public.room_sections 
      ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS slug TEXT,
      ADD COLUMN IF NOT EXISTS name TEXT,
      ADD COLUMN IF NOT EXISTS name_ar TEXT,
      ADD COLUMN IF NOT EXISTS description TEXT,
      ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
      ADD COLUMN IF NOT EXISTS icon TEXT,
      ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc', now());
      
      -- Add unique constraint if not exists
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'room_sections_company_slug_unique'
        ) THEN
          ALTER TABLE public.room_sections 
          ADD CONSTRAINT room_sections_company_slug_unique UNIQUE (company_id, slug);
        END IF;
      END $$;
      
      -- Create indexes
      CREATE INDEX IF NOT EXISTS idx_room_sections_company_active ON public.room_sections(company_id, is_active, display_order);
      CREATE INDEX IF NOT EXISTS idx_room_sections_slug ON public.room_sections(slug);
      
      -- Enable RLS and add policy
      ALTER TABLE public.room_sections ENABLE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS room_sections_isolation ON public.room_sections;
      CREATE POLICY room_sections_isolation ON public.room_sections
      FOR ALL USING (company_id = public.current_company_id()) WITH CHECK (company_id = public.current_company_id());
    `;

    // Try to execute via REST API
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'apikey': SUPABASE_SERVICE_KEY
      },
      body: JSON.stringify({ sql: alterSQL })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`   REST API failed: ${errorText.substring(0, 200)}`);
      console.log('\n⚠️  Please run the SQL manually in Supabase SQL Editor:');
      console.log('   https://supabase.com/dashboard/project/dmavypdmtbxzwrexqesu/sql-editor');
      console.log('\n   SQL to run:');
      console.log(alterSQL);
      process.exit(1);
    }

    console.log('   ✅ Columns added successfully');

    // Step 3: Verify structure
    console.log('\nStep 3: Verifying new structure...');
    const { data: newColumns, error: verifyError } = await supabase
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_name', 'room_sections')
      .eq('table_schema', 'public');

    if (verifyError) {
      console.warn('   Could not verify, but continuing...');
    } else {
      const hasCompanyId = newColumns?.some(c => c.column_name === 'company_id');
      const hasSlug = newColumns?.some(c => c.column_name === 'slug');
      console.log(`   company_id column: ${hasCompanyId ? '✅' : '❌'}`);
      console.log(`   slug column: ${hasSlug ? '✅' : '❌'}`);
      console.log(`   Total columns: ${newColumns?.length || 0}`);
    }

    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║  ✅ TABLE STRUCTURE FIX COMPLETE                        ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixTable();

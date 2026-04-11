#!/usr/bin/env ts-node
/**
 * Apply Migration 005: Room Sections Table
 * 
 * Run: npx tsx scripts/apply-migration-005.ts
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { resolve } from 'path';

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const MIGRATION_SQL = `
-- Migration 005: Room Sections Table for Interior Categories

-- ============================================
-- ROOM_SECTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.room_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    slug TEXT NOT NULL,
    name TEXT NOT NULL,
    name_ar TEXT,
    description TEXT,
    display_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    icon TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    UNIQUE(company_id, slug)
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_room_sections_company_active 
    ON public.room_sections(company_id, is_active, display_order);

CREATE INDEX IF NOT EXISTS idx_room_sections_slug 
    ON public.room_sections(slug);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE public.room_sections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS room_sections_isolation ON public.room_sections;
CREATE POLICY room_sections_isolation ON public.room_sections
FOR ALL
USING (company_id = public.current_company_id())
WITH CHECK (company_id = public.current_company_id());
`;

async function applyMigration() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║  APPLYING MIGRATION 005: Room Sections Table            ║');
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
    // Execute the migration SQL
    const { error } = await supabase.rpc('exec_sql', { sql: MIGRATION_SQL });
    
    if (error) {
      console.log('Note: exec_sql RPC not available, trying direct query...');
      
      // Try executing SQL statements individually
      const statements = MIGRATION_SQL.split(';').filter(s => s.trim());
      
      for (const statement of statements) {
        const trimmed = statement.trim();
        if (!trimmed || trimmed.startsWith('--')) continue;
        
        const fullStatement = trimmed + ';';
        console.log(`Executing: ${trimmed.substring(0, 60)}...`);
        
        // Use Supabase REST API to execute raw SQL
        const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Prefer': 'resolution=merge-duplicates'
          },
          body: JSON.stringify({
            query: fullStatement
          })
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.warn(`   Warning: ${errorText.substring(0, 100)}`);
        }
      }
    }

    // Verify table was created
    const { data, error: checkError } = await supabase
      .from('room_sections')
      .select('id')
      .limit(1);

    if (checkError && checkError.code === '42P01') {
      console.error('❌ Table creation failed. Table does not exist.');
      console.log('\n⚠️  Please run the SQL manually in Supabase SQL Editor:');
      console.log('File: supabase/migrations/005_room_sections_table.sql');
      process.exit(1);
    }

    console.log('✅ Migration 005 applied successfully!');
    console.log('✅ room_sections table exists and is ready\n');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.log('\n⚠️  Please run the SQL manually in Supabase SQL Editor:');
    console.log('File: supabase/migrations/005_room_sections_table.sql');
    process.exit(1);
  }
}

applyMigration();

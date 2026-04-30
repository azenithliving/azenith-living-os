#!/usr/bin/env ts-node
/**
 * Add company_id column and update all room_sections
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// SQL to add company_id column via Supabase REST API workaround
async function addCompanyId() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║  ADDING COMPANY_ID COLUMN & LINKING TO TENANT         ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Get company ID
  const { data: company } = await supabase.from('companies').select('id').limit(1).single();
  if (!company) {
    console.error('❌ No company found');
    process.exit(1);
  }
  const companyId = company.id;
  console.log(`✅ Company ID: ${companyId}\n`);

  // SQL statements to execute
  const statements = [
    `ALTER TABLE public.room_sections ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE`,
    `UPDATE public.room_sections SET company_id = '${companyId}' WHERE company_id IS NULL`,
    `ALTER TABLE public.room_sections ALTER COLUMN company_id SET NOT NULL`,
    `CREATE INDEX IF NOT EXISTS idx_room_sections_company_active ON public.room_sections(company_id, is_active)`,
    `ALTER TABLE public.room_sections ENABLE ROW LEVEL SECURITY`,
    `DROP POLICY IF EXISTS room_sections_isolation ON public.room_sections`,
    `CREATE POLICY room_sections_isolation ON public.room_sections FOR ALL USING (company_id = public.current_company_id())`
  ];

  // Try to execute via PostgREST
  console.log('Attempting to execute SQL...\n');
  
  for (const sql of statements) {
    console.log(`Executing: ${sql.substring(0, 60)}...`);
    
    try {
      // Use Supabase's query parameter approach via fetch
      const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'apikey': SUPABASE_SERVICE_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ sql })
      });
      
      if (!response.ok) {
        const text = await response.text();
        // Check for "already exists" errors which are OK
        if (text.includes('already exists') || text.includes('AlreadyExists')) {
          console.log('   ✅ Already exists (OK)');
        } else {
          console.log(`   ⚠️  ${text.substring(0, 100)}`);
        }
      } else {
        console.log('   ✅ Success');
      }
    } catch (e) {
      console.log(`   ⚠️  ${e instanceof Error ? e.message.substring(0, 80) : String(e)}`);
    }
  }

  console.log('\n--- FINAL VERIFICATION ---');
  
  // Verify results
  const { data: sections, error } = await supabase
    .from('room_sections')
    .select('id, name, company_id, is_active')
    .order('name');
  
  if (error) {
    console.log(`Error: ${error.message}`);
  } else {
    console.log(`\n📊 Total sections with company_id: ${sections?.length || 0}`);
    sections?.forEach(s => {
      const linked = s.company_id === companyId ? '✅' : '❌';
      console.log(`   ${linked} ${s.name} (${s.company_id?.substring(0, 8)}...) - Active: ${s.is_active}`);
    });
  }

  console.log('\n⚠️  If SQL execution failed, please run this SQL manually in Supabase SQL Editor:');
  console.log('https://supabase.com/dashboard/project/dmavypdmtbxzwrexqesu/sql-editor\n');
  console.log('-- COPY AND PASTE THIS SQL --');
  statements.forEach(s => console.log(s + ';'));
}

addCompanyId();

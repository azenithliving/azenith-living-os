#!/usr/bin/env ts-node
/**
 * Room Sections Initialization Script
 * 
 * Adds all 15 interior sections to the room_sections table in Supabase.
 * All sections are marked as is_active: true and linked to the correct Tenant ID.
 * 
 * Run: npx tsx scripts/init-room-sections.ts
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { resolve } from 'path';

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// 15 Interior Sections for Azenith Living
const INTERIOR_SECTIONS = [
  {
    slug: 'living-room',
    name: 'Living Room',
    name_ar: 'غرفة المعيشة',
    description: 'Luxury living room furniture and interior design',
    icon: 'sofa',
    display_order: 1
  },
  {
    slug: 'dining-room',
    name: 'Dining Room',
    name_ar: 'غرفة الطعام',
    description: 'Elegant dining room furniture and setups',
    icon: 'utensils',
    display_order: 2
  },
  {
    slug: 'kitchen',
    name: 'Kitchen',
    name_ar: 'المطبخ',
    description: 'Modern kitchen designs and cabinetry',
    icon: 'chef-hat',
    display_order: 3
  },
  {
    slug: 'master-bedroom',
    name: 'Master Bedroom',
    name_ar: 'غرفة النوم الرئيسية',
    description: 'Premium master bedroom furniture and design',
    icon: 'bed',
    display_order: 4
  },
  {
    slug: 'guest-bedroom',
    name: 'Guest Bedroom',
    name_ar: 'غرفة نوم الضيوف',
    description: 'Comfortable guest bedroom solutions',
    icon: 'bed-single',
    display_order: 5
  },
  {
    slug: 'kids-bedroom',
    name: 'Kids Bedroom',
    name_ar: 'غرفة الأطفال',
    description: 'Playful and functional kids bedroom furniture',
    icon: 'toy',
    display_order: 6
  },
  {
    slug: 'teen-room',
    name: 'Teen Room',
    name_ar: 'غرفة المراهقين',
    description: 'Modern teenager bedroom with study area',
    icon: 'user',
    display_order: 7
  },
  {
    slug: 'dressing-room',
    name: 'Dressing Room',
    name_ar: 'غرفة الملابس',
    description: 'Walk-in closets and dressing room solutions',
    icon: 'shirt',
    display_order: 8
  },
  {
    slug: 'home-office',
    name: 'Home Office',
    name_ar: 'مكتب المنزل',
    description: 'Executive home office and study room furniture',
    icon: 'briefcase',
    display_order: 9
  },
  {
    slug: 'study-room',
    name: 'Study Room',
    name_ar: 'غرفة الدراسة',
    description: 'Dedicated study and reading room design',
    icon: 'book-open',
    display_order: 10
  },
  {
    slug: 'bathroom',
    name: 'Bathroom',
    name_ar: 'الحمام',
    description: 'Luxury bathroom fixtures and design',
    icon: 'bath',
    display_order: 11
  },
  {
    slug: 'guest-bathroom',
    name: 'Guest Bathroom',
    name_ar: 'حمام الضيوف',
    description: 'Elegant guest bathroom solutions',
    icon: 'bath',
    display_order: 12
  },
  {
    slug: 'entrance-lobby',
    name: 'Entrance/Lobby',
    name_ar: 'المدخل',
    description: 'Grand entrance and lobby furniture',
    icon: 'door-open',
    display_order: 13
  },
  {
    slug: 'corner-sofa',
    name: 'Corner Sofa',
    name_ar: 'كنب الزاوية',
    description: 'Luxury sectional and corner sofa options',
    icon: 'lamp',
    display_order: 14
  },
  {
    slug: 'lounge',
    name: 'Lounge',
    name_ar: 'الاستراحة',
    description: 'Premium lounge seating and relaxation areas',
    icon: 'couch',
    display_order: 15
  }
];

async function initRoomSections() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║  ROOM SECTIONS INITIALIZATION                           ║');
  console.log('║  Adding 15 Interior Sections to Supabase               ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  if (!SUPABASE_SERVICE_KEY) {
    console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY not found in environment');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    // Step 1: Get the primary company/tenant ID
    console.log('Step 1: Fetching primary company/tenant...');
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('id, name')
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (companyError || !company) {
      console.error('❌ No company found. Please ensure companies table has at least one record.');
      console.log('Creating default company first...');
      
      // Create default company
      const { data: newCompany, error: createError } = await supabase
        .from('companies')
        .insert({
          name: 'Azenith Living',
          domain: 'azenithliving.vercel.app',
          primary_color: '#C5A059',
          whatsapp: '201090819584'
        })
        .select('id, name')
        .single();
      
      if (createError) {
        console.error('❌ Failed to create default company:', createError.message);
        process.exit(1);
      }
      
      console.log(`✅ Created default company: ${newCompany.name} (${newCompany.id})`);
      var companyId = newCompany.id;
    } else {
      console.log(`✅ Found company: ${company.name} (${company.id})`);
      var companyId = company.id;
    }

    // Step 2: Create room_sections table if it doesn't exist
    console.log('\nStep 2: Ensuring room_sections table exists...');
    const { error: tableError } = await supabase
      .from('room_sections')
      .select('id')
      .limit(1);

    if (tableError && tableError.code === '42P01') {
      console.log('   Table does not exist. Creating room_sections table...');
      
      // Create the table using raw SQL via supabase
      const createTableSQL = `
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
        CREATE INDEX IF NOT EXISTS idx_room_sections_company_active ON public.room_sections(company_id, is_active, display_order);
        CREATE INDEX IF NOT EXISTS idx_room_sections_slug ON public.room_sections(slug);
        ALTER TABLE public.room_sections ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS room_sections_isolation ON public.room_sections;
        CREATE POLICY room_sections_isolation ON public.room_sections
        FOR ALL USING (company_id = public.current_company_id()) WITH CHECK (company_id = public.current_company_id());
      `;
      
      // Execute SQL using Supabase's exec_sql function if available
      const { error: createError } = await supabase.rpc('exec_sql', { sql: createTableSQL });
      
      if (createError) {
        console.log('   Note: exec_sql RPC not available, trying REST API...');
        
        // Try REST API approach
        try {
          const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
              'apikey': SUPABASE_SERVICE_KEY
            },
            body: JSON.stringify({ sql: createTableSQL })
          });
          
          if (!response.ok) {
            const errorText = await response.text();
            console.warn(`   Warning creating table via REST: ${errorText.substring(0, 200)}`);
            console.log('\n⚠️  Please run the SQL manually in Supabase SQL Editor:');
            console.log('  https://dmavypdmtbxzwrexqesu.supabase.co/project/sql');
            console.log('\n  SQL File: supabase/migrations/005_room_sections_table.sql');
            process.exit(1);
          }
        } catch (fetchError) {
          console.error('   Error creating table:', fetchError);
          console.log('\n⚠️  Please run the SQL manually in Supabase SQL Editor:');
          console.log('  https://dmavypdmtbxzwrexqesu.supabase.co/project/sql');
          process.exit(1);
        }
      }
      
      console.log('   ✅ room_sections table created successfully');
    } else {
      console.log('   ✅ room_sections table exists');
    }

    // Step 3: Check existing sections
    console.log('\nStep 3: Checking existing sections...');
    const { data: existingSections, error: existingError } = await supabase
      .from('room_sections')
      .select('slug, name, is_active')
      .eq('company_id', companyId);

    if (existingError) {
      console.error('❌ Error checking existing sections:', existingError.message);
      process.exit(1);
    }

    const existingSlugs = new Set(existingSections?.map(s => s.slug) || []);
    console.log(`   Found ${existingSlugs.size} existing sections`);

    // Step 4: Insert missing sections
    console.log('\nStep 4: Inserting 15 interior sections...');
    let insertedCount = 0;
    let skippedCount = 0;

    for (const section of INTERIOR_SECTIONS) {
      if (existingSlugs.has(section.slug)) {
        // Update existing section to ensure is_active is true
        const { error: updateError } = await supabase
          .from('room_sections')
          .update({ 
            is_active: true,
            updated_at: new Date().toISOString()
          })
          .eq('company_id', companyId)
          .eq('slug', section.slug);

        if (updateError) {
          console.warn(`   ⚠️  Failed to update ${section.slug}:`, updateError.message);
        } else {
          console.log(`   🔄 Updated: ${section.name} (activated)`);
          skippedCount++;
        }
        continue;
      }

      const { error: insertError } = await supabase
        .from('room_sections')
        .insert({
          company_id: companyId,
          slug: section.slug,
          name: section.name,
          name_ar: section.name_ar,
          description: section.description,
          icon: section.icon,
          display_order: section.display_order,
          is_active: true,
          metadata: {
            category: 'interior',
            created_by: 'init-script',
            created_at: new Date().toISOString()
          }
        });

      if (insertError) {
        console.error(`   ❌ Failed to insert ${section.slug}:`, insertError.message);
      } else {
        console.log(`   ✅ Inserted: ${section.name}`);
        insertedCount++;
      }
    }

    // Step 5: Verify results
    console.log('\nStep 5: Verifying final state...');
    const { data: finalSections, error: finalError } = await supabase
      .from('room_sections')
      .select('slug, name, is_active, display_order')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('display_order');

    if (finalError) {
      console.error('❌ Error verifying sections:', finalError.message);
    } else {
      console.log(`\n📊 FINAL RESULTS:`);
      console.log(`   Total active sections: ${finalSections?.length || 0}`);
      console.log(`   Newly inserted: ${insertedCount}`);
      console.log(`   Updated/Existing: ${skippedCount}`);
      
      console.log('\n📋 Active Room Sections:');
      finalSections?.forEach((section, index) => {
        console.log(`   ${index + 1}. ${section.name} (${section.slug}) - Active: ${section.is_active}`);
      });
    }

    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║  ✅ ROOM SECTIONS INITIALIZATION COMPLETE               ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');

  } catch (error) {
    console.error('\n❌ Unexpected error:', error);
    process.exit(1);
  }
}

initRoomSections();

#!/usr/bin/env ts-node
/**
 * Check Table Structure and Initialize Sections
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const INTERIOR_SECTIONS = [
  { slug: 'living-room', name: 'Living Room', name_ar: 'غرفة المعيشة', description: 'Luxury living room furniture', icon: 'sofa', order: 1 },
  { slug: 'dining-room', name: 'Dining Room', name_ar: 'غرفة الطعام', description: 'Elegant dining room furniture', icon: 'utensils', order: 2 },
  { slug: 'kitchen', name: 'Kitchen', name_ar: 'المطبخ', description: 'Modern kitchen designs', icon: 'chef-hat', order: 3 },
  { slug: 'master-bedroom', name: 'Master Bedroom', name_ar: 'غرفة النوم الرئيسية', description: 'Premium master bedroom', icon: 'bed', order: 4 },
  { slug: 'guest-bedroom', name: 'Guest Bedroom', name_ar: 'غرفة نوم الضيوف', description: 'Guest bedroom solutions', icon: 'bed-single', order: 5 },
  { slug: 'kids-bedroom', name: 'Kids Bedroom', name_ar: 'غرفة الأطفال', description: 'Kids bedroom furniture', icon: 'toy', order: 6 },
  { slug: 'teen-room', name: 'Teen Room', name_ar: 'غرفة المراهقين', description: 'Teen bedroom with study', icon: 'user', order: 7 },
  { slug: 'dressing-room', name: 'Dressing Room', name_ar: 'غرفة الملابس', description: 'Walk-in closets', icon: 'shirt', order: 8 },
  { slug: 'home-office', name: 'Home Office', name_ar: 'مكتب المنزل', description: 'Executive home office', icon: 'briefcase', order: 9 },
  { slug: 'study-room', name: 'Study Room', name_ar: 'غرفة الدراسة', description: 'Study and reading room', icon: 'book-open', order: 10 },
  { slug: 'bathroom', name: 'Bathroom', name_ar: 'الحمام', description: 'Luxury bathroom', icon: 'bath', order: 11 },
  { slug: 'guest-bathroom', name: 'Guest Bathroom', name_ar: 'حمام الضيوف', description: 'Guest bathroom', icon: 'bath', order: 12 },
  { slug: 'entrance-lobby', name: 'Entrance/Lobby', name_ar: 'المدخل', description: 'Entrance furniture', icon: 'door-open', order: 13 },
  { slug: 'corner-sofa', name: 'Corner Sofa', name_ar: 'كنب الزاوية', description: 'Sectional sofas', icon: 'lamp', order: 14 },
  { slug: 'lounge', name: 'Lounge', name_ar: 'الاستراحة', description: 'Lounge seating', icon: 'couch', order: 15 },
];

async function checkAndInit() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║  CHECK & INITIALIZE ROOM SECTIONS                       ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Get company
  const { data: company } = await supabase.from('companies').select('id,name').limit(1).single();
  if (!company) {
    console.error('❌ No company found');
    process.exit(1);
  }
  console.log(`✅ Company: ${company.name} (${company.id})\n`);

  // Try to select from room_sections to see what error we get
  const { error: selectError } = await supabase.from('room_sections').select('*').limit(1);
  
  if (selectError) {
    console.log('Table error:', selectError.message);
    console.log('Code:', selectError.code);
    
    if (selectError.code === '42P01') {
      console.log('\n❌ Table does not exist. Please run SQL in Supabase Editor:');
      console.log('https://supabase.com/dashboard/project/dmavypdmtbxzwrexqesu/sql-editor');
      console.log('\nRun: supabase/migrations/005_room_sections_complete.sql');
      process.exit(1);
    }
  }

  // Try inserting a test record to see what columns are required
  console.log('Attempting to insert sections...\n');
  
  for (const section of INTERIOR_SECTIONS) {
    const record: Record<string, unknown> = {
      company_id: company.id,
      slug: section.slug,
      name: section.name,
      is_active: true,
    };
    
    // Try adding optional fields - they'll fail silently if columns don't exist
    try {
      const { error } = await supabase.from('room_sections').insert(record);
      
      if (error) {
        if (error.message.includes('company_id')) {
          console.log(`❌ company_id column missing`);
          break;
        }
        if (error.message.includes('duplicate')) {
          console.log(`🔄 ${section.name}: Already exists`);
        } else {
          console.log(`⚠️  ${section.name}: ${error.message.substring(0, 60)}`);
        }
      } else {
        console.log(`✅ ${section.name}: Inserted`);
      }
    } catch (e) {
      console.log(`❌ ${section.name}: ${e}`);
    }
  }

  // Count records
  const { count } = await supabase.from('room_sections').select('*', { count: 'exact', head: true });
  console.log(`\n📊 Total sections: ${count || 0}`);
}

checkAndInit();

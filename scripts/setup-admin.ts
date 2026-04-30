/**
 * Setup Default Admin User
 * 
 * Run this script to create the default admin user in Supabase Auth
 * 
 * Usage: npx tsx scripts/setup-admin.ts
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { resolve } from 'path';

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dmavypdmtbxzwrexqesu.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Default admin credentials
const ADMIN_EMAIL = 'azenithliving@gmail.com';
const ADMIN_PASSWORD = '3laa92aziz';

async function setupAdmin() {
  if (!SUPABASE_SERVICE_KEY) {
    console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY not found in environment');
    console.log('Please add it to your .env.local file');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  console.log('🔧 Setting up default admin user...');
  console.log(`Email: ${ADMIN_EMAIL}`);

  try {
    // Check if user already exists
    const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error('❌ Error listing users:', listError.message);
      process.exit(1);
    }

    const existingUser = existingUsers.users.find(u => u.email === ADMIN_EMAIL);

    if (existingUser) {
      console.log('⚠️  Admin user already exists');
      console.log('📝 Updating password...');
      
      // Update password
      const { error: updateError } = await supabase.auth.admin.updateUserById(
        existingUser.id,
        { password: ADMIN_PASSWORD }
      );

      if (updateError) {
        console.error('❌ Error updating password:', updateError.message);
        process.exit(1);
      }

      console.log('✅ Password updated successfully');
    } else {
      console.log('📝 Creating new admin user...');
      
      // Create new user
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        email_confirm: true,
        user_metadata: {
          role: 'master_admin',
          full_name: 'System Administrator',
        },
      });

      if (createError) {
        console.error('❌ Error creating user:', createError.message);
        process.exit(1);
      }

      console.log('✅ Admin user created successfully');
      console.log(`User ID: ${newUser.user.id}`);
    }

    // Also ensure user exists in the users table for application-level permissions
    const { data: company } = await supabase
      .from('companies')
      .select('id')
      .limit(1)
      .single();

    if (company) {
      const { data: existingDbUser } = await supabase
        .from('users')
        .select('id')
        .eq('email', ADMIN_EMAIL)
        .maybeSingle();

      if (!existingDbUser) {
        await supabase.from('users').insert({
          email: ADMIN_EMAIL,
          company_id: company.id,
          role: 'master_admin',
          session_id: 'admin-session',
          metadata: { is_admin: true, setup_date: new Date().toISOString() },
        });
        console.log('✅ Admin user added to application database');
      }
    }

    console.log('\n🎉 Setup complete!');
    console.log('\n📋 Login Credentials:');
    console.log(`Email: ${ADMIN_EMAIL}`);
    console.log(`Password: ${ADMIN_PASSWORD}`);
    console.log('\n🔗 Login at: http://localhost:3000/admin-gate/login');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }
}

setupAdmin();

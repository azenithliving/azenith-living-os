import postgres from 'postgres';
import dotenv from 'dotenv';
dotenv.config();

const sql = postgres(process.env.DIRECT_URL || process.env.DATABASE_URL!, { ssl: 'require' });

async function run() {
  console.log('Creating core prerequisite tables...');
  try {
    await sql.unsafe('CREATE TABLE IF NOT EXISTS team_roles (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT)');
    await sql.unsafe('CREATE TABLE IF NOT EXISTS team_members (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), company_id UUID, role_id UUID, email TEXT, name TEXT)');
    await sql.unsafe('CREATE TABLE IF NOT EXISTS sales_orders (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), company_id UUID, status TEXT)');
    await sql.unsafe('CREATE TABLE IF NOT EXISTS sales_order_items (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), sales_order_id UUID, description TEXT)');
    console.log('SUCCESS: Core tables created.');
  } catch (e) {
    console.error('FAILURE:', e.message);
  } finally {
    await sql.end();
  }
}
run();

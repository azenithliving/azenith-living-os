require('dotenv').config({ path: '.env.local' });
const postgres = require('postgres');

async function runMigration() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not found');
    return;
  }
  const sql = postgres(process.env.DATABASE_URL + '?sslmode=require');
  
  try {
    console.log('Running migration...');
    
    // 1. Create visitor_telemetry
    await sql`
      CREATE TABLE IF NOT EXISTS visitor_telemetry (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        session_id TEXT NOT NULL,
        current_path TEXT,
        hovered_elements JSONB DEFAULT '[]'::jsonb,
        attention_score FLOAT DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;
    console.log('visitor_telemetry table checked/created.');

    // 2. Create dynamic_assets_cms
    await sql`
      CREATE TABLE IF NOT EXISTS dynamic_assets_cms (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        asset_url TEXT NOT NULL,
        asset_type TEXT,
        tags TEXT[],
        psychological_trigger TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;
    console.log('dynamic_assets_cms table checked/created.');

    // 3. Add ui_state to consultant_sessions if it doesn't exist
    const cols = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='consultant_sessions' AND column_name='ui_state';
    `;
    
    if (cols.length === 0) {
      await sql`ALTER TABLE consultant_sessions ADD COLUMN ui_state JSONB DEFAULT '{}'::jsonb;`;
      console.log('ui_state column added to consultant_sessions.');
    } else {
      console.log('ui_state column already exists.');
    }

    console.log('Migration completed successfully!');
  } catch (e) {
    console.error('Migration failed:', e);
  } finally {
    await sql.end();
  }
}

runMigration();

const postgres = require('postgres');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const sql = postgres(process.env.DATABASE_URL);

async function inspectImagesTable() {
  console.log('--- Inspecting curated_images table ---');
  try {
    const columns = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'curated_images'
    `;
    console.log('Columns:', columns);
    
    const count = await sql`SELECT count(*) FROM curated_images`;
    console.log('Total images in DB:', count[0].count);

    const roomStats = await sql`
      SELECT room_type, count(*) 
      FROM curated_images 
      GROUP BY room_type
    `;
    console.log('Stats by Room:', roomStats);

    const styleStats = await sql`
      SELECT style, count(*) 
      FROM curated_images 
      GROUP BY style
    `;
    console.log('Stats by Style:', styleStats);

  } catch (e) {
    console.error('❌ Table Inspection Failed:', e);
  } finally {
    await sql.end();
  }
}

inspectImagesTable();

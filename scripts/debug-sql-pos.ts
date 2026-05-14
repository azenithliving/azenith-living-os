import fs from 'fs';
import path from 'path';

const migrationPath = path.join(process.cwd(), 'supabase/migrations/20260423_agents.sql');
const sql = fs.readFileSync(migrationPath, 'utf8');
const pos = 21945;

console.log('Snippet at position 21945:');
console.log(sql.substring(pos - 100, pos + 100));

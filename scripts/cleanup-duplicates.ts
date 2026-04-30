import postgres from 'postgres';

async function cleanup() {
  const sql = postgres("postgresql://postgres.dmavypdmtbxzwrexqesu:3laa1992aziz@aws-1-eu-central-1.pooler.supabase.com:5432/postgres");

  try {
    // Remove duplicate pending entries (keep only the latest one)
    const pending = await sql`SELECT id, description, created_at FROM evolution_log WHERE status = 'pending' ORDER BY created_at DESC`;
    console.log('عدد المقترحات المعلقة:', pending.length);
    
    if (pending.length > 1) {
      const idsToDelete = pending.slice(1).map(p => p.id);
      await sql`DELETE FROM evolution_log WHERE id = ANY(${idsToDelete})`;
      console.log('✅ تم حذف', idsToDelete.length, 'مقترح مكرر');
    }
    
    // Show current neural_stream
    const thoughts = await sql`SELECT agent_name, thought_process FROM neural_stream ORDER BY created_at DESC LIMIT 5`;
    console.log('\n--- آخر 5 أفكار في تيار الوعي ---');
    thoughts.forEach(t => console.log(`  [${t.agent_name}]: ${t.thought_process.substring(0, 80)}`));
    
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await sql.end();
  }
}

cleanup();

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkCuratedImages() {
  console.log('🔍 فحص جدول curated_images...\n');

  // Check if table exists
  const { count, error } = await supabase
    .from('curated_images')
    .select('*', { count: 'exact', head: true });

  if (error) {
    console.log('❌ خطأ:', error.message);
    console.log('→ الجدول ممكن مش موجود في قاعدة البيانات');
    return;
  }

  console.log(`✅ عدد الصور في قاعدة البيانات: ${count || 0}`);

  // Get breakdown by room type
  const { data: stats, error: statsError } = await supabase
    .from('curated_images')
    .select('room_type, style, count:id');

  if (statsError) {
    console.log('❌ خطأ في جلب الاحصائيات:', statsError.message);
    return;
  }

  // Manual count breakdown
  const { data: allImages, error: fetchError } = await supabase
    .from('curated_images')
    .select('room_type, style');

  if (fetchError || !allImages) {
    console.log('❌ خطأ:', fetchError?.message || 'No data');
    return;
  }

  const breakdown: Record<string, Record<string, number>> = {};
  for (const img of allImages) {
    const room = img.room_type as string;
    const style = img.style as string;
    if (!breakdown[room]) breakdown[room] = {};
    if (!breakdown[room][style]) breakdown[room][style] = 0;
    breakdown[room][style]++;
  }

  console.log('\n📊 التوزيع:');
  for (const [room, styles] of Object.entries(breakdown)) {
    console.log(`\n${room}:`);
    for (const [style, count] of Object.entries(styles)) {
      console.log(`  - ${style}: ${count} صورة`);
    }
  }

  console.log(`\n✅ الإجمالي: ${allImages.length} صورة في قاعدة البيانات`);
}

checkCuratedImages().catch(console.error);

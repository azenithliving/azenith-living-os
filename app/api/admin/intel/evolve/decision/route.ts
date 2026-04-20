import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { id, status } = body;

    if (!id || !status) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    const { data, error } = await supabaseServer
      .from('evolution_log')
      .update({ 
        status, 
        approved_at: status === 'approved' ? new Date().toISOString() : null 
      })
      .eq('id', id)
      .select();

    if (error) {
      console.error("❌ Update Error:", error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // If approved, ACTUALLY apply the patch to the system state
    if (status === 'approved' && data && data.length > 0) {
      const patch = data[0].proposed_patch;
      
      // We log that the patch is being applied
      await supabaseServer.from('neural_stream').insert({
        agent_name: "الوكيل التنفيذي",
        thought_process: `جاري حقن الكود وتطبيق التحسين المعتمد في نواة النظام...`,
        intensity: 0.9
      });

      // ACTUAL EXECUTION: We save the approved patch logic into the site_settings
      // This allows the Next.js app to dynamically read this setting and alter behavior based on ASI patches.
      const parsedPatch = typeof patch === 'string' ? JSON.parse(patch) : patch;
      
      const { error: upsertError } = await supabaseServer
        .from('site_settings')
        .upsert({
          setting_key: `asi_patch_${id.substring(0,8)}`,
          setting_category: 'asi_logic',
          setting_value: parsedPatch,
          updated_at: new Date().toISOString()
        }, { onConflict: 'setting_key' });

      if (upsertError) {
        console.error("❌ Patch Execution Error:", upsertError);
        // We could revert the status here, but for now we'll just log it.
        await supabaseServer.from('neural_stream').insert({
          agent_name: "الوكيل التنفيذي",
          thought_process: `حدث خطأ أثناء حقن الكود: ${upsertError.message}`,
          intensity: 1.0
        });
      } else {
        await supabaseServer.from('neural_stream').insert({
          agent_name: "الوكيل التنفيذي",
          thought_process: `تم تنفيذ التحسين بنجاح وتم تفعيله في قاعدة البيانات المركزية.`,
          intensity: 0.5
        });
      }
    }

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

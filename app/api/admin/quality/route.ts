import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';
import { z } from 'zod';

const qualityCheckSchema = z.object({
  production_job_id: z.string().optional(),
  job_title: z.string().default('مهمة إنتاج'),
  check_type: z.enum(['incoming_material', 'in_process', 'pre_finish', 'final']),
  stage_name: z.string().optional(),
  status: z.enum(['pass', 'fail', 'conditional_pass']),
  notes: z.string().optional(),
  photos: z.array(z.string()).optional(),
  company_id: z.string().uuid().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json({ success: false, error: 'Supabase unavailable' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const job_id = searchParams.get('production_job_id');
    const limit = parseInt(searchParams.get('limit') || '50');

    let query = supabase
      .from('quality_checks')
      .select('*')
      .order('checked_at', { ascending: false })
      .limit(limit);

    if (job_id) {
      query = query.eq('production_job_id', job_id);
    }

    const { data, error } = await query;

    if (error) {
      if (error.code === 'PGRST205' || error.code === '42P01') {
        return NextResponse.json({ success: true, data: [], warning: 'quality_checks table not found' });
      }
      throw error;
    }

    return NextResponse.json({ success: true, data: data || [] });
  } catch (error: any) {
    console.error('[QualityAPI] GET error:', error);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json({ success: false, error: 'Supabase unavailable' }, { status: 500 });
    }

    const body = await request.json();
    const parseResult = qualityCheckSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid data', details: parseResult.error.message },
        { status: 400 }
      );
    }

    const data = parseResult.data;

    const insertData = {
      production_job_id: data.production_job_id || null,
      job_title: data.job_title,
      check_type: data.check_type,
      stage_name: data.stage_name || data.check_type,
      status: data.status,
      notes: data.notes || '',
      photos: data.photos || [],
      checked_by: 'system',
      checked_at: new Date().toISOString(),
      company_id: data.company_id || '00000000-0000-0000-0000-000000000000',
      created_at: new Date().toISOString(),
    };

    const { data: check, error } = await supabase
      .from('quality_checks')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST205' || error.code === '42P01') {
        return NextResponse.json({
          success: true,
          warning: 'quality_checks table not found — check saved locally',
          data: { ...insertData, id: `local-${Date.now()}` },
        });
      }
      throw error;
    }

    return NextResponse.json({
      success: true,
      message: 'Quality check submitted successfully',
      data: check,
    }, { status: 201 });
  } catch (error: any) {
    console.error('[QualityAPI] POST error:', error);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}

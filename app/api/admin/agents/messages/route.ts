// API Route: /api/admin/agents/messages
// المحادثات بين المستخدم والـ Agents

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/dal/unified-supabase';
import { z } from 'zod';

const messageSchema = z.object({
  agent_key: z.string(),
  content: z.string().min(1),
  sender_type: z.enum(['agent', 'user', 'system']),
  conversation_id: z.string().uuid().optional(),
  mentions: z.array(z.string()).optional()
});

// جلب الرسائل
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentKey = searchParams.get('agent_key');
    const conversationId = searchParams.get('conversation_id');
    const limit = parseInt(searchParams.get('limit') || '50');
    
    let query = supabaseServer
      .from('agent_messages')
      .select(`
        *,
        agent_conversations!inner(participants)
      `)
      .order('created_at', { ascending: true })
      .limit(limit);
    
    if (conversationId) {
      query = query.eq('conversation_id', conversationId);
    }
    
    const { data: messages, error } = await query;
    
    if (error) {
      throw error;
    }
    
    // format messages with sender names
    const formattedMessages = messages?.map(msg => ({
      ...msg,
      sender_name: msg.sender_type === 'user' ? 'أنت' : 
                  msg.sender_type === 'system' ? 'النظام' :
                  msg.agent_key?.toUpperCase() || 'Agent'
    })) || [];
    
    return NextResponse.json({ 
      success: true, 
      data: formattedMessages 
    });
    
  } catch (error) {
    console.error('Get messages error:', error);
    return NextResponse.json(
      { success: false, error: 'خطأ في السيرفر' },
      { status: 500 }
    );
  }
}

// إرسال رسالة
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const parseResult = messageSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: 'بيانات غير صحيحة', details: parseResult.error.message },
        { status: 400 }
      );
    }
    
    const data = parseResult.data;
    
    // دور على أو أنشئ محادثة
    let conversationId = data.conversation_id;
    
    if (!conversationId) {
      // دور على محادثة موجودة
      const { data: existingConv } = await supabaseServer
        .from('agent_conversations')
        .select('id')
        .eq('conversation_type', 'direct')
        .filter('participants', 'cs', `{${data.agent_key}}`)
        .single();
      
      if (existingConv) {
        conversationId = existingConv.id;
      } else {
        // أنشئ محادثة جديدة
        const { data: newConv, error: convError } = await supabaseServer
          .from('agent_conversations')
          .insert({
            company_id: '00000000-0000-0000-0000-000000000000',
            title: `محادثة مع ${data.agent_key}`,
            conversation_type: 'direct',
            participants: [data.agent_key],
            is_active: true,
            created_at: new Date().toISOString()
          })
          .select('id')
          .single();
        
        if (convError) throw convError;
        conversationId = newConv.id;
      }
    }
    
    // أضف الرسالة
    const { data: message, error } = await supabaseServer
      .from('agent_messages')
      .insert({
        conversation_id: conversationId,
        sender_type: data.sender_type,
        sender_name: data.sender_type === 'user' ? 'أنت' : data.agent_key,
        content: data.content,
        mentions: data.mentions || [],
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) throw error;
    
    // حدّث وقت آخر رسالة في المحادثة
    await supabaseServer
      .from('agent_conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', conversationId);
    
    return NextResponse.json({ 
      success: true, 
      message: 'تم إرسال الرسالة',
      data: message 
    });
    
  } catch (error) {
    console.error('Send message error:', error);
    return NextResponse.json(
      { success: false, error: 'خطأ في السيرفر' },
      { status: 500 }
    );
  }
}

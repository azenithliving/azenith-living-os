// API Route: /api/admin/agents/messages
// المحادثات بين المستخدم والـ Agents

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/dal/unified-supabase';
import { resolveAdminCompanyId } from '@/lib/admin-company';
import { resolveMasterCompanyId } from '@/lib/admin-env-resolver';
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
    const agentKey       = searchParams.get('agent_key');
    const conversationId = searchParams.get('conversation_id');
    const limit          = parseInt(searchParams.get('limit') || '50');
    const unreadOnly     = searchParams.get('unread') === 'true';
    const markRead       = searchParams.get('mark_read') === 'true';

    // ── حل agent_key → conversation_id ──────────────────────────────
    let resolvedConvId = conversationId;

    if (!resolvedConvId && agentKey) {
      const normKey = agentKey.toLowerCase();
      const companyId = (await resolveAdminCompanyId()) || (await resolveMasterCompanyId());
      let convQuery = supabaseServer
        .from('agent_conversations')
        .select('id')
        .or(`participants.cs.{${normKey}},title.ilike.%${normKey}%`)
        .order('created_at', { ascending: false })
        .limit(1);
      if (companyId) convQuery = convQuery.eq('company_id', companyId);
      const { data: conv } = await convQuery.maybeSingle();

      if (conv) {
        resolvedConvId = conv.id;
      } else {
        // لا توجد محادثة بعد — أعد قائمة فارغة
        return NextResponse.json({ success: true, data: [] });
      }
    }
    // ─────────────────────────────────────────────────────────────────

    let query = supabaseServer
      .from('agent_messages')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(limit);

    if (resolvedConvId) {
      query = query.eq('conversation_id', resolvedConvId);
    }
    if (unreadOnly) {
      query = query.eq('sender_type', 'agent').eq('is_read', false);
    }

    const { data: messages, error } = await query;

    // Mark as read if requested (when user opens chat)
    if (markRead && resolvedConvId && messages && messages.length > 0) {
      const unreadIds = messages.filter((m: any) => m.sender_type === 'agent' && !m.is_read).map((m: any) => m.id);
      if (unreadIds.length > 0) {
        await supabaseServer.from('agent_messages').update({ is_read: true }).in('id', unreadIds);
      }
    }

    // If unreadOnly requested, return count only
    if (unreadOnly) {
      return NextResponse.json({ success: true, count: messages?.length || 0, data: messages });
    }

    if (error) {
      if (error.code === 'PGRST205' || error.code === '42703') {
        return NextResponse.json({
          success: true,
          data: [],
          warnings: ['agent_messages schema is not available in the expected shape.'],
        });
      }
      throw error;
    }

    // format messages with sender names
    const formattedMessages = (messages ?? []).map(msg => ({
      ...msg,
      sender_name: msg.sender_type === 'user'   ? 'أنت'    :
                   msg.sender_type === 'system'  ? 'النظام' :
                   (msg as any).agent_key?.toUpperCase() || msg.sender_name || 'Agent',
    }));

    return NextResponse.json({ success: true, data: formattedMessages });

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
        const resolvedCompanyId = (await resolveAdminCompanyId()) || (await resolveMasterCompanyId());
        const insertPayload: Record<string, any> = {
          title: `محادثة مع ${data.agent_key}`,
          conversation_type: 'direct',
          participants: [data.agent_key],
          is_active: true,
          created_at: new Date().toISOString(),
        };
        if (resolvedCompanyId) {
          insertPayload.company_id = resolvedCompanyId;
        }

        const { data: newConv, error: convError } = await supabaseServer
          .from('agent_conversations')
          .insert(insertPayload)
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

    let agentReply: { content: string } | null = null;

    if (data.sender_type === 'user' && data.content?.trim()) {
      try {
        const { processAdminNaturalLanguageReply } = await import('@/lib/admin-natural-brain');
        const brain = await processAdminNaturalLanguageReply(data.content, {
          userEmail: process.env.ADMIN_GATE_EMAIL || 'admin@azenithliving.com',
          source: 'agent_chat',
          agentKey: data.agent_key,
          sessionId: `agent-${data.agent_key}-${conversationId}`,
        });

        if (brain.reply) {
          const { data: replyRow } = await supabaseServer
            .from('agent_messages')
            .insert({
              conversation_id: conversationId,
              sender_type: 'agent',
              sender_name: data.agent_key.toUpperCase(),
              content: brain.reply,
              mentions: [],
              created_at: new Date().toISOString(),
            })
            .select()
            .single();
          agentReply = replyRow ? { content: brain.reply } : { content: brain.reply };
        }
      } catch (brainErr) {
        console.error('[Agent messages] brain reply failed:', brainErr);
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'تم إرسال الرسالة',
      data: message,
      agentReply,
    });
    
  } catch (error) {
    console.error('Send message error:', error);
    return NextResponse.json(
      { success: false, error: 'خطأ في السيرفر' },
      { status: 500 }
    );
  }
}

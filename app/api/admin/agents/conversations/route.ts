/**
 * Agent Conversations API
 * GET /api/admin/agents/conversations
 * POST /api/admin/agents/conversations
 * Manage agent chat conversations
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/dal/unified-supabase';

// GET - List conversations
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('company_id');
    const conversationType = searchParams.get('type'); // direct, group, agent_to_agent
    const activeOnly = searchParams.get('active') !== 'false';

    if (!companyId) {
      return NextResponse.json(
        { success: false, error: 'company_id required' },
        { status: 400 }
      );
    }

    let query = supabaseServer
      .from('agent_conversations')
      .select('*')
      .eq('company_id', companyId);

    if (conversationType) {
      query = query.eq('conversation_type', conversationType);
    }

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query
      .order('updated_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Conversations fetch error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    // Get last message for each conversation
    const conversationsWithPreview = await Promise.all(
      (data || []).map(async (conv) => {
        const { data: lastMessage } = await supabaseServer
          .from('agent_messages')
          .select('*')
          .eq('conversation_id', conv.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        // Get unread count
        const { count: unreadCount } = await supabaseServer
          .from('agent_messages')
          .select('*', { count: 'exact' })
          .eq('conversation_id', conv.id)
          .eq('requires_action', true)
          .eq('action_taken', false);

        return {
          ...conv,
          last_message: lastMessage || null,
          unread_count: unreadCount || 0
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: conversationsWithPreview
    });
  } catch (error) {
    console.error('Conversations GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Create new conversation
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      company_id,
      title,
      conversation_type = 'direct',
      participants,
      context
    } = body;

    if (!company_id || !title || !participants || participants.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const timestamp = new Date().toISOString();

    // Create conversation
    const { data: conversation, error } = await supabaseServer
      .from('agent_conversations')
      .insert({
        company_id,
        title,
        conversation_type,
        participants,
        context: context || {},
        is_active: true,
        created_at: timestamp,
        updated_at: timestamp
      })
      .select()
      .single();

    if (error) {
      console.error('Conversation create error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    // Add welcome message for group chats
    if (conversation_type === 'group') {
      await supabaseServer.from('agent_messages').insert({
        conversation_id: conversation.id,
        sender_type: 'system',
        content: `👋 مرحباً! تم بدء محادثة جماعية بين: ${participants.join(', ')}`,
        created_at: timestamp
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Conversation created successfully',
      data: conversation
    });
  } catch (error) {
    console.error('Conversations POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

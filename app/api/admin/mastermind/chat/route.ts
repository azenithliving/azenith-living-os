import { NextRequest, NextResponse } from 'next/server';
import {
  processIntelligentMessage,
  isAIModeEnabled,
  detectCommand,
  generateAIResponse,
  loadHistory,
  saveMessage
} from '@/lib/mastermind-ai';
import { executeCommand } from '@/lib/command-executor';
import { createClient } from '@/utils/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  try {
    const { message, signature = 'dev-bypass' } = await req.json();

    // Generate or retrieve session ID
    const sessionId = req.cookies.get('mastermind_session')?.value ||
                      crypto.randomUUID();

    // Get user info if authenticated
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Check if user is authenticated
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Authentication required' },
        { status: 401 }
      );
    }

    // Check if user is owner (MASTER_ADMIN_EMAILS)
    const masterEmails = process.env.MASTER_ADMIN_EMAILS?.split(',').map(e => e.trim()) || [];
    const isOwner = !!(user.email && masterEmails.includes(user.email));

    // Step 1: Verify 2FA (required for everyone including owner)
    const { data: user2FA, error: faError } = await supabase
      .from('user_2fa')
      .select('is_enabled')
      .eq('user_id', user.id)
      .single();

    if (faError || !user2FA?.is_enabled) {
      return NextResponse.json(
        { success: false, error: '2FA must be enabled to use Mastermind' },
        { status: 403 }
      );
    }

    // Step 2: Determine signature validation
    // Owner can bypass signature verification (uses 'owner-bypass')
    // Normal users must provide valid signature
    let effectiveSignature = signature;
    let bypassAuth = false;

    if (isOwner && signature === 'owner-bypass') {
      // Owner bypassing signature verification (2FA already verified)
      effectiveSignature = 'owner-bypass';
      bypassAuth = true;
    } else if (signature === 'dev-bypass' || signature === 'test-bypass') {
      // Development bypass (not allowed in production)
      bypassAuth = process.env.NODE_ENV !== 'production';
    }

    // Detect if message is a command
    const detectedCommand = detectCommand(message);
    const isCommand = detectedCommand && detectedCommand.confidence > 0.8;

    let result;

    if (isCommand) {
      // It's a known command - execute it with AI response
      const supabaseClient = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
      );

      // Load history for context
      const history = user?.id ? await loadHistory(user.id) : [];

      try {
        const commandResult = await executeCommand(
          `${detectedCommand.command} ${detectedCommand.args.join(" ")}`,
          {
            supabase: supabaseClient,
            userId: user?.id || "00000000-0000-0000-0000-000000000000",
            userEmail: user?.email || "admin@azenithliving.com",
            bypassRls: bypassAuth,
            isOwner,
          }
        );

        // Generate AI response about the command result
        const aiMessage = await generateAIResponse(message, history, {
          commandExecuted: detectedCommand.command,
          commandResult: commandResult,
        });

        result = {
          type: "mixed",
          message: aiMessage,
          command: {
            name: detectedCommand.command,
            args: detectedCommand.args,
            result: commandResult,
          },
        };
      } catch (error) {
        // Command failed - generate AI explanation
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        const aiMessage = await generateAIResponse(message, history, {
          commandExecuted: detectedCommand.command,
          commandResult: { success: false, error: errorMessage },
        });

        result = {
          type: "mixed",
          message: aiMessage,
          command: {
            name: detectedCommand.command,
            args: detectedCommand.args,
            result: { success: false, error: errorMessage },
          },
        };
      }
    } else {
      // Not a command - use intelligent AI response
      result = await processIntelligentMessage(message, {
        sessionId,
        userId: user?.id,
        userEmail: user?.email,
        userSignature: effectiveSignature,
        bypassAuth,
        isOwner,
      });
    }
    
    // Build response
    const response = NextResponse.json({
      success: true,
      result,
      mode: isCommand ? 'command' : 'ai',
    });
    
    // Set session cookie if not exists
    if (!req.cookies.get('mastermind_session')) {
      response.cookies.set('mastermind_session', sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 60 * 60 * 24 * 7, // 7 days
      });
    }
    
    return response;
    
  } catch (error: any) {
    console.error('[Mastermind Chat] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Processing failed' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/mastermind/chat
 * Get chat history for current user
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ 
        success: true, 
        messages: [],
        mode: isAIModeEnabled() ? 'ai' : 'legacy',
      });
    }
    
    // Load chat history from database by user_id
    const { data: messages, error } = await supabase
      .from('chat_history')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (error) {
      console.error('[Mastermind Chat] Failed to load history:', error);
      return NextResponse.json({ 
        success: true, 
        messages: [],
        mode: isAIModeEnabled() ? 'ai' : 'legacy',
      });
    }
    
    return NextResponse.json({ 
      success: true, 
      messages: messages || [],
      mode: isAIModeEnabled() ? 'ai' : 'legacy',
    });
    
  } catch (error: any) {
    console.error('[Mastermind Chat] GET Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/mastermind/chat
 * Clear chat history for current user
 */
export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ success: true, cleared: 0 });
    }
    
    // Clear chat history by user_id
    const { data: deleted, error } = await supabase
      .from('chat_history')
      .delete()
      .eq('user_id', user.id)
      .select('id');
    
    if (error) {
      console.error('[Mastermind Chat] Failed to clear history:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to clear history' },
        { status: 500 }
      );
    }
    
    const clearedCount = deleted?.length || 0;
    
    return NextResponse.json({ 
      success: true, 
      cleared: clearedCount 
    });
    
  } catch (error: any) {
    console.error('[Mastermind Chat] DELETE Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { askOpenRouter, askAllam } from '@/lib/ai-orchestrator';

// Room suggestions mapping for different styles
const STYLE_ROOM_SUGGESTIONS: Record<string, string[]> = {
  modern: ['living-room', 'kitchen', 'home-office', 'master-bedroom'],
  classic: ['dining-room', 'master-bedroom', 'living-room', 'dressing-room'],
  industrial: ['home-office', 'kitchen', 'living-room', 'teen-room'],
  scandinavian: ['living-room', 'children-room', 'master-bedroom', 'kitchen'],
};

// Room ID to Arabic name mapping
const ROOM_NAMES: Record<string, string> = {
  'living-room': 'غرفة المعيشة',
  'master-bedroom': 'غرفة النوم الرئيسية',
  'kitchen': 'المطبخ',
  'dining-room': 'غرفة الطعام',
  'home-office': 'المكتب المنزلي',
  'dressing-room': 'غرفة الملابس',
  'children-room': 'غرفة الأطفال',
  'teen-room': 'غرفة المراهقين',
  'corner-sofa': 'الكنب الزاوية',
  'lounge': 'اللاونج',
};

// Style names in Arabic
const STYLE_NAMES: Record<string, string> = {
  modern: 'مودرن',
  classic: 'كلاسيك',
  industrial: 'صناعي',
  scandinavian: 'اسكندنافي',
};

export async function POST(req: NextRequest) {
  try {
    const { imageUrl, currentRoomId } = await req.json();

    if (!imageUrl) {
      return NextResponse.json(
        { success: false, error: 'Image URL is required' },
        { status: 400 }
      );
    }

    // Use OpenRouter (Claude) for vision analysis
    const analysisPrompt = `حلل هذه الصورة من تصميم داخلي وحدد:
1. اسم الاستايل (modern, classic, industrial, scandinavian) - اختر واحدًا فقط
2. وصف موجز للعناصر الرئيسية في الصورة (بالعربية)

أجب بتنسيق JSON فقط:
{
  "style": "اسم الاستايل بالإنجليزية",
  "styleAr": "اسم الاستايل بالعربية",
  "description": "وصف موجز بالعربية"
}`;

    const visionResult = await askOpenRouter(analysisPrompt, imageUrl, {
      temperature: 0.3,
      maxTokens: 500,
    });

    if (!visionResult.success) {
      console.error('[Analyze Image] Vision analysis failed:', visionResult.error);
      
      // Fallback: use the current room's style
      return NextResponse.json({
        success: true,
        analysis: {
          detectedStyle: 'modern',
          styleAr: 'مودرن',
          description: 'تصميم داخلي أنيق',
          suggestions: getRoomSuggestions('modern', currentRoomId),
        },
        fallback: true,
      });
    }

    // Parse the vision analysis result
    let detectedStyle = 'modern';
    let styleDescription = '';
    
    try {
      // Try to extract JSON from the response
      const jsonMatch = visionResult.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        detectedStyle = parsed.style?.toLowerCase() || 'modern';
        styleDescription = parsed.description || '';
      } else {
        // Fallback: detect style from text
        const content = visionResult.content.toLowerCase();
        if (content.includes('classic') || content.includes('كلاسيك')) detectedStyle = 'classic';
        else if (content.includes('industrial') || content.includes('صناعي') || content.includes('loft')) detectedStyle = 'industrial';
        else if (content.includes('scandinavian') || content.includes('اسكندنافي') || content.includes('nordic')) detectedStyle = 'scandinavian';
      }
    } catch (parseError) {
      console.error('[Analyze Image] Failed to parse vision result:', parseError);
    }

    // Validate detected style
    if (!STYLE_ROOM_SUGGESTIONS[detectedStyle]) {
      detectedStyle = 'modern';
    }

    // Generate room suggestions based on detected style
    const suggestions = getRoomSuggestions(detectedStyle, currentRoomId);

    // Use ALLaM to generate a friendly Arabic message
    const allamPrompt = `اكتب رسالة قصيرة بالعربية (3-4 أسطر) ترحب بالمستخدم وتخبره أن الصورة التي أعجبته من استايل ${STYLE_NAMES[detectedStyle]}، واقترح عليه زيارة هذه الغرف: ${suggestions.map(s => ROOM_NAMES[s.id] || s.id).join('، ')}. 

اكتب بأسلوب ودي واحترافي. لا تذكر الأسعار.`;

    const allamResult = await askAllam(allamPrompt, { maxTokens: 300, temperature: 0.7 });
    
    const friendlyMessage = allamResult.success 
      ? allamResult.content.trim()
      : `الصورة من استايل ${STYLE_NAMES[detectedStyle]}. بناءً على ذوقك، قد تعجبك هذه الغرف أيضًا.`;

    return NextResponse.json({
      success: true,
      analysis: {
        detectedStyle,
        styleAr: STYLE_NAMES[detectedStyle] || detectedStyle,
        description: styleDescription,
        suggestions,
        message: friendlyMessage,
      },
    });

  } catch (error: any) {
    console.error('[Analyze Image] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Analysis failed' },
      { status: 500 }
    );
  }
}

function getRoomSuggestions(style: string, currentRoomId: string) {
  const allSuggestions = STYLE_ROOM_SUGGESTIONS[style] || STYLE_ROOM_SUGGESTIONS.modern;
  
  // Filter out current room and get up to 3 suggestions
  const filtered = allSuggestions.filter(id => id !== currentRoomId).slice(0, 3);
  
  // Map to room objects with URLs
  return filtered.map(id => ({
    id,
    name: ROOM_NAMES[id] || id,
    url: `/rooms/${id}?style=${style}`,
  }));
}

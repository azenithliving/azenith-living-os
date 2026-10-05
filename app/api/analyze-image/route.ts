import { NextRequest, NextResponse } from 'next/server';
import { askOpenRouter, askAllam } from '@/lib/ai-orchestrator';
import { answeredByLabel } from '@/lib/ops/key-desk';

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

const FLOOR_LABEL = 'قواعد المتجر — من غير مفتاح';

/**
 * The style the reader named, or nothing.
 *
 * The door used to carry `let detectedStyle = 'modern'` through the parse, so a reply that never
 * arrived and a reply that could not be read both came back to a customer as «مودرن» — a reading
 * of a picture nobody looked at. The capability ledger already says what the absence means:
 * «غايب يعني الصورة تتعرض باسمها ونوعها من غير اختراع وصف».
 */
export function readStyleAnswer(content: string): { style: string; description: string } | null {
  const found = content?.match(/\{[\s\S]*\}/);
  if (found) {
    try {
      const parsed = JSON.parse(found[0]) as { style?: unknown; description?: unknown };
      const style = typeof parsed.style === 'string' ? parsed.style.trim().toLowerCase() : '';
      if (STYLE_ROOM_SUGGESTIONS[style]) {
        return { style, description: typeof parsed.description === 'string' ? parsed.description.trim() : '' };
      }
    } catch {
      /* fall through to the prose reading below */
    }
  }
  // The reader answered in prose rather than JSON: a style is still named, but only when the text
  // says one — never because a default was waiting.
  const text = (content ?? '').toLowerCase();
  const named = (['classic', 'industrial', 'scandinavian', 'modern'] as const).filter((s) =>
    text.includes(s) || text.includes(STYLE_NAMES[s])
  );
  return named.length === 1 ? { style: named[0], description: '' } : null;
}

/** Other rooms of the same gallery, said to be that and nothing more. */
function otherRooms(currentRoomId: string, count = 3) {
  return Object.keys(ROOM_NAMES)
    .filter((id) => id !== currentRoomId)
    .slice(0, count)
    .map((id) => ({ id, name: ROOM_NAMES[id], url: `/rooms/${id}` }));
}

function getRoomSuggestions(style: string, currentRoomId: string) {
  const allSuggestions = STYLE_ROOM_SUGGESTIONS[style] || STYLE_ROOM_SUGGESTIONS.modern;
  const filtered = allSuggestions.filter((id) => id !== currentRoomId).slice(0, 3);
  return filtered.map((id) => ({
    id,
    name: ROOM_NAMES[id] || id,
    url: `/rooms/${id}?style=${style}`,
  }));
}

export async function POST(req: NextRequest) {
  let currentRoomId = '';
  try {
    let imageUrl = '';
    try {
      const body = (await req.json()) as { imageUrl?: unknown; currentRoomId?: unknown };
      imageUrl = typeof body?.imageUrl === 'string' ? body.imageUrl.trim() : '';
      currentRoomId = typeof body?.currentRoomId === 'string' ? body.currentRoomId : '';
    } catch {
      return NextResponse.json({ success: false, error: 'المطلوب صورة عشان تتقري' }, { status: 400 });
    }

    if (!imageUrl) {
      return NextResponse.json({ success: false, error: 'المطلوب صورة عشان تتقري' }, { status: 400 });
    }

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

    const reading = visionResult.success ? readStyleAnswer(visionResult.content) : null;

    if (!reading) {
      // The provider's own words stay in the log; what the customer gets is the absence, named.
      if (!visionResult.success) console.error('[Analyze Image] no reader answered:', visionResult.error);
      const roomName = ROOM_NAMES[currentRoomId] || 'هذه الغرفة';
      return NextResponse.json({
        success: true,
        read: false,
        answered_by: FLOOR_LABEL,
        analysis: {
          read: false,
          style: null,
          styleAr: null,
          description: '',
          suggestions: otherRooms(currentRoomId),
          message: `ما قدرناش نقرا الصورة دلوقتي، والمتجر ما بيخترعش وصف. دي صورة من ${roomName}، واللي تحتها غرف تانية من المعرض.`,
        },
      });
    }

    const suggestions = getRoomSuggestions(reading.style, currentRoomId);

    const allamPrompt = `اكتب رسالة قصيرة بالعربية (3-4 أسطر) ترحب بالمستخدم وتخبره أن الصورة التي أعجبته من استايل ${STYLE_NAMES[reading.style]}، واقترح عليه زيارة هذه الغرف: ${suggestions.map((s) => ROOM_NAMES[s.id] || s.id).join('، ')}. 

اكتب بأسلوب ودي واحترافي. لا تذكر الأسعار.`;

    const allamResult = await askAllam(allamPrompt, { maxTokens: 300, temperature: 0.7 });

    // The rooms are chosen from the style that was actually read — that part is arithmetic, and it
    // stands whether or not a writer answered.
    const friendlyMessage = allamResult.success
      ? allamResult.content.trim()
      : `الصورة من استايل ${STYLE_NAMES[reading.style]}. بناءً على ذوقك، قد تعجبك هذه الغرف أيضًا.`;

    return NextResponse.json({
      success: true,
      read: true,
      // The URL-capable helper this door uses reports no reader name, so the label says what is
      // actually known: one of his keys answered. Naming a company that was not measured is the
      // same invention in a different place.
      answered_by: answeredByLabel(null),
      analysis: {
        read: true,
        style: reading.style,
        styleAr: STYLE_NAMES[reading.style],
        description: reading.description,
        suggestions,
        message: friendlyMessage,
      },
    });
  } catch (error) {
    console.error('[Analyze Image] Error:', error);
    return NextResponse.json({
      success: true,
      read: false,
      answered_by: FLOOR_LABEL,
      analysis: {
        read: false,
        style: null,
        styleAr: null,
        description: '',
        suggestions: otherRooms(currentRoomId),
        message: 'القراءة مش متاحة دلوقتي — المتجر ما بيخترعش وصف. جرّب تاني بعد شوية.',
      },
    });
  }
}

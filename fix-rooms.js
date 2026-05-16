const fs = require('fs');

const constantsPath = 'lib/constants/rooms.ts';
let code = fs.readFileSync(constantsPath, 'utf8');

// 1. Add English fields to LandingRoom type
code = code.replace(
  /export type LandingRoom = \{\n\s*slug: string;\n\s*eyebrow: string;\n\s*title: string;\n\s*summary: string;\n\};/,
  `export type LandingRoom = {
  slug: string;
  eyebrow: string;
  eyebrowEn: string;
  title: string;
  titleEn: string;
  summary: string;
  summaryEn: string;
};`
);

// We will just let the frontend fallback to English titles if the style descriptions don't have English.
// But wait, it's easier to just rewrite BASE_ROOMS to have English strings.
code = code.replace(
  /export const BASE_ROOMS: LandingRoom\[\] = \[([\s\S]*?)\];/,
  `export const BASE_ROOMS: LandingRoom[] = [
  {
    slug: "living-room",
    eyebrow: "استقبال بثقة",
    eyebrowEn: "Confident Reception",
    title: "غرفة المعيشة",
    titleEn: "Living Room",
    summary: "جلسات مدروسة بصريًا لاستقبال الضيوف ولحظات عائلية لا تُنسى.",
    summaryEn: "Visually designed seating for welcoming guests and unforgettable family moments.",
  },
  {
    slug: "dining-room",
    eyebrow: "ولائم عائلية",
    eyebrowEn: "Family Feasts",
    title: "غرفة الطعام",
    titleEn: "Dining Room",
    summary: "تجارب طعام مريحة بأناقة دافئة تناسب كل مناسبة.",
    summaryEn: "Comfortable dining experiences with warm elegance for every occasion.",
  },
  {
    slug: "kitchen",
    eyebrow: "فن الطهي",
    eyebrowEn: "Culinary Art",
    title: "المطبخ",
    titleEn: "Kitchen",
    summary: "مساحة عمل أنيقة تجمع بين الوظيفة والجمال لتجربة طهي فاخرة.",
    summaryEn: "An elegant workspace combining functionality and beauty for a luxurious cooking experience.",
  },
  {
    slug: "master-bedroom",
    eyebrow: "خصوصية ملكية",
    eyebrowEn: "Royal Privacy",
    title: "غرفة النوم الرئيسية",
    titleEn: "Master Bedroom",
    summary: "ملاذ هادئ يجمع بين الفخامة الفندقية والراحة الشخصية بتفاصيل متقنة.",
    summaryEn: "A serene sanctuary combining hotel luxury with personal comfort through meticulous details.",
  },
  {
    slug: "guest-bedroom",
    eyebrow: "ضيافة أنيقة",
    eyebrowEn: "Elegant Hospitality",
    title: "غرفة نوم الضيوف",
    titleEn: "Guest Bedroom",
    summary: "راحة فاخرة لضيوفك مع تصميم دافئ يلائم كل الأذواق.",
    summaryEn: "Luxury comfort for your guests with a warm design suitable for all tastes.",
  },
  {
    slug: "kids-bedroom",
    eyebrow: "أحلام صغيرة",
    eyebrowEn: "Little Dreams",
    title: "غرفة الأطفال",
    titleEn: "Kids Bedroom",
    summary: "مساحة آمنة ومبهجة تنمو مع طفلك، تجمع بين المرح والوظيفة.",
    summaryEn: "A safe and joyful space that grows with your child, combining fun and functionality.",
  },
  {
    slug: "teen-room",
    eyebrow: "شخصية ناشئة",
    eyebrowEn: "Emerging Personality",
    title: "غرفة المراهقين",
    titleEn: "Teen Room",
    summary: "تصميم يناسب مرحلة النضج مع مساحات للدراسة والتعبير الذاتي.",
    summaryEn: "Design suited for adolescence with spaces for study and self-expression.",
  },
  {
    slug: "dressing-room",
    eyebrow: "تنظيم فاخر",
    eyebrowEn: "Luxury Organization",
    title: "غرفة الملابس",
    titleEn: "Dressing Room",
    summary: "تجربة ملابس يومية أنيقة بتقسيم ذكي وإضاءة مثالية.",
    summaryEn: "An elegant daily dressing experience with smart division and perfect lighting.",
  },
  {
    slug: "home-office",
    eyebrow: "إنتاجية متقنة",
    eyebrowEn: "Refined Productivity",
    title: "مكتب المنزل",
    titleEn: "Home Office",
    summary: "بيئة عمل محفزة تحافظ على التوازن بين المهنية والراحة المنزلية.",
    summaryEn: "A stimulating work environment balancing professionalism with home comfort.",
  },
  {
    slug: "study-room",
    eyebrow: "تركيز وهدوء",
    eyebrowEn: "Focus & Calm",
    title: "غرفة الدراسة",
    titleEn: "Study Room",
    summary: "بيئة مثالية للقراءة والتعلم بعيدًا عن المشتتات.",
    summaryEn: "Ideal environment for reading and learning away from distractions.",
  },
  {
    slug: "bathroom",
    eyebrow: "رفاهية يومية",
    eyebrowEn: "Daily Luxury",
    title: "الحمام",
    titleEn: "Bathroom",
    summary: "تصميم حمامات فاخرة تجمع بين الوظيفة والاسترخاء.",
    summaryEn: "Luxury bathroom designs combining functionality and relaxation.",
  },
  {
    slug: "guest-bathroom",
    eyebrow: "ضيافة مثالية",
    eyebrowEn: "Perfect Hospitality",
    title: "حمام الضيوف",
    titleEn: "Guest Bathroom",
    summary: "أناقة عملية لحمام الضيوف مع لمسات فاخرة.",
    summaryEn: "Practical elegance for guest bathrooms with luxury touches.",
  },
  {
    slug: "entrance-lobby",
    eyebrow: "انطباع أول",
    eyebrowEn: "First Impression",
    title: "المدخل",
    titleEn: "Entrance Lobby",
    summary: "مدخل مهيب يعكس أناقة منزلك من أول خطوة.",
    summaryEn: "A majestic entrance reflecting your home's elegance from the first step.",
  },
  {
    slug: "corner-sofa",
    eyebrow: "راحة مطلقة",
    eyebrowEn: "Absolute Comfort",
    title: "كنب الزاوية",
    titleEn: "Corner Sofa",
    summary: "قطع مفروشات فاخرة تضيف لمسة عصرية ومساحة جلوس واسعة.",
    summaryEn: "Luxury furniture pieces adding a modern touch with ample seating space.",
  },
  {
    slug: "lounge",
    eyebrow: "استرخاء أنيق",
    eyebrowEn: "Elegant Relaxation",
    title: "الاستراحة",
    titleEn: "Lounge",
    summary: "زاوية خاصة للاسترخاء والقراءة بلمسات أنيقة وخامات ناعمة.",
    summaryEn: "A private corner for relaxation and reading with elegant touches and soft materials.",
  }
];`
);

// We need to fix ROOM_STYLE_DESCRIPTIONS type and inject english defaults so they don't break the translation
code = code.replace(
  /export const ROOM_STYLE_DESCRIPTIONS: Record<string, Record<string, \{ eyebrow: string; title: string; summary: string \}>> = \{/g,
  'export const ROOM_STYLE_DESCRIPTIONS: Record<string, Record<string, { eyebrow: string; title: string; summary: string; eyebrowEn?: string; titleEn?: string; summaryEn?: string; }>> = {'
);

fs.writeFileSync(constantsPath, code);

// Now update home-page-client-fixed.tsx to use bilingual texts
const homeClientPath = 'components/home-page-client-fixed.tsx';
let hc = fs.readFileSync(homeClientPath, 'utf8');

hc = hc.replace(
  /const ranked = BASE_ROOMS\.map\(\(room\) => \{[\s\S]*?return \{ \.\.\.room \};\n\s*\}\);/,
  `const ranked = BASE_ROOMS.map((room) => {
      const styleDesc = ROOM_STYLE_DESCRIPTIONS[room.slug]?.[displayStyle];
      if (styleDesc) {
        return {
          ...room,
          eyebrow: isRTL ? styleDesc.eyebrow : (styleDesc.eyebrowEn || room.eyebrowEn),
          title: isRTL ? styleDesc.title : (styleDesc.titleEn || room.titleEn),
          summary: isRTL ? styleDesc.summary : (styleDesc.summaryEn || room.summaryEn),
        };
      }
      return { 
        ...room,
        eyebrow: isRTL ? room.eyebrow : room.eyebrowEn,
        title: isRTL ? room.title : room.titleEn,
        summary: isRTL ? room.summary : room.summaryEn,
      };
    });`
);

fs.writeFileSync(homeClientPath, hc);

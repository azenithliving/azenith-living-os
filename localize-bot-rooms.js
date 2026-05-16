const fs = require('fs');

// 1. Update ConsultantWidget.tsx
let consultantCode = fs.readFileSync('components/ConsultantWidget.tsx', 'utf8');

if (!consultantCode.includes('useSessionStore')) {
  consultantCode = consultantCode.replace(
    /import \{ MessageCircle/,
    'import useSessionStore from "@/stores/useSessionStore";\nimport { MessageCircle'
  );
}

consultantCode = consultantCode.replace(
  /const WELCOME_MESSAGE_NEW = "[^"]+";/,
  'const WELCOME_MESSAGE_NEW = (isRTL: boolean) => isRTL ? "أهلاً بك في أزينث ليفينج. أنا مُستشارك الشخصي. هل تسمح لي بمعرفة اسمك؟" : "Welcome to Azenith Living. I am your personal consultant. May I know your name?";'
);

consultantCode = consultantCode.replace(
  /const WELCOME_MESSAGE_RETURNING = \(name: string, topic: string\) => `[^`]+`;/,
  'const WELCOME_MESSAGE_RETURNING = (name: string, topic: string, isRTL: boolean) => isRTL ? `أهلاً بعودتك ${name}. هل ما زلت مهتمًا بـ ${topic}؟` : `Welcome back ${name}. Are you still interested in ${topic}?`;'
);

consultantCode = consultantCode.replace(
  /const WELCOME_QUANTUM = "[^"]+";/,
  'const WELCOME_QUANTUM = (isRTL: boolean) => isRTL ? "لاحظت أنك ترى العرض الاستثنائي الآن! 🎯 هذا الخصم 25% متاح لفترة محدودة جداً وتم تخصيصه خصيصاً للزوار المميزين. أنا هنا لمساعدتك في استغلاله. ما الذي يستهويك في مجال التصميم الداخلي؟" : "I see you\'re looking at the exceptional offer! 🎯 This 25% discount is available for a very limited time. I am here to help you utilize it. What interests you in interior design?";'
);

consultantCode = consultantCode.replace(
  /const WELCOME_THUNDER = "[^"]+";/,
  'const WELCOME_THUNDER = (isRTL: boolean) => isRTL ? "أرى أنك لاحظت عرضنا الخاص! ⚡ خصم 15% فوري على أول معاينة لمشروعك. هل أخبرك أحد من قبل أن أزينث تصنع قصوراً من الفضاء؟ ما نوع مشروعك؟" : "I see you noticed our special offer! ⚡ 15% instant discount on your first project consultation. Has anyone told you Azenith builds palaces from space? What\'s your project type?";'
);

consultantCode = consultantCode.replace(
  /const WELCOME_HALLUCINATION = "[^"]+";/,
  'const WELCOME_HALLUCINATION = (isRTL: boolean) => isRTL ? "مرحباً! هل تعلم أن 3 عملاء آخرين يتصفحون نفس التصاميم التي تراها الآن؟ 👀 المساحات تُحجز بسرعة. ما الذي يستهويك؟" : "Hello! Did you know 3 other clients are browsing the same designs? 👀 Spaces get booked fast. What catches your eye?";'
);

if (!consultantCode.includes('const currentLang = useSessionStore')) {
  consultantCode = consultantCode.replace(
    /export default function ConsultantWidget\(\) \{/,
    'export default function ConsultantWidget() {\n  const currentLang = useSessionStore((state) => state.language);\n  const isRTL = currentLang === "ar";'
  );
}

consultantCode = consultantCode.replace(
  /welcomeContent = WELCOME_QUANTUM;/,
  'welcomeContent = WELCOME_QUANTUM(isRTL);'
);
consultantCode = consultantCode.replace(
  /welcomeContent = WELCOME_THUNDER;/,
  'welcomeContent = WELCOME_THUNDER(isRTL);'
);
consultantCode = consultantCode.replace(
  /welcomeContent = WELCOME_HALLUCINATION;/,
  'welcomeContent = WELCOME_HALLUCINATION(isRTL);'
);
consultantCode = consultantCode.replace(
  /let welcomeContent = WELCOME_MESSAGE_NEW;/,
  'let welcomeContent = WELCOME_MESSAGE_NEW(isRTL);'
);

consultantCode = consultantCode.replace(
  /content: WELCOME_MESSAGE_RETURNING\(name, lastTopic\),/,
  'content: WELCOME_MESSAGE_RETURNING(name, lastTopic, isRTL),'
);

consultantCode = consultantCode.replace(
  /content: WELCOME_MESSAGE_NEW,/,
  'content: WELCOME_MESSAGE_NEW(isRTL),'
);

consultantCode = consultantCode.replace(
  />مُستشار أزينث<\/h3>/,
  '>{isRTL ? "مُستشار أزينث" : "Azenith Consultant"}</h3>'
);

consultantCode = consultantCode.replace(
  />متصل الآن<\/span>/g,
  '>{isRTL ? "متصل الآن" : "Online now"}</span>'
);

consultantCode = consultantCode.replace(
  /title="محادثة جديدة"/,
  'title={isRTL ? "محادثة جديدة" : "New Chat"}'
);

consultantCode = consultantCode.replace(
  />اضغط للبدء<\/p>/,
  '>{isRTL ? "اضغط للبدء" : "Tap to start"}</p>'
);

consultantCode = consultantCode.replace(
  /placeholder="اكتب رسالتك\.\.\."/,
  'placeholder={isRTL ? "اكتب رسالتك..." : "Type your message..."}'
);

consultantCode = consultantCode.replace(
  /"عذراً، حدث خطأ في الاتصال\. يرجى المحاولة مرة أخرى\."/,
  'isRTL ? "عذراً، حدث خطأ في الاتصال. يرجى المحاولة مرة أخرى." : "Sorry, a connection error occurred. Please try again."'
);

consultantCode = consultantCode.replace(
  /history: messages,/,
  'history: messages,\n          language: currentLang,'
);

fs.writeFileSync('components/ConsultantWidget.tsx', consultantCode);


// 2. Update api/consultant/route.ts
let apiCode = fs.readFileSync('app/api/consultant/route.ts', 'utf8');
if (!apiCode.includes('const { message, sessionId, userName, history, language }')) {
  apiCode = apiCode.replace(
    /const \{ message, sessionId, userName, history \} = await request\.json\(\);/,
    'const { message, sessionId, userName, history, language } = await request.json();'
  );
  
  apiCode = apiCode.replace(
    /const systemPrompt = `/,
    `const langInstruction = language === "en" ? "You MUST reply in English." : "You MUST reply in Arabic.";
    const systemPrompt = \`\${langInstruction} `
  );
  fs.writeFileSync('app/api/consultant/route.ts', apiCode);
}


// 3. Update lib/constants/rooms.ts
let roomsCode = fs.readFileSync('lib/constants/rooms.ts', 'utf8');

// Replace style descriptions with bilingual ones
roomsCode = roomsCode.replace(
  /modern: {\s*eyebrow: "نقاء عصري",\s*title: "غرف نوم مينيمال",\s*summary: "خطوط نظيفة وتصميم مينيمال يمنحك هدوءاً عصرياً مع تخزين ذكي خفي\.",\s*},/g,
  `modern: {
      eyebrow: "نقاء عصري",
      title: "غرف نوم مينيمال",
      summary: "خطوط نظيفة وتصميم مينيمال يمنحك هدوءاً عصرياً مع تخزين ذكي خفي.",
      eyebrowEn: "Modern Purity",
      titleEn: "Minimal Bedrooms",
      summaryEn: "Clean lines and minimal design give you modern tranquility with smart hidden storage.",
    },`
);

roomsCode = roomsCode.replace(
  /classic: {\s*eyebrow: "فخامة ملكية",\s*title: "غرف نوم كلاسيكية",\s*summary: "فخامة ملكية وتفاصيل غنية تعيد تعريف الرقي الكلاسيكي في كل زاوية\.",\s*},/g,
  `classic: {
      eyebrow: "فخامة ملكية",
      title: "غرف نوم كلاسيكية",
      summary: "فخامة ملكية وتفاصيل غنية تعيد تعريف الرقي الكلاسيكي في كل زاوية.",
      eyebrowEn: "Royal Luxury",
      titleEn: "Classic Bedrooms",
      summaryEn: "Royal luxury and rich details redefine classic sophistication in every corner.",
    },`
);

roomsCode = roomsCode.replace(
  /industrial: {\s*eyebrow: "خامة أصيلة",\s*title: "غرف نوم صناعية",\s*summary: "مساحة هادئة بتفاصيل فندقية وخامات راقية تجمع بين القوة والدفء\.",\s*},/g,
  `industrial: {
      eyebrow: "خامة أصيلة",
      title: "غرف نوم صناعية",
      summary: "مساحة هادئة بتفاصيل فندقية وخامات راقية تجمع بين القوة والدفء.",
      eyebrowEn: "Authentic Material",
      titleEn: "Industrial Bedrooms",
      summaryEn: "A quiet space with hotel details and refined materials combining strength and warmth.",
    },`
);

roomsCode = roomsCode.replace(
  /scandinavian: {\s*eyebrow: "دفء شمالي",\s*title: "غرف نوم سكاندينافية",\s*summary: "ألوان هادئة وخشب طبيعي يخلق ملاذاً للراحة والاسترخاء العميق\.",\s*},/g,
  `scandinavian: {
      eyebrow: "دفء شمالي",
      title: "غرف نوم سكاندينافية",
      summary: "ألوان هادئة وخشب طبيعي يخلق ملاذاً للراحة والاسترخاء العميق.",
      eyebrowEn: "Nordic Warmth",
      titleEn: "Scandinavian Bedrooms",
      summaryEn: "Calm colors and natural wood create a haven for deep relaxation and comfort.",
    },`
);

// Living Room
roomsCode = roomsCode.replace(
  /modern: {\s*eyebrow: "أناقة معاصرة",\s*title: "صالات مودرن",\s*summary: "تصميم مفتوح وخطوط نقية تجمع بين البساطة والوظيفة العالية\.",\s*},/g,
  `modern: {
      eyebrow: "أناقة معاصرة",
      title: "صالات مودرن",
      summary: "تصميم مفتوح وخطوط نقية تجمع بين البساطة والوظيفة العالية.",
      eyebrowEn: "Contemporary Elegance",
      titleEn: "Modern Lounges",
      summaryEn: "Open design and clean lines combining simplicity with high functionality.",
    },`
);

roomsCode = roomsCode.replace(
  /classic: {\s*eyebrow: "عراقة وجمال",\s*title: "صالات كلاسيكية",\s*summary: "تفاصيل نحتية وثريات فاخرة تمنح المكان روحاً تاريخية عريقة\.",\s*},/g,
  `classic: {
      eyebrow: "عراقة وجمال",
      title: "صالات كلاسيكية",
      summary: "تفاصيل نحتية وثريات فاخرة تمنح المكان روحاً تاريخية عريقة.",
      eyebrowEn: "Heritage & Beauty",
      titleEn: "Classic Lounges",
      summaryEn: "Sculptural details and luxury chandeliers give the place an ancient historical soul.",
    },`
);

roomsCode = roomsCode.replace(
  /industrial: {\s*eyebrow: "روح المدينة",\s*title: "صالات لوفت",\s*summary: "جدران طوبية وأسقف عالية مع لمسات معدنية جريئة وشخصية قوية\.",\s*},/g,
  `industrial: {
      eyebrow: "روح المدينة",
      title: "صالات لوفت",
      summary: "جدران طوبية وأسقف عالية مع لمسات معدنية جريئة وشخصية قوية.",
      eyebrowEn: "City Spirit",
      titleEn: "Loft Lounges",
      summaryEn: "Brick walls and high ceilings with bold metallic touches and strong character.",
    },`
);

roomsCode = roomsCode.replace(
  /scandinavian: {\s*eyebrow: "بساطة شمالية",\s*title: "صالات سكاندينافية",\s*summary: "إضاءة طبيعية وقماش مريح يجعل كل لحظة استرخاء تجربة فريدة\.",\s*},/g,
  `scandinavian: {
      eyebrow: "بساطة شمالية",
      title: "صالات سكاندينافية",
      summary: "إضاءة طبيعية وقماش مريح يجعل كل لحظة استرخاء تجربة فريدة.",
      eyebrowEn: "Nordic Simplicity",
      titleEn: "Scandinavian Lounges",
      summaryEn: "Natural lighting and comfortable fabric make every relaxing moment a unique experience.",
    },`
);

// Kitchen
roomsCode = roomsCode.replace(
  /modern: {\s*eyebrow: "أداء ذكي",\s*title: "مطابخ عصرية",\s*summary: "أسطح خشبية نظيفة وأجهزة مخفية لمساحة طهي أنيقة وعملية\.",\s*},/g,
  `modern: {
      eyebrow: "أداء ذكي",
      title: "مطابخ عصرية",
      summary: "أسطح خشبية نظيفة وأجهزة مخفية لمساحة طهي أنيقة وعملية.",
      eyebrowEn: "Smart Performance",
      titleEn: "Modern Kitchens",
      summaryEn: "Clean wooden surfaces and hidden appliances for an elegant and practical cooking space.",
    },`
);

roomsCode = roomsCode.replace(
  /classic: {\s*eyebrow: "تراث الطبخ",\s*title: "مطابخ كلاسيكية",\s*summary: "خزائن خشبية نقشية وأرضيات رخامية تعكس أصالة المطبخ التقليدي\.",\s*},/g,
  `classic: {
      eyebrow: "تراث الطبخ",
      title: "مطابخ كلاسيكية",
      summary: "خزائن خشبية نقشية وأرضيات رخامية تعكس أصالة المطبخ التقليدي.",
      eyebrowEn: "Cooking Heritage",
      titleEn: "Classic Kitchens",
      summaryEn: "Carved wooden cabinets and marble floors reflecting the authenticity of traditional kitchens.",
    },`
);

roomsCode = roomsCode.replace(
  /industrial: {\s*eyebrow: "قوة الخامة",\s*title: "مطابخ صناعية",\s*summary: "أسطح معدنية ولمسات خشبية قوية للطهاة المحترفين والمحبي الجرأة\.",\s*},/g,
  `industrial: {
      eyebrow: "قوة الخامة",
      title: "مطابخ صناعية",
      summary: "أسطح معدنية ولمسات خشبية قوية للطهاة المحترفين والمحبي الجرأة.",
      eyebrowEn: "Material Strength",
      titleEn: "Industrial Kitchens",
      summaryEn: "Metallic surfaces and strong wooden touches for professional chefs and bold lovers.",
    },`
);

roomsCode = roomsCode.replace(
  /scandinavian: {\s*eyebrow: "نقاء وضوء",\s*title: "مطابخ شمالية",\s*summary: "أبيض نقي وخشب فاتح مع إضاءة طبيعية تمنح الطاقة والنظافة\.",\s*},/g,
  `scandinavian: {
      eyebrow: "نقاء وضوء",
      title: "مطابخ شمالية",
      summary: "أبيض نقي وخشب فاتح مع إضاءة طبيعية تمنح الطاقة والنظافة.",
      eyebrowEn: "Purity & Light",
      titleEn: "Scandinavian Kitchens",
      summaryEn: "Pure white and light wood with natural lighting providing energy and cleanliness.",
    },`
);

fs.writeFileSync('lib/constants/rooms.ts', roomsCode);

export type LandingRoom = {
  slug: string;
  eyebrow: string;
  eyebrowEn?: string;
  title: string;
  titleEn?: string;
  summary: string;
  summaryEn?: string;
};

export const STYLE_LABELS: Record<string, string> = {
  modern: "مودرن",
  classic: "كلاسيك",
  industrial: "صناعي",
  scandinavian: "سكاندينافي",
};

export const ROOM_QUERIES: Record<string, string> = {
  "master-bedroom": "luxury master bedroom suite hotel interior design",
  "children-room": "luxury kids bedroom interior design playful elegant",
  "teen-room": "modern teenager bedroom study area contemporary design",
  "living-room": "luxury modern living room high-end interior design architectural digest lounge",
  "dining-room": "bespoke dining area luxury interior dining modern chandelier dining room",
  "corner-sofa": "luxury corner sofa sectional living room high-end furniture",
  lounge: "luxury lounge seating area interior design modern elegant",
  "dressing-room": "bespoke walk-in closet luxury dressing room interior",
  kitchen: "luxury high-end kitchen marble bespoke interior design",
  "home-office": "luxury home office study room executive interior",
  "interior-design": "luxury comprehensive interior design whole house architecture",
};

export const STYLE_QUERY_HINTS: Record<string, string> = {
  modern: "modern minimal luxury",
  classic: "classic elegant luxury",
  industrial: "industrial loft luxury",
  scandinavian: "scandinavian cozy luxury",
};

export const STYLE_RESULT_PAGE: Record<string, number> = {
  modern: 1,
  classic: 2,
  industrial: 3,
  scandinavian: 4,
};

export const BASE_ROOMS: LandingRoom[] = [
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
];

export const ROOM_STYLE_DESCRIPTIONS: Record<string, Record<string, { eyebrow: string; title: string; summary: string; eyebrowEn?: string; titleEn?: string; summaryEn?: string; }>> = {
  "master-bedroom": {
    modern: {
      eyebrow: "نقاء عصري",
      title: "غرف نوم مينيمال",
      summary: "خطوط نظيفة وتصميم مينيمال يمنحك هدوءاً عصرياً مع تخزين ذكي خفي.",
      eyebrowEn: "Modern Purity",
      titleEn: "Minimal Bedrooms",
      summaryEn: "Clean lines and minimal design give you modern tranquility with smart hidden storage.",
    },
    classic: {
      eyebrow: "فخامة ملكية",
      title: "غرف نوم كلاسيكية",
      summary: "فخامة ملكية وتفاصيل غنية تعيد تعريف الرقي الكلاسيكي في كل زاوية.",
      eyebrowEn: "Royal Luxury",
      titleEn: "Classic Bedrooms",
      summaryEn: "Royal luxury and rich details redefine classic sophistication in every corner.",
    },
    industrial: {
      eyebrow: "خامة أصيلة",
      title: "غرف نوم صناعية",
      summary: "مساحة هادئة بتفاصيل فندقية وخامات راقية تجمع بين القوة والدفء.",
      eyebrowEn: "Authentic Material",
      titleEn: "Industrial Bedrooms",
      summaryEn: "A quiet space with hotel details and refined materials combining strength and warmth.",
    },
    scandinavian: {
      eyebrow: "دفء شمالي",
      title: "غرف نوم سكاندينافية",
      summary: "ألوان هادئة وخشب طبيعي يخلق ملاذاً للراحة والاسترخاء العميق.",
      eyebrowEn: "Nordic Warmth",
      titleEn: "Scandinavian Bedrooms",
      summaryEn: "Calm colors and natural wood create a haven for deep relaxation and comfort.",
    },
  },
  "living-room": {
    modern: {
      eyebrow: "أناقة معاصرة",
      title: "صالات مودرن",
      summary: "تصميم مفتوح وخطوط نقية تجمع بين البساطة والوظيفة العالية.",
      eyebrowEn: "Contemporary Elegance",
      titleEn: "Modern Lounges",
      summaryEn: "Open design and clean lines combining simplicity with high functionality.",
    },
    classic: {
      eyebrow: "عراقة وجمال",
      title: "صالات كلاسيكية",
      summary: "تفاصيل نحتية وثريات فاخرة تمنح المكان روحاً تاريخية عريقة.",
      eyebrowEn: "Heritage & Beauty",
      titleEn: "Classic Lounges",
      summaryEn: "Sculptural details and luxury chandeliers give the place an ancient historical soul.",
    },
    industrial: {
      eyebrow: "روح المدينة",
      title: "صالات لوفت",
      summary: "جدران طوبية وأسقف عالية مع لمسات معدنية جريئة وشخصية قوية.",
      eyebrowEn: "City Spirit",
      titleEn: "Loft Lounges",
      summaryEn: "Brick walls and high ceilings with bold metallic touches and strong character.",
    },
    scandinavian: {
      eyebrow: "بساطة شمالية",
      title: "صالات سكاندينافية",
      summary: "إضاءة طبيعية وقماش مريح يجعل كل لحظة استرخاء تجربة فريدة.",
      eyebrowEn: "Nordic Simplicity",
      titleEn: "Scandinavian Lounges",
      summaryEn: "Natural lighting and comfortable fabric make every relaxing moment a unique experience.",
    },
  },
  kitchen: {
    modern: {
      eyebrow: "أداء ذكي",
      title: "مطابخ عصرية",
      summary: "أسطح خشبية نظيفة وأجهزة مخفية لمساحة طهي أنيقة وعملية.",
      eyebrowEn: "Smart Performance",
      titleEn: "Modern Kitchens",
      summaryEn: "Clean wooden surfaces and hidden appliances for an elegant and practical cooking space.",
    },
    classic: {
      eyebrow: "تراث الطبخ",
      title: "مطابخ كلاسيكية",
      summary: "خزائن خشبية نقشية وأرضيات رخامية تعكس أصالة المطبخ التقليدي.",
      eyebrowEn: "Cooking Heritage",
      titleEn: "Classic Kitchens",
      summaryEn: "Carved wooden cabinets and marble floors reflecting the authenticity of traditional kitchens.",
    },
    industrial: {
      eyebrow: "قوة الخامة",
      title: "مطابخ صناعية",
      summary: "أسطح معدنية ولمسات خشبية قوية للطهاة المحترفين والمحبي الجرأة.",
      eyebrowEn: "Material Strength",
      titleEn: "Industrial Kitchens",
      summaryEn: "Metallic surfaces and strong wooden touches for professional chefs and bold lovers.",
    },
    scandinavian: {
      eyebrow: "نقاء وضوء",
      title: "مطابخ شمالية",
      summary: "أبيض نقي وخشب فاتح مع إضاءة طبيعية تمنح الطاقة والنظافة.",
      eyebrowEn: "Purity & Light",
      titleEn: "Scandinavian Kitchens",
      summaryEn: "Pure white and light wood with natural lighting providing energy and cleanliness.",
    },
  },
  "dressing-room": {
    modern: {
      eyebrow: "تنظيم عصري",
      title: "خزائن ملابس مينيمال",
      summary: "أدراج مخفية وإضاءة LED ذكية لتجربة ملابس منظمة وهادئة.",
    },
    classic: {
      eyebrow: "خزائن ملكية",
      title: "غرف ملابس كلاسيكية",
      summary: "مرايا مزخرفة وخزائن خشبية ثقيلة بتفاصيل ذهبية راقية.",
    },
    industrial: {
      eyebrow: "عرض جريء",
      title: "خزائن ملابس مفتوحة",
      summary: "أنابيب معدنية ورفوف خشبية لعرض الملابس بأسلوب لوفت عصري.",
    },
    scandinavian: {
      eyebrow: "بساطة عملية",
      title: "خزائن ملابس شمالية",
      summary: "تنظيم واضح وإضاءة ناعمة مع خشب فاتح لراحة يومية.",
    },
  },
  "home-office": {
    modern: {
      eyebrow: "تركيز عصري",
      title: "مكاتب ذكية",
      summary: "خطوط نظيفة وتقنية متكاملة لبيئة عمل منتجة بدون تشويش.",
    },
    classic: {
      eyebrow: "مكتب تنفيذي",
      title: "مكاتب كلاسيكية",
      summary: "خشب داكن وجلد فاخر يخلقان حضوراً مهنياً يليق بالقرارات الكبرى.",
    },
    industrial: {
      eyebrow: "إبداع صناعي",
      title: "مكاتب لوفت",
      summary: "جدران طوبية وطاولات معدنية لمساحة عمل ملهمة وقوية الشخصية.",
    },
    scandinavian: {
      eyebrow: "توازن وهدوء",
      title: "مكاتب شمالية",
      summary: "ضوء طبيعي ونباتات وألوان هادئة تدعم الإنتاجية والراحة النفسية.",
    },
  },
  "youth-room": {
    modern: {
      eyebrow: "مرونة عصرية",
      title: "غرف شباب مودرن",
      summary: "تصميم متكيف مع مساحات تخزين ذكية تنمو مع احتياجات الشباب المتغيرة.",
    },
    classic: {
      eyebrow: "أناقة شبابية",
      title: "غرف شباب كلاسيكية",
      summary: "خشب نقي وتفاصيل دافئة تمنح الأبناء قيمة الجودة منذ الصغر.",
    },
    industrial: {
      eyebrow: "شخصية قوية",
      title: "غرف شباب صناعية",
      summary: "لمسات معدنية وخشب خام لمساحة تعبر عن الجرأة والاستقلالية.",
    },
    scandinavian: {
      eyebrow: "نمو بصحة",
      title: "غرف شباب شمالية",
      summary: "ألوان هادئة وإضاءة طبيعية تخلق بيئة مثالية للدراسة والراحة.",
    },
  },
  "dining-room": {
    modern: {
      eyebrow: "تجمع عصري",
      title: "غرف طعام مودرن",
      summary: "طاولات نظيفة وإضاءة معمارية لجلسات طعام أنيقة وعصرية.",
    },
    classic: {
      eyebrow: "ولائم تقليدية",
      title: "غرف طعام كلاسيكية",
      summary: "أثاث نقشي وثريات كريستال لجلسات عائلية ذات طابع تاريخي.",
    },
    industrial: {
      eyebrow: "طعام بروح المدينة",
      title: "غرف طعام صناعية",
      summary: "طاولات خشبية ثقيلة ولمسات معدنية لأجواء طعام جريئة.",
    },
    scandinavian: {
      eyebrow: "دفء المائدة",
      title: "غرف طعام سكاندينافية",
      summary: "خشب فاتح وإضاءة شمعدانية لجلسات طعام دافئة ومريحة.",
    },
  },
  "children-room": {
    modern: {
      eyebrow: "عالم ألوان",
      title: "غرف أطفال مودرن",
      summary: "تصميم آمن ومبهج يناسب تطور طفلك مع ألوان متناسقة.",
    },
    classic: {
      eyebrow: "أحلام دافئة",
      title: "غرف أطفال كلاسيكية",
      summary: "تفاصيل دافئة وخشب نقي لبيئة آمنة ومريحة.",
    },
    industrial: {
      eyebrow: "مغامرة صغيرة",
      title: "غرف أطفال صناعية",
      summary: "لمسات معدنية وخشبية تناسب روح المغامرة لدى الأطفال.",
    },
    scandinavian: {
      eyebrow: "نقاء ومرح",
      title: "غرف أطفال شمالية",
      summary: "ألوان هادئة ومساحات آمنة للعب والنمو.",
    },
  },
  "teen-room": {
    modern: {
      eyebrow: "استقلالية عصرية",
      title: "غرف مراهقين مودرن",
      summary: "مساحة متكاملة للدراسة والاسترخاء بتصميم عصري.",
    },
    classic: {
      eyebrow: "أناقة ناشئة",
      title: "غرف مراهقين كلاسيكية",
      summary: "خشب داكن وتفاصيل راقية تناسب مرحلة النضج.",
    },
    industrial: {
      eyebrow: "شخصية جريئة",
      title: "غرف مراهقين صناعية",
      summary: "لمسات معدنية وخشب خام تعبر عن الاستقلالية.",
    },
    scandinavian: {
      eyebrow: "تركيز وهدوء",
      title: "غرف مراهقين شمالية",
      summary: "إضاءة طبيعية وتنظيم واضح للدراسة والراحة.",
    },
  },
  "corner-sofa": {
    modern: {
      eyebrow: "أناقة عملية",
      title: "كنب زاوية مودرن",
      summary: "تصميم عصري يوفر مساحة جلوس واسعة بأناقة.",
    },
    classic: {
      eyebrow: "فخامة تقليدية",
      title: "كنب زاوية كلاسيكي",
      summary: "خامات فاخرة وتفاصيل نقشية لجلسات راقية.",
    },
    industrial: {
      eyebrow: "خامة أصيلة",
      title: "كنب زاوية صناعي",
      summary: "جلد طبيعي وهيكل معدني لمساحة جريئة.",
    },
    scandinavian: {
      eyebrow: "راحة شمالية",
      title: "كنب زاوية سكاندينافي",
      summary: "قماش ناعم وألوان فاتحة لراحة مطلقة.",
    },
  },
  lounge: {
    modern: {
      eyebrow: "زاوية هادئة",
      title: "لاونج مودرن",
      summary: "مساحة استرخاء عصرية بتصميم مينيمال أنيق.",
    },
    classic: {
      eyebrow: "أناقة قراءة",
      title: "لاونج كلاسيكي",
      summary: "كرسي استرخاء فاخر وإضاءة دافئة للقراءة.",
    },
    industrial: {
      eyebrow: "استرخاء صناعي",
      title: "لاونج لوفت",
      summary: "كرسي جلد وطاولة خشبية خام لزاوية مميزة.",
    },
    scandinavian: {
      eyebrow: "دفء وقراءة",
      title: "لاونج شمالي",
      summary: "كرسي ناعم وإضاءة طبيعية لزاوية قراءة مريحة.",
    },
  },
};

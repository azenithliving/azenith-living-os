export type LandingRoom = {
  slug: string;
  eyebrow: string;
  title: string;
  summary: string;
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
    title: "غرفة المعيشة",
    summary: "جلسات مدروسة بصريًا لاستقبال الضيوف ولحظات عائلية لا تُنسى.",
  },
  {
    slug: "dining-room",
    eyebrow: "ولائم عائلية",
    title: "غرفة الطعام",
    summary: "تجارب طعام مريحة بأناقة دافئة تناسب كل مناسبة.",
  },
  {
    slug: "kitchen",
    eyebrow: "فن الطهي",
    title: "المطبخ",
    summary: "مساحة عمل أنيقة تجمع بين الوظيفة والجمال لتجربة طهي فاخرة.",
  },
  {
    slug: "master-bedroom",
    eyebrow: "خصوصية ملكية",
    title: "غرفة النوم الرئيسية",
    summary: "ملاذ هادئ يجمع بين الفخامة الفندقية والراحة الشخصية بتفاصيل متقنة.",
  },
  {
    slug: "guest-bedroom",
    eyebrow: "ضيافة أنيقة",
    title: "غرفة نوم الضيوف",
    summary: "راحة فاخرة لضيوفك مع تصميم دافئ يلائم كل الأذواق.",
  },
  {
    slug: "kids-bedroom",
    eyebrow: "أحلام صغيرة",
    title: "غرفة الأطفال",
    summary: "مساحة آمنة ومبهجة تنمو مع طفلك، تجمع بين المرح والوظيفة.",
  },
  {
    slug: "teen-room",
    eyebrow: "شخصية ناشئة",
    title: "غرفة المراهقين",
    summary: "تصميم يناسب مرحلة النضج مع مساحات للدراسة والتعبير الذاتي.",
  },
  {
    slug: "dressing-room",
    eyebrow: "تنظيم فاخر",
    title: "غرفة الملابس",
    summary: "تجربة ملابس يومية أنيقة بتقسيم ذكي وإضاءة مثالية.",
  },
  {
    slug: "home-office",
    eyebrow: "إنتاجية متقنة",
    title: "مكتب المنزل",
    summary: "بيئة عمل محفزة تحافظ على التوازن بين المهنية والراحة المنزلية.",
  },
  {
    slug: "study-room",
    eyebrow: "تركيز وهدوء",
    title: "غرفة الدراسة",
    summary: "بيئة مثالية للقراءة والتعلم بعيدًا عن المشتتات.",
  },
  {
    slug: "bathroom",
    eyebrow: "رفاهية يومية",
    title: "الحمام",
    summary: "تصميم حمامات فاخرة تجمع بين الوظيفة والاسترخاء.",
  },
  {
    slug: "guest-bathroom",
    eyebrow: "ضيافة مثالية",
    title: "حمام الضيوف",
    summary: "أناقة عملية لحمام الضيوف مع لمسات فاخرة.",
  },
  {
    slug: "entrance-lobby",
    eyebrow: "انطباع أول",
    title: "المدخل",
    summary: "مدخل مهيب يعكس أناقة منزلك من أول خطوة.",
  },
  {
    slug: "corner-sofa",
    eyebrow: "راحة مطلقة",
    title: "كنب الزاوية",
    summary: "قطع مفروشات فاخرة تضيف لمسة عصرية ومساحة جلوس واسعة.",
  },
  {
    slug: "lounge",
    eyebrow: "استرخاء أنيق",
    title: "الاستراحة",
    summary: "زاوية خاصة للاسترخاء والقراءة بلمسات أنيقة وخامات ناعمة.",
  },
];

export const ROOM_STYLE_DESCRIPTIONS: Record<string, Record<string, { eyebrow: string; title: string; summary: string }>> = {
  "master-bedroom": {
    modern: {
      eyebrow: "نقاء عصري",
      title: "غرف نوم مينيمال",
      summary: "خطوط نظيفة وتصميم مينيمال يمنحك هدوءاً عصرياً مع تخزين ذكي خفي.",
    },
    classic: {
      eyebrow: "فخامة ملكية",
      title: "غرف نوم كلاسيكية",
      summary: "فخامة ملكية وتفاصيل غنية تعيد تعريف الرقي الكلاسيكي في كل زاوية.",
    },
    industrial: {
      eyebrow: "خامة أصيلة",
      title: "غرف نوم صناعية",
      summary: "مساحة هادئة بتفاصيل فندقية وخامات راقية تجمع بين القوة والدفء.",
    },
    scandinavian: {
      eyebrow: "دفء شمالي",
      title: "غرف نوم سكاندينافية",
      summary: "ألوان هادئة وخشب طبيعي يخلق ملاذاً للراحة والاسترخاء العميق.",
    },
  },
  "living-room": {
    modern: {
      eyebrow: "أناقة معاصرة",
      title: "صالات مودرن",
      summary: "تصميم مفتوح وخطوط نقية تجمع بين البساطة والوظيفة العالية.",
    },
    classic: {
      eyebrow: "عراقة وجمال",
      title: "صالات كلاسيكية",
      summary: "تفاصيل نحتية وثريات فاخرة تمنح المكان روحاً تاريخية عريقة.",
    },
    industrial: {
      eyebrow: "روح المدينة",
      title: "صالات لوفت",
      summary: "جدران طوبية وأسقف عالية مع لمسات معدنية جريئة وشخصية قوية.",
    },
    scandinavian: {
      eyebrow: "بساطة شمالية",
      title: "صالات سكاندينافية",
      summary: "إضاءة طبيعية وقماش مريح يجعل كل لحظة استرخاء تجربة فريدة.",
    },
  },
  kitchen: {
    modern: {
      eyebrow: "أداء ذكي",
      title: "مطابخ عصرية",
      summary: "أسطح خشبية نظيفة وأجهزة مخفية لمساحة طهي أنيقة وعملية.",
    },
    classic: {
      eyebrow: "تراث الطبخ",
      title: "مطابخ كلاسيكية",
      summary: "خزائن خشبية نقشية وأرضيات رخامية تعكس أصالة المطبخ التقليدي.",
    },
    industrial: {
      eyebrow: "قوة الخامة",
      title: "مطابخ صناعية",
      summary: "أسطح معدنية ولمسات خشبية قوية للطهاة المحترفين والمحبي الجرأة.",
    },
    scandinavian: {
      eyebrow: "نقاء وضوء",
      title: "مطابخ شمالية",
      summary: "أبيض نقي وخشب فاتح مع إضاءة طبيعية تمنح الطاقة والنظافة.",
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

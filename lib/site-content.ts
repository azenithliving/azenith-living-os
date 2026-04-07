export type FurnitureDefinition = {
  slug: string;
  title: string;
  images: string[];
  video?: string;
  description: string;
  priceRange: string;
  features: string[];
  variations: string[];
};

export type RoomDefinition = {
  slug: string;
  title: string;
  eyebrow: string;
  summary: string;
  outcome: string;
  bullets: string[];
  furniture: FurnitureDefinition[];
};

export type AboutData = {
  title: string;
  story: string;
  values: string[];
  team: string;
};

export type SeoPageDefinition = {
  slug: string;
  title: string;
  description: string;
  focus: string;
};

export const roomDefinitions: RoomDefinition[] = [
  {
    slug: "master-bedroom",
    title: "غرف النوم الرئيسية",
    eyebrow: "خصوصية محسوبة",
    summary: "مساحة هادئة بتفاصيل فندقية وإضاءة طبقية وخامات تعيش سنوات طويلة.",
    outcome: "تصميم ينقل الغرفة من مجرد فرش إلى تجربة يومية مريحة ومتماسكة.",
    bullets: ["توزيع حركة واضح", "حلول تخزين مخفية", "لوحة خامات دافئة", "تناغم بين السرير والدريسينج"],
    furniture: [
      {
        slug: "master-bed",
        title: "سرير رئيسي فاخر",
        images: ["/images/master-bed-1.jpg", "/images/master-bed-2.jpg", "/images/master-bed-3.jpg"],
        video: "/videos/master-bed-tour.mp4",
        description: "سرير بتصميم مترف يجمع بين الراحة والأناقة مع خامات فندقية عالية الجودة.",
        priceRange: "25,000 - 45,000 EGP",
        features: ["خشب طبيعي", "مراتب متقدمة", "إضاءة مدمجة"],
        variations: ["بيج كلاسيك", "رمادي مودرن", "أسود فاخر"]
      },
      {
        slug: "nightstands",
        title: "كومودات السرير",
        images: ["/images/nightstands-1.jpg", "/images/nightstands-2.jpg"],
        description: "كومودات أنيقة مع تخزين ذكي وإضاءة ليلية لتجربة نوم مثالية.",
        priceRange: "8,000 - 15,000 EGP",
        features: ["تخزين متعدد", "إضاءة لمسة واحدة"],
        variations: ["خشبي", "معدني"]
      },
      {
        slug: "sofa-master",
        title: "كنبة غرفة نوم رئيسية",
        images: ["/images/sofa-master-1.jpg", "/images/sofa-master-2.jpg"],
        description: "كنبة أنيقة لجلسات القراءة في الغرفة الرئيسية، خامات فندقية فاخرة.",
        priceRange: "18,000 - 30,000 EGP",
        features: ["جلد طبيعي", "تخزين داخلي", "تصميم مدمج"],
        variations: ["بيج", "رمادي", "بني"]
      }
    ]
  },
  {
    slug: "living-room",
    title: "غرف المعيشة",
    eyebrow: "استقبال بثقة",
    summary: "صالة تحمل الطابع الاجتماعي للمنزل مع توازن بين الراحة والمشهد العام.",
    outcome: "جلسات مدروسة بصريًا وعمليًا مع مركز بصري قوي ومسارات حركة مريحة.",
    bullets: ["معالجة التلفزيون والجدار الرئيسي", "توزيع جلسات مرن", "حلول إضاءة للضيافة", "اختيار أقمشة مناسبة للاستخدام اليومي"],
    furniture: [
      {
        slug: "living-sofa",
        title: "كنبة غرفة معيشة كلاسيك",
        images: ["/images/living-sofa-1.jpg", "/images/living-sofa-2.jpg"],
        video: "/videos/living-sofa.mp4",
        description: "كنبة مريحة للجلسات العائلية، أقمشة مقاومة وتصميم عصري.",
        priceRange: "22,000 - 40,000 EGP",
        features: ["أقمشة فاخرة", "إطار خشبي قوي", "وسائد إضافية"],
        variations: ["رمادي", "بيج", "أزرق بحري"]
      },
      {
        slug: "corner-sofa-living",
        title: "كنبة زاوية للصالة",
        images: ["/images/corner-sofa-living-1.jpg"],
        description: "كنبة زاوية توفر مساحة ومرونة للصالات الكبيرة والصغيرة.",
        priceRange: "35,000 - 55,000 EGP",
        features: ["تصميم L-shape", "تخزين تحت الجلوس", "متعددة الاستخدامات"],
        variations: ["رمادي كبير", "بيج مدبب"]
      }
    ]
  },
  {
    slug: "kitchen",
    title: "المطابخ",
    eyebrow: "أداء يومي أنظف",
    summary: "مطابخ حديثة بتوازن بين الوظيفة والشكل مع عناية بالتخزين وسهولة الاستخدام.",
    outcome: "مطبخ عملي بواجهات متقنة ومسارات استخدام مختصرة وتشطيب يبدو أغلى من تكلفته.",
    bullets: ["مثلث حركة ذكي", "استغلال رأسي للتخزين", "خامات مقاومة وسهلة التنظيف", "حلول إضاءة فوق أسطح العمل"],
    furniture: [
      {
        slug: "kitchen-sofa",
        title: "كنبة مطبخ صغيرة",
        images: ["/images/kitchen-sofa-1.jpg"],
        description: "كنبة بجانب البار للجلسات السريعة في المطبخ الحديث.",
        priceRange: "10,000 - 18,000 EGP",
        features: ["مقاومة للرطوبة", "سهلة التنظيف", "تصميم مدمج"],
        variations: ["رمادي", "أبيض"]
      }
    ]
  },
  {
    slug: "dressing-room",
    title: "غرف الملابس",
    eyebrow: "تنظيم فاخر",
    summary: "دريسينج واضح التقسيم يرفع قيمة التجربة اليومية ويقلل الفوضى.",
    outcome: "وحدات تخزين محسوبة، مرايا، وإضاءة تجعل المساحة عملية ومترفة في الوقت نفسه.",
    bullets: ["تقسيمات داخلية فعالة", "مرايا وإضاءة تجميلية", "استفادة قصوى من المساحة", "خامات متناسقة مع الغرفة الرئيسية"],
    furniture: [
      {
        slug: "dressing-sofa",
        title: "كنبة صغيرة للدريسينج",
        images: ["/images/dressing-sofa-1.jpg"],
        description: "كنبة أنيقة للجلوس أثناء التجربة في غرفة الملابس.",
        priceRange: "9,000 - 15,000 EGP",
        features: ["جلد ناعم", "تصميم نحيف", "سهلة الحركة"],
        variations: ["أسود", "بيج"]
      }
    ]
  },
  {
    slug: "home-office",
    title: "المكاتب المنزلية",
    eyebrow: "تركيز بدون تشويش",
    summary: "مكتب منزلي يحافظ على هوية المنزل مع جاهزية حقيقية للعمل الطويل.",
    outcome: "سطح عمل مريح، خلفية بصرية نظيفة، وتخزين يجعل المساحة منتجة وليست مؤقتة.",
    bullets: ["إضاءة عملية للمهام", "معالجة خلفية الاجتماعات", "تخزين ملفات وإكسسوارات", "راحة بصرية للجلسات الطويلة"],
    furniture: [
      {
        slug: "office-sofa",
        title: "كنبة مكتب منزلي",
        images: ["/images/office-sofa-1.jpg"],
        description: "كنبة مريحة للزوار أو استراحة العمل في المكتب المنزلي.",
        priceRange: "14,000 - 24,000 EGP",
        features: ["دعم ظهر", "جلد أو قماش", "عجلات اختيارية"],
        variations: ["رمادي", "أسود", "بيج"]
      }
    ]
  },
  {
    slug: "youth-room",
    title: "غرف الشباب والأطفال",
    eyebrow: "مرونة تنمو مع الوقت",
    summary: "غرف تجمع بين الشخصية والعملية مع حلول قابلة للتطوير بدل التغيير السريع.",
    outcome: "مساحة مرنة للنوم والدراسة والتخزين، مع هوية تناسب العمر والاستخدام.",
    bullets: ["زوايا دراسة واضحة", "تخزين يخفف الفوضى", "ألوان محسوبة", "أثاث يقبل التطوير لاحقًا"],
    furniture: [
      {
        slug: "youth-sofa",
        title: "كنب شبابي متعدد الاستخدامات",
        images: ["/images/youth-sofa-1.jpg"],
        description: "كنب مريح يتحول إلى سرير مع تخزين مدمج للغرف الصغيرة.",
        priceRange: "12,000 - 20,000 EGP",
        features: ["تحويل سرير", "تخزين", "أقمشة مقاومة"],
        variations: ["أزرق", "رمادي", "أخضر"]
      },
      {
        slug: "corner-sofa-youth",
        title: "كنبة زاوية للغرف الشبابية",
        images: ["/images/corner-sofa-youth-1.jpg"],
        description: "كنبة زاوية صغيرة متعددة الوظائف للغرف المحدودة المساحة.",
        priceRange: "15,000 - 25,000 EGP",
        features: ["صغيرة الحجم", "تحويل سرير", "ألوان مبهجة"],
        variations: ["أزرق فاتح", "أخضر", "رمادي"]
      }
    ]
  },
  {
    slug: "dining-room",
    title: "غرف الطعام",
    eyebrow: "جلسات عائلية راقية",
    summary: "تصميم يجمع بين الأناقة والعملية لتجارب الطعام المميزة.",
    outcome: "مساحة طعام مترابطة مع إضاءة دافئة وتوزيع مريح.",
    bullets: ["طاولات قابلة للتوسعة", "كراسي مريحة", "خزائن عرض"],
    furniture: [
      {
        slug: "dining-table",
        title: "طاولة طعام فاخرة",
        images: ["/images/dining-table-1.jpg"],
        description: "طاولة طعام من خشب طبيعي تدوم لأجيال.",
        priceRange: "30,000 - 50,000 EGP",
        features: ["خشب طبيعي", "قابلة للتوسعة"],
        variations: ["8 مقاعد", "10 مقاعد"]
      }
    ]
  },
  {
    slug: "interior-design",
    title: "تصميم داخلي شامل",
    eyebrow: "رؤية متكاملة",
    summary: "تصميم شامل للمنزل بأكمله مع تناغم بين جميع المساحات.",
    outcome: "منزل متناسق يعكس شخصيتكم.",
    bullets: ["تصميم شامل", "اختيار خامات", "إشراف تنفيذ"],
    furniture: []
  }
];

export const seoDefinitions: SeoPageDefinition[] = [
  {
    slug: "luxury-bedroom-design-cairo",
    title: "تصميم غرف نوم فاخرة في القاهرة",
    description: "حلول لغرف النوم الرئيسية تجمع بين الهدوء، التخزين، والهوية الراقية.",
    focus: "غرف النوم",
  },
  {
    slug: "modern-kitchen-design-egypt",
    title: "تصميم مطابخ مودرن في مصر",
    description: "تخطيط مطابخ عملية بخامات مناسبة للمنازل الراقية والمشروعات الخاصة.",
    focus: "المطابخ",
  },
  {
    slug: "living-room-interior-egypt",
    title: "أفكار تصميم صالات معيشة في مصر",
    description: "تصميم صالات تجمع بين الاستقبال، الجلسات اليومية، وإدارة الحركة.",
    focus: "غرف المعيشة",
  },
  {
    slug: "dressing-room-design-cairo",
    title: "تصميم دريسينج روم في القاهرة",
    description: "تنظيم فاخر لغرف الملابس مع مرايا، إضاءة، وتفاصيل تخزين دقيقة.",
    focus: "غرف الملابس",
  },
];

export const budgetOptions = [
  "2,500 - 5,500 EGP",
  "5,500 - 12,000 EGP",
  "12,000 - 25,000 EGP",
  "25,000+ EGP",
];

export const styleOptions = [
  "مودرن دافئ",
  "هادئ فاخر",
  "عملي مع لمسة فندقية",
  "صناعي ناعم",
];

export const serviceOptions = [
  "تصميم فقط",
  "تصميم وتجهيز",
  "تصميم وتنفيذ",
  "تجديد لمساحة قائمة",
];

export const packageLadder = [
  {
    key: "basic",
    title: "الباقة الأساسية",
    price: "2,500 EGP",
    summary: "مناسبة للعميل الذي يريد اتجاهًا واضحًا وخطة تصميم أولية سريعة.",
    bullets: ["مخطط مبدئي", "لوحة خامات أساسية", "اقتراح توزيع للأثاث"],
  },
  {
    key: "full",
    title: "الباقة الكاملة",
    price: "5,500 EGP",
    summary: "حل متوازن لمن يريد تصورًا أقرب للتنفيذ مع قرارات أوضح للخامات والأثاث.",
    bullets: ["تصميم تفصيلي أكثر", "ترشيحات أثاث وخامات", "معالجة إضاءة وتشطيب"],
  },
  {
    key: "premium",
    title: "الباقة التنفيذية",
    price: "12,000 EGP",
    summary: "لمن يريد الانتقال من القرار إلى التنفيذ بثقة ومسار متابعة أدق.",
    bullets: ["تفاصيل تنفيذ", "أولوية متابعة", "توصيات مشتريات وبدائل"],
  },
];

export const trustPoints = [
  "تصميم مبدئي خلال 24 ساعة",
  "عربي أولًا مع تجربة واضحة وسريعة",
  "توصيات قابلة للتنفيذ وليست moodboard فقط",
  "تركيز على المساحات السكنية الراقية في مصر",
];

export const TONE_MAP: Record<string, { headline: string; desc: string }> = {
  modern: {
    headline: "ذكاء التصميم، بساطة المستقبل",
    desc: "مساحات تعكس نمط حياتك المتسارع بلمسات ذكية وحلول تنظيمية مبتكرة."
  },
  industrial: {
    headline: "جرأة الخام، روح المدن",
    desc: "تصاميم صريحة تمزج بين المعدن والخشب لتخلق مساحة عمل وإبداع غير تقليدية."
  },
  classic: {
    headline: "فخامة خالدة، تفاصيل ملكية",
    desc: "إرث من الأناقة يجمع بين دفء الماضي وفخامة الحاضر في كل زاوية."
  },
  scandinavian: {
    headline: "هدوء الطبيعة، دفء المنزل",
    desc: "توازن مثالي بين الإضاءة الطبيعية والألوان الهادئة لمساحة تمنحك السكينة."
  }
};

export const executionTimeline = [
  {
    step: "01",
    title: "تأهيل سريع",
    detail: "نحدد نوع المساحة، الميزانية، والطابع المطلوب في أقل من دقيقتين.",
  },
  {
    step: "02",
    title: "تصور أولي",
    detail: "نقدم اتجاه تصميمي واضح مع تقدير مبدئي أقرب للواقع.",
  },
  {
    step: "03",
    title: "إغلاق عبر واتساب",
    detail: "نحول البيانات إلى محادثة جاهزة للفريق مع ملخص اهتمام العميل.",
  },
  {
    step: "04",
    title: "تنفيذ أو تطوير",
    detail: "نرفع العميل إلى الباقة المناسبة ونكمل التفاصيل حسب المرحلة.",
  },
];


export const aboutData: AboutData = {
  title: "نبذة عنا",
  story: "نحن متخصصون في تصميم داخلي فاخر يركز على المساحات السكنية. خبرتنا تمتد لسنوات في خلق بيئات تعيش مع العائلة وتنمو مع احتياجاتها. نؤمن بأن التصميم ليس مجرد شكل، بل وظيفة تجعل الحياة أفضل.",
  values: ["جودة تدوم", "تخصيص كامل", "تنفيذ مضمون"],
  team: "فريق من المهندسين والمصممين ذوي الخبرة العالية."
};

export function getRoomDefinition(slug: string) {
  return roomDefinitions.find((room) => room.slug === slug) ?? null;
}

export function getSeoDefinition(slug: string) {
  return seoDefinitions.find((page) => page.slug === slug) ?? null;
}

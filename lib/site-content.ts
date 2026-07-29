export type FurnitureDefinition = {
  slug: string;
  title: string;
  titleEn?: string;
  images: string[];
  video?: string;
  description: string;
  descriptionEn?: string;
  priceRange: string;
  features: string[];
  featuresEn?: string[];
  variations: string[];
  variationsEn?: string[];
};

export type RoomDefinition = {
  slug: string;
  title: string;
  titleEn?: string;
  eyebrow: string;
  eyebrowEn?: string;
  summary: string;
  summaryEn?: string;
  outcome: string;
  outcomeEn?: string;
  bullets: string[];
  bulletsEn?: string[];
  furniture: FurnitureDefinition[];
};

export type AboutData = {
  title: string;
  titleEn: string;
  story: string;
  storyEn: string;
  values: string[];
  valuesEn: string[];
  team: string;
  teamEn: string;
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
    titleEn: "Master Bedrooms",
    eyebrow: "خصوصية محسوبة",
    eyebrowEn: "Calculated Privacy",
    summaryEn: "A calm space with hotel details, layered lighting, and long-lasting materials.",
    outcomeEn: "A design that transforms the room from mere furnishing to a comfortable and cohesive daily experience.",
    bulletsEn: ["Clear movement distribution","Hidden storage solutions","Warm materials palette","Harmony between bed and dressing"],
    summary: "مساحة هادئة بتفاصيل فندقية وإضاءة طبقية وخامات تعيش سنوات طويلة.",
    outcome: "تصميم ينقل الغرفة من مجرد فرش إلى تجربة يومية مريحة ومتماسكة.",
    bullets: ["توزيع حركة واضح", "حلول تخزين مخفية", "لوحة خامات دافئة", "تناغم بين السرير والدريسينج"],
    furniture: [
      {
        slug: "master-bed",
        title: "سرير رئيسي فاخر",
        titleEn: "Luxury Master Bed",
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
        titleEn: "Nightstands",
        images: ["/images/nightstands-1.jpg", "/images/nightstands-2.jpg"],
        description: "كومودات أنيقة مع تخزين ذكي وإضاءة ليلية لتجربة نوم مثالية.",
        priceRange: "8,000 - 15,000 EGP",
        features: ["تخزين متعدد", "إضاءة لمسة واحدة"],
        variations: ["خشبي", "معدني"]
      },
      {
        slug: "sofa-master",
        title: "كنبة غرفة نوم رئيسية",
        titleEn: "Master Bedroom Sofa",
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
    titleEn: "Living Rooms",
    eyebrow: "استقبال بثقة",
    eyebrowEn: "Confident Reception",
    summaryEn: "A hall that carries the social character of the home with a balance between comfort and the overall scene.",
    outcomeEn: "Visually and practically studied seating with a strong visual center and comfortable movement paths.",
    bulletsEn: ["TV and main wall treatment","Flexible seating distribution","Hospitality lighting solutions","Choosing fabrics suitable for daily use"],
    summary: "صالة تحمل الطابع الاجتماعي للمنزل مع توازن بين الراحة والمشهد العام.",
    outcome: "جلسات مدروسة بصريًا وعمليًا مع مركز بصري قوي ومسارات حركة مريحة.",
    bullets: ["معالجة التلفزيون والجدار الرئيسي", "توزيع جلسات مرن", "حلول إضاءة للضيافة", "اختيار أقمشة مناسبة للاستخدام اليومي"],
    furniture: [
      {
        slug: "living-sofa",
        title: "كنبة غرفة معيشة كلاسيك",
        titleEn: "Classic Living Sofa",
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
        titleEn: "Living Room Corner Sofa",
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
    titleEn: "Kitchens",
    eyebrow: "أداء يومي أنظف",
    eyebrowEn: "Cleaner Daily Performance",
    summaryEn: "Modern kitchens balancing function and form with care for storage and ease of use.",
    outcomeEn: "A practical kitchen with meticulous facades, shortened usage paths, and a finish that looks more expensive than its cost.",
    bulletsEn: ["Smart movement triangle","Vertical exploitation of storage","Resistant and easy to clean materials","Lighting solutions above workspaces"],
    summary: "مطابخ حديثة بتوازن بين الوظيفة والشكل مع عناية بالتخزين وسهولة الاستخدام.",
    outcome: "مطبخ عملي بواجهات متقنة ومسارات استخدام مختصرة وتشطيب يبدو أغلى من تكلفته.",
    bullets: ["مثلث حركة ذكي", "استغلال رأسي للتخزين", "خامات مقاومة وسهلة التنظيف", "حلول إضاءة فوق أسطح العمل"],
    furniture: [
      {
        slug: "kitchen-sofa",
        title: "كنبة مطبخ صغيرة",
        titleEn: "Small Kitchen Sofa",
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
    titleEn: "Dressing Rooms",
    eyebrow: "تنظيم فاخر",
    eyebrowEn: "Luxurious Organization",
    summaryEn: "A clearly divided dressing room that elevates the daily experience and reduces clutter.",
    outcomeEn: "Calculated storage units, mirrors, and lighting that make the space practical and luxurious at the same time.",
    bulletsEn: ["Effective internal divisions","Cosmetic mirrors and lighting","Maximum use of space","Materials consistent with the main room"],
    summary: "دريسينج واضح التقسيم يرفع قيمة التجربة اليومية ويقلل الفوضى.",
    outcome: "وحدات تخزين محسوبة، مرايا، وإضاءة تجعل المساحة عملية ومترفة في الوقت نفسه.",
    bullets: ["تقسيمات داخلية فعالة", "مرايا وإضاءة تجميلية", "استفادة قصوى من المساحة", "خامات متناسقة مع الغرفة الرئيسية"],
    furniture: [
      {
        slug: "dressing-sofa",
        title: "كنبة صغيرة للدريسينج",
        titleEn: "Small Dressing Sofa",
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
    titleEn: "Home Offices",
    eyebrow: "تركيز بدون تشويش",
    eyebrowEn: "Focus Without Distraction",
    summaryEn: "A home office that maintains the home's identity with real readiness for long work.",
    outcomeEn: "A comfortable workspace, clean visual background, and storage that makes the space productive and not temporary.",
    bulletsEn: ["Practical task lighting","Meeting background treatment","Files and accessories storage","Visual comfort for long sessions"],
    summary: "مكتب منزلي يحافظ على هوية المنزل مع جاهزية حقيقية للعمل الطويل.",
    outcome: "سطح عمل مريح، خلفية بصرية نظيفة، وتخزين يجعل المساحة منتجة وليست مؤقتة.",
    bullets: ["إضاءة عملية للمهام", "معالجة خلفية الاجتماعات", "تخزين ملفات وإكسسوارات", "راحة بصرية للجلسات الطويلة"],
    furniture: [
      {
        slug: "office-sofa",
        title: "كنبة مكتب منزلي",
        titleEn: "Home Office Sofa",
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
    titleEn: "Kids & Teen Rooms",
    eyebrow: "مرونة تنمو مع الوقت",
    eyebrowEn: "Flexibility That Grows Over Time",
    summaryEn: "Rooms that combine personality and practicality with scalable solutions instead of rapid change.",
    outcomeEn: "A flexible space for sleeping, studying, and storage, with an identity that suits age and use.",
    bulletsEn: ["Clear study corners","Storage that reduces clutter","Calculated colors","Furniture that can be developed later"],
    summary: "غرف تجمع بين الشخصية والعملية مع حلول قابلة للتطوير بدل التغيير السريع.",
    outcome: "مساحة مرنة للنوم والدراسة والتخزين، مع هوية تناسب العمر والاستخدام.",
    bullets: ["زوايا دراسة واضحة", "تخزين يخفف الفوضى", "ألوان محسوبة", "أثاث يقبل التطوير لاحقًا"],
    furniture: [
      {
        slug: "youth-sofa",
        title: "كنب شبابي متعدد الاستخدامات",
        titleEn: "Versatile Youth Sofa",
        images: ["/images/youth-sofa-1.jpg"],
        description: "كنب مريح يتحول إلى سرير مع تخزين مدمج للغرف الصغيرة.",
        priceRange: "12,000 - 20,000 EGP",
        features: ["تحويل سرير", "تخزين", "أقمشة مقاومة"],
        variations: ["أزرق", "رمادي", "أخضر"]
      },
      {
        slug: "corner-sofa-youth",
        title: "كنبة زاوية للغرف الشبابية",
        titleEn: "Youth Room Corner Sofa",
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
    titleEn: "Dining Rooms",
    eyebrow: "جلسات عائلية راقية",
    eyebrowEn: "Elegant Family Gatherings",
    summaryEn: "A design that combines elegance and practicality for exceptional dining experiences.",
    outcomeEn: "An interconnected dining space with warm lighting and comfortable distribution.",
    bulletsEn: ["Expandable tables","Comfortable chairs","Display cabinets"],
    summary: "تصميم يجمع بين الأناقة والعملية لتجارب الطعام المميزة.",
    outcome: "مساحة طعام مترابطة مع إضاءة دافئة وتوزيع مريح.",
    bullets: ["طاولات قابلة للتوسعة", "كراسي مريحة", "خزائن عرض"],
    furniture: [
      {
        slug: "dining-table",
        title: "طاولة طعام فاخرة",
        titleEn: "Luxury Dining Table",
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
    titleEn: "Full Interior Design",
    eyebrow: "رؤية متكاملة",
    eyebrowEn: "Integrated Vision",
    summaryEn: "Comprehensive design for the entire home with harmony between all spaces.",
    outcomeEn: "A harmonious home that reflects your personality.",
    bulletsEn: ["Comprehensive design","Material selection","Execution supervision"],
    summary: "تصميم شامل للمنزل بأكمله مع تناغم بين جميع المساحات.",
    outcome: "منزل متناسق يعكس شخصيتكم.",
    bullets: ["تصميم شامل", "اختيار خامات", "إشراف تنفيذ"],
    furniture: []
  },
  {
    slug: "children-room",
    title: "غرف الأطفال",
    titleEn: "Children's Rooms",
    eyebrow: "أحلام صغيرة",
    eyebrowEn: "Little Dreams",
    summaryEn: "A safe and joyful space that grows with your child, combining fun and functionality.",
    outcomeEn: "A creative environment designed for safety, learning, and playful exploration.",
    bulletsEn: ["Safe cornerless design", "Scalable storage solutions", "Cheerful color palettes", "Interactive study desks"],
    summary: "مساحة آمنة ومبهجة تنمو مع طفلك، تجمع بين المرح والوظيفة.",
    outcome: "بيئة إبداعية مصممة للأمان والتعلم والاستكشاف الممتع.",
    bullets: ["تصميم آمن بدون زوايا حادة", "حلول تخزين قابلة للتطوير", "لوحة ألوان مبهجة", "مكاتب دراسة تفاعلية"],
    furniture: [
      {
        slug: "kids-bed",
        title: "سرير أطفال ذكي",
        titleEn: "Smart Kids Bed",
        images: ["/images/youth-sofa-1.jpg"],
        description: "سرير مريح وآمن مصمم خصيصًا للأطفال مع حواف دائرية وتخزين تحت السرير.",
        priceRange: "12,000 - 22,000 EGP",
        features: ["خشب آمن", "حواف دائرية", "تخزين مدمج"],
        variations: ["أزرق باستيل", "وردي ناعم", "أبيض خشبي"]
      }
    ]
  },
  {
    slug: "teen-room",
    title: "غرف المراهقين",
    titleEn: "Teen Rooms",
    eyebrow: "شخصية ناشئة",
    eyebrowEn: "Emerging Personality",
    summaryEn: "Design suited for adolescence with dedicated spaces for study, media, and self-expression.",
    outcomeEn: "A modern, flexible room that reflects identity and fosters independent productivity.",
    bulletsEn: ["Ergonomic study zone", "Modular shelving", "Ambient lighting control", "Lounge seating corner"],
    summary: "تصميم يناسب مرحلة النضج مع مساحات مخصصة للدراسة والتعبير الذاتي.",
    outcome: "غرفة مودرن مرنة تعكس الشخصية وتدعم الإنتاجية المستقلة.",
    bullets: ["ركن دراسة مريح وعملي", "أرفف جدارية مرنة", "تحكم بالإضاءة المحيطة", "زاوية جلوس واسترخاء"],
    furniture: [
      {
        slug: "teen-desk-set",
        title: "مجموعة مكتب ودراسة للمراهقين",
        titleEn: "Teen Study Desk Set",
        images: ["/images/office-sofa-1.jpg"],
        description: "مكتب دراسي متكامل بتصميم مودرن مع إدارة كابلات وأرفف متعددة.",
        priceRange: "15,000 - 28,000 EGP",
        features: ["إدارة كابلات", "أرفف قابلة للتعديل", "كرسي مريح"],
        variations: ["رمادي عصري", "أسود مات", "بلوط فاتح"]
      }
    ]
  },
  {
    slug: "corner-sofa",
    title: "الكنب الزاوية",
    titleEn: "Corner Sofas",
    eyebrow: "راحة مطلقة",
    eyebrowEn: "Absolute Comfort",
    summaryEn: "Luxury sectional sofas engineered for spacious relaxation and smart corner optimization.",
    outcomeEn: "Maximized seating capacity with premium ergonomics and contemporary aesthetics.",
    bulletsEn: ["L-shape & U-shape configurations", "Modular extensions", "Stain-resistant upholstery", "Built-in storage compartments"],
    summary: "قطع مفروشات فاخرة تضيف لمسة عصرية ومساحة جلوس واسعة.",
    outcome: "استغلال مثالي للمساحات والزوايا مع راحة استثنائية وأنسجة عالية التدفئة.",
    bullets: ["تشكيلات L وU مرنة", "وحدات قاطعة قابلة للتعديل", "أقمشة مقاومة للبقع", "تخزين مدمج هادئ"],
    furniture: [
      {
        slug: "modular-corner-sofa",
        title: "كنبة زاوية مودولار فاخرة",
        titleEn: "Luxury Modular Corner Sofa",
        images: ["/images/corner-sofa-living-1.jpg"],
        description: "كنبة زاوية قاطعة بتصميم إيطالي راقٍ وأنسجة مخملية ناعمة.",
        priceRange: "38,000 - 65,000 EGP",
        features: ["تعديل مسند الرأس", "أقمشة إيطالية", "هيكل فولاذي"],
        variations: ["رمادي رماد", "بيج رملي", "أخضر زمردي"]
      }
    ]
  },
  {
    slug: "lounge",
    title: "اللاونج",
    titleEn: "Lounges",
    eyebrow: "استرخاء أنيق",
    eyebrowEn: "Elegant Relaxation",
    summaryEn: "A private sanctuary for reading, conversations, and peaceful downtime.",
    outcomeEn: "An intimate, hotel-inspired lounge atmosphere with curated comfort lighting.",
    bulletsEn: ["Accent lounge chairs", "Low ambient coffee tables", "Mood lighting fixtures", "Acoustic plush rugs"],
    summary: "زاوية خاصة للاسترخاء والقراءة بلمسات أنيقة وخامات ناعمة.",
    outcome: "أجواء لاونج فندقية دافئة تشجع على الهدوء والتواصل الراقي.",
    bullets: ["كراسي استرخاء مميزة", "طاولات قهوة منخفضة", "إضاءة مزاجية دافئة", "سجاد مخملي ممتص للصوت"],
    furniture: [
      {
        slug: "lounge-chair-pair",
        title: "ثنائي كراسي اللاونج الملكي",
        titleEn: "Royal Lounge Chair Pair",
        images: ["/images/sofa-master-1.jpg"],
        description: "كراسي لاونج بتصميم مريح وأرجل معدنية مذهبة للاسترخاء التام.",
        priceRange: "20,000 - 35,000 EGP",
        features: ["دعم قطني ممتازة", "جلد طبيعي أو مخمل", "أرجل ذهبية"],
        variations: ["أسود فاخر", "بني جلد", "أوف وايت"]
      }
    ]
  },
  {
    slug: "guest-bedroom",
    title: "غرف نوم الضيوف",
    titleEn: "Guest Bedrooms",
    eyebrow: "ضيافة أنيقة",
    eyebrowEn: "Elegant Hospitality",
    summaryEn: "Welcoming guest bedroom design offering hotel luxury, high privacy, and serene ambiance.",
    outcomeEn: "A memorable guest stay with refined comfort and versatile space usage.",
    bulletsEn: ["Hotel-standard bedding", "Luggage & wardrobe space", "Neutral welcoming colors", "Soft bedside lighting"],
    summary: "راحة فاخرة لضيوفك مع تصميم دافئ يلائم كل الأذواق بأعلى معايير الخصوصية.",
    outcome: "تجربة ضيافة لا تُنسى تجمع بين الرفاهية والهدوء والتنظيم الفندقي.",
    bullets: ["معايير فندقية في المفروشات", "مساحات أمتعة وخزائن مخصصة", "ألوان محايدة مريحة", "إضاءة ليلية دافئة"],
    furniture: [
      {
        slug: "guest-bed-set",
        title: "طقم سرير الضيوف الفندقي",
        titleEn: "Hotel Guest Bed Set",
        images: ["/images/master-bed-1.jpg"],
        description: "سرير ضيوف متين ومريح بخامات فندقية سهلة العناية والتنظيف.",
        priceRange: "18,000 - 32,000 EGP",
        features: ["مرتبة فندقية", "قماش مقاوم", "تصميم محايد"],
        variations: ["بيج فندقي", "رمادي فاتح"]
      }
    ]
  },
  {
    slug: "study-room",
    title: "غرف الدراسة",
    titleEn: "Study Rooms",
    eyebrow: "تركيز وهدوء",
    eyebrowEn: "Focus & Calm",
    summaryEn: "A peaceful environment crafted for reading, deep work, and learning away from household noise.",
    outcomeEn: "Maximum intellectual productivity with sound insulation and ergonomic seating.",
    bulletsEn: ["Acoustic wall treatments", "Built-in library shelves", "Anti-glare task lighting", "Ergonomic study desks"],
    summary: "بيئة مثالية للقراءة والتعلم بعيدًا عن المشتتات والضوضاء اليومية.",
    outcome: "إنتاجية ذهنية عالية بفضل المعالجات الصوتية والإضاءة المريحة للعين.",
    bullets: ["معالجات جدارية ماصة للصوت", "مكتبات جدارية مدمجة", "إضاءة موجهة مانعة للانعكاس", "مكاتب دراسية مريحة"],
    furniture: [
      {
        slug: "library-desk-combo",
        title: "مكتبة ومكتب دراسة مدمج",
        titleEn: "Integrated Study Library & Desk",
        images: ["/images/office-sofa-1.jpg"],
        description: "وحدة دراسة جدارية تضم مكتبًا واسعًا وأرفف كتب مغلقة ومفتوحة.",
        priceRange: "22,000 - 42,000 EGP",
        features: ["أخشاب صلبة", "إضاءة LED للمطبوعات", "خزائن مغلقة"],
        variations: ["جوز داكن", "بلوط طبيعي"]
      }
    ]
  },
  {
    slug: "bathroom",
    title: "الحمامات",
    titleEn: "Bathrooms",
    eyebrow: "رفاهية يومية",
    eyebrowEn: "Daily Luxury",
    summaryEn: "Spa-like luxury bathroom architecture blending premium stone finishes with functional sanitary solutions.",
    outcomeEn: "A tranquil sanctuary for daily rejuvenation with moisture-resistant materials.",
    bulletsEn: ["Marble & porcelain cladding", "Concealed plumbing fixtures", "Anti-fog illuminated mirrors", "Rain shower & freestanding tub design"],
    summary: "تصميم حمامات فاخرة تجمع بين الوظيفة والاسترخاء بأجواء السبا الفندقي.",
    outcome: "ملاذ يومي للانتعاش بخامات عزل ورخام يقاوم الرطوبة وسنوات الاستخدام.",
    bullets: ["تكسيات رخام وبورسلين فاخرة", "خلاطات ومدفونات حديثة", "مرايا مضاءة مانعة للبخار", "شور ورخام حر مستدام"],
    furniture: [
      {
        slug: "bathroom-vanity-unit",
        title: "وحدة حوض ورخام حمام فاخرة",
        titleEn: "Luxury Bathroom Vanity Unit",
        images: ["/images/dressing-sofa-1.jpg"],
        description: "وحدة حوض رخام طبيعي مع أدراج مقاومة للمياه وإضاءة خلفية.",
        priceRange: "25,000 - 48,000 EGP",
        features: ["رخام كلكتا", "خشب مقاوم للمياه", "إضاءة مدمجة"],
        variations: ["رخام أبيض", "رخام أسود مذهّب"]
      }
    ]
  },
  {
    slug: "guest-bathroom",
    title: "حمامات الضيوف",
    titleEn: "Guest Bathrooms",
    eyebrow: "ضيافة مثالية",
    eyebrowEn: "Perfect Hospitality",
    summaryEn: "Sophisticated powder rooms tailored to make a memorable impression on guests.",
    outcomeEn: "Compact elegance featuring statement vanities and ambient background lighting.",
    bulletsEn: ["Statement vanity designs", "Warm ambient accent lighting", "Water-resistant wall panels", "Compact space optimization"],
    summary: "أناقة عملية لحمام الضيوف مع لمسات فاخرة تعكس الذوق الرفيع.",
    outcome: "انطباع مبهر للضيوف في مساحة مدمجة ومصممة بعناية فائقة.",
    bullets: ["وحدات أحواض مميزة", "إضاءة جدارية دافئة", "تكسيات جدارية مقاومة للماء", "استغلال مثالي للمساحات الصغرى"],
    furniture: [
      {
        slug: "powder-room-vanity",
        title: "وحدة حوض مدمجة بتصميم معماري مبتكر لحمامات الضيوف.",
        titleEn: "Elegant Powder Room Vanity",
        images: ["/images/dressing-sofa-1.jpg"],
        description: "وحدة حوض مدمجة بتصميم معماري مبتكر لحمامات الضيوف.",
        priceRange: "16,000 - 30,000 EGP",
        features: ["تصميم نحيف", "رخام فاخر", "خلاط نحاسي"],
        variations: ["أسود مات", "ذهبي فرشي"]
      }
    ]
  },
  {
    slug: "entrance-lobby",
    title: "المداخل",
    titleEn: "Entrances",
    eyebrow: "انطباع أول",
    eyebrowEn: "First Impression",
    summaryEn: "Grand foyers and entrance lobbies designed to set the luxury tone of the residence immediately.",
    outcomeEn: "A majestic first step into your home with statement consoles, lighting, and mirrors.",
    bulletsEn: ["Statement console tables", "Full-height accent mirrors", "Custom flooring inlays", "Chandelier focus points"],
    summary: "مدخل مهيب يعكس أناقة منزلك من أول خطوة بفخامة هندسية مدروسة.",
    outcome: "انطباع أول ساحر يربط بين مدخل المنزل وباقي المساحات بهوية بصري موحدة.",
    bullets: ["طاولات كونسول فاخرة", "مرايا جدارية عملاقة", "تطعيمات أرضيات رخامية", "إضاءة مركزية مهيبة"],
    furniture: [
      {
        slug: "entrance-console-set",
        title: "كونسول مدخل ورخام ملكي",
        titleEn: "Royal Entrance Console & Mirror",
        images: ["/images/living-sofa-1.jpg"],
        description: "طاولة كونسول رخام مع مرآة جدارية عملاقة بتفاصيل برونزية.",
        priceRange: "28,000 - 52,000 EGP",
        features: ["رخام إيطالي", "مرآة برونزية", "هيكل معدني مذهب"],
        variations: ["ذهبي فاخر", "أسود ملكي"]
      }
    ]
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
  titleEn: "About Us",
  story: "نحن متخصصون في تصميم داخلي فاخر يركز على المساحات السكنية. خبرتنا تمتد لسنوات في خلق بيئات تعيش مع العائلة وتنمو مع احتياجاتها. نؤمن بأن التصميم ليس مجرد شكل، بل وظيفة تجعل الحياة أفضل.",
  storyEn: "We specialize in luxury interior design focusing on residential spaces. Our experience spans years of creating environments that live with the family and grow with their needs. We believe design is not just form, but function that makes life better.",
  values: ["جودة تدوم", "تخصيص كامل", "تنفيذ مضمون"],
  valuesEn: ["Lasting Quality", "Full Customization", "Guaranteed Execution"],
  team: "فريق من المهندسين والمصممين ذوي الخبرة العالية.",
  teamEn: "A team of highly experienced engineers and designers."
};

export function getRoomDefinition(slug: string) {
  return roomDefinitions.find((room) => room.slug === slug) ?? null;
}

export function getSeoDefinition(slug: string) {
  return seoDefinitions.find((page) => page.slug === slug) ?? null;
}

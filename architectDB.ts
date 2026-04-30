/**
 * Azenith Architect Database - Elite Engineering Design Tips
 * Azenith Infinite Pulse Protocol v2.0
 * 
 * Contains 5 factual engineering/design tips for each of the 11 room categories.
 * All measurements use metric system (cm, m, Kelvin, lux).
 */

export interface DesignTip {
  id: string;
  category: string;
  title: string;
  content: string;
  technicalSpecs: {
    measurement?: string;
    colorTemp?: string;
    ratio?: string;
    standard?: string;
  };
}

export const architectDB: Record<string, DesignTip[]> = {
  "master-bedroom": [
    {
      id: "mb-001",
      category: "master-bedroom",
      title: "سرير ملكي: الأبعاد الذهبية",
      content: "السرير المزدوج المثالي يحتاج مساحة 160×200 سم كحد أدنى للراحة الفندقية. اترك 90 سم على الأقل من كل جانب للمشي بحرية. المسافة بين السرير والجدار يجب ألا تقل عن 60 سم للتنظيف.",
      technicalSpecs: {
        measurement: "160×200 cm minimum",
        ratio: "60-30-10 (60% منسوجات، 30% خشب، 10% معدن)",
        standard: "ISO 7250 for ergonomic bedroom spacing"
      }
    },
    {
      id: "mb-002",
      category: "master-bedroom",
      title: "إضاءة النوم: درجات الحرارة اللونية",
      content: "استخدم 2700K-3000K للإضاءة العامة (دافئة ومريحة). 4000K للإضاءة الموجهة على منضدة الزينة. تجنب أكثر من 3500K بالقرب من السرير - يؤثر على إنتاج الميلاتونين.",
      technicalSpecs: {
        colorTemp: "2700K-3000K ambient, 4000K task lighting",
        measurement: "150-200 lux general, 400 lux task areas"
      }
    },
    {
      id: "mb-003",
      category: "master-bedroom",
      title: "خزانة الملابس: العمق الأمثل",
      content: "عمق الخزانة القياسي 60 سم (يتسع للمعطف). رفوف القمصان تحتاج 30 سم عمق. ارتفاع الرف للأحذية 15 سم. اترك 120 سم أمام الخزانة للانفتاح الكامل للأبواب.",
      technicalSpecs: {
        measurement: "60 cm depth, 120 cm clearance",
        standard: "CEN EN 14749 wardrobe dimensions"
      }
    },
    {
      id: "mb-004",
      category: "master-bedroom",
      title: "اللون والنفسية: قاعدة 60-30-10",
      content: "60% من اللون الأساسي (الجدران والأرضيات)، 30% لون ثانوي (الأثاث الكبير)، 10% لون مميز (الوسائد والإكسسوارات). للنوم الهادئ: أزرق-رمادي (Pantone 7451C) مع ذهبي.",
      technicalSpecs: {
        ratio: "60% primary, 30% secondary, 10% accent",
        colorTemp: "Pantone 7451C + Gold #C5A059"
      }
    },
    {
      id: "mb-005",
      category: "master-bedroom",
      title: "جودة الهواء والتهوية",
      content: "معدل تبادل الهواء المطلوب: 0.5 تغيير/ساعة للنوم المريح. ارتفاع السقف المثالي: 2.7-3 متر. درجة الحرارة المثالية: 18-20°C. الرطوبة: 40-60%.",
      technicalSpecs: {
        measurement: "2.7-3.0 m ceiling height",
        standard: "ASHRAE 62.1 ventilation standards"
      }
    }
  ],

  "children-room": [
    {
      id: "cr-001",
      category: "children-room",
      title: "أمان الطفل: الارتفاعات الآمنة",
      content: "الأثاث المتحرك يجب تثبيته للجدار (مضاد انقلاب). ارتفاع السرير للطفل 3-6 سنوات: 25-35 سم. مكتب الدراسة: ارتفاع 50-60 سم مع كرسي 30-35 سم.",
      technicalSpecs: {
        measurement: "Bed: 25-35 cm height, Desk: 50-60 cm",
        standard: "EN 747-1 children's furniture safety"
      }
    },
    {
      id: "cr-002",
      category: "children-room",
      title: "النمو مع الوقت: الأثاث القابل للتعديل",
      content: "مكتب قابل للتعديل: نطاق 55-75 سم ارتفاع. كرسي تنظيمي: مسند قابل للحركة. السرير القابل للتمديد: من 140 سم إلى 200 سم. عمر الاستخدام: 5-15 سنة.",
      technicalSpecs: {
        measurement: "Adjustable desk: 55-75 cm range"
      }
    },
    {
      id: "cr-003",
      category: "children-room",
      title: "إضاءة الأطفال: حماية العين",
      content: "تجنب الضوء المباشر في عيون الأطفال. 4000K للدراسة (تركيز). 3000K للأوقات العادية (راحة). مستوى الإضاءة على المكتب: 500 lux كحد أدنى.",
      technicalSpecs: {
        colorTemp: "4000K study, 3000K general",
        measurement: "500 lux desk illumination"
      }
    },
    {
      id: "cr-004",
      category: "children-room",
      title: "ألوان النمو: علم النفس اللوني",
      content: "الأزرق: يهدئ ويساعد على النوم. الأخضر: يعزز التركيز. الأصفر: يحفز الإبداع. تجنب الأحمر المفرط (يزيد النشاط الزائد). نسبة اللون: 70% محايد، 20% لون مفضل، 10% لون مكمل.",
      technicalSpecs: {
        ratio: "70% neutral, 20% preferred, 10% complementary"
      }
    },
    {
      id: "cr-005",
      category: "children-room",
      title: "التنظيم الذكي: مساحات التخزين",
      content: "صناديق الألعاب: 30×30×30 سم (سهلة الحمل للطفل). رفوف الكتب: عمق 20-25 سم. مساحة اللعب الحرة المطلوبة: 2×2 متر على الأقل. ارتفاع الخزانات: لا يتجاوز 120 سم (وصول آمن).",
      technicalSpecs: {
        measurement: "Storage boxes: 30×30×30 cm, Shelves: 20-25 cm depth",
        standard: "Montessori accessibility principles"
      }
    }
  ],

  "teen-room": [
    {
      id: "tr-001",
      category: "teen-room",
      title: "مرحلة النضج: مرونة التصميم",
      content: "المراهق يحتاج 3 مناطق: نوم (سرير 90×200 سم)، دراسة (مكتب 120×60 سم)، استرخاء (كرسي أو أريكة). المسافة بين السرير والمكتب: 150 سم للخصوصية.",
      technicalSpecs: {
        measurement: "Bed: 90×200 cm, Desk: 120×60 cm, Distance: 150 cm"
      }
    },
    {
      id: "tr-002",
      category: "teen-room",
      title: "إضاءة الدراسة: تجنب الإرهاق البصري",
      content: "مصباح المكتب: 40 واط LED مع قاعدة قابلة للتعديل. الارتفاع الأمثل: 40-50 سم فوق سطح المكتب. لا توجيه مباشر للعين. 500-750 lux للقراءة المطولة.",
      technicalSpecs: {
        measurement: "Lamp height: 40-50 cm above desk",
        colorTemp: "4000K-5000K for concentration"
      }
    },
    {
      id: "tr-003",
      category: "teen-room",
      title: "التعبير الذاتي: الجدران القابلة للتغيير",
      content: "استخدم طلاء مغناطيسي أو ألواح cork للصور. لوحة بيضاء قابلة للمسح: 60×90 سم. تجنب التثبيت الدائم - المراهق يتغير كل 2-3 سنوات.",
      technicalSpecs: {
        measurement: "Whiteboard: 60×90 cm minimum"
      }
    },
    {
      id: "tr-004",
      category: "teen-room",
      title: "التقنية والاتصال",
      content: "نقاط كهرباء: 4-6 مخارج على الأقل (أجهزة، شحن، إضاءة). كابل الإيثرنت: Cat6 للألعاب/الدراسة. ارتفاع الشاشة: العين في مستوى العلوي 1/3 من الشاشة.",
      technicalSpecs: {
        measurement: "Monitor: top 1/3 at eye level"
      }
    },
    {
      id: "tr-005",
      category: "teen-room",
      title: "الخصوصية والصوت",
      content: "الباب: عازل صوتي (STC 30 على الأقل). الجدران: إضافة طبقة عزل صوتي إذا مشترك في الحائط. السجاد: يمتص 30% من الصوت.",
      technicalSpecs: {
        standard: "STC 30 sound isolation for doors"
      }
    }
  ],

  "living-room": [
    {
      id: "lr-001",
      category: "living-room",
      title: "التخطيط الاجتماعي: دائرة المحادثة",
      content: "رتب الأرائك على شكل U أو L للحوار. المسافة بين المقاعد: 1.8-2.4 متر (قريب لكن ليس ضاغط). مسافة المشاهدة للتلفاز: 1.5×diagonal الشاشة.",
      technicalSpecs: {
        measurement: "Seating distance: 1.8-2.4 m, TV distance: 1.5×diagonal"
      }
    },
    {
      id: "lr-002",
      category: "living-room",
      title: "إضاءة متدرجة: 3 مستويات",
      content: "إضاءة عامة: 100-150 lux (ثريا أو سبوتات). إضاءة مهمة: 300-400 lux (قراءة). إضاءة مميزة: 50-100 lux (أعمال فنية). استخدم 3000K للدفء.",
      technicalSpecs: {
        colorTemp: "3000K ambient, 4000K task",
        measurement: "Ambient: 100-150 lux, Task: 300-400 lux"
      }
    },
    {
      id: "lr-003",
      category: "living-room",
      title: "السجادة: تحديد المنطقة",
      content: "الأرائك الأمامية: أرجلها الأمامية على السجادة. المسافة من الجدار: 30-45 سم. السجادة الكبيرة (2.4×3 متر) تحدد منطقة الجلوس. الألياف القصيرة: سهلة التنظيف.",
      technicalSpecs: {
        measurement: "Rug: 2.4×3.0 m for standard living room",
        ratio: "60-30-10 rule for color distribution"
      }
    },
    {
      id: "lr-004",
      category: "living-room",
      title: "التلفاز: الموقع والارتفاع",
      content: "مركز الشاشة على مستوى العين (105-120 سم من الأرض). المسافة: 1.5×القطر. لا انعكاس من النوافذ. زاوية المشاهدة المريحة: ±15 درجة.",
      technicalSpecs: {
        measurement: "TV center: 105-120 cm height",
        standard: "SMPTE viewing standards"
      }
    },
    {
      id: "lr-005",
      category: "living-room",
      title: "التدفق والحركة: مسارات واضحة",
      content: "عرض الممر: 90 سم على الأقل للمشي المريح. 60 سم كحد أدنى للمساحات الضيقة. تجنب bottleneck عند المدخل. المسافة بين طاولة القهوة والكنبة: 45 سم.",
      technicalSpecs: {
        measurement: "Pathway: 90 cm, Coffee table gap: 45 cm"
      }
    }
  ],

  "dining-room": [
    {
      id: "dr-001",
      category: "dining-room",
      title: "طاولة الطعام: الأبعاد الإنسانية",
      content: "العرض: 90-105 سم (يترك 20 سم للطبق+15 سم للمكان+10 سم للذراع). الطول: 60 سم لكل شخص. المسافة بين الكرسي والجدار: 90 سم للجلوس بسهولة.",
      technicalSpecs: {
        measurement: "Table width: 90-105 cm, Space per person: 60 cm",
        standard: "Ergonomics for dining spaces"
      }
    },
    {
      id: "dr-002",
      category: "dining-room",
      title: "الإضاءة فوق الطاولة",
      content: "الثريا: ارتفاع 75-90 سم فوق الطاولة. القطر: 2/3 إلى 3/4 عرض الطاولة. 2700K-3000K للجو الدافئ. 300-400 lux على سطح الطاولة.",
      technicalSpecs: {
        measurement: "Chandelier height: 75-90 cm above table",
        colorTemp: "2700K-3000K for warm dining atmosphere"
      }
    },
    {
      id: "dr-003",
      category: "dining-room",
      title: "تخزين الأواني: البوفيه",
      content: "عمق البوفيه: 45-50 سم. ارتفاع الطاولة: 75-90 سم. المسافة من الطاولة: 90-120 سم للحركة. الأدراج: مناسبة للأدوات المتكررة الاستخدام.",
      technicalSpecs: {
        measurement: "Sideboard depth: 45-50 cm, Height: 75-90 cm"
      }
    },
    {
      id: "dr-004",
      category: "dining-room",
      title: "الألوان والشهية: علم اللون",
      content: "الأحمر والبرتقالي: يحفزان الشهية (لكن باعتدال). الأزرق: يقلل الشهية (تجنب). الأخضر: يعطي إحساس بالطازجة. الأرضيات: داكنة لإخفاء البقع.",
      technicalSpecs: {
        ratio: "60% neutral walls, 30% wood furniture, 10% warm accents"
      }
    },
    {
      id: "dr-005",
      category: "dining-room",
      title: "صوت الطعام: التحكم بالضوضاء",
      content: "الجدران الصلبة تعكس الصوت (صدى). أضف نسيج: ستائر، سجاد، وسائد. السقف المعلق (أكوستيك): يمتص 40% من الصوت. تجنب المساحات المكعبة (تردد صوتي سيئ).",
      technicalSpecs: {
        measurement: "Acoustic ceiling absorbs 40% sound",
        standard: "NRC 0.4+ for dining acoustics"
      }
    }
  ],

  "corner-sofa": [
    {
      id: "cs-001",
      category: "corner-sofa",
      title: "الزاوية: قياسات المقعد العميقة",
      content: "عمق المقعد: 60-65 سم للاسترخاء. عرض المقاطع: 80-100 سم لكل قطعة. ارتفاع الظهر: 40-45 سم للدعم. ارتفاع المقعد من الأرض: 45 سم (سهل الاستعمال).",
      technicalSpecs: {
        measurement: "Seat depth: 60-65 cm, Seat height: 45 cm"
      }
    },
    {
      id: "cs-002",
      category: "corner-sofa",
      title: "الأركان: النجارة المتينة",
      content: "الزاوية تحتاج دعم إضافي (أقوى إطار). استخدم زاوية معدنية داخلية. التنجيد: زنبركات الجيب (pocket springs) 8-10 سم عمق. الكثافة: 35-40 kg/m³ للأسفنج.",
      technicalSpecs: {
        standard: "Pocket spring 8-10 cm, Foam density 35-40 kg/m³"
      }
    },
    {
      id: "cs-003",
      category: "corner-sofa",
      title: "تخطيط الغرفة: المساحة المحيطة",
      content: "حجم الكنبة الزاوية: احسب 60 سم إضافية على كل جانب. المسافة من التلفاز: 2.5-3.5 متر للشاشات الكبيرة. مساحة المشي: 90 سم أمام الكنبة.",
      technicalSpecs: {
        measurement: "TV distance: 2.5-3.5 m, Walk space: 90 cm"
      }
    },
    {
      id: "cs-004",
      category: "corner-sofa",
      title: "الأقمشة: المتانة والتنظيف",
      content: "Martindale test: 30,000 دورة على الأقل للمنازل. 100,000+ للاستخدام التجاري. مقاومة البقع: treatment nanotech. الألوان الداكنة: تخفي الاستخدام.",
      technicalSpecs: {
        standard: "Martindale rub test 30,000+ cycles"
      }
    },
    {
      id: "cs-005",
      category: "corner-sofa",
      title: "الإضاءة: القراءة في الزاوية",
      content: "إضاءة القراءة: 400-500 lux. مصباح أرضي: ارتفاع 150-160 سم. زاوية الضوء: 45 درجة لتجنب الوهج. 3000K للدفء.",
      technicalSpecs: {
        measurement: "Floor lamp: 150-160 cm height",
        colorTemp: "3000K for reading comfort"
      }
    }
  ],

  "lounge": [
    {
      id: "ln-001",
      category: "lounge",
      title: "كرسي الاسترخاء: زوايا الجسم",
      content: "زاوية الظهر: 100-110 درجة (ليس 90°). عمق المقعد: 55-60 سمس. مسند القدمين: 15-20 سم ارتفاع. ارتفاع الذراع: 20-25 سم فوق المقعد.",
      technicalSpecs: {
        measurement: "Back angle: 100-110°, Seat depth: 55-60 cm"
      }
    },
    {
      id: "ln-002",
      category: "lounge",
      title: "الزاوية النية: مساحة شخصية",
      content: "المساحة المطلوبة: 1.5×1.5 متر على الأقل. المسافة من الجدار: 30 سم للتنظيف. الطاولة الجانبية: 40×40 سم. ارتفاعها: 60-65 سم (نفس ارتفاع ذراع الكرسي).",
      technicalSpecs: {
        measurement: "Minimum space: 1.5×1.5 m, Side table: 40×40 cm"
      }
    },
    {
      id: "ln-003",
      category: "lounge",
      title: "إضاءة الهدوء: طبقات خافتة",
      content: "الإضاءة العامة: 50-100 lux فقط (استرخاء). مصباح القراءة: 300-400 lux (قابل للتعتيم). تجنب الضوء المباشر في العين. 2700K للجو المسائي.",
      technicalSpecs: {
        colorTemp: "2700K ambient, 3000K task",
        measurement: "Ambient: 50-100 lux, Task: 300-400 lux"
      }
    },
    {
      id: "ln-004",
      category: "lounge",
      title: "الصوت الشخصي: عزل بسيط",
      content: "لوحة خشبية خلف الكرسي: تمنع انتقال الصوت. السجاد: يمتص 30% من الصوت. الستائر الثقيلة: تخفيض echo. لا مكبرات صوت قريبة (احتفظ بالمنطقة هادئة).",
      technicalSpecs: {
        standard: "NRC 0.3+ absorption for lounge area"
      }
    },
    {
      id: "ln-005",
      category: "lounge",
      title: "اللون والاسترخاء: درجات محايدة",
      content: "الأزرق-الرمادي: يقلل ضغط القلب. الأخضر الفاتح: يعطي إحساس بالطبيعة. تجنب الأحمر والبرتقالي (منبهات). 60% محايد، 30% خشب طبيعي، 10% أخضر نباتي.",
      technicalSpecs: {
        ratio: "60% neutral, 30% natural wood, 10% plant green"
      }
    }
  ],

  "dressing-room": [
    {
      id: "dr-001",
      category: "dressing-room",
      title: "المرآة: الأبعاد والإضاءة",
      content: "المرآة الكاملة: 150×50 سم على الأقل. المسافة من المرآة: 90-120 سم للنظر. الإضاءة على جانبي المرآة: 300-500 lux. لا إضاءة من الأعلى فقط (ظلال).",
      technicalSpecs: {
        measurement: "Full mirror: 150×50 cm minimum",
        colorTemp: "4000K-5000K (daylight accurate)"
      }
    },
    {
      id: "dr-002",
      category: "dressing-room",
      title: "الخزانة: التقسيم العمودي",
      content: "القسم العلوي (30%): تخزين موسمي، يتطلب 40 سم عمق. القسم الأوسط (50%): ملابس يومية، 55-60 سم عمق. القسم السفلي (20%): أحذية، 35-40 سم ارتفاع للرفوف.",
      technicalSpecs: {
        measurement: "Top: 40 cm, Middle: 55-60 cm, Bottom: 35-40 cm height"
      }
    },
    {
      id: "dr-003",
      category: "dressing-room",
      title: "الأدراج: التنظيم الداخلي",
      content: "عمق الدرج: 45-50 سم. الارتفاع الداخلي: 15-20 سم (للطي). منظمات الأدراج: فواصل قابلة للتعديل. الأدراج العليا: أقل استخداماً (اكسسوارات).",
      technicalSpecs: {
        measurement: "Drawer internal height: 15-20 cm for folded clothes"
      }
    },
    {
      id: "dr-004",
      category: "dressing-room",
      title: "الإضاءة الداخلية: LED strips",
      content: "LED strips داخل الخزانة: 3000K-4000K. مستشعر حركة: يشتغل عند فتح الباب. السطوع: 200-300 lux داخل الخزانة. البطاريات: قابلة للشحن USB.",
      technicalSpecs: {
        colorTemp: "3000K-4000K interior lighting",
        measurement: "Interior: 200-300 lux"
      }
    },
    {
      id: "dr-005",
      category: "dressing-room",
      title: "الأرضية: الراحة والمظهر",
      content: "سجادة صغيرة: 80×120 سم أمام المرآة. السير barefoot: أرضية دافئة (Engineered wood أو vinyl). تجنب الرخام البارد (صدمة حرارية).",
      technicalSpecs: {
        measurement: "Rug: 80×120 cm in front of mirror"
      }
    }
  ],

  "kitchen": [
    {
      id: "kt-001",
      category: "kitchen",
      title: "مثلث العمل: الكفاءة الحركية",
      content: "البوتاجاز-الثلاجة-الحوض: محيط 3.6-6.6 متر (12-22 قدم). كل ضلع: 1.2-2.7 متر. لا عائق في المثلث (الممرات الحرة 90 سم). مساحة العمل: 105-120 سم ارتفاع.",
      technicalSpecs: {
        measurement: "Work triangle: 3.6-6.6 m perimeter, Counter: 105-120 cm height"
      }
    },
    {
      id: "kt-002",
      category: "kitchen",
      title: "الأسطح: الارتفاع الأمثل",
      content: "الارتفاع القياسي: 90 سم (لشخص 170 سم). المعادلة: (الطول × 0.5) - 10 سم = ارتفاع المنضدة. الجزيرة: ارتفاع موحد مع الباقي. حافة الجزيرة: 30 سم علوية.",
      technicalSpecs: {
        measurement: "Standard: 90 cm, Formula: (height × 0.5) - 10 cm"
      }
    },
    {
      id: "kt-003",
      category: "kitchen",
      title: "التخزين: قواعد الوصول",
      content: "المنطقة الذهبية (90-150 سم): الأدوات المتكررة. المنطقة الفضية (60-90 سم و 150-180 سم): الأدوات الأقل. المنطقة البرونزية (تحت 60 وفوق 180): نادر الاستخدام.",
      technicalSpecs: {
        measurement: "Gold zone: 90-150 cm (frequent access)"
      }
    },
    {
      id: "kt-004",
      category: "kitchen",
      title: "إضاءة العمل: سلامة الغذاء",
      content: "سطح العمل: 500-750 lux (يرى اللون الحقيقي). 4000K-5000K (neutral white). لا ظلال (إضاءة متعددة المصادر). فوق البوتاجاز: 300 lux.",
      technicalSpecs: {
        colorTemp: "4000K-5000K for food preparation",
        measurement: "Work surface: 500-750 lux"
      }
    },
    {
      id: "kt-005",
      category: "kitchen",
      title: "التنظيف: مواد مقاومة",
      content: "الكوارتز: غير مسامي، مقاوم للبقع. الستانلس ستيل: صحي لكن يظهر البصمات. الخزف: متين جداً (Mohs hardness 7). تجنب الرخام الطبيعي (مسامي).",
      technicalSpecs: {
        standard: "Mohs hardness 7+ for durability"
      }
    }
  ],

  "home-office": [
    {
      id: "ho-001",
      category: "home-office",
      title: "المكتب: الأبعاد الإرجونومية",
      content: "العرض: 120-160 سم (مساحة كافية). العمق: 70-80 سم (80 سم للشاشة الكبيرة). الارتفاع: 72-75 سم (قابل للتعديل ممتاز). المسافة تحت: 60 سم للأرجل.",
      technicalSpecs: {
        measurement: "Width: 120-160 cm, Depth: 70-80 cm, Height: 72-75 cm"
      }
    },
    {
      id: "ho-002",
      category: "home-office",
      title: "الكرسي: دعم العمود الفقري",
      content: "ارتفاع المقعد: 42-48 سم. عمق المقعد: 40-50 سم (2-3 أصابع بين الركبة والحافة). دعم أسفل الظهر: منحنى قطني قابل للتعديل. ارتفاع الظهر: 40-50 سم.",
      technicalSpecs: {
        measurement: "Seat height: 42-48 cm, Lumbar support essential"
      }
    },
    {
      id: "ho-003",
      category: "home-office",
      title: "الشاشة: مكافحة الإرهاق",
      content: "المسافة: 50-70 سم من العين. ارتفاع: أعلى الشاشة على مستوى العين أو أقل بقليل. الميل: 10-20 درجة للخلف. لا وهج: مضاد انعكاس.",
      technicalSpecs: {
        measurement: "Distance: 50-70 cm, Top at eye level"
      }
    },
    {
      id: "ho-004",
      category: "home-office",
      title: "الإضاءة: التركيز دون إجهاد",
      content: "سطح المكتب: 500 lux كحد أدنى. 4000K-5000K (تركيز). لا ضوء مباشر على الشاشة. النافذة على الجانب (ليس أمام/خلف). ستارة تلقائية للتحكم.",
      technicalSpecs: {
        colorTemp: "4000K-5000K for productivity",
        measurement: "Desk: 500 lux minimum"
      }
    },
    {
      id: "ho-005",
      category: "home-office",
      title: "الكابلات: التنظيم والسلامة",
      content: "فتحات الكابلات: 5 سم قطر على الأقل. Grommet: بلاستيك لحماية الأسلاك. Channel تحت المكتب: يخفي 80% من الكابلات. Power strip: مع protection.",
      technicalSpecs: {
        measurement: "Cable holes: 5 cm diameter minimum"
      }
    }
  ],

  "interior-design": [
    {
      id: "id-001",
      category: "interior-design",
      title: "اللغة البصرية الموحدة: 3 عناصر",
      content: "اختر: (1) لون أساسي يتكرر في كل غرفة، (2) مادة واحدة تربط المساحات (مثل خشب البلوط)، (3) نمط إضاءة متناسق (3000K أو 4000K). التكرار يخلق انسجاماً.",
      technicalSpecs: {
        ratio: "1 primary color + 1 material + consistent lighting"
      }
    },
    {
      id: "id-002",
      category: "interior-design",
      title: "التدفق المكاني: العلاقات البصرية",
      content: "المسافة البصرية بين الغرف: استخدم فتحات أو زجاج للعمق. أرضيات متصلة (نفس الخشب) تكبر المساحة بصرياً. السقف المستمر: يوحد الطابق.",
      technicalSpecs: {
        measurement: "Continuous flooring expands visual space"
      }
    },
    {
      id: "id-003",
      category: "interior-design",
      title: "قياسات الجسم البشري: Antropometrics",
      content: "عرض الممر المريح: 120 سم (يمر شخصان). 90 سم للشخص الواحد. ارتفاع اليد المرفوعة: 210-220 سم (لا تعليقات). المنظر: 160 سم ارتفاع العين.",
      technicalSpecs: {
        measurement: "Hallway: 120 cm dual, 90 cm single, Eye level: 160 cm"
      }
    },
    {
      id: "id-004",
      category: "interior-design",
      title: "النسبة الذهبية: 1:1.618",
      content: "نسبة ممتازة للأبعاد: ارتفاع الغرفة = العرض × 1.618. الكنبة: الطول = العمق × 1.618. الأعمال الفنية: ضعها على ارتفاع 160 سم (مركزها).",
      technicalSpecs: {
        ratio: "1:1.618 golden ratio for proportions"
      }
    },
    {
      id: "id-005",
      category: "interior-design",
      title: "الاستدامة: المسؤولية البيئية",
      content: "VOC منخفض (<50 g/L) للطلاء. FSC للخشب (استدامة). طاقة الإضاءة: LED 4-7 واط/شمعة. العزل الحراري: R-value 30+ للسقف.",
      technicalSpecs: {
        standard: "VOC <50 g/L, FSC certified wood, LED 4-7W/lumen"
      }
    }
  ]
};

// Helper function to get random tip for a category
export function getRandomDesignTip(category: string): DesignTip | null {
  const tips = architectDB[category];
  if (!tips || tips.length === 0) return null;
  return tips[Math.floor(Math.random() * tips.length)];
}

// Helper function to get all tips for a category
export function getDesignTipsByCategory(category: string): DesignTip[] {
  return architectDB[category] || [];
}

// Helper function to get tip by ID
export function getDesignTipById(id: string): DesignTip | undefined {
  for (const category in architectDB) {
    const tip = architectDB[category].find(t => t.id === id);
    if (tip) return tip;
  }
  return undefined;
}

export default architectDB;

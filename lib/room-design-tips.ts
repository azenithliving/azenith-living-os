// Room Design Tips - معلومات تصميم الغرف
// Tips for each room type and style combination

export interface RoomDesignTip {
  id: string;
  title: string;
  titleEn?: string;
  content: string;
  contentEn?: string;
  category: "furniture" | "lighting" | "colors" | "layout" | "materials";
}

// Tips organized by room type and style
export const ROOM_DESIGN_TIPS: Record<string, Record<string, RoomDesignTip[]>> = {
  // غرف المعيشة - Living Room
  "living-room": {
    modern: [
      {
        id: "living-modern-1",
        title: "أبعاد الأريكة المثالية",
        titleEn: "Ideal Sofa Dimensions",
        content: "الأبعاد المثالية لأريكة مودرن: الطول بين 180 و240 سم، والعمق 90-100 سم. اختار كنبة بأرجل مكشوفة لتبدو الغرفة أكثر اتساعًا.",
        contentEn: "The ideal dimensions for a modern sofa: Length between 180 and 240 cm, and depth 90-100 cm. Choose a sofa with exposed legs to make the room look more spacious.",
        category: "furniture"
      },
      {
        id: "living-modern-2",
        title: "توزيع الإضاءة الطبيعية",
        titleEn: "Natural Light Distribution",
        content: "في التصميم المودرن، يُفضل استخدام ستائر شفافة أو شيدات خشبية تسمح بدخول الضوء الطبيعي بنسبة 70% على الأقل.",
        contentEn: "In modern design, it is preferable to use sheer curtains or wooden shades that allow at least 70% of natural light to enter.",
        category: "lighting"
      },
      {
        id: "living-modern-3",
        title: "قاعدة الألوان المحايدة",
        titleEn: "The Neutral Colors Rule",
        content: "اتبع قاعدة 60-30-10: 60% لون أساسي محايد (أبيض/بيج)، 30% لون ثانوي، و10% لون مميز للإكسسوارات.",
        contentEn: "Follow the 60-30-10 rule: 60% neutral primary color (white/beige), 30% secondary color, and 10% distinct color for accessories.",
        category: "colors"
      }
    ],
    classic: [
      {
        id: "living-classic-1",
        title: "ارتفاع السقف والثريات",
        titleEn: "Ceiling height and chandeliers",
        content: "في التصميم الكلاسيكي، يجب أن يكون ارتفاع الثريا 75-90 سم عن طاولة القهوة. للسقف المرتفع (3م+) استخدم ثريات متعددة الطبقات.",
        contentEn: "In the classic design, the height of the chandelier should be 75-90 cm above the coffee table. For high ceilings (3m+) use multi-layer chandeliers.",
        category: "lighting"
      },
      {
        id: "living-classic-2",
        title: "الأقمشة الفاخرة",
        titleEn: "Luxurious fabrics",
        content: "اختار أقمشة مخملية أو حريرية للستائر والمخدات. الألوان الدافئة مثل الذهبي والبني تضفي طابعًا كلاسيكيًا أنيقًا.",
        contentEn: "Choose velvet or silk fabrics for curtains and pillows. Warm colors like gold and brown create a classic, elegant feel.",
        category: "materials"
      },
      {
        id: "living-classic-3",
        title: "توازن الأثاث",
        titleEn: "Furniture balance",
        content: "وزع الأثاث بشكل متناظر حول نقطة التركيز (المدفأة أو التلفاز). المسافة بين الكنبة والطاولة الأمامية: 45-50 سم.",
        contentEn: "Distribute the furniture symmetrically around the focal point (fireplace or TV). Distance between sofa and front table: 45-50 cm.",
        category: "layout"
      }
    ],
    industrial: [
      {
        id: "living-industrial-1",
        title: "الخامات الصناعية",
        titleEn: "Industrial raw materials",
        content: "امزج بين الخشب الخام (خشب السقف المكشوف) والمعدن (أنابيب الإضاءة). نسبة 60% خشب و40% معدن تعطي توازنًا مثاليًا.",
        contentEn: "Mix raw wood (exposed ceiling wood) and metal (light tubes). The ratio of 60% wood and 40% metal gives a perfect balance.",
        category: "materials"
      },
      {
        id: "living-industrial-2",
        title: "الإضاءة الصناعية",
        titleEn: "Industrial lighting",
        content: "استخدم لمبات إديسون مع قلابات معدنية ظاهرة. ارتفاع الإضاءة المعلقة: 2.1-2.4 متر عن الأرض.",
        contentEn: "Use Edison bulbs with visible metal flaps. Hanging lighting height: 2.1-2.4 meters from the ground.",
        category: "lighting"
      },
      {
        id: "living-industrial-3",
        title: "الجدران الطوبية",
        titleEn: "Brick walls",
        content: "جدار طوبي واحد كـ Accent Wall يكفي. يمكن دهانه بالشمع الشفاف لتقليل الغبار مع الحفاظ على المظهر الخام.",
        contentEn: "One brick wall such as Accent Wall is enough. Can be coated with clear wax to reduce dust while maintaining a raw look.",
        category: "materials"
      }
    ],
    scandinavian: [
      {
        id: "living-scandi-1",
        title: "الألوان الفاتحة",
        titleEn: "Light colours",
        content: "استخدم ألوانًا محايدة 80% (أبيض/رمادي فاتح/بيج) مع لمسات من الخشب الفاتح والنباتات الخضراء.",
        contentEn: "Use 80% neutral colors (white/light grey/beige) with accents of light wood and green plants.",
        category: "colors"
      },
      {
        id: "living-scandi-2",
        title: "إضاءة هايغ",
        titleEn: "High lighting",
        content: "الإضاءة الدافئة (2700-3000K) أساسية. استخدم مصابيح أرضية بتصميم بسيط وستائر خفيفة تسمح بالضوء.",
        contentEn: "Warm lighting (2700-3000K) is essential. Use floor lamps with a simple design and light curtains that let in the light.",
        category: "lighting"
      },
      {
        id: "living-scandi-3",
        title: "الأثاث متعدد الوظائف",
        titleEn: "Multifunctional furniture",
        content: "اختار قطع أثاث بسيطة وعملية. طاولة قهوة بمساحة تخزين، أو مقاعد قابلة للطي. مبدأ: كل قطعة لها هدف.",
        contentEn: "Choose simple and practical pieces of furniture. A coffee table with storage space, or foldable chairs. Principle: Every piece has a purpose.",
        category: "furniture"
      }
    ]
  },

  // غرف النوم الرئيسية - Master Bedroom
  "master-bedroom": {
    modern: [
      {
        id: "bedroom-modern-1",
        title: "ارتفاع السرير",
        titleEn: "Bed height",
        content: "الارتفاع المثالي للسرير: 45-60 سم من الأرض (بما فيها المرتبة). السرير المنخفض يعطي مظهرًا مودرن أنيقًا.",
        contentEn: "Ideal bed height: 45-60 cm from the floor (including mattress). The low bed gives a stylish, modern look.",
        category: "furniture"
      },
      {
        id: "bedroom-modern-2",
        title: "جانبي السرير المتناظر",
        titleEn: "Symmetrical sides of the bed",
        content: "ضع طاولات جانبية متطابقة على طرفي السرير. ارتفاعها يجب أن يكون مساويًا أو أقل بـ 5 سم من ارتفاع المرتبة.",
        contentEn: "Place matching side tables on either end of the bed. Its height should be equal to or 5 cm less than the height of the mattress.",
        category: "layout"
      },
      {
        id: "bedroom-modern-3",
        title: "إضاءة مخفية",
        titleEn: "Hidden lighting",
        content: "استخدم إضاءة LED مخفية خلف التسريحة أو أسفل السرير. الإضاءة الدافئة (2700K) مثالية لغرف النوم.",
        contentEn: "Use hidden LED lighting behind the dresser or under the bed. Warm lighting (2700K) is ideal for bedrooms.",
        category: "lighting"
      }
    ],
    classic: [
      {
        id: "bedroom-classic-1",
        title: "رأس السرير الفاخر",
        titleEn: "Luxury bed head",
        content: "رأس سرير مبطن بارتفاع 120-150 سم يضفي فخامة كلاسيكية. اختار أقمشة مخملية بألوان غامقة.",
        contentEn: "A quilted headboard with a height of 120-150 cm adds classic luxury. Choose velvet fabrics in dark colors.",
        category: "furniture"
      },
      {
        id: "bedroom-classic-2",
        title: "الثريات والبرادي",
        titleEn: "Chandeliers and curtains",
        content: "ثريا كلاسيكية مركزية مع برادي جانبية للقراءة. البراني يجب أن تكون بارتفاع 1.5-1.7 متر عن الأرض.",
        contentEn: "Central classic chandelier with side curtains for reading. The barani should be 1.5-1.7 meters high from the ground.",
        category: "lighting"
      },
      {
        id: "bedroom-classic-3",
        title: "السجاد الفاخر",
        titleEn: "Luxury carpets",
        content: "سجادة بحجم يتجاوز السرير بـ 60 سم على كل جانب. الألوان الغامقة تضفي دفئًا وأناقة كلاسيكية.",
        contentEn: "Carpet sized to exceed the bed by 60 cm on each side. Dark colors add warmth and classic elegance.",
        category: "materials"
      }
    ],
    industrial: [
      {
        id: "bedroom-industrial-1",
        title: "الهيكل المعدني",
        titleEn: "Metal structure",
        content: "سرير بهيكل معدني أو خشب خام غير مصبوغ. أمزج مع طاولات جانبية من الخشب المستصلح.",
        contentEn: "Bed with metal frame or unpainted raw wood. Mix it up with reclaimed wood side tables.",
        category: "furniture"
      },
      {
        id: "bedroom-industrial-2",
        title: "الإضاءة المعلقة",
        titleEn: "Pendant lighting",
        content: "استخدم قلابات معدنية معلقة على جانبي السرير. ارتفاع 1.8-2 متر عن الأرض لإضاءة مثالية للقراءة.",
        contentEn: "Use metal flaps hanging on either side of the bed. 1.8-2 meters high from the ground for ideal reading lighting.",
        category: "lighting"
      },
      {
        id: "bedroom-industrial-3",
        title: "الخزائن المفتوحة",
        titleEn: "Open cabinets",
        content: "خزائن مفتوحة بدون أبواب تعرض الملابس بشكل منظم. استخدم علب قماشية أو معدنية للتنظيم.",
        contentEn: "Open cabinets without doors display clothes in an organized manner. Use fabric or metal bins for organization.",
        category: "layout"
      }
    ],
    scandinavian: [
      {
        id: "bedroom-scandi-1",
        title: "الخشب الفاتح والأبيض",
        titleEn: "Light wood and white",
        content: "امزج بين الخشب الفاتح (البلوط/البتولا) والأبيض النقي. نسبة 50/50 تعطي توازنًا هادئًا.",
        contentEn: "Mix light wood (oak/birch) with pure white. A 50/50 ratio gives a calm balance.",
        category: "colors"
      },
      {
        id: "bedroom-scandi-2",
        title: "الإضاءة الطبيعية",
        titleEn: "Natural lighting",
        content: "احتفظ بالنوافذ كبيرة وغير مغطاة قدر الإمكان. استخدم ستائر شفافة بيضاء للخصوصية مع الحفاظ على الضوء.",
        contentEn: "Keep windows as large and uncovered as possible. Use white sheer curtains for privacy while keeping out light.",
        category: "lighting"
      },
      {
        id: "bedroom-scandi-3",
        title: "النباتات والنسيج",
        titleEn: "Plants and fabric",
        content: "أضف نباتات خضراء (3-5 نباتات) وأغطية سرير من القطن الطبيعي. البساطة هي المفتاح.",
        contentEn: "Add green plants (3-5 plants) and natural cotton bed covers. Simplicity is key.",
        category: "materials"
      }
    ]
  },

  // المطابخ - Kitchen
  "kitchen": {
    modern: [
      {
        id: "kitchen-modern-1",
        title: "مثلث العمل",
        titleEn: "Action triangle",
        content: "ارتبط الثلاجة والموقد والحوض بمثلث عمل. المسافة بينهم: 1.2-2.7 متر لكل ضلع للكفاءة القصوى.",
        contentEn: "The refrigerator, stove and sink are connected by a working triangle. Distance between them: 1.2-2.7 meters per side for maximum efficiency.",
        category: "layout"
      },
      {
        id: "kitchen-modern-2",
        title: "أسطح العمل",
        titleEn: "Work surfaces",
        content: "اختر أسطح كوارتز أو رخام للمطبخ المودرن. ارتفاع سطح العمل المثالي: 85-95 سم حسب طولك.",
        contentEn: "Choose quartz or marble countertops for a modern kitchen. Ideal worktop height: 85-95 cm depending on your height.",
        category: "materials"
      },
      {
        id: "kitchen-modern-3",
        title: "إضاءة المهام",
        titleEn: "Task lighting",
        content: "إضاءة LED مخفية تحت الخزائن العلوية للإضاءة المباشرة على سطح العمل. درجة حرارة 4000K للوضوح.",
        contentEn: "LED lighting is hidden under the upper cabinets for direct illumination on the work surface. 4000K temperature for clarity.",
        category: "lighting"
      }
    ],
    classic: [
      {
        id: "kitchen-classic-1",
        title: "الخزائن الخشبية",
        titleEn: "Wooden cabinets",
        content: "خزائن من خشب الكرز أو البلوط بأبواب نقشية. المقابض النحاسية تضفي لمسة كلاسيكية فاخرة.",
        contentEn: "Cherry or oak cabinets with carved doors. The brass handles add a classic, luxurious touch.",
        category: "furniture"
      },
      {
        id: "kitchen-classic-2",
        title: "الأرضيات الرخامية",
        titleEn: "Marble floors",
        content: "أرضيات رخام أو سيراميك بتصميم كلاسيكي. الألوان الفاتحة توسع المساحة وتعكس الضوء.",
        contentEn: "Marble or ceramic flooring in a classic design. Light colors expand the space and reflect light.",
        category: "materials"
      },
      {
        id: "kitchen-classic-3",
        title: "الإضاءة الدافئة",
        titleEn: "Warm lighting",
        content: "ثريا مركزية فوق جزيرة الطبخ أو طاولة الطعام. إضاءة دافئة (2700-3000K) للجو العائلي.",
        contentEn: "A central chandelier above your cooking island or dining table. Warm light (2700-3000K) for family atmosphere.",
        category: "lighting"
      }
    ],
    industrial: [
      {
        id: "kitchen-industrial-1",
        title: "أسطح الستانلس ستيل",
        titleEn: "Stainless steel surfaces",
        content: "أسطح عمل من الستانلس ستيل أو الخرسانة المصقولة. سهلة التنظيف ومقاومة للحرارة والبقع.",
        contentEn: "Stainless steel or polished concrete worktops. Easy to clean and resistant to heat and stains.",
        category: "materials"
      },
      {
        id: "kitchen-industrial-2",
        title: "الأرفف المفتوحة",
        titleEn: "Open shelves",
        content: "استبدل بعض الخزائن بأرفف معدنية مفتوحة لعرض الأطباق والأواني. مظهر عصري وعملي.",
        contentEn: "Replace some cabinets with open metal shelves to display dishes and utensils. Fashionable and practical look.",
        category: "layout"
      },
      {
        id: "kitchen-industrial-3",
        title: "إضاءة المستودع",
        titleEn: "Warehouse lighting",
        content: "استخدم مصابيح معلقة صناعية بتصميم معدني. الارتفاع: 80-100 سم فوق جزيرة الطبخ.",
        contentEn: "Use industrial pendant lights with a metal design. Height: 80-100 cm above the cooking island.",
        category: "lighting"
      }
    ],
    scandinavian: [
      {
        id: "kitchen-scandi-1",
        title: "الأبيض والخشب الفاتح",
        titleEn: "White and light wood",
        content: "خزائن بيضاء مع أرضيات خشب فاتح. نسبة 70% أبيض و30% خشب تعطي مظهرًا نظيفًا ودافئًا.",
        contentEn: "White cabinets with light wood floors. 70% white and 30% wood gives a clean, warm look.",
        category: "colors"
      },
      {
        id: "kitchen-scandi-2",
        title: "التخزين الذكي",
        titleEn: "Smart storage",
        content: "استخدم حاويات زجاجية وسلال قش للتخزين المفتوح. التنظيم المرئي جزء أساسي من التصميم الاسكندنافي.",
        contentEn: "Use glass containers and straw baskets for open storage. Visual organization is an essential part of Scandinavian design.",
        category: "layout"
      },
      {
        id: "kitchen-scandi-3",
        title: "إضاءة هادئة",
        titleEn: "Soft lighting",
        content: "إضاءة طبيعية قدر الإمكان. مصابيح بسيطة معلقة فوق منطقة الطعام بارتفاع 75 سم عن الطاولة.",
        contentEn: "Natural lighting as much as possible. Simple lamps hung above the dining area at a height of 75 cm from the table.",
        category: "lighting"
      }
    ]
  },

  // غرف الطعام - Dining Room
  "dining-room": {
    modern: [
      {
        id: "dining-modern-1",
        title: "الطاولة والكراسي",
        titleEn: "Table and chairs",
        content: "مسافة 60 سم بين الكرسي والجدار للراحة. طاولة بسطح زجاجي أو خشبي ناعم بأرجل معدنية رفيعة.",
        contentEn: "60 cm distance between the chair and the wall for comfort. A table with a glass or smooth wooden top with thin metal legs.",
        category: "furniture"
      },
      {
        id: "dining-modern-2",
        title: "الإضاءة المركزية",
        titleEn: "Central lighting",
        content: "ثريا أو مصابيح معلقة فوق مركز الطاولة. الارتفاع: 75-90 سم عن سطح الطاولة.",
        contentEn: "A chandelier or hanging lamps above the center of the table. Height: 75-90 cm from the table top.",
        category: "lighting"
      },
      {
        id: "dining-modern-3",
        title: "الألوان المحايدة",
        titleEn: "Neutral colors",
        content: "استخدم ألوانًا محايدة مع لمسة واحدة جريئة. طاولة خشب طبيعي مع كراسي سوداء أو بيضاء.",
        contentEn: "Use neutral colors with one bold touch. Natural wood table with black or white chairs.",
        category: "colors"
      }
    ],
    classic: [
      {
        id: "dining-classic-1",
        title: "طاولة الطعام الكبيرة",
        titleEn: "Large dining table",
        content: "طاولة خشبية ثقيلة بسطح رخامي أو خشب صلب. تتسع لـ 6-8 أشخاص للولائم العائلية.",
        contentEn: "Heavy wooden table with marble or solid wood top. It can accommodate 6-8 people for family banquets.",
        category: "furniture"
      },
      {
        id: "dining-classic-2",
        title: "الثريات الكريستال",
        titleEn: "Crystal chandeliers",
        content: "ثريا كريستال فخمة فوق طاولة الطعام. ارتفاع 90-110 سم عن الطاولة للإضاءة المثالية.",
        contentEn: "A luxurious crystal chandelier above the dining table. 90-110 cm height from the table for optimal lighting.",
        category: "lighting"
      },
      {
        id: "dining-classic-3",
        title: "الستائر الثقيلة",
        titleEn: "Heavy curtains",
        content: "ستائر مخملية ثقيلة تصل للأرض. الألوان الغامقة مثل الأحمر البني أو الذهبي تضفي فخامة.",
        contentEn: "Heavy velvet curtains reach the floor. Dark colors such as red-brown or gold add luxury.",
        category: "materials"
      }
    ],
    industrial: [
      {
        id: "dining-industrial-1",
        title: "طاولة خشب و معدن",
        titleEn: "Wood and metal table",
        content: "طاولة بسطح خشب خام (مستصلح) وهيكل معدني. كراسي معدنية أو جلدية لمظهر صناعي.",
        contentEn: "Table with raw (reclaimed) wood top and metal frame. Metal or leather chairs for an industrial look.",
        category: "furniture"
      },
      {
        id: "dining-industrial-2",
        title: "الإضاءة الصناعية",
        titleEn: "Industrial lighting",
        content: "3-5 مصابيح معلقة بتصميم صناعي فوق الطاولة. لمبات إديسون للإضاءة الدافئة.",
        contentEn: "3-5 industrial design pendant lamps above the table. Edison bulbs for warm lighting.",
        category: "lighting"
      },
      {
        id: "dining-industrial-3",
        title: "الأرضيات الخرسانية",
        titleEn: "Concrete floors",
        content: "أرضية خرسانية مصقولة أو باركيه داكن. السجاد الجلدي يضيف لمسة دفء للمساحة.",
        contentEn: "Polished concrete floor or dark parquet. Leather rugs add a touch of warmth to the space.",
        category: "materials"
      }
    ],
    scandinavian: [
      {
        id: "dining-scandi-1",
        title: "طاولة خشب فاتح",
        titleEn: "Light wood table",
        content: "طاولة بيضاوية أو مستطيلة من خشب البلوك الفاتح. كراسي بسيطة بظهر منحني للراحة.",
        contentEn: "Oval or rectangular table made of light block wood. Simple chairs with curved backs for comfort.",
        category: "furniture"
      },
      {
        id: "dining-scandi-2",
        title: "إضاءة ناعمة",
        titleEn: "Soft lighting",
        content: "مصباح معلق بقبة خشبية أو زجاجية أبيض. ارتفاع 70-80 سم عن الطاولة لإضاءة دافئة.",
        contentEn: "White wooden or glass dome pendant lamp. 70-80cm height from the table for warm lighting.",
        category: "lighting"
      },
      {
        id: "dining-scandi-3",
        title: "النباتات كديكور",
        titleEn: "Plants as decor",
        content: "أضف 2-3 نباتات خضراء على الطاولة أو الرفوف. الأواني البيضاء أو الخزفية تكمل المظهر.",
        contentEn: "Add 2-3 green plants on the table or shelves. White or ceramic pots complete the look.",
        category: "colors"
      }
    ]
  },

  // المكاتب المنزلية - Home Office
  "home-office": {
    modern: [
      {
        id: "office-modern-1",
        title: "المكتب الوظيفي",
        titleEn: "Functional office",
        content: "مكتب بسطح 140×70 سم على الأقل. ارتفاع 73-76 سم مع كرسي قابل للتعديل (ارتفاع المقعد 42-50 سم).",
        contentEn: "A desk with a surface of at least 140 x 70 cm. Height 73-76 cm with adjustable chair (seat height 42-50 cm).",
        category: "furniture"
      },
      {
        id: "office-modern-2",
        title: "إضاءة المهام",
        titleEn: "Task lighting",
        content: "مصباح مكتب LED بإضاءة بيضاء (4000-5000K). ضعه على الجانب الأيسر إذا كنت أيمن لتقليل الظل.",
        contentEn: "White LED desk lamp (4000-5000K). Place it on the left side if you are right-handed to reduce shadow.",
        category: "lighting"
      },
      {
        id: "office-modern-3",
        title: "التنظيم الرقمي",
        titleEn: "Digital regulation",
        content: "استخدم حامل شاشة معدني أنيق ومنظمات كابلات مخفية. مبدأ: لا كابلات ظاهرة على المكتب.",
        contentEn: "Use a stylish metal monitor stand and hidden cable organizers. Principle: No visible cables on the desk.",
        category: "layout"
      }
    ],
    classic: [
      {
        id: "office-classic-1",
        title: "المكتب التنفيذي",
        titleEn: "Executive Office",
        content: "مكتب خشبي ثقيل بأدراج جانبية. خشب البلوط أو الجوز الداكن للحضور المهني.",
        contentEn: "Heavy wooden desk with side drawers. Dark oak or walnut for a professional presence.",
        category: "furniture"
      },
      {
        id: "office-classic-2",
        title: "الكرسي الجلدي",
        titleEn: "Leather chair",
        content: "كرسي مكتب جلدي بتصميم كلاسيكي. عالي الظهر (110-120 سم) للدعم الكامل.",
        contentEn: "Classic design leather office chair. High back (110-120cm) for full support.",
        category: "furniture"
      },
      {
        id: "office-classic-3",
        title: "الإضاءة الدافئة",
        titleEn: "Warm lighting",
        content: "براني مكتب كلاسيكية مع ثريا صغيرة. إضاءة دافئة (2700-3000K) للتركيز المريح.",
        contentEn: "Classic desk stands with small chandelier. Warm light (2700-3000K) for comfortable focusing.",
        category: "lighting"
      }
    ],
    industrial: [
      {
        id: "office-industrial-1",
        title: "المكتب المعدني",
        titleEn: "Metal desk",
        content: "مكتب بهيكل معدني وسطح خشب صلب. أرفف مفتوحة من الأنابيب المعدنية والخشب.",
        contentEn: "Desk with metal frame and solid wood top. Open shelves made of metal pipes and wood.",
        category: "furniture"
      },
      {
        id: "office-industrial-2",
        title: "الإضاءة المعلقة",
        titleEn: "Pendant lighting",
        content: "مصباح مكتب معلق بتصميم صناعي. أو مصابيح أرضية معدنية للإضاءة الموجهة.",
        contentEn: "Industrial design pendant desk lamp. Or metal floor lamps for directed lighting.",
        category: "lighting"
      },
      {
        id: "office-industrial-3",
        title: "الجدران الخرسانية",
        titleEn: "Concrete walls",
        content: "جدار خرساني أو طوبي ظاهر كخلفية للمكتب. يضيف شخصية قوية للمساحة.",
        contentEn: "Visible concrete or brick wall as the background of the office. Adds strong character to the space.",
        category: "materials"
      }
    ],
    scandinavian: [
      {
        id: "office-scandi-1",
        title: "المكتب البسيط",
        titleEn: "Simple office",
        content: "مكتب أبيض أو خشب فاتح بخطوط نظيفة. بدون أدراج ظاهرة - استخدم تخزينًا منفصلًا.",
        contentEn: "A white or light wood desk with clean lines. No visible drawers - use separate storage.",
        category: "furniture"
      },
      {
        id: "office-scandi-2",
        title: "الضوء الطبيعي",
        titleEn: "Natural light",
        content: "ضع المكتب بجانب النافذة مباشرة للاستفادة من الضوء الطبيعي. ستائر شفافة للتحكم بالإضاءة.",
        contentEn: "Place the desk directly next to a window to take advantage of natural light. Transparent curtains to control lighting.",
        category: "lighting"
      },
      {
        id: "office-scandi-3",
        title: "النباتات للتركيز",
        titleEn: "Plants for concentration",
        content: "3-4 نباتات خضراء في المكتب تحسن جودة الهواء والتركيز. أواني بيضاء أو طينية بسيطة.",
        contentEn: "3-4 green plants in the office improve air quality and concentration. Simple white or clay pots.",
        category: "colors"
      }
    ]
  },

  // غرف الملابس - Dressing Room
  "dressing-room": {
    modern: [
      {
        id: "dressing-modern-1",
        title: "الخزائن المخفية",
        titleEn: "Hidden safes",
        content: "أبواب خزانة منزلقة بمرايا للتوسيع البصري. ارتفاع الرفوف: 30 سم للقمصان، 45 سم للكنزات.",
        contentEn: "Sliding wardrobe doors with mirrors for visual expansion. Shelves height: 30 cm for shirts, 45 cm for sweaters.",
        category: "furniture"
      },
      {
        id: "dressing-modern-2",
        title: "إضاءة LED",
        titleEn: "LED lighting",
        content: "إضاءة LED داخل الخزائن وعلى جانبي المرايا. إضاءة بيضاء (4000K) للألوان الحقيقية.",
        contentEn: "LED lighting inside the cabinets and on both sides of the mirrors. White lighting (4000K) for true colors.",
        category: "lighting"
      },
      {
        id: "dressing-modern-3",
        title: "الأدراج المنظمة",
        titleEn: "Organized drawers",
        content: "أدراج داخلية بفواصل للإكسسوارات. 60 سم عرض للأدراج العميقة، 40 سم للضحلة.",
        contentEn: "Interior drawers with dividers for accessories. 60 cm wide for deep drawers, 40 cm wide for shallow ones.",
        category: "layout"
      }
    ],
    classic: [
      {
        id: "dressing-classic-1",
        title: "الخزائن الملكية",
        titleEn: "Royal vaults",
        content: "خزائن خشبية ثقيلة بأبواب نقشية. مرايا مزخرفة بإطار ذهبي أو فضي.",
        contentEn: "Heavy wooden cabinets with carved doors. Decorative mirrors with gold or silver frame.",
        category: "furniture"
      },
      {
        id: "dressing-classic-2",
        title: "الإضاءة الفاخرة",
        titleEn: "Luxurious lighting",
        content: "ثريا صغيرة أو مصابيح جدارية كلاسيكية. إضاءة دافئة (2700K) للجو الأنيق.",
        contentEn: "Small chandelier or classic wall lamps. Warm lighting (2700K) for elegant atmosphere.",
        category: "lighting"
      },
      {
        id: "dressing-classic-3",
        title: "السجاد الفاخر",
        titleEn: "Luxury carpets",
        content: "سجادة صغيرة ناعمة في وسط الغرفة. الألوان الغامقة والأنماط الكلاسيكية تضفي فخامة.",
        contentEn: "A small soft rug in the center of the room. Bold colors and classic patterns add luxury.",
        category: "materials"
      }
    ],
    industrial: [
      {
        id: "dressing-industrial-1",
        title: "العرض المفتوح",
        titleEn: "Open offer",
        content: "أنظمة تعليق مفتوحة من الأنابيب المعدنية والخشب. عرض الملابس كمتجر عصري.",
        contentEn: "Open suspension systems of metal pipes and wood. Display clothing as a trendy store.",
        category: "layout"
      },
      {
        id: "dressing-industrial-2",
        title: "الإضاءة المعلقة",
        titleEn: "Pendant lighting",
        content: "مصابيح سقفية صناعية أو مصابيح أرضية معدنية. لمبات إديسون للإضاءة الدافئة.",
        contentEn: "Industrial ceiling lamps or metal floor lamps. Edison bulbs for warm lighting.",
        category: "lighting"
      },
      {
        id: "dressing-industrial-3",
        title: "المرايا الكبيرة",
        titleEn: "Large mirrors",
        content: "مرايا كاملة الجسم بإطار معدني. يمكن أن تكون على عجل للحركة السهلة.",
        contentEn: "Full body mirrors with metal frame. Can be wheeled for easy movement.",
        category: "furniture"
      }
    ],
    scandinavian: [
      {
        id: "dressing-scandi-1",
        title: "الخزائن البيضاء",
        titleEn: "White cabinets",
        content: "خزائن بيضاء مع أرفف خشب فاتح. بساطة ونظام في التنظيم المرئي.",
        contentEn: "White cabinets with light wood shelves. Simplicity and order in visual organization.",
        category: "furniture"
      },
      {
        id: "dressing-scandi-2",
        title: "الإضاءة الطبيعية",
        titleEn: "Natural lighting",
        content: "نافذة كبيرة إن أمكن، أو إضاءة LED بيضاء نقية. مرايا تعكس الضوء الطبيعي.",
        contentEn: "A large window if possible, or pure white LED lighting. Mirrors reflect natural light.",
        category: "lighting"
      },
      {
        id: "dressing-scandi-3",
        title: "التنظيم المرئي",
        titleEn: "Visual organization",
        content: "علب وسلال قش للتنظيم. الملابس مرتبة باللون لمنظر جمالي وعملي.",
        contentEn: "Straw cans and baskets for organization. The clothes are arranged in color for an aesthetic and practical appearance.",
        category: "layout"
      }
    ]
  },

  // غرف الأطفال - Children's Room
  "children-room": {
    modern: [
      {
        id: "children-modern-1",
        title: "الأمان أولاً",
        titleEn: "Safety first",
        content: "أثاث بدون زوايا حادة، ومواد غير سامة. سرير منخفض (30 سم عن الأرض) للأطفال الصغار.",
        contentEn: "Furniture without sharp corners, non-toxic materials. Low bed (30 cm from the floor) for young children.",
        category: "furniture"
      },
      {
        id: "children-modern-2",
        title: "ألوان متناسقة",
        titleEn: "Coordinated colours",
        content: "استخدم 2-3 ألوان متناسقة مع أبيض كأساس. الألوان الباستيل مثالية للأطفال.",
        contentEn: "Use 2-3 coordinating colors with white as a base. Pastel colors are perfect for children.",
        category: "colors"
      },
      {
        id: "children-modern-3",
        title: "منطقة اللعب",
        titleEn: "Play area",
        content: "سجاد ناعم أو حصير لعب في زاوية. تخزين مفتوح أسفل للوصول السهل للألعاب.",
        contentEn: "Soft rugs or play mats in a corner. Open storage underneath for easy access to toys.",
        category: "layout"
      }
    ],
    classic: [
      {
        id: "children-classic-1",
        title: "السرير الخشبي",
        titleEn: "Wooden bed",
        content: "سرير خشبي نقي بتصميم بسيط. يمكن إضافة حاجز أمان قابل للإزالة للأطفال الصغار.",
        contentEn: "Pure wooden bed with simple design. A removable safety barrier can be added for younger children.",
        category: "furniture"
      },
      {
        id: "children-classic-2",
        title: "الألوان الدافئة",
        titleEn: "Warm colours",
        content: "ألوان دافئة مثل البيج والأصفر الفاتح. ستائر بنقشات خفيفة للأجواء المريحة.",
        contentEn: "Warm colors such as beige and light yellow. Lightly patterned curtains for a comfortable atmosphere.",
        category: "colors"
      },
      {
        id: "children-classic-3",
        title: "الإضاءة الليلية",
        titleEn: "Night lighting",
        content: "مصباح ليلي دافئ أو إضاءة مخفية. تجنب الإضاءة الساطعة قبل النوم.",
        contentEn: "Warm night lamp or hidden lighting. Avoid bright lighting before bed.",
        category: "lighting"
      }
    ],
    industrial: [
      {
        id: "children-industrial-1",
        title: "الأثاث العملي",
        titleEn: "Practical furniture",
        content: "سرير بإطار معدني قوي وخزانة خشبية بسيطة. متين ويتحمل حركة الأطفال.",
        contentEn: "A bed with a sturdy metal frame and a simple wooden dresser. Durable and can withstand children's movements.",
        category: "furniture"
      },
      {
        id: "children-industrial-2",
        title: "منطقة الإبداع",
        titleEn: "Creativity zone",
        content: "جدار سبورة أو لوحة بيضاء للرسم. مساحة مفتوحة للإبداع واللعب.",
        contentEn: "Chalkboard wall or white board for drawing. An open space for creativity and play.",
        category: "layout"
      },
      {
        id: "children-industrial-3",
        title: "الأرضيات المطاطية",
        titleEn: "Rubber flooring",
        content: "أرضية مطاطية أو فينيل ناعم للأمان. سهل التنظيف ومريح للعب.",
        contentEn: "Rubber or soft vinyl flooring for safety. Easy to clean and comfortable to play.",
        category: "materials"
      }
    ],
    scandinavian: [
      {
        id: "children-scandi-1",
        title: "الخشب الطبيعي",
        titleEn: "Natural wood",
        content: "أثاث خشبي فاتح بسيط. سرير منخفض مع تخزين مفتوح أسفله للألعاب.",
        contentEn: "Simple light wood furniture. Low bed with open storage underneath for toys.",
        category: "furniture"
      },
      {
        id: "children-scandi-2",
        title: "النباتات والضوء",
        titleEn: "Plants and light",
        content: "نباتات غير سامة (2-3 نباتات) وضوء طبيعي كبير. ستائر خفيفة بيضاء.",
        contentEn: "Non-toxic plants (2-3 plants) and plenty of natural light. White light curtains.",
        category: "lighting"
      },
      {
        id: "children-scandi-3",
        title: "التنظيم البسيط",
        titleEn: "Simple organization",
        content: "سلال قش وصناديق خشبية للتخزين. سهلة الوصول للطفل وتعلمه الترتيب.",
        contentEn: "Straw baskets and wooden boxes for storage. Easy for children to access and learn to arrange.",
        category: "layout"
      }
    ]
  },

  // غرف المراهقين - Teen Room
  "teen-room": {
    modern: [
      {
        id: "teen-modern-1",
        title: "مكتب الدراسة",
        titleEn: "Study desk",
        content: "مكتب كبير (120×60 سم على الأقل) بمساحة للحاسوب والكتب. كرسي مريح قابل للتعديل.",
        contentEn: "A large desk (at least 120 x 60 cm) with space for a computer and books. Comfortable adjustable chair.",
        category: "furniture"
      },
      {
        id: "teen-modern-2",
        title: "مساحة الشخصية",
        titleEn: "The Personal Space  This area is characterized by a sense of intimacy and tranquility, where one can relax and unwind after a long day. The design of this space is often minimalist, with a focus on clean lines, simple shapes, and a limited color palette.  The furniture in this area is typically low-profile and comfortable, with a focus on functionality and ease of use. A plush sofa or armchair is often the centerpiece of the room, surrounded by a few carefully selected decorative pieces.  The lighting in this area is often soft and warm, with table lamps or floor lamps providing a cozy glow. The walls are often painted a soothing color, such as a light gray or beige, to create a sense of calm.  In terms of style, the personal space is often a reflection of the individual's personality and tastes. Some people prefer a modern and sleek look, while others opt for a more traditional and ornate design.  Overall, the personal space is a sanctuary where one can retreat from the stresses of everyday life and recharge. It is a place where one can be alone with their thoughts, and where they can feel safe and comfortable.  The key elements of a well-designed personal space include:  - A comfortable and inviting seating area - Soft and warm lighting - A soothing color palette - Minimalist decor - Functional and easy-to-use furniture  By incorporating these elements, one can create a personal space that is both beautiful and functional, and that provides a sense of calm and tranquility.",
        content: "منطقة جلوس منفصلة (كرسي أو كنبة صغيرة) للاسترخاء والقراءة بعيدًا عن مكتب الدراسة.",
        contentEn: "A separate seating area (a chair or a small sofa) for relaxation and reading, away from the study desk.",
        category: "layout"
      },
      {
        id: "teen-modern-3",
        title: "التخزين المرن",
        titleEn: "Flexible Storage",
        content: "خزانة ملابس مع أدراج + رفوف مفتوحة للكتب والديكور. تخصيص حسب احتياجات المراهق.",
        contentEn: "A wardrobe with drawers and open shelves for books and decorations. Customizable according to the teenager's needs.",
        category: "furniture"
      }
    ],
    classic: [
      {
        id: "teen-classic-1",
        title: "المكتب التقليدي",
        titleEn: "The Traditional Office",
        content: "مكتب خشبي كلاسيكي بأدراج. مناسب للدراسة والعمل على الحاسوب. خشب البلوط أو الكرز.",
        contentEn: "مكتب خشبي كلاسيكي بأدراج. مناسب للدراسة والعمل على الحاسوب. خشب البلوط أو الكرز.",
        category: "furniture"
      },
      {
        id: "teen-classic-2",
        title: "الألوان الناضجة",
        titleEn: "الألوان الناضجة",
        content: "ألوان محايدة مع لمسة من الأزرق الداكن أو الأخضر. مناسبة لمرحلة النضج.",
        contentEn: "ألوان محايدة مع لمسة من الأزرق الداكن أو الأخضر. مناسبة لمرحلة النضج.",
        category: "colors"
      },
      {
        id: "teen-classic-3",
        title: "الإضاءة المتوازنة",
        titleEn: "الإضاءة المتوازنة",
        content: "براني مكتب للدراسة + إضاءة عامة دافئة. التحكم بالإضاءة أثناء النهار والليل.",
        contentEn: "براني مكتب للدراسة + إضاءة عامة دافئة. التحكم بالإضاءة أثناء النهار والليل.",
        category: "lighting"
      }
    ],
    industrial: [
      {
        id: "teen-industrial-1",
        title: "المكتب الصناعي",
        titleEn: "المكتب الصناعي",
        content: "مكتب بهيكل معدني وسطح خشب سميك. أرفف مفتوحة من الأنابيب للكتب والديكور.",
        contentEn: "مكتب بهيكل معدني وسطح خشب سميك. أرفف مفتوحة من الأنابيب للكتب والديكور.",
        category: "furniture"
      },
      {
        id: "teen-industrial-2",
        title: "منطقة التعبير",
        titleEn: "منطقة التعبير",
        content: "جدار للصور أو الملصقات، أو سبورة للأفكار. مساحة للتعبير عن الشخصية.",
        contentEn: "جدار للصور أو الملصقات، أو سبورة للأفكار. مساحة للتعبير عن الشخصية.",
        category: "layout"
      },
      {
        id: "teen-industrial-3",
        title: "الإضاءة الجريئة",
        titleEn: "الإضاءة الجريئة",
        content: "مصابيح معلقة بتصميم صناعي. يمكن إضافة إضاءة LED ملونة للتخصيص.",
        contentEn: "مصابيح معلقة بتصميم صناعي. يمكن إضافة إضاءة LED ملونة للتخصيص.",
        category: "lighting"
      }
    ],
    scandinavian: [
      {
        id: "teen-scandi-1",
        title: "المكتب البسيط",
        titleEn: "المكتب البسيط",
        content: "مكتب أبيض نظيف بخطوط بسيطة. كرسي مريح بتصميم اسكندنافي. مساحة عمل منظمة.",
        contentEn: "مكتب أبيض نظيف بخطوط بسيطة. كرسي مريح بتصميم اسكندنافي. مساحة عمل منظمة.",
        category: "furniture"
      },
      {
        id: "teen-scandi-2",
        title: "التركيز والهدوء",
        titleEn: "التركيز والهدوء",
        content: "ألوان محايدة (أبيض/رمادي/بيج) مع خشب فاتح. بيئة هادئة تدعم الدراسة والتركيز.",
        contentEn: "ألوان محايدة (أبيض/رمادي/بيج) مع خشب فاتح. بيئة هادئة تدعم الدراسة والتركيز.",
        category: "colors"
      },
      {
        id: "teen-scandi-3",
        title: "النباتات والتنظيم",
        titleEn: "النباتات والتنظيم",
        content: "2-3 نباتات خضراء ونظام تخزين بسيط. التنظيم المرئي يقلل التوتر ويحسن الإنتاجية.",
        contentEn: "2-3 نباتات خضراء ونظام تخزين بسيط. التنظيم المرئي يقلل التوتر ويحسن الإنتاجية.",
        category: "layout"
      }
    ]
  },

  // الكنب الزاوية - Corner Sofa
  "corner-sofa": {
    modern: [
      {
        id: "sofa-modern-1",
        title: "قياسات الزاوية",
        titleEn: "Angle measurements",
        content: "اختار كنبة زاوية بعمق 90-100 سم للجلوس المريح. الطول: 250-300 سم لكل جانب للمساحات المتوسطة.",
        contentEn: "Choose a corner sofa with a depth of 90-100 cm for comfortable sitting. Length: 250-300 cm per side for medium spaces.",
        category: "furniture"
      },
      {
        id: "sofa-modern-2",
        title: "تنسيق مع الطاولة",
        titleEn: "Coordinate with the table",
        content: "طاولة قهوة بارتفاع 40-45 سم (أقل من الكنبة بـ 5-10 سم). المسافة بينهما: 45-50 سم.",
        contentEn: "Coffee table 40-45 cm high (5-10 cm lower than the sofa). The distance between them: 45-50 cm.",
        category: "layout"
      },
      {
        id: "sofa-modern-3",
        title: "الألوان المحايدة",
        titleEn: "Neutral colors",
        content: "كنبة باللون الرمادي الداكن أو البيج مع مخدات ملونة للتغيير السهل. أقمشة سهلة التنظيف.",
        contentEn: "A dark gray or beige sofa with colorful pillows for an easy change. Easy to clean fabrics.",
        category: "colors"
      }
    ],
    classic: [
      {
        id: "sofa-classic-1",
        title: "الكنبة المنجدة",
        titleEn: "Upholstered sofa",
        content: "كنبة زاوية منجدّة بأزرار. أقمشة مخملية فاخرة باللون البني الداكن أو الكحلي.",
        contentEn: "Upholstered corner sofa with buttons. Luxurious velvet fabrics in dark brown or navy.",
        category: "furniture"
      },
      {
        id: "sofa-classic-2",
        title: "السجاد التحتي",
        titleEn: "Undercarpet",
        content: "سجادة كبيرة تتجاوز الكنبة بـ 30 سم على الأقل. السجادة تحدد منطقة الجلوس بأناقة.",
        contentEn: "A large rug that extends beyond the sofa by at least 30 cm. The rug elegantly defines the seating area.",
        category: "layout"
      },
      {
        id: "sofa-classic-3",
        title: "الإضاءة الجانبية",
        titleEn: "Side lighting",
        content: "براني أرضية كلاسيكية على جانبي الكنبة. ارتفاع 150-160 سم للإضاءة المثالية للقراءة.",
        contentEn: "Classic floor holders on both sides of the sofa. Height 150-160 cm for ideal lighting for reading.",
        category: "lighting"
      }
    ],
    industrial: [
      {
        id: "sofa-industrial-1",
        title: "الكنبة الجلدية",
        titleEn: "Leather sofa",
        content: "كنبة زاوية جلدية (طبيعي أو صناعي) باللون البني أو الأسود. متينة وسهلة التنظيف.",
        contentEn: "Leather corner sofa (natural or synthetic) in brown or black. Durable and easy to clean.",
        category: "furniture"
      },
      {
        id: "sofa-industrial-2",
        title: "الطاولة الخشبية",
        titleEn: "The wooden table",
        content: "طاولة قهوة من خشب مستصلح أو معدن. سطح خشب سميك (5 سم على الأقل) بملمس طبيعي.",
        contentEn: "Coffee table made of reclaimed wood or metal. Thick wood surface (minimum 5 cm) with a natural texture.",
        category: "materials"
      },
      {
        id: "sofa-industrial-3",
        title: "الإضاءة المعلقة",
        titleEn: "Pendant lighting",
        content: "مصباح أرضي معدني بتصميم صناعي أو إضاءة معلقة من السقف. لمبات إديسون للجو الدافئ.",
        contentEn: "Industrial design metal floor lamp or ceiling pendant light. Edison bulbs for warm weather.",
        category: "lighting"
      }
    ],
    scandinavian: [
      {
        id: "sofa-scandi-1",
        title: "الكنبة الفاتحة",
        titleEn: "The light sofa",
        content: "كنبة بألوان فاتحة (بيج/رمادي فاتح) بأرجل خشبية مكشوفة. القماش الناعم يضيف راحة.",
        contentEn: "Light colored sofa (beige/light grey) with exposed wooden legs. Soft fabric adds comfort.",
        category: "furniture"
      },
      {
        id: "sofa-scandi-2",
        title: "المخدات المنسقة",
        titleEn: "Coordinated pillows",
        content: "4-6 مخدات بألوان وأنماط متناسقة. اختار أقمشة طبيعية (كتان/قطن) بألوان محايدة.",
        contentEn: "4-6 pillows in coordinating colors and patterns. Choose natural fabrics (linen/cotton) in neutral colors.",
        category: "colors"
      },
      {
        id: "sofa-scandi-3",
        title: "الطاولة الخشبية",
        titleEn: "The wooden table",
        content: "طاولة قهوة خشبية فاتحة (بلوك/بتولا) بخطوط نظيفة. بساطة ووظيفة معًا.",
        contentEn: "Light wood coffee table (block/birch) with clean lines. Simplicity and function together.",
        category: "furniture"
      }
    ]
  },

  // اللاونج - Lounge
  "lounge": {
    modern: [
      {
        id: "lounge-modern-1",
        title: "كرسي الاسترخاء",
        titleEn: "Relaxing chair",
        content: "كرسي استرخاء مودرن بزاوية 135 درجة. مع مسند قدم منفصل للراحة القصوى.",
        contentEn: "Modern reclining chair with an angle of 135 degrees. With separate footrest for maximum comfort.",
        category: "furniture"
      },
      {
        id: "lounge-modern-2",
        title: "الإضاءة الموجهة",
        titleEn: "Directed lighting",
        content: "براني أرضية مع قابلية للتحريك. ضوء موجه للقراءة بدون إزعاج للآخرين.",
        contentEn: "Floor mounts with the ability to move. Directed light for reading without disturbing others.",
        category: "lighting"
      },
      {
        id: "lounge-modern-3",
        title: "الطاولة الجانبية",
        titleEn: "Side table",
        content: "طاولة صغيرة للمشروبات بارتفاع 50-60 سم. ضعها على بعد 30 سم من الكرسي.",
        contentEn: "Small drinks table, 50-60 cm high. Place it 30 cm away from the chair.",
        category: "layout"
      }
    ],
    classic: [
      {
        id: "lounge-classic-1",
        title: "كرسي البرشر",
        titleEn: "Barsher chair",
        content: "كرسي برشر جلدي كلاسيكي. عالي الظهر (110 سم) بمسند قدم مدمج للأناقة والراحة.",
        contentEn: "Classic leather brocade chair. High back (110cm) with built-in footrest for style and comfort.",
        category: "furniture"
      },
      {
        id: "lounge-classic-2",
        title: "الإضاءة الدافئة",
        titleEn: "Warm lighting",
        content: "براني أرضية كلاسيكية بظل قماشي. إضاءة دافئة (2700K) للاسترخاء والقراءة.",
        contentEn: "Classic floor runners with fabric shade. Warm light (2700K) for relaxing and reading.",
        category: "lighting"
      },
      {
        id: "lounge-classic-3",
        title: "السجادة الصغيرة",
        titleEn: "Small carpet",
        content: "سجادة صغيرة ناعمة تحت كرسي الاسترخاء. تحدد منطقة القراءة وتضيف دفئًا.",
        contentEn: "A small soft rug under the lounge chair. Defines the reading area and adds warmth.",
        category: "materials"
      }
    ],
    industrial: [
      {
        id: "lounge-industrial-1",
        title: "كرسي الجلد",
        titleEn: "Leather chair",
        content: "كرسي استرخاء جلدي بإطار معدني. تصميم صناعي بسيط ومتين.",
        contentEn: "Leather recliner chair with metal frame. Simple and durable industrial design.",
        category: "furniture"
      },
      {
        id: "lounge-industrial-2",
        title: "الطاولة المعدنية",
        titleEn: "Metal table",
        content: "طاولة جانبية معدنية أو خشبية خام. سطح معدني أو خشب سميك بملمس طبيعي.",
        contentEn: "Raw metal or wooden side table. Metal or thick wood surface with natural texture.",
        category: "materials"
      },
      {
        id: "lounge-industrial-3",
        title: "الإضاءة الصناعية",
        titleEn: "Industrial lighting",
        content: "مصباح أرضي معدني بذراع متحركة. ارتفاع 160-180 سم للتحكم بالإضاءة.",
        contentEn: "Metal floor lamp with movable arm. Height 160-180 cm to control lighting.",
        category: "lighting"
      }
    ],
    scandinavian: [
      {
        id: "lounge-scandi-1",
        title: "كرسي مريح",
        titleEn: "Comfortable chair",
        content: "كرسي استرخاء بقماش ناعم وألوان فاتحة. أرجل خشبية خفيفة تظهر المساحة.",
        contentEn: "Relaxing chair in soft fabric and light colours. Light wooden legs show space.",
        category: "furniture"
      },
      {
        id: "lounge-scandi-2",
        title: "الضوء الطبيعي",
        titleEn: "Natural light",
        content: "ضع كرسي الاسترخاء قرب النافذة للاستفادة من الضوء الطبيعي. ستارة شفافة للتحكم.",
        contentEn: "Place the lounge chair near a window to take advantage of natural light. Transparent curtain for control.",
        category: "lighting"
      },
      {
        id: "lounge-scandi-3",
        title: "بطانية وكتاب",
        titleEn: "Blanket and book",
        content: "بطانية ناعمة مطوية ورف كتب صغير. بساطة اسكندنافية تدعو للاسترخاء.",
        contentEn: "A soft folded blanket and a small bookshelf. Scandinavian simplicity invites relaxation.",
        category: "materials"
      }
    ]
  },

  // التصميم الداخلي الشامل - Interior Design
  "interior-design": {
    modern: [
      {
        id: "interior-modern-1",
        title: "الوحدة البصرية",
        titleEn: "Optical unit",
        content: "استخدم 2-3 ألوان أساسية في جميع الغرف. الخشب والمعدن والزجاج مزيج مودرن مثالي.",
        contentEn: "Use 2-3 primary colors in all rooms. Wood, metal and glass are a perfect modern combination.",
        category: "colors"
      },
      {
        id: "interior-modern-2",
        title: "التدفق بين الغرف",
        titleEn: "Flow between rooms",
        content: "أرضيات متصلة (باركيه أو سيراميك واحد) بين المساحات المفتوحة. يوسع المساحة بصريًا.",
        contentEn: "Continuous flooring (parquet or single ceramic) between open spaces. Visually expands the space.",
        category: "layout"
      },
      {
        id: "interior-modern-3",
        title: "الإضاءة الطبقية",
        titleEn: "Layered lighting",
        content: "امزج بين إضاءة السقف والبراني والإضاءة المخفية. التحكم بالمستويات لكل وقت من اليوم.",
        contentEn: "Mix ceiling, recessed and recessed lighting. Control levels for every time of the day.",
        category: "lighting"
      }
    ],
    classic: [
      {
        id: "interior-classic-1",
        title: "اللغة الموحدة",
        titleEn: "Unified language",
        content: "نقشات كلاسيكية متناسقة على الأبواب والخزائن. المقابض النحاسية تربط الغرف بأناقة.",
        contentEn: "Classic, coordinated engravings on doors and cabinets. Brass knobs elegantly connect the rooms.",
        category: "materials"
      },
      {
        id: "interior-classic-2",
        title: "الألوان الغنية",
        titleEn: "Rich colors",
        content: "ألوان غامقة دافئة (بني/كحلي/زيتوني) مع ذهبي. تضفي فخامة متناسقة للمنزل.",
        contentEn: "Warm dark colors (brown/navy/olive) with gold. Adds harmonious elegance to the home.",
        category: "colors"
      },
      {
        id: "interior-classic-3",
        title: "الإضاءة الفاخرة",
        titleEn: "Luxurious lighting",
        content: "ثريات كلاسيكية في كل غرفة رئيسية. تصاميم متناسقة (كريستال أو نحاس).",
        contentEn: "Classic chandeliers in every master room. Matching designs (crystal or copper).",
        category: "lighting"
      }
    ],
    industrial: [
      {
        id: "interior-industrial-1",
        title: "الخامات المكشوفة",
        titleEn: "Exposed materials",
        content: "اجعل الخامات جزءًا من التصميم: طوب، خرسانة، معدن، خشب. لا حاجة للتغطية.",
        contentEn: "Make materials part of the design: brick, concrete, metal, wood. No need to cover.",
        category: "materials"
      },
      {
        id: "interior-industrial-2",
        title: "المساحات المفتوحة",
        titleEn: "Open spaces",
        content: "قلل الجدران الداخلية. استخدم أعمدة معدنية أو جدران زجاجية للفصل.",
        contentEn: "Reduce interior walls. Use metal columns or glass walls for separation.",
        category: "layout"
      },
      {
        id: "interior-industrial-3",
        title: "الإضاءة الصناعية",
        titleEn: "Industrial lighting",
        content: "استخدم نفس أسلوب الإضاءة في جميع الغرف: معلقة، أرضية، مخفية. لمبات إديسون موحدة.",
        contentEn: "Use the same lighting style in all rooms: pendant, floor, hidden. Standard Edison bulbs.",
        category: "lighting"
      }
    ],
    scandinavian: [
      {
        id: "interior-scandi-1",
        title: "الضوء في كل مكان",
        titleEn: "Light is everywhere",
        content: "نوافذ كبيرة ومرايا تعكس الضوء. ألوان فاتحة (80% أبيض) لتوزيع الإضاءة.",
        contentEn: "Large windows and mirrors reflect light. Light colors (80% white) for even light distribution.",
        category: "lighting"
      },
      {
        id: "interior-scandi-2",
        title: "الخشب الموحد",
        titleEn: "Uniform wood",
        content: "استخدم نفس نوع الخشب الفاتح في جميع الغرف. البلوك أو البتولا مثاليان.",
        contentEn: "Use the same type of light wood in all rooms. Block or birch are ideal.",
        category: "materials"
      },
      {
        id: "interior-scandi-3",
        title: "النباتات في كل ركن",
        titleEn: "Plants in every corner",
        content: "10-15 نباتًا موزعة على المنزل. تنقي الهواء وتضيف حياة لكل مساحة.",
        contentEn: "10-15 plants distributed throughout the house. Purifies the air and adds life to every space.",
        category: "colors"
      }
    ]
  }
};

// Helper function to get random tips for a room and style
export function getRoomTips(roomId: string, style: string, count: number = 3): RoomDesignTip[] {
  const roomTips = ROOM_DESIGN_TIPS[roomId]?.[style] || [];
  
  // If no specific tips, return generic tips
  if (roomTips.length === 0) {
    return getGenericTips(count);
  }
  
  // Shuffle and return requested count
  const shuffled = [...roomTips].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

// Generic tips for any room
function getGenericTips(count: number): RoomDesignTip[] {
  const genericTips: RoomDesignTip[] = [
    {
      id: "generic-1",
      title: "تناسب المقاسات",
        titleEn: "Sizes fit",
        content: "المسافة بين الأثاث تؤثر على الراحة. اترك 45-60 سم للممرات الرئيسية و90 سم على الأقل أمام الأبواب.",
        contentEn: "The distance between furniture affects comfort. Leave 45-60 cm for main corridors and at least 90 cm in front of doors.",
      category: "layout"
    },
    {
      id: "generic-2",
      title: "توزيع الإضاءة",
        titleEn: "Lighting distribution",
        content: "امزج بين 3 أنواع إضاءة: عامة (السقف)، مهام (القراءة)، وجو (ديكور). التحكم المنفصل لكل نوع.",
        contentEn: "Combine 3 lighting types: general (ceiling), task (reading), and ambiance (decorative). Separate control for each type.",
      category: "lighting"
    },
    {
      id: "generic-3",
      title: "قاعدة الألوان",
        titleEn: "Color base",
        content: "60% لون أساسي، 30% لون ثانوي، 10% لون مميز. هذه القاعدة تنطبق على كل غرفة بشكل منفصل.",
        contentEn: "60% primary color, 30% secondary color, 10% accent color. This rule applies to each room separately.",
      category: "colors"
    },
    {
      id: "generic-4",
      title: "جودة الخامات",
        titleEn: "Quality of materials",
        content: "استثمر في الخامات الطبيعية: خشب صلب، قطن، كتان. تدوم longer وتتحسن مع الوقت.",
        contentEn: "Invest in natural materials: solid wood, cotton, linen. It lasts longer and gets better with time.",
      category: "materials"
    },
    {
      id: "generic-5",
      title: "التخزين الذكي",
        titleEn: "Smart storage",
        content: "80% تخزين مخفي، 20% مفتوح للعرض. التنظيم المخفي يعطي مظهرًا أنظف وهدوءًا نفسيًا.",
        contentEn: "80% hidden storage, 20% open for viewing. Hidden organization creates a cleaner appearance and psychological calm.",
      category: "layout"
    }
  ];
  
  return genericTips.slice(0, count);
}

// Get a single tip by index (for pagination)
export function getTipByIndex(roomId: string, style: string, index: number): RoomDesignTip | null {
  const roomTips = ROOM_DESIGN_TIPS[roomId]?.[style] || [];
  
  if (roomTips.length === 0) {
    const generic = getGenericTips(3);
    return generic[index % generic.length] || null;
  }
  
  return roomTips[index % roomTips.length] || null;
}

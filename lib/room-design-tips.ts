// Room Design Tips - معلومات تصميم الغرف
// Tips for each room type and style combination

export interface RoomDesignTip {
  id: string;
  title: string;
  content: string;
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
        content: "الأبعاد المثالية لأريكة مودرن: الطول بين 180 و240 سم، والعمق 90-100 سم. اختار كنبة بأرجل مكشوفة لتبدو الغرفة أكثر اتساعًا.",
        category: "furniture"
      },
      {
        id: "living-modern-2",
        title: "توزيع الإضاءة الطبيعية",
        content: "في التصميم المودرن، يُفضل استخدام ستائر شفافة أو شيدات خشبية تسمح بدخول الضوء الطبيعي بنسبة 70% على الأقل.",
        category: "lighting"
      },
      {
        id: "living-modern-3",
        title: "قاعدة الألوان المحايدة",
        content: "اتبع قاعدة 60-30-10: 60% لون أساسي محايد (أبيض/بيج)، 30% لون ثانوي، و10% لون مميز للإكسسوارات.",
        category: "colors"
      }
    ],
    classic: [
      {
        id: "living-classic-1",
        title: "ارتفاع السقف والثريات",
        content: "في التصميم الكلاسيكي، يجب أن يكون ارتفاع الثريا 75-90 سم عن طاولة القهوة. للسقف المرتفع (3م+) استخدم ثريات متعددة الطبقات.",
        category: "lighting"
      },
      {
        id: "living-classic-2",
        title: "الأقمشة الفاخرة",
        content: "اختار أقمشة مخملية أو حريرية للستائر والمخدات. الألوان الدافئة مثل الذهبي والبني تضفي طابعًا كلاسيكيًا أنيقًا.",
        category: "materials"
      },
      {
        id: "living-classic-3",
        title: "توازن الأثاث",
        content: "وزع الأثاث بشكل متناظر حول نقطة التركيز (المدفأة أو التلفاز). المسافة بين الكنبة والطاولة الأمامية: 45-50 سم.",
        category: "layout"
      }
    ],
    industrial: [
      {
        id: "living-industrial-1",
        title: "الخامات الصناعية",
        content: "امزج بين الخشب الخام (خشب السقف المكشوف) والمعدن (أنابيب الإضاءة). نسبة 60% خشب و40% معدن تعطي توازنًا مثاليًا.",
        category: "materials"
      },
      {
        id: "living-industrial-2",
        title: "الإضاءة الصناعية",
        content: "استخدم لمبات إديسون مع قلابات معدنية ظاهرة. ارتفاع الإضاءة المعلقة: 2.1-2.4 متر عن الأرض.",
        category: "lighting"
      },
      {
        id: "living-industrial-3",
        title: "الجدران الطوبية",
        content: "جدار طوبي واحد كـ Accent Wall يكفي. يمكن دهانه بالشمع الشفاف لتقليل الغبار مع الحفاظ على المظهر الخام.",
        category: "materials"
      }
    ],
    scandinavian: [
      {
        id: "living-scandi-1",
        title: "الألوان الفاتحة",
        content: "استخدم ألوانًا محايدة 80% (أبيض/رمادي فاتح/بيج) مع لمسات من الخشب الفاتح والنباتات الخضراء.",
        category: "colors"
      },
      {
        id: "living-scandi-2",
        title: "إضاءة هايغ",
        content: "الإضاءة الدافئة (2700-3000K) أساسية. استخدم مصابيح أرضية بتصميم بسيط وستائر خفيفة تسمح بالضوء.",
        category: "lighting"
      },
      {
        id: "living-scandi-3",
        title: "الأثاث متعدد الوظائف",
        content: "اختار قطع أثاث بسيطة وعملية. طاولة قهوة بمساحة تخزين، أو مقاعد قابلة للطي. مبدأ: كل قطعة لها هدف.",
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
        content: "الارتفاع المثالي للسرير: 45-60 سم من الأرض (بما فيها المرتبة). السرير المنخفض يعطي مظهرًا مودرن أنيقًا.",
        category: "furniture"
      },
      {
        id: "bedroom-modern-2",
        title: "جانبي السرير المتناظر",
        content: "ضع طاولات جانبية متطابقة على طرفي السرير. ارتفاعها يجب أن يكون مساويًا أو أقل بـ 5 سم من ارتفاع المرتبة.",
        category: "layout"
      },
      {
        id: "bedroom-modern-3",
        title: "إضاءة مخفية",
        content: "استخدم إضاءة LED مخفية خلف التسريحة أو أسفل السرير. الإضاءة الدافئة (2700K) مثالية لغرف النوم.",
        category: "lighting"
      }
    ],
    classic: [
      {
        id: "bedroom-classic-1",
        title: "رأس السرير الفاخر",
        content: "رأس سرير مبطن بارتفاع 120-150 سم يضفي فخامة كلاسيكية. اختار أقمشة مخملية بألوان غامقة.",
        category: "furniture"
      },
      {
        id: "bedroom-classic-2",
        title: "الثريات والبرادي",
        content: "ثريا كلاسيكية مركزية مع برادي جانبية للقراءة. البراني يجب أن تكون بارتفاع 1.5-1.7 متر عن الأرض.",
        category: "lighting"
      },
      {
        id: "bedroom-classic-3",
        title: "السجاد الفاخر",
        content: "سجادة بحجم يتجاوز السرير بـ 60 سم على كل جانب. الألوان الغامقة تضفي دفئًا وأناقة كلاسيكية.",
        category: "materials"
      }
    ],
    industrial: [
      {
        id: "bedroom-industrial-1",
        title: "الهيكل المعدني",
        content: "سرير بهيكل معدني أو خشب خام غير مصبوغ. أمزج مع طاولات جانبية من الخشب المستصلح.",
        category: "furniture"
      },
      {
        id: "bedroom-industrial-2",
        title: "الإضاءة المعلقة",
        content: "استخدم قلابات معدنية معلقة على جانبي السرير. ارتفاع 1.8-2 متر عن الأرض لإضاءة مثالية للقراءة.",
        category: "lighting"
      },
      {
        id: "bedroom-industrial-3",
        title: "الخزائن المفتوحة",
        content: "خزائن مفتوحة بدون أبواب تعرض الملابس بشكل منظم. استخدم علب قماشية أو معدنية للتنظيم.",
        category: "layout"
      }
    ],
    scandinavian: [
      {
        id: "bedroom-scandi-1",
        title: "الخشب الفاتح والأبيض",
        content: "امزج بين الخشب الفاتح (البلوط/البتولا) والأبيض النقي. نسبة 50/50 تعطي توازنًا هادئًا.",
        category: "colors"
      },
      {
        id: "bedroom-scandi-2",
        title: "الإضاءة الطبيعية",
        content: "احتفظ بالنوافذ كبيرة وغير مغطاة قدر الإمكان. استخدم ستائر شفافة بيضاء للخصوصية مع الحفاظ على الضوء.",
        category: "lighting"
      },
      {
        id: "bedroom-scandi-3",
        title: "النباتات والنسيج",
        content: "أضف نباتات خضراء (3-5 نباتات) وأغطية سرير من القطن الطبيعي. البساطة هي المفتاح.",
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
        content: "ارتبط الثلاجة والموقد والحوض بمثلث عمل. المسافة بينهم: 1.2-2.7 متر لكل ضلع للكفاءة القصوى.",
        category: "layout"
      },
      {
        id: "kitchen-modern-2",
        title: "أسطح العمل",
        content: "اختر أسطح كوارتز أو رخام للمطبخ المودرن. ارتفاع سطح العمل المثالي: 85-95 سم حسب طولك.",
        category: "materials"
      },
      {
        id: "kitchen-modern-3",
        title: "إضاءة المهام",
        content: "إضاءة LED مخفية تحت الخزائن العلوية للإضاءة المباشرة على سطح العمل. درجة حرارة 4000K للوضوح.",
        category: "lighting"
      }
    ],
    classic: [
      {
        id: "kitchen-classic-1",
        title: "الخزائن الخشبية",
        content: "خزائن من خشب الكرز أو البلوط بأبواب نقشية. المقابض النحاسية تضفي لمسة كلاسيكية فاخرة.",
        category: "furniture"
      },
      {
        id: "kitchen-classic-2",
        title: "الأرضيات الرخامية",
        content: "أرضيات رخام أو سيراميك بتصميم كلاسيكي. الألوان الفاتحة توسع المساحة وتعكس الضوء.",
        category: "materials"
      },
      {
        id: "kitchen-classic-3",
        title: "الإضاءة الدافئة",
        content: "ثريا مركزية فوق جزيرة الطبخ أو طاولة الطعام. إضاءة دافئة (2700-3000K) للجو العائلي.",
        category: "lighting"
      }
    ],
    industrial: [
      {
        id: "kitchen-industrial-1",
        title: "أسطح الستانلس ستيل",
        content: "أسطح عمل من الستانلس ستيل أو الخرسانة المصقولة. سهلة التنظيف ومقاومة للحرارة والبقع.",
        category: "materials"
      },
      {
        id: "kitchen-industrial-2",
        title: "الأرفف المفتوحة",
        content: "استبدل بعض الخزائن بأرفف معدنية مفتوحة لعرض الأطباق والأواني. مظهر عصري وعملي.",
        category: "layout"
      },
      {
        id: "kitchen-industrial-3",
        title: "إضاءة المستودع",
        content: "استخدم مصابيح معلقة صناعية بتصميم معدني. الارتفاع: 80-100 سم فوق جزيرة الطبخ.",
        category: "lighting"
      }
    ],
    scandinavian: [
      {
        id: "kitchen-scandi-1",
        title: "الأبيض والخشب الفاتح",
        content: "خزائن بيضاء مع أرضيات خشب فاتح. نسبة 70% أبيض و30% خشب تعطي مظهرًا نظيفًا ودافئًا.",
        category: "colors"
      },
      {
        id: "kitchen-scandi-2",
        title: "التخزين الذكي",
        content: "استخدم حاويات زجاجية وسلال قش للتخزين المفتوح. التنظيم المرئي جزء أساسي من التصميم الاسكندنافي.",
        category: "layout"
      },
      {
        id: "kitchen-scandi-3",
        title: "إضاءة هادئة",
        content: "إضاءة طبيعية قدر الإمكان. مصابيح بسيطة معلقة فوق منطقة الطعام بارتفاع 75 سم عن الطاولة.",
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
        content: "مسافة 60 سم بين الكرسي والجدار للراحة. طاولة بسطح زجاجي أو خشبي ناعم بأرجل معدنية رفيعة.",
        category: "furniture"
      },
      {
        id: "dining-modern-2",
        title: "الإضاءة المركزية",
        content: "ثريا أو مصابيح معلقة فوق مركز الطاولة. الارتفاع: 75-90 سم عن سطح الطاولة.",
        category: "lighting"
      },
      {
        id: "dining-modern-3",
        title: "الألوان المحايدة",
        content: "استخدم ألوانًا محايدة مع لمسة واحدة جريئة. طاولة خشب طبيعي مع كراسي سوداء أو بيضاء.",
        category: "colors"
      }
    ],
    classic: [
      {
        id: "dining-classic-1",
        title: "طاولة الطعام الكبيرة",
        content: "طاولة خشبية ثقيلة بسطح رخامي أو خشب صلب. تتسع لـ 6-8 أشخاص للولائم العائلية.",
        category: "furniture"
      },
      {
        id: "dining-classic-2",
        title: "الثريات الكريستال",
        content: "ثريا كريستال فخمة فوق طاولة الطعام. ارتفاع 90-110 سم عن الطاولة للإضاءة المثالية.",
        category: "lighting"
      },
      {
        id: "dining-classic-3",
        title: "الستائر الثقيلة",
        content: "ستائر مخملية ثقيلة تصل للأرض. الألوان الغامقة مثل الأحمر البني أو الذهبي تضفي فخامة.",
        category: "materials"
      }
    ],
    industrial: [
      {
        id: "dining-industrial-1",
        title: "طاولة خشب و معدن",
        content: "طاولة بسطح خشب خام (مستصلح) وهيكل معدني. كراسي معدنية أو جلدية لمظهر صناعي.",
        category: "furniture"
      },
      {
        id: "dining-industrial-2",
        title: "الإضاءة الصناعية",
        content: "3-5 مصابيح معلقة بتصميم صناعي فوق الطاولة. لمبات إديسون للإضاءة الدافئة.",
        category: "lighting"
      },
      {
        id: "dining-industrial-3",
        title: "الأرضيات الخرسانية",
        content: "أرضية خرسانية مصقولة أو باركيه داكن. السجاد الجلدي يضيف لمسة دفء للمساحة.",
        category: "materials"
      }
    ],
    scandinavian: [
      {
        id: "dining-scandi-1",
        title: "طاولة خشب فاتح",
        content: "طاولة بيضاوية أو مستطيلة من خشب البلوك الفاتح. كراسي بسيطة بظهر منحني للراحة.",
        category: "furniture"
      },
      {
        id: "dining-scandi-2",
        title: "إضاءة ناعمة",
        content: "مصباح معلق بقبة خشبية أو زجاجية أبيض. ارتفاع 70-80 سم عن الطاولة لإضاءة دافئة.",
        category: "lighting"
      },
      {
        id: "dining-scandi-3",
        title: "النباتات كديكور",
        content: "أضف 2-3 نباتات خضراء على الطاولة أو الرفوف. الأواني البيضاء أو الخزفية تكمل المظهر.",
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
        content: "مكتب بسطح 140×70 سم على الأقل. ارتفاع 73-76 سم مع كرسي قابل للتعديل (ارتفاع المقعد 42-50 سم).",
        category: "furniture"
      },
      {
        id: "office-modern-2",
        title: "إضاءة المهام",
        content: "مصباح مكتب LED بإضاءة بيضاء (4000-5000K). ضعه على الجانب الأيسر إذا كنت أيمن لتقليل الظل.",
        category: "lighting"
      },
      {
        id: "office-modern-3",
        title: "التنظيم الرقمي",
        content: "استخدم حامل شاشة معدني أنيق ومنظمات كابلات مخفية. مبدأ: لا كابلات ظاهرة على المكتب.",
        category: "layout"
      }
    ],
    classic: [
      {
        id: "office-classic-1",
        title: "المكتب التنفيذي",
        content: "مكتب خشبي ثقيل بأدراج جانبية. خشب البلوط أو الجوز الداكن للحضور المهني.",
        category: "furniture"
      },
      {
        id: "office-classic-2",
        title: "الكرسي الجلدي",
        content: "كرسي مكتب جلدي بتصميم كلاسيكي. عالي الظهر (110-120 سم) للدعم الكامل.",
        category: "furniture"
      },
      {
        id: "office-classic-3",
        title: "الإضاءة الدافئة",
        content: "براني مكتب كلاسيكية مع ثريا صغيرة. إضاءة دافئة (2700-3000K) للتركيز المريح.",
        category: "lighting"
      }
    ],
    industrial: [
      {
        id: "office-industrial-1",
        title: "المكتب المعدني",
        content: "مكتب بهيكل معدني وسطح خشب صلب. أرفف مفتوحة من الأنابيب المعدنية والخشب.",
        category: "furniture"
      },
      {
        id: "office-industrial-2",
        title: "الإضاءة المعلقة",
        content: "مصباح مكتب معلق بتصميم صناعي. أو مصابيح أرضية معدنية للإضاءة الموجهة.",
        category: "lighting"
      },
      {
        id: "office-industrial-3",
        title: "الجدران الخرسانية",
        content: "جدار خرساني أو طوبي ظاهر كخلفية للمكتب. يضيف شخصية قوية للمساحة.",
        category: "materials"
      }
    ],
    scandinavian: [
      {
        id: "office-scandi-1",
        title: "المكتب البسيط",
        content: "مكتب أبيض أو خشب فاتح بخطوط نظيفة. بدون أدراج ظاهرة - استخدم تخزينًا منفصلًا.",
        category: "furniture"
      },
      {
        id: "office-scandi-2",
        title: "الضوء الطبيعي",
        content: "ضع المكتب بجانب النافذة مباشرة للاستفادة من الضوء الطبيعي. ستائر شفافة للتحكم بالإضاءة.",
        category: "lighting"
      },
      {
        id: "office-scandi-3",
        title: "النباتات للتركيز",
        content: "3-4 نباتات خضراء في المكتب تحسن جودة الهواء والتركيز. أواني بيضاء أو طينية بسيطة.",
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
        content: "أبواب خزانة منزلقة بمرايا للتوسيع البصري. ارتفاع الرفوف: 30 سم للقمصان، 45 سم للكنزات.",
        category: "furniture"
      },
      {
        id: "dressing-modern-2",
        title: "إضاءة LED",
        content: "إضاءة LED داخل الخزائن وعلى جانبي المرايا. إضاءة بيضاء (4000K) للألوان الحقيقية.",
        category: "lighting"
      },
      {
        id: "dressing-modern-3",
        title: "الأدراج المنظمة",
        content: "أدراج داخلية بفواصل للإكسسوارات. 60 سم عرض للأدراج العميقة، 40 سم للضحلة.",
        category: "layout"
      }
    ],
    classic: [
      {
        id: "dressing-classic-1",
        title: "الخزائن الملكية",
        content: "خزائن خشبية ثقيلة بأبواب نقشية. مرايا مزخرفة بإطار ذهبي أو فضي.",
        category: "furniture"
      },
      {
        id: "dressing-classic-2",
        title: "الإضاءة الفاخرة",
        content: "ثريا صغيرة أو مصابيح جدارية كلاسيكية. إضاءة دافئة (2700K) للجو الأنيق.",
        category: "lighting"
      },
      {
        id: "dressing-classic-3",
        title: "السجاد الفاخر",
        content: "سجادة صغيرة ناعمة في وسط الغرفة. الألوان الغامقة والأنماط الكلاسيكية تضفي فخامة.",
        category: "materials"
      }
    ],
    industrial: [
      {
        id: "dressing-industrial-1",
        title: "العرض المفتوح",
        content: "أنظمة تعليق مفتوحة من الأنابيب المعدنية والخشب. عرض الملابس كمتجر عصري.",
        category: "layout"
      },
      {
        id: "dressing-industrial-2",
        title: "الإضاءة المعلقة",
        content: "مصابيح سقفية صناعية أو مصابيح أرضية معدنية. لمبات إديسون للإضاءة الدافئة.",
        category: "lighting"
      },
      {
        id: "dressing-industrial-3",
        title: "المرايا الكبيرة",
        content: "مرايا كاملة الجسم بإطار معدني. يمكن أن تكون على عجل للحركة السهلة.",
        category: "furniture"
      }
    ],
    scandinavian: [
      {
        id: "dressing-scandi-1",
        title: "الخزائن البيضاء",
        content: "خزائن بيضاء مع أرفف خشب فاتح. بساطة ونظام في التنظيم المرئي.",
        category: "furniture"
      },
      {
        id: "dressing-scandi-2",
        title: "الإضاءة الطبيعية",
        content: "نافذة كبيرة إن أمكن، أو إضاءة LED بيضاء نقية. مرايا تعكس الضوء الطبيعي.",
        category: "lighting"
      },
      {
        id: "dressing-scandi-3",
        title: "التنظيم المرئي",
        content: "علب وسلال قش للتنظيم. الملابس مرتبة باللون لمنظر جمالي وعملي.",
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
        content: "أثاث بدون زوايا حادة، ومواد غير سامة. سرير منخفض (30 سم عن الأرض) للأطفال الصغار.",
        category: "furniture"
      },
      {
        id: "children-modern-2",
        title: "ألوان متناسقة",
        content: "استخدم 2-3 ألوان متناسقة مع أبيض كأساس. الألوان الباستيل مثالية للأطفال.",
        category: "colors"
      },
      {
        id: "children-modern-3",
        title: "منطقة اللعب",
        content: "سجاد ناعم أو حصير لعب في زاوية. تخزين مفتوح أسفل للوصول السهل للألعاب.",
        category: "layout"
      }
    ],
    classic: [
      {
        id: "children-classic-1",
        title: "السرير الخشبي",
        content: "سرير خشبي نقي بتصميم بسيط. يمكن إضافة حاجز أمان قابل للإزالة للأطفال الصغار.",
        category: "furniture"
      },
      {
        id: "children-classic-2",
        title: "الألوان الدافئة",
        content: "ألوان دافئة مثل البيج والأصفر الفاتح. ستائر بنقشات خفيفة للأجواء المريحة.",
        category: "colors"
      },
      {
        id: "children-classic-3",
        title: "الإضاءة الليلية",
        content: "مصباح ليلي دافئ أو إضاءة مخفية. تجنب الإضاءة الساطعة قبل النوم.",
        category: "lighting"
      }
    ],
    industrial: [
      {
        id: "children-industrial-1",
        title: "الأثاث العملي",
        content: "سرير بإطار معدني قوي وخزانة خشبية بسيطة. متين ويتحمل حركة الأطفال.",
        category: "furniture"
      },
      {
        id: "children-industrial-2",
        title: "منطقة الإبداع",
        content: "جدار سبورة أو لوحة بيضاء للرسم. مساحة مفتوحة للإبداع واللعب.",
        category: "layout"
      },
      {
        id: "children-industrial-3",
        title: "الأرضيات المطاطية",
        content: "أرضية مطاطية أو فينيل ناعم للأمان. سهل التنظيف ومريح للعب.",
        category: "materials"
      }
    ],
    scandinavian: [
      {
        id: "children-scandi-1",
        title: "الخشب الطبيعي",
        content: "أثاث خشبي فاتح بسيط. سرير منخفض مع تخزين مفتوح أسفله للألعاب.",
        category: "furniture"
      },
      {
        id: "children-scandi-2",
        title: "النباتات والضوء",
        content: "نباتات غير سامة (2-3 نباتات) وضوء طبيعي كبير. ستائر خفيفة بيضاء.",
        category: "lighting"
      },
      {
        id: "children-scandi-3",
        title: "التنظيم البسيط",
        content: "سلال قش وصناديق خشبية للتخزين. سهلة الوصول للطفل وتعلمه الترتيب.",
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
        content: "مكتب كبير (120×60 سم على الأقل) بمساحة للحاسوب والكتب. كرسي مريح قابل للتعديل.",
        category: "furniture"
      },
      {
        id: "teen-modern-2",
        title: "مساحة الشخصية",
        content: "منطقة جلوس منفصلة (كرسي أو كنبة صغيرة) للاسترخاء والقراءة بعيدًا عن مكتب الدراسة.",
        category: "layout"
      },
      {
        id: "teen-modern-3",
        title: "التخزين المرن",
        content: "خزانة ملابس مع أدراج + رفوف مفتوحة للكتب والديكور. تخصيص حسب احتياجات المراهق.",
        category: "furniture"
      }
    ],
    classic: [
      {
        id: "teen-classic-1",
        title: "المكتب التقليدي",
        content: "مكتب خشبي كلاسيكي بأدراج. مناسب للدراسة والعمل على الحاسوب. خشب البلوط أو الكرز.",
        category: "furniture"
      },
      {
        id: "teen-classic-2",
        title: "الألوان الناضجة",
        content: "ألوان محايدة مع لمسة من الأزرق الداكن أو الأخضر. مناسبة لمرحلة النضج.",
        category: "colors"
      },
      {
        id: "teen-classic-3",
        title: "الإضاءة المتوازنة",
        content: "براني مكتب للدراسة + إضاءة عامة دافئة. التحكم بالإضاءة أثناء النهار والليل.",
        category: "lighting"
      }
    ],
    industrial: [
      {
        id: "teen-industrial-1",
        title: "المكتب الصناعي",
        content: "مكتب بهيكل معدني وسطح خشب سميك. أرفف مفتوحة من الأنابيب للكتب والديكور.",
        category: "furniture"
      },
      {
        id: "teen-industrial-2",
        title: "منطقة التعبير",
        content: "جدار للصور أو الملصقات، أو سبورة للأفكار. مساحة للتعبير عن الشخصية.",
        category: "layout"
      },
      {
        id: "teen-industrial-3",
        title: "الإضاءة الجريئة",
        content: "مصابيح معلقة بتصميم صناعي. يمكن إضافة إضاءة LED ملونة للتخصيص.",
        category: "lighting"
      }
    ],
    scandinavian: [
      {
        id: "teen-scandi-1",
        title: "المكتب البسيط",
        content: "مكتب أبيض نظيف بخطوط بسيطة. كرسي مريح بتصميم اسكندنافي. مساحة عمل منظمة.",
        category: "furniture"
      },
      {
        id: "teen-scandi-2",
        title: "التركيز والهدوء",
        content: "ألوان محايدة (أبيض/رمادي/بيج) مع خشب فاتح. بيئة هادئة تدعم الدراسة والتركيز.",
        category: "colors"
      },
      {
        id: "teen-scandi-3",
        title: "النباتات والتنظيم",
        content: "2-3 نباتات خضراء ونظام تخزين بسيط. التنظيم المرئي يقلل التوتر ويحسن الإنتاجية.",
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
        content: "اختار كنبة زاوية بعمق 90-100 سم للجلوس المريح. الطول: 250-300 سم لكل جانب للمساحات المتوسطة.",
        category: "furniture"
      },
      {
        id: "sofa-modern-2",
        title: "تنسيق مع الطاولة",
        content: "طاولة قهوة بارتفاع 40-45 سم (أقل من الكنبة بـ 5-10 سم). المسافة بينهما: 45-50 سم.",
        category: "layout"
      },
      {
        id: "sofa-modern-3",
        title: "الألوان المحايدة",
        content: "كنبة باللون الرمادي الداكن أو البيج مع مخدات ملونة للتغيير السهل. أقمشة سهلة التنظيف.",
        category: "colors"
      }
    ],
    classic: [
      {
        id: "sofa-classic-1",
        title: "الكنبة المنجدة",
        content: "كنبة زاوية منجدّة بأزرار. أقمشة مخملية فاخرة باللون البني الداكن أو الكحلي.",
        category: "furniture"
      },
      {
        id: "sofa-classic-2",
        title: "السجاد التحتي",
        content: "سجادة كبيرة تتجاوز الكنبة بـ 30 سم على الأقل. السجادة تحدد منطقة الجلوس بأناقة.",
        category: "layout"
      },
      {
        id: "sofa-classic-3",
        title: "الإضاءة الجانبية",
        content: "براني أرضية كلاسيكية على جانبي الكنبة. ارتفاع 150-160 سم للإضاءة المثالية للقراءة.",
        category: "lighting"
      }
    ],
    industrial: [
      {
        id: "sofa-industrial-1",
        title: "الكنبة الجلدية",
        content: "كنبة زاوية جلدية (طبيعي أو صناعي) باللون البني أو الأسود. متينة وسهلة التنظيف.",
        category: "furniture"
      },
      {
        id: "sofa-industrial-2",
        title: "الطاولة الخشبية",
        content: "طاولة قهوة من خشب مستصلح أو معدن. سطح خشب سميك (5 سم على الأقل) بملمس طبيعي.",
        category: "materials"
      },
      {
        id: "sofa-industrial-3",
        title: "الإضاءة المعلقة",
        content: "مصباح أرضي معدني بتصميم صناعي أو إضاءة معلقة من السقف. لمبات إديسون للجو الدافئ.",
        category: "lighting"
      }
    ],
    scandinavian: [
      {
        id: "sofa-scandi-1",
        title: "الكنبة الفاتحة",
        content: "كنبة بألوان فاتحة (بيج/رمادي فاتح) بأرجل خشبية مكشوفة. القماش الناعم يضيف راحة.",
        category: "furniture"
      },
      {
        id: "sofa-scandi-2",
        title: "المخدات المنسقة",
        content: "4-6 مخدات بألوان وأنماط متناسقة. اختار أقمشة طبيعية (كتان/قطن) بألوان محايدة.",
        category: "colors"
      },
      {
        id: "sofa-scandi-3",
        title: "الطاولة الخشبية",
        content: "طاولة قهوة خشبية فاتحة (بلوك/بتولا) بخطوط نظيفة. بساطة ووظيفة معًا.",
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
        content: "كرسي استرخاء مودرن بزاوية 135 درجة. مع مسند قدم منفصل للراحة القصوى.",
        category: "furniture"
      },
      {
        id: "lounge-modern-2",
        title: "الإضاءة الموجهة",
        content: "براني أرضية مع قابلية للتحريك. ضوء موجه للقراءة بدون إزعاج للآخرين.",
        category: "lighting"
      },
      {
        id: "lounge-modern-3",
        title: "الطاولة الجانبية",
        content: "طاولة صغيرة للمشروبات بارتفاع 50-60 سم. ضعها على بعد 30 سم من الكرسي.",
        category: "layout"
      }
    ],
    classic: [
      {
        id: "lounge-classic-1",
        title: "كرسي البرشر",
        content: "كرسي برشر جلدي كلاسيكي. عالي الظهر (110 سم) بمسند قدم مدمج للأناقة والراحة.",
        category: "furniture"
      },
      {
        id: "lounge-classic-2",
        title: "الإضاءة الدافئة",
        content: "براني أرضية كلاسيكية بظل قماشي. إضاءة دافئة (2700K) للاسترخاء والقراءة.",
        category: "lighting"
      },
      {
        id: "lounge-classic-3",
        title: "السجادة الصغيرة",
        content: "سجادة صغيرة ناعمة تحت كرسي الاسترخاء. تحدد منطقة القراءة وتضيف دفئًا.",
        category: "materials"
      }
    ],
    industrial: [
      {
        id: "lounge-industrial-1",
        title: "كرسي الجلد",
        content: "كرسي استرخاء جلدي بإطار معدني. تصميم صناعي بسيط ومتين.",
        category: "furniture"
      },
      {
        id: "lounge-industrial-2",
        title: "الطاولة المعدنية",
        content: "طاولة جانبية معدنية أو خشبية خام. سطح معدني أو خشب سميك بملمس طبيعي.",
        category: "materials"
      },
      {
        id: "lounge-industrial-3",
        title: "الإضاءة الصناعية",
        content: "مصباح أرضي معدني بذراع متحركة. ارتفاع 160-180 سم للتحكم بالإضاءة.",
        category: "lighting"
      }
    ],
    scandinavian: [
      {
        id: "lounge-scandi-1",
        title: "كرسي مريح",
        content: "كرسي استرخاء بقماش ناعم وألوان فاتحة. أرجل خشبية خفيفة تظهر المساحة.",
        category: "furniture"
      },
      {
        id: "lounge-scandi-2",
        title: "الضوء الطبيعي",
        content: "ضع كرسي الاسترخاء قرب النافذة للاستفادة من الضوء الطبيعي. ستارة شفافة للتحكم.",
        category: "lighting"
      },
      {
        id: "lounge-scandi-3",
        title: "بطانية وكتاب",
        content: "بطانية ناعمة مطوية ورف كتب صغير. بساطة اسكندنافية تدعو للاسترخاء.",
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
        content: "استخدم 2-3 ألوان أساسية في جميع الغرف. الخشب والمعدن والزجاج مزيج مودرن مثالي.",
        category: "colors"
      },
      {
        id: "interior-modern-2",
        title: "التدفق بين الغرف",
        content: "أرضيات متصلة (باركيه أو سيراميك واحد) بين المساحات المفتوحة. يوسع المساحة بصريًا.",
        category: "layout"
      },
      {
        id: "interior-modern-3",
        title: "الإضاءة الطبقية",
        content: "امزج بين إضاءة السقف والبراني والإضاءة المخفية. التحكم بالمستويات لكل وقت من اليوم.",
        category: "lighting"
      }
    ],
    classic: [
      {
        id: "interior-classic-1",
        title: "اللغة الموحدة",
        content: "نقشات كلاسيكية متناسقة على الأبواب والخزائن. المقابض النحاسية تربط الغرف بأناقة.",
        category: "materials"
      },
      {
        id: "interior-classic-2",
        title: "الألوان الغنية",
        content: "ألوان غامقة دافئة (بني/كحلي/زيتوني) مع ذهبي. تضفي فخامة متناسقة للمنزل.",
        category: "colors"
      },
      {
        id: "interior-classic-3",
        title: "الإضاءة الفاخرة",
        content: "ثريات كلاسيكية في كل غرفة رئيسية. تصاميم متناسقة (كريستال أو نحاس).",
        category: "lighting"
      }
    ],
    industrial: [
      {
        id: "interior-industrial-1",
        title: "الخامات المكشوفة",
        content: "اجعل الخامات جزءًا من التصميم: طوب، خرسانة، معدن، خشب. لا حاجة للتغطية.",
        category: "materials"
      },
      {
        id: "interior-industrial-2",
        title: "المساحات المفتوحة",
        content: "قلل الجدران الداخلية. استخدم أعمدة معدنية أو جدران زجاجية للفصل.",
        category: "layout"
      },
      {
        id: "interior-industrial-3",
        title: "الإضاءة الصناعية",
        content: "استخدم نفس أسلوب الإضاءة في جميع الغرف: معلقة، أرضية، مخفية. لمبات إديسون موحدة.",
        category: "lighting"
      }
    ],
    scandinavian: [
      {
        id: "interior-scandi-1",
        title: "الضوء في كل مكان",
        content: "نوافذ كبيرة ومرايا تعكس الضوء. ألوان فاتحة (80% أبيض) لتوزيع الإضاءة.",
        category: "lighting"
      },
      {
        id: "interior-scandi-2",
        title: "الخشب الموحد",
        content: "استخدم نفس نوع الخشب الفاتح في جميع الغرف. البلوك أو البتولا مثاليان.",
        category: "materials"
      },
      {
        id: "interior-scandi-3",
        title: "النباتات في كل ركن",
        content: "10-15 نباتًا موزعة على المنزل. تنقي الهواء وتضيف حياة لكل مساحة.",
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
      content: "المسافة بين الأثاث تؤثر على الراحة. اترك 45-60 سم للممرات الرئيسية و90 سم على الأقل أمام الأبواب.",
      category: "layout"
    },
    {
      id: "generic-2",
      title: "توزيع الإضاءة",
      content: "امزج بين 3 أنواع إضاءة: عامة (السقف)، مهام (القراءة)، وجو (ديكور). التحكم المنفصل لكل نوع.",
      category: "lighting"
    },
    {
      id: "generic-3",
      title: "قاعدة الألوان",
      content: "60% لون أساسي، 30% لون ثانوي، 10% لون مميز. هذه القاعدة تنطبق على كل غرفة بشكل منفصل.",
      category: "colors"
    },
    {
      id: "generic-4",
      title: "جودة الخامات",
      content: "استثمر في الخامات الطبيعية: خشب صلب، قطن، كتان. تدوم longer وتتحسن مع الوقت.",
      category: "materials"
    },
    {
      id: "generic-5",
      title: "التخزين الذكي",
      content: "80% تخزين مخفي، 20% مفتوح للعرض. التنظيم المخفي يعطي مظهرًا أنظف وهدوءًا نفسيًا.",
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

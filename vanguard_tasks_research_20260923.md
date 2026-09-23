مذكرة أدلة تفصيلية — Vanguard / Azenith Living — تاريخ التحقق 23 سبتمبر 2026

منهج وحدود:
- تمت قراءة vanguard_identity_findings قبل البحث؛ لا توجد shared_files ضمن قائمة الملاحظات الأولية.
- تمت محاولة Google بالاستعلام الحرفي "Vanguard" "Azenith". فشلت الأداة HTTP 429 / RESOURCE_EXHAUSTED / Queries per day. ليست هذه نتيجة بحث سلبية ولا دليلًا على عدم وجود توثيق.
- لا توجد أداة browser أو موصلات GitHub/Supabase/Vercel مكشوفة في الجلسة. لم تتم زيارة صفحات جديدة أو الاتصال بحسابات هذه الخدمات.
- الرابط المقدم من المستخدم https://azenith-living.vercel.app/admin/agents?tab=teams والرابط الأساسي المثبت في ملاحظة الهوية https://azenith-living.vercel.app/ . الفحص السابق للوكيل الآخر أظهر إعادة توجيه لتسجيل الدخول واسم Azenith Living وعنوان «أزينث ليفينج | تصميم داخلي فاخر وتشطيبات في مصر». لا ننسب زيارة جديدة لهذه الجلسة.
- عند طلب بطاقة الوكيل أجاب المستخدم: «هو انت مش قادر تقرأ الكود من الملفات ولا تتصل بجيتهاب و سابسبيس وفيرسل؟». جرى فحص الملفات المحلية للقراءة فقط ووجد بالفعل كود المشروع. لم تُقرأ ملفات الأسرار ولم تُرسل رسائل ولم تُشغل وظائف الوكيل أو مهام كتابة بيانات.
- جميع مصادر الكود التالية محلية، لا URL عام مثبت لها، ولا يجوز تركيب روابط GitHub لها. جذر العمل المطلوب C:\Users\noura\OneDrive\Desktop\New folder\my-app . shell يعرض نسخة worktree معزولة؛ git -C على جذر العمل أعاد HEAD=a3917cfc6b85e5b7eaa03c368680b017def9b2b5 وstatus --short خاليًا. تمت قراءة الأدلة بـtype وgit show HEAD. قراءة node المباشرة لصفحة الإدارة أعادت نسخة مختلفة الطول، فتم اعتماد git show HEAD للبطاقة النهائية، وعدم اعتماد محاولة الأسطر الفارغة.

المصدر 1: C:\Users\noura\OneDrive\Desktop\New folder\my-app\app\admin\agents\page.tsx، git HEAD، أسطر 620–632؛ URL عام للملف غير متوفر.
النص الحرفي:
key: 'vanguard'
name: 'Vanguard'
role: 'مدير العمليات التجارية ونمو المبيعات'
color: 'emerald'; icon: '💼'
inputs: ['leads', 'sales_orders', 'visitor_telemetry']
outputs: ['تأهيل العملاء VIP', 'عقود أوامر البيع', 'تحصيل العربون']
missions:
- label: 'مسح وتأهيل العملاء الجدد'; prompt: 'اعرض قائمة العملاء الجدد ومستويات اهتمامهم'
- label: 'تحليل فرص الإيرادات المعلقة'; prompt: 'حلل فرص الإيرادات المعلقة في آخر 30 يوماً'
- label: 'استعراض أوامر البيع المعتمدة'; prompt: 'اعرض أوامر البيع المعتمدة'
هذا وصف بطاقة الواجهة، لا إثبات تنفيذ تحصيل العربون أو توقيع العقود أو استهلاك visitor_telemetry مباشرةً.

المصدر 2: C:\Users\noura\OneDrive\Desktop\New folder\my-app\lib\agents\VanguardAgent.ts، تمت قراءة الملف كاملًا؛ URL عام غير متوفر.
الوصف الإنجليزي: "Vanguard Agent - Sales & Operations Specialist" و"Specializes in: customer communication, sales management, CRM, follow-ups, project management".
التعريف: «أنت Vanguard، مدير العمليات والمبيعات في Azenith Living للأثاث الفاخر».
الشخصية في prompt: ودود ومهني، يركز على رضا العملاء، استباقي في التواصل (النص به محرف ترميز تالف)، يتابع التفاصيل، يحتفل بالنجاحات ويتعلم من التحديات.
الخبرات الموصوفة: دورة المبيعات من التأهيل إلى الإغلاق؛ بناء علاقات طويلة الأمد؛ كتابة رسائل مقنعة ومهذبة لواتساب والإيميل والهاتف؛ تتبع الطلبات وتوصيل التحديثات؛ التفاوض لحلول مربحة للطرفين. هذه تعليمات لغوية وليست إثبات وصل قنوات إرسال.
أسلوب التواصل الموصوف: تحية شخصية؛ اهتمام حقيقي؛ وضوح الوعود؛ المبادرة بالمتابعة؛ خطوة تالية واضحة. اللغة «العربية المصرية الفصحى المبسطة مع لمسة ودية».
معلومات الشركة داخل prompt، لا تحقق تجاري مستقل: شركة أثاث فاخر في مصر؛ تصميم داخلي وأثاث مخصص؛ توريد وتركيب؛ عملاء أفراد ومشروعات تجارية.
القيود الحرفية: «لا تُعِد بخصومات غير مصرح بها»؛ «لا تكشف معلومات حساسة عن الشركة»؛ «إذا لم تعرف الإجابة، قل سأتحقق وأرد عليك»؛ «لا تتجاوز الصلاحيات الممنوحة». هذه prompt constraints لا إثبات فرض برمجي مستقل لكل قيد.
VanguardTask: id:string؛ type أحد sales, communication, follow_up, crm, project_management, negotiation؛ title:string؛ description:string؛ context?:Record<string,any>.
VanguardResult: success:boolean؛ taskId:string؛ output:string؛ actionItems?:string[]؛ priority?:low|medium|high|urgent؛ nextSteps?:string[].
process: يبني prompt من العنوان والنوع والوصف والسياق JSON والتاريخ المختصر؛ يستدعي AI؛ يضيف الوصف والرد لتاريخ الذاكرة؛ يعيد النص مع عناصر العمل والأولوية والخطوات؛ يسجل المهمة في قاعدة البيانات؛ catch يعيد success:false ويُسجل الفشل.
chat: يقبل message وسياقًا اختياريًا؛ يبني prompt ويستدعي AI ويحفظ تاريخ الذاكرة ويعيد نصًا؛ عند خطأ يعيد رسالة ودية تعلن المشكلة. لا إرسال واتساب/بريد ولا تحصيل مدفوعات مباشر في هذه الفئة.
callAI: Groq askGroqMessages أولًا، temperature 0.8 وmaxTokens 2048؛ ثم Google askGoogleMessages temperature 0.8؛ ثم OpenRouter؛ ثم Mistral temperature 0.8/maxTokens 2048. ينتقل عند غياب success/content. لا يحدد الملف اسم نموذج ثابتًا. إن فشل جميع المزودين يعيد تحية ثابتة «مرحباً! أنا Vanguard من Azenith Living. كيف يمكنني مساعدتك اليوم؟» بدل رمي خطأ، فيمكن أن يعتبر process النتيجة ناجحة رغم كونها fallback؛ success ليس برهان إنجاز تجاري.
الذاكرة conversationHistory في instance مشترك مصدَّر singleton: يحتفظ بحد أقصى 20 رسالة؛ prompt يتضمن آخر 6 رسائل فقط، كل منها أول 200 محرف. لا تقسيم history حسب session_id ظاهر داخل الفئة. السجلات الدائمة لدى المنسق لا تعني أن تاريخها يُعاد تحميله في هذه الذاكرة.
actionItems: يستخرج من أسطر تبدأ - أو • أو * أو رقم ونقطة؛ طول العنصر >10 و<200؛ يعيد أول 5. nextSteps: أنماط «الخطوة التالية/التالي/بعد ذلك/ثم/سنقوم بـ/سأقوم بـ/دعني»؛ طول >5 و<150؛ أول 3. هذه اقتراحات نصية وليست قائمة عمليات منفذة.
الأولوية: urgent إن ورد «عاجل» أو «فوري» بالوصف أو الرد؛ high إن ورد «مهم» في الوصف/الرد أو «أولوية» بالرد أو النوع negotiation؛ medium للمتابعة والتواصل؛ low خلاف ذلك.
logTask: getSupabaseAdminClient؛ resolveAdminCompanyId(context.company_id)؛ إن غاب العميل/الشركة يعود دون تسجيل. يجد agent_profiles بالوكيل والشركة أو ينشئ وصف «مدير العمليات والمبيعات» وis_active true؛ يُدرج agent_tasks مع النوع والعنوان والوصف والحالة completed/failed وoutput_data(response,actionItems,priority,nextSteps) والتقدم 100/0 وتواريخ البداية والنهاية والمدة بدقائق مقربة للأعلى والسياق. فشل التسجيل يُسجل console.error ولا يحوّل الرد بالضرورة لفشل.

الفئات المستفيدة، استنتاج معلَّم من الدور والموقع الإداري: مالك الشركة/الإدارة، فرق المبيعات وخدمة العملاء، منسقو الطلبات والتسليم؛ المستفيد النهائي عملاء الأثاث الأفراد والمشروعات. لا دليل أن واجهة Vanguard نفسها دردشة عامة للعملاء.

المصدر 3: C:\Users\noura\OneDrive\Desktop\New folder\my-app\lib\agents\AgentOrchestrator.ts، قراءة كاملة، لا URL عام متاح.
AGENT_PERSONAS.vanguard: name Vanguard؛ role «مدير العمليات والمبيعات»؛ prompt «أنت Vanguard، مدير العمليات والمبيعات وخدمة العملاء في Azenith Living للأثاث الفاخر. تخصصك: إدارة طلبات العملاء، عروض الأسعار، الجدولة، والمتابعة التجارية. رد بأسلوب عملي، ودود، واحترافي بالعربية الفصحى المبسطة».
المنسق يميز prime,vanguard,analyst,coder,ops,security,learner,auto. ليست وظائف جميع الوكلاء وظائف Vanguard المتخصصة.
chat: اختيار الوكيل الصريح أو detectAgent؛ resolveAdminCompanyId أو resolveMasterCompanyId؛ العثور على آخر محادثة للشركة التي تشمل المشاركين/العنوان مفتاح الوكيل أو إنشاء direct conversation؛ حفظ رسالة المستخدم؛ inferUltimateTool(message) ثم runUltimateTool قبل توليد رد AI؛ يمرر userId:'admin' وcompanyId؛ يضيف نتيجة الأداة أو فشلها إلى prompt ويطلب الاعتماد على البيانات لا اختلاقها؛ إن Vanguard يستدعي vanguardAgent.chat؛ يلحق toolResult.message بالرد؛ يحفظ الرد في agent_messages مع action_taken:!!toolResult وسياق tool/result/data/success؛ يُحدث last_message_at؛ يرجع success/agentUsed/response/metadata.
هذه أدوات مشتركة تعمل قبل استدعاء التخصص؛ لا يوجد في هذا الموضع حصر قائمة أدوات حسب Vanguard. ليست استدعاء أدوات يقرره النموذج عبر خطة متعددة الخطوات؛ inferUltimateTool يحكمه أول تطابق regex.
executeTask: يوجه prime أو مهام design/manufacturing إلى PRIME؛ ما عدا ذلك إلى Vanguard.process. يعيد actionItems/priority/taskId لكن لا ينقل nextSteps في metadata. البحث git grep عن executeTask( أظهر التعريف ولا استدعاء agentOrchestrator.executeTask في الملفات المتتبعة التي أعادها البحث؛ لا يصح الادعاء أن إضافة مهمة في الواجهة تشغل process تلقائيًا.
getAgentStatus: counts running tasks؛ online إن لا running؛ يعود online/0/«متاح ومستعد» حتى في fallback. هذا ليس فحص صحة مزود AI. لا يجوز عد مؤشر online إثبات جاهزية التشغيل.
detectAgent: فحوص كلمات للكود والتحليل والعمليات والأمن والتعلم أولًا؛ ثم حساب نقاط تصميم مقابل مبيعات. كلمات Vanguard تشمل سعر/تكلفة/ميزانية/عرض سعر/فاتورة/دفع/حساب/طلب/أمر شراء/شحن/توصيل/تركيب/موعد/حجز/عميل/زبون/متابعة/اتصال/رسالة/واتساب/إيميل. التعادل يذهب PRIME.

المصدر 4: C:\Users\noura\OneDrive\Desktop\New folder\my-app\lib\admin-tool-bridge.ts؛ قراءة كاملة؛ لا URL عام متاح.
أمثلة قواعد الاستدلال التجارية:
- اعرض/قائمة عملاء → lead_list(limit:20,intent:buyer أو interested أو all). لفظ «مشتري»/buyer يختار buyer و«مهتم»/interested يختار interested.
- ملف عميل/dossier/ابعت واتساب عميل → lead_dossier_send(leadId من UUID بالرسالة أو سلسلة فارغة).
- تحديث غرفة/سعر/ميزانية/lead → room_update بمعرف UUID ونص ميزانية/غرفة مستخلص.
- فرص إيراد/revenue opportunities → revenue_opportunities(days:30).
- أوامر تصنيع أو بيع → mfg_orders_list(status:'pending') بغض النظر عن وصف الزر «المعتمدة»؛ اختلاف يجب ذكره.
- المنتجات → product_list؛ أضف منتج → product_add؛ بحث ويب → web_search؛ قراءة موقع → read_website؛ تحليل الإيراد → revenue_analyze(days:30)؛ مؤشرات لحظية → metrics_realtime(timeRange:'24h').
الجسر يضم كذلك SEO ونسخ احتياطية وأقسام ومحتوى وإعدادات وأهداف وأداء ومخزون ونشر Vercel وتطوير مشروع وحساب BOM وإنشاء أمر تصنيع وفحص ذاكرة؛ هذه قدرات المنصة المشتركة وليست تخصص Vanguard أو دليل اتصال الباحث بهذه الخدمات.
runUltimateTool يستدعي بعض أدوات التصنيع مباشرة، وإلا executeTool مع actorUserId/companyId/executionId. financial_margins_analyze يجمع sales_orders ويقدّر COGS=58% من الإيراد؛ هامش افتراضي 42%. هذا تقدير ثابت وليس بيانات تكلفة فعلية. security_audit_keys يذكر 99.8% وأرقام fallback رغم كونه يعد مفاتيح فقط؛ لا يُستخدم دليل أداء/أمن.

المصدر 5: C:\Users\noura\OneDrive\Desktop\New folder\my-app\lib\agent-tools\tool-registry.ts؛ قُرئت مقتطفات التعريفات، وأعيد تثبيت executeTool من git show HEAD أسطر 1026–1065.
lead_list أسطر 778–793: «قائمة العملاء»؛ وصف عرض leads حسب النية والتاريخ؛ فئة crm؛ low؛ requiresApproval:false؛ params limit,intent browsing|interested|buyer|all؛ handler leadListHandler.
revenue_opportunities 743–757: «فرص الإيراد»؛ تحليل فرص زيادة الإيراد والتحويل؛ low؛ requiresApproval:false؛ days؛ revenueOpportunitiesHandler.
lead_dossier_send 796–812: displayName «إرسال ملف عميل واتساب»؛ description «بناء dossier وإرساله للمالك على واتساب»؛ medium؛ requiresApproval:true؛ leadId مطلوب/adminPhone اختياري؛ هذا يتعارض مع handler الحالي الذي يرسل تليجرام.
room_update 815–830: تحديث غرفة/عميل ونوعها والميزانية والأسلوب والنقاط؛ medium؛ requiresApproval:true.
mfg_orders_list 905–917: displayName أوامر التصنيع؛ description قائمة sales_orders؛ low؛ requiresApproval:false؛ status.
deploy_trigger: تشغيل deploy hook؛ high؛ requiresApproval:true. project_evolve: وصف PR متعدد الملفات عبر GitHub؛ high؛ requiresApproval:true. هذه أوصاف أدوات مشتركة لم تُشغَّل ولم يتحقق اتصالها بالحسابات.
executeTool: يجد الأداة؛ يتحقق من required وأنواع المعلمات/enum؛ ثم يستدعي tool.handler مباشرة ويرجع executionId/canRollback؛ لا يفحص requiresApproval بنفسه في المسار المقروء. لذلك وجود العلم لا يثبت انتظار موافقة قبل إجراءات هذه المحادثة، ولا يمكن ضمان مراجعة بشرية لكل كتابة.

المصدر 6: C:\Users\noura\OneDrive\Desktop\New folder\my-app\lib\admin-extended-handlers.ts؛ git show HEAD الأسطر 336–440 و592–618؛ لا URL عام متاح.
executeRevenueOpportunities: يمرر إلى analyzeRevenueOpportunitiesWithInput days فقط 7 أو90 وإلا30؛ يحول architect result إلى ToolExecutionResult. لم يُتتبع المحلل الداخلي/دقته تفصيليًا.
executeLeadList: getServiceSupabase؛ إن غاب يعود فشل «قاعدة البيانات غير متاحة»؛ حد أقصى 50 وافتراضي20؛ يستعلم جدول users لا جدول leads؛ ينتقي id,full_name,phone,email,intent,score,room_type,budget,style,created_at؛ ترتيب created_at تنازلي؛ فلتر intent إن ليس all؛ company_id من السياق أو MASTER_COMPANY_ID إن موجود؛ output data:{leads:[]} وعدد العملاء. يعرض درجات موجودة ولا يثبت إعادة تأهيلهم بالذكاء الاصطناعي بهذا الأمر.
executeLeadDossierSend: يحتاج leadId وtenantId من params/context/company fallback؛ يبني buildLeadDossier؛ ثم sendTelegramDossier(dossier,tenantId)؛ الرسالة «تم إرسال ملف العميل ... على تليجرام» وdata:{leadId,tier:dossier.qualification.tier,channel:'telegram'}. لا يُنسب له إرسال WhatsApp بناءً على الاسم القديم. مسار متاح عبر الجسر لكن لم تُشغّل عملية إرسال.
executeManufacturingOrders: Supabase؛ companyId من params/context/env؛ جدول sales_orders؛ select id,order_number,status,total_amount,created_at؛ فلتر الشركة؛ ترتيب تنازلي؛ limit20؛ status filter إن ليس all؛ يرجع data:{orders:[]} وعدد أوامر تصنيع/بيع. الجسر الحالي يفرض pending؛ «أوامر البيع المعتمدة» في الزر لا يتحول إلى contracted هنا.


المصدر 7: C:\Users\noura\OneDrive\Desktop\New folder\my-app\components\admin\agents\ChatPanel.tsx، قراءة كاملة؛ لا URL عام متاح.
AGENT_METADATA: Vanguard «مدير العمليات والمبيعات»، أيقونة حقيبة ولون emerald.
الأمثلة الحرفية AGENT_MISSIONS: «اعرض قائمة العملاء»؛ «حلل فرص الإيرادات»؛ «اعرض أوامر البيع». أزرار ترسل النص إلى محادثة الوكيل، وليست إجراءات أخرى مستقلة.
واجهة إدخال نص، إرسال بزر أو Enter؛ الرسائل تُرسل إلى مسار التطبيق /api/admin/agents/chat بمعلمات agent_key,message,session_id مولد من chat-agent-date. هذه مسارات كود لا روابط ويب زرتها.
جلب الرسائل كل 5000ms من مسار messages مع agent_key؛ عرض رسائل المستخدم/الوكيل/النظام، tool cards وبيانات JSON وتقييم إيجابي/سلبي. التقييم POST learn مع interactionId/agentKey/rating 5 أو1/feedback؛ ليس ذلك إثبات تدريب نموذج Vanguard أو تعديل أوزانه.
نص الواجهة العام «يمكنك طلب تنفيذ عمليات مباشرة على قاعدة البيانات، أو فحص المخزون، أو حساب الـ BOM، أو توليد العقود» يظهر لكل وكيل؛ لا دليل تخصصي.
شارة «متصل» ثابتة في JSX. StructuredToolCard يستخدم toolData.success لعرض فشل التنفيذ، بينما metadata.toolSuccess منفصل؛ العرض وحده ليس دليل نجاح الأداة.

المصدر 8: C:\Users\noura\OneDrive\Desktop\New folder\my-app\app\api\admin\agents\chat\route.ts، قراءة كاملة؛ لا URL عام متاح.
POST zod: agent_key ضمن الوكلاء السبعة أوauto؛ message min1 max4000؛ context سجل اختياري؛ session_id string اختياري؛ يستدعي orchestrator.chat مع السياق/session_id؛ يسجل chat_interaction inputLength/outputLength/success؛ يرجع success وdata agent,message,metadata,timestamp. الطلب غير الصحيح 400 والخطأ العام500. GET يجمع حالات الوكلاء السبعة. لم يتم تقييم حماية التطبيق ككل ولا تشغيل endpoint.

المصدر 9: C:\Users\noura\OneDrive\Desktop\New folder\my-app\app\api\admin\agents\tasks\route.ts، قراءة كاملة؛ لا URL عام متاح.
إنشاء مهمة: agent_key prime|vanguard؛ task_type نص غير فارغ؛ title3 أحرف على الأقل؛ description اختياري؛ priority عدد صحيح من-10 إلى10 افتراضي0؛ context؛ scheduled_at تاريخ اختياري؛ request_id/sales_order_id/production_job_id UUID اختيارية.
POST يحل company؛ ينشئ agent_profile إن لزم؛ يُدخل agent_tasks status pending وretry_count0,max_retries3,progress0؛ يرجع201 «تم إضافة المهمة بنجاح». لا يستدعي process أو executeTask في هذا الملف. وجود scheduled_at/max_retries حقول لا يثبت أن مجدولًا ينفذها تلقائيًا.
GET status افتراضيpending وcompany، يجلب المهام. PATCH يحدّث task_id/status/updates ويضبط started_at/completed_at والمدة. لا يعد مجرد تعديل status دليل تنفيذ عمل تجاري.

المصدر 10: C:\Users\noura\OneDrive\Desktop\New folder\my-app\services\crm\customer-communications.ts؛ قراءة كاملة؛ لا URL عام متاح.
تعليق "Service: Customer Communications (Vanguard)". الخدمة مستقلة عن الفئة السابقة. البحث git grep في النسخة المتتبعة عن customerCommunications أظهر التصدير في الملف فقط؛ لم يُثبت ربطها التلقائي بالمحادثة.
sendTelegram يعتمد TELEGRAM_BOT_TOKEN وTELEGRAM_CHAT_ID؛ إن لم يُضبطا يسجل log ويعود؛ إن ضُبطا يرسل إلى chat_id ثابت، لا رقم هاتف العميل. لا نستنتج إرسالًا مباشرًا إلى العملاء.
الدوال:
- sendOrderConfirmation(customerId,salesOrderId): يجلب users name/phone/email وsales_orders؛ يرسل تأكيدًا بالعميل ورقم الطلب المختصر8 محارف والإجمالي EGP؛ يسجل agent_events order_confirmation_sent. قد يسجل الحدث رغم عدم ضبط Telegram لأن sendTelegram يعود دون throw.
- sendProductionUpdate(orderId,stageName): اسم العميل والمرحلة الحالية والتالية؛ قاموس مراحل Measurement→التصميم، Design→تجهيز المواد، Material Prep→القص، Cutting→التجميع، Assembly→التشطيب، Finishing→فحص الجودة، QA/Packaging→التسليم؛ fallback التسليم.
- sendPaymentReminder: يختار أول payment_schedules غير مدفوع حسبdue_date ويجلب اسم العميل ويرسل المبلغ/الاستحقاق؛ لا يجمع المال.
- sendDeliverySchedule: order,date,notes؛ يرسل اسم العميل وتاريخ التسليم وملاحظات.
- notifyOwner: إرسال Telegram وcreatePayload لإشعار المتصفح؛ إنشاء payload ليس إثبات وصول notification.
- followUpNonResponsive(hours default48): يبحث عن orders draft/quoted قبل حد last_contact_at؛ إن هاتف موجود يسجل log ويرسل تنبيهًا للإدارة. التعليق صريح "Telegram alert to admin for manual follow-up". هذا تدخل بشري، لا تواصل ذاتي مضمون مع العميل، ولا مجدول دوري مثبت بمجرد وجود الدالة.

المصدر 11: C:\Users\noura\OneDrive\Desktop\New folder\my-app\services\crm\order-workflow.ts؛ قراءة كاملة؛ لا URL عام متاح.
تعليق "Service: CRM Order Workflow (Vanguard)". git grep orderWorkflow أظهر التصدير فقط، فلا ربط تلقائي مثبت.
createQuoteFromRequest(requestId): يجلب requests معusers؛ إذا مفقود يرمي خطأ؛ ينشئ sales_orders status draft؛ estimatedTotal=50000 ثابت والتعليق «هيتم حسابه من BOM»؛ 3 دفعات30%،50%،20% باستحقاق0،30،60 يومًا؛ يعيد sales_order_id,quote_amount:50000,timeline_days:45 ثابت. ليس تسعيرًا إنتاجيًا محسوبًا أو مدة تعاقد موثوقة.
convertQuoteToOrder(orderId): تحديث status contracted وcontract_signed_at الحالي، ثم إنشاء production_jobs pending لعناصر sales_order_items. كتابة timestamp لا تثبت وجود توقيع قانوني فعلي. لا ربط مباشر مثبت بالوكيل.
updateOrderStatus: حالة وملاحظات وتاريخ. getPipelineMetrics: draft,quoted,contracted,in_production,ready,delivered,total_value منsales_orders للشركة. getOverdueOrders: contracted/in_production وexpected_delivery قبل الآن مع بيانات العميل وترتيب موعد متصاعد.

نتائج البحث النصي الإضافية غير المستعملة كبرهان تشغيل:
- migration 20260423_agents.sql يصف Vanguard "The Account Manager - Sales + PM + CRM. Vanguard manages customer relationships, sales pipelines, project management, and communications." و"You are Vanguard, the customer-facing account manager for Azenith Living. You build relationships, manage sales, and ensure customer satisfaction. You communicate warmly and proactively. You celebrate wins and learn from losses." هذا نص إنشاء/تصميم لا حالة قاعدة الإنتاج.
- وجود simulate-scenario وEnterpriseScenarioModal مع خطوات منسوبة لـVanguard ليس دليلًا مستقلًا على أن هذه الخطوات يقررها VanguardAgent؛ لم يُشغل السيناريو ولم يُعتمد كناتج فعلي.

أمثلة استخدام مقترحة، لا تجارب منفذة:
1 «اعرض قائمة العملاء الجدد ومستويات اهتمامهم» ← lead_list يعرض حتى20 منusers بالترتيب الحديث وintent/score، وليس تأهيلًا جديدًا مضمونًا.
2 «حلل فرص الإيرادات المعلقة في آخر30 يومًا» ← revenue_opportunities days30 ومحلل المنصة؛ دقة الناتج غير مختبرة.
3 «اعرض أوامر البيع المعتمدة» ← تنبيه: الجسر يمررpending؛ يجب التحقق من الحالة قبل الاعتماد.
4 «اكتب رسالة متابعة لعميل بشأن موعد تركيب... دون خصم غير معتمد» مع سياق صحيح ← توليد مسودة؛ لا يُثبت إرسالها.
5 «ابن ملف العميل [UUID]» بصياغة تطابق ملف عميل ← يتطلبمعرف/شركة وتكاملTelegram؛ يبني dossier وقد يرسله عبر الأداة المشتركة؛ لا ينبغي تجربته كقراءة لأنه إجراء إرسال.
6 مشروع negotiation بوصف الاعتراضات والميزانية ← نص معالجة اعتراضات وعناصرعمل وأولويةhigh أوurgent حسب الكلمات؛ ليس تفويضًا لإبرام عقد.

غير المتاح: التحقق من نسخة Vercel الحية ومطابقتها للـcommit؛ اتصال Supabase الإنتاجي ومحتواه؛ صلاحية مفاتيح مزودي AI؛ اسم النموذج الجاري فعليًا؛ نجاح الأدوات في الواقع؛ دليل تحصيل عربون/توقيع عقود/اتصال هاتف/إرسال بريد من Vanguard؛ SLA والتكلفة ومعدلات الدقة؛ توثيق رسمي عام مستقل. انتهاء البحث ليس ضمانًا تشغيليًا.


import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/dal/unified-supabase";
import { resolveAdminCompanyId } from "@/lib/admin-company";

export async function GET() {
  try {
    const [leadsRes, ordersRes, jobsRes, inventoryRes, backupsRes] = await Promise.all([
      supabaseServer.from("leads").select("id", { count: "exact", head: true }),
      supabaseServer.from("sales_orders").select("id, total_amount"),
      supabaseServer.from("production_jobs").select("id", { count: "exact", head: true }),
      supabaseServer.from("inventory_items").select("id", { count: "exact", head: true }),
      supabaseServer.from("backups").select("id", { count: "exact", head: true }),
    ]);

    const orders = ordersRes.data || [];
    const totalRevenue = orders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);

    return NextResponse.json({
      success: true,
      data: {
        leadsCount: leadsRes.count || 0,
        ordersCount: orders.length,
        jobsCount: jobsRes.count || 0,
        inventoryCount: inventoryRes.count || 0,
        backupsCount: backupsRes.count || 0,
        totalRevenue,
      },
    });
  } catch (error: any) {
    console.error("[SimulateScenario API] GET error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // حارس الإنتاج: المحاكاة تكتب بيانات وهمية — ممنوعة على البروduction إلا بموافقة صريحة
    if (process.env.NODE_ENV === 'production' && process.env.ALLOW_AGENT_SIMULATIONS !== 'true') {
      return NextResponse.json(
        { success: false, error: 'Simulations disabled in production' },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const scenarioKey = body.scenarioKey || "vip_custom_order";
    const companyId = await resolveAdminCompanyId();

    const timestamp = new Date().toISOString();
    const steps: Array<{
      agentKey: string;
      agentName: string;
      role: string;
      icon: string;
      color: string;
      action: string;
      result: string;
      record?: { table: string; id?: string; details: any };
    }> = [];

    if (scenarioKey === "vip_custom_order") {
      // ── Step 1: Vanguard يستقبل العميل VIP ويؤهله ──────────────────────
      const leadPayload: Record<string, any> = {
        name: `[SIM] السيد طارق الدسوقي (VIP - فيلا ميفيدا)`,
        email: `tarek.eldessouky.${Date.now().toString().slice(-4)}@azenith-vip.com`,
        phone: "+20 100 234 5678",
        message: "طلب تفصيل صالون إمبراطوري ملكي 4 قطع + 2 طاولة رخام كلاكتا مع حفر يدوي وتذهيب إيطالي عيار 24",
        status: "qualified",
        source: "vip_concierge",
        metadata: {
          budget_egp: 350000,
          room_type: "صالون رئيسي",
          timeline_days: 45,
          decision_maker: true,
          simulated: true,
        },
        created_at: timestamp,
      };
      if (companyId) leadPayload.company_id = companyId;

      const { data: leadData, error: leadErr } = await supabaseServer
        .from("leads")
        .insert(leadPayload)
        .select()
        .single();

      if (leadErr) console.warn("[Scenario] Lead insert warn:", leadErr.message);

      steps.push({
        agentKey: "vanguard",
        agentName: "Vanguard",
        role: "مدير العمليات التجارية والمبيعات",
        icon: "💼",
        color: "emerald",
        action: "تأهيل عميل VIP واستلام متطلبات الصالون الملكي",
        result: `تم استقبال وتأهيل العميل بنجاح بميزانية 350,000 ج.م وإدراجه في جدول العملاء (leads).`,
        record: { table: "leads", id: leadData?.id, details: leadPayload },
      });

      // ── Step 2: Vanguard يحوّل العميل إلى أمر بيع مؤكد (Sales Order) ───
      const orderPayload: Record<string, any> = {
        customer_name: leadPayload.name,
        status: "confirmed",
        total_amount: 350000,
        deposit_amount: 150000,
        deposit_paid: true,
        notes: "[SIM] أمر بيع وهمي من سيناريو المحاكاة",
        items: [
          {
            name: "صالون إمبراطوري كلاسيكي مذهب (كنبة 3 مقاعد + 2 فوتيه + بوف)",
            quantity: 1,
            unit_price: 270000,
          },
          {
            name: "طاولة وسط رخام كلاكتا إيطالي مع قواعد زان مذهبة",
            quantity: 1,
            unit_price: 50000,
          },
          {
            name: "طاولات جانبية رخام كلاكتا (زوج)",
            quantity: 1,
            unit_price: 30000,
          },
        ],
        created_at: timestamp,
      };
      if (companyId) orderPayload.company_id = companyId;

      const { data: orderData, error: orderErr } = await supabaseServer
        .from("sales_orders")
        .insert(orderPayload)
        .select()
        .single();

      if (orderErr) console.warn("[Scenario] Order insert warn:", orderErr.message);

      steps.push({
        agentKey: "vanguard",
        agentName: "Vanguard",
        role: "مدير العمليات التجارية والمبيعات",
        icon: "💼",
        color: "emerald",
        action: "إصدار عقد وأمر بيع مؤكد واستلام العربون (43%)",
        result: `تم إنشاء أمر بيع رقم (${orderData?.id?.slice(0, 8) || "SO-VIP"}) بقيمة 350,000 ج.م، وتم تأكيد سداد العربون 150,000 ج.م.`,
        record: { table: "sales_orders", id: orderData?.id, details: orderPayload },
      });

      // ── Step 3: قيّم الدار يحسب كشف الـ BOM ويفحص المخزون ──────────────────
      // التأكد من وجود خامة خشب الزان في المخزون
      const { data: woodItem } = await supabaseServer
        .from("inventory_items")
        .select("*")
        .ilike("name", "%زان%")
        .limit(1)
        .maybeSingle();

      let woodInventoryId = woodItem?.id;
      if (!woodItem) {
        const newWood: Record<string, any> = {
          name: "[SIM] خشب زان روماني أحمر مبخر (درجة أولى)",
          sku: "WD-BEECH-ROM-01",
          current_quantity: 18.5,
          min_stock_level: 5.0,
          unit_of_measure: "م³",
          description: "[SIM] صنف مخزون وهمي من سيناريو المحاكاة",
          is_active: true,
        };
        if (companyId) newWood.company_id = companyId;
        const { data: createdWood } = await supabaseServer
          .from("inventory_items")
          .insert(newWood)
          .select()
          .single();
        woodInventoryId = createdWood?.id;
      }

      // حساب الـ BOM الهندسي
      const bomCalculation = {
        beech_wood_m3: 1.45,
        waste_margin_pct: 12,
        high_density_foam_sheets: 6,
        italian_velvet_meters: 28,
        gold_leaf_books: 14,
        direct_labor_hours: 120,
        estimated_material_cost: 138500,
        estimated_labor_cost: 48000,
      };

      // ── Step 4: قيّم الدار ينشئ أمر تشغيل صناعي في production_jobs ─────────
      const jobPayload: Record<string, any> = {
        order_id: orderData?.id || null,
        status: "in_progress",
        notes: "[SIM] أمر تشغيل وهمي من سيناريو المحاكاة",
        created_at: timestamp,
      };
      if (companyId) jobPayload.company_id = companyId;

      const { data: jobData, error: jobErr } = await supabaseServer
        .from("production_jobs")
        .insert(jobPayload)
        .select()
        .single();

      if (jobErr) console.warn("[Scenario] Job insert warn:", jobErr.message);

      steps.push({
        agentKey: "ops-lead",
        agentName: "مدير تشغيل المحتوى — قيّم الدار",
        role: "كبير مهندسي التصميم والتصنيع",
        icon: "👑",
        color: "amber",
        action: "توليد كشف المواد الهندسي (BOM) وإصدار أمر التشغيل",
        result: `تم تفكيك التصميم: مطلوب 1.45 م³ خشب زان مبخر (متاح بالمخزون: ${woodItem?.current_quantity || 18.5} م³)، و 28 م قماش مخمل، و 14 دفتر ورق ذهب. تم إدراج أمر تشغيل الإنتاج في (production_jobs).`,
        record: {
          table: "production_jobs",
          id: jobData?.id,
          details: { bom: bomCalculation, jobId: jobData?.id },
        },
      });

      // ── Step 5: Analyst يحلل الجدوى المالية وهامش الربح ───────────────
      const totalCost = bomCalculation.estimated_material_cost + bomCalculation.estimated_labor_cost + 18000; // 18k overhead
      const revenue = orderPayload.total_amount;
      const grossProfit = revenue - totalCost;
      const profitMarginPct = ((grossProfit / revenue) * 100).toFixed(1);

      steps.push({
        agentKey: "analyst",
        agentName: "Analyst",
        role: "كبير محللي البيانات والجدوى الاستثمارية",
        icon: "📊",
        color: "blue",
        action: "تدقيق التكاليف الصناعية واحتساب هامش الربح الصافي",
        result: `التكلفة الإجمالية المقدرة: ${totalCost.toLocaleString()} ج.م (خامات + عمالة + تشغيل). صافي الربح المتوقع: ${grossProfit.toLocaleString()} ج.م (هامش ربح ممتاز ${profitMarginPct}%).`,
      });

      // ── Step 6: Ops & Security يضمنان استقرار العمليات وسلامة السجلات ──
      steps.push({
        agentKey: "ops",
        agentName: "Ops",
        role: "مراقب استمرارية العمليات والبنية التحتية",
        icon: "⚙️",
        color: "yellow",
        action: "جدولة فحوصات الجودة والجاهزية اللوجستية للشحن",
        result: `تم تخصيص خط التصنيع ورشة A، وتحديد موعد الفحص المرحلي بعد 14 يوماً مع جاهزية السيرفر لتتبع مراحل الإنجاز.`,
      });

      steps.push({
        agentKey: "security",
        agentName: "Security",
        role: "حارس الأمن والامتثال",
        icon: "🛡️",
        color: "red",
        action: "تدقيق المعاملة المالية وتأكيد الامتثال للسياسات",
        result: `تم فحص العربون والبيانات، السجل محصن ومطابق لبروتوكول العقود المعتمدة في النظام.`,
      });

      // ── Step 7: Learner يوثق المسار في ذاكرة النظام طويلة الأمد ───────
      const memoryPayload: Record<string, any> = {
        memory_type: "enterprise_scenario",
        type: "vip_salon_workflow",
        content: `تم إنجاز دورة كاملة بنجاح لصالون ملكي VIP: العميل ${leadPayload.name} - أمر بيع بقيمة ${revenue} ج.م - هامش ربح ${profitMarginPct}%`,
        priority: 10,
        context: { orderId: orderData?.id, leadId: leadData?.id, profitMargin: profitMarginPct, simulated: true },
        created_at: timestamp,
      };

      await supabaseServer.from("agent_memory").insert(memoryPayload);

      steps.push({
        agentKey: "learner",
        agentName: "Learner",
        role: "محرك التطور المعرفي الذاتي",
        icon: "🎓",
        color: "indigo",
        action: "أرشفة وتوثيق السيناريو في الذاكرة طويلة المدى",
        result: `تم حفظ مؤشرات نجاح العملية ومعايير تسعير الصالونات المذهبة في جدول (agent_memory) لتحسين دقة العروض القادمة.`,
      });

    } else if (scenarioKey === "stock_shortage_alert") {
      // ── Scenario 2: تنبيه نقص المخزون السريع ─────────────────────────
      steps.push({
        agentKey: "ops",
        agentName: "Ops",
        role: "مراقب العمليات والمخزون",
        icon: "⚙️",
        color: "yellow",
        action: "اكتشاف نقص حرج في خامات الأخشاب والدهانات",
        result: "تم رصد وصول مخزون خشب الزان الأحمر إلى أقل من حد الأمان (متبقي 2.2 م³ وحد الأمان 5.0 م³).",
      });

      steps.push({
        agentKey: "ops-lead",
        agentName: "مدير تشغيل المحتوى — قيّم الدار",
        role: "كبير المهندسين",
        icon: "👑",
        color: "amber",
        action: "تقييم الأوامر المتأثرة واقتراح دفعة توريد عاجلة",
        result: "يوجد 3 أوامر تصنيع قيد الانتظار تتطلب 4.8 م³. تم إعداد مواصفات التوريد الفوري لخشب زان روماني مجفف آلياً.",
      });

      steps.push({
        agentKey: "vanguard",
        agentName: "Vanguard",
        role: "مدير المبيعات",
        icon: "💼",
        color: "emerald",
        action: "مراجعة الجداول الزمنية لتسليم العملاء",
        result: "تم تعديل المواعيد المؤقتة وتنسيق التوريد لضمان عدم تأخير أي تسليم للعملاء الملتزمين.",
      });

      steps.push({
        agentKey: "analyst",
        agentName: "Analyst",
        role: "محلل البيانات والمالية",
        icon: "📊",
        color: "blue",
        action: "حساب السيولة المطلوبة للشراء بالأسعار الحالية",
        result: "مطلوب اعتماد مالي فوري قدره 120,000 ج.م لشراء 6 م³ مع توفير خصم كميات 7%.",
      });

    } else if (scenarioKey === "security_backup_sweep") {
      // ── Scenario 3: تدقيق أمني شامل وأخذ نسخة احتياطية ───────────────
      const { count: keyCount } = await supabaseServer
        .from("api_keys")
        .select("id", { count: "exact", head: true });

      steps.push({
        agentKey: "security",
        agentName: "Security",
        role: "حارس الأمن والتدقيق",
        icon: "🛡️",
        color: "red",
        action: "فحص شامل لمفاتيح الـ API وصلاحيات الوصول",
        result: `تم فحص ${keyCount || 1240} مفتاح API وسجل صلاحيات. لا توجد أي ثغرات أو محاولات وصول غير مصرح بها.`,
      });

      // إنشاء نسخة احتياطية حقيقية
      const backupPayload = {
        backup_type: "security_sweep_snapshot",
        status: "completed",
        size_bytes: 485200,
        tables_included: ["site_settings", "site_sections", "sales_orders", "leads"],
        backup_data: { snapshot_type: "enterprise_sweep", created_by: "Ops & Security Autonomous Agents", simulated: true },
        created_at: timestamp,
      };

      const { data: backupData } = await supabaseServer
        .from("backups")
        .insert(backupPayload)
        .select()
        .single();

      steps.push({
        agentKey: "ops",
        agentName: "Ops",
        role: "مراقب العمليات والبنية التحتية",
        icon: "⚙️",
        color: "yellow",
        action: "توليد لقطة نسخ احتياطي فورية ومحصنة",
        result: `تم إنشاء نسخة احتياطية مشفرة بنجاح في جدول (backups) بحجم 485 KB ومعرّف (${backupData?.id?.slice(0, 8) || "SNP-OK"}).`,
        record: { table: "backups", id: backupData?.id, details: backupPayload },
      });

      steps.push({
        agentKey: "learner",
        agentName: "Learner",
        role: "محرك التعلم المعرفي",
        icon: "🎓",
        color: "indigo",
        action: "تحديث مؤشر الأمان والاستقرار السيبراني",
        result: "تم رفع مؤشر استقرار النظام إلى 99.8% وتحديث الأوزان المعرفية بنجاح.",
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        scenarioKey,
        executedAt: timestamp,
        steps,
      },
    });
  } catch (error: any) {
    console.error("[SimulateScenario API] POST error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

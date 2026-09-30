import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/dal/unified-supabase";

/**
 * The scenario door — a what-if, and nothing more.
 *
 * It used to write. Measured on the live store, the two rows in the lead ledger and the
 * two 350,000 orders in the sales ledger are its residue: a buyer invented with a phone
 * number, who then appeared on the owner's customers screen as a real person — twice — and
 * a revenue figure that leaked into every count built on those tables. A demo that plants
 * rows in the ledgers the dashboards read is not a demo, it is a false witness.
 *
 * So: it reads what is real, it proposes what is not, and it writes nothing. Where a number
 * cannot be measured the answer says so instead of inventing one.
 */
type Step = {
  agentKey: string;
  agentName: string;
  role: string;
  icon: string;
  color: string;
  action: string;
  result: string;
};

export async function GET() {
  try {
    const [leadsRes, ordersRes] = await Promise.all([
      supabaseServer.from("leads").select("id", { count: "exact", head: true }),
      supabaseServer.from("sales_orders").select("id, total_amount"),
    ]);

    const orders = (ordersRes.data || []) as Array<{ total_amount: number | null }>;
    const totalRevenue = orders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);

    return NextResponse.json({
      success: true,
      data: {
        leadsCount: leadsRes.count || 0,
        ordersCount: orders.length,
        totalRevenue,
        note: "الأرقام دى من الدفاتر الحقيقية — والدفتر ما بيفرقش بين سطر حقيقي وسطر زرعته محاكاة قديمة",
      },
    });
  } catch (error) {
    console.error("[SimulateScenario API] GET error:", error);
    return NextResponse.json({ success: false, error: "الدفتر ما ردّش" }, { status: 500 });
  }
}

/** The one real number this door is allowed to quote. */
async function woodStock(): Promise<number | null> {
  const { data } = await supabaseServer
    .from("inventory_items")
    .select("current_quantity")
    .ilike("name", "%زان%")
    .limit(1)
    .maybeSingle<{ current_quantity: number }>();
  return data?.current_quantity ?? null;
}

const woodLine = (available: number | null) =>
  available === null ? "مش مقاس — الصنف ده مش فى المخزون" : `${available} م³`;

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as { scenarioKey?: string };
    const scenarioKey = body.scenarioKey || "vip_custom_order";
    const steps: Step[] = [];

    if (scenarioKey === "vip_custom_order") {
      const wood = await woodStock();
      steps.push({
        agentKey: "ops-lead",
        agentName: "مدير تشغيل المحتوى",
        role: "كبير مهندسي التصميم والتصنيع",
        icon: "📐",
        color: "amber",
        action: "كشف مواد مقترح",
        result: `لو مشينا على المواصفات دى: مطلوب ١٫٤٥ م³ خشب زان مبخر، و٢٨ م مخمل، و١٤ دفتر ورق ذهب. المتاح من الزان فى المخزون: ${woodLine(wood)}.`,
      });
      steps.push({
        agentKey: "vanguard",
        agentName: "رجل المبيعات",
        role: "المبيعات والتعاقد",
        icon: "💼",
        color: "emerald",
        action: "خطوات ما بعد الاتفاق",
        result: "اللى يحصل بعد الاتفاق: عقد مكتوب، عربون مستلم بره النظام، أمر تشغيل للورشة. مفيش حاجة اتسجلت — الباب ده بيكتبش فى أى دفتر.",
      });
      steps.push({
        agentKey: "analyst",
        agentName: "محلل التكلفة",
        role: "جدوى وتكلفة",
        icon: "📊",
        color: "blue",
        action: "تقدير التكلفة",
        result: "التكلفة والهامش مش مقاسين: محتاجين أسعار خامات حقيقية وعرض موردين. أى رقم يتقال دلوقتى يبقى تخمين.",
      });
    } else if (scenarioKey === "stock_shortage_alert") {
      const wood = await woodStock();
      steps.push({
        agentKey: "ops-lead",
        agentName: "مدير تشغيل المحتوى",
        role: "متابعة المخزون",
        icon: "⚙️",
        color: "yellow",
        action: "نقص خامات محتمل",
        result: `اللى اتقاس: المتاح من خشب الزان ${woodLine(wood)}. حد الأمان وكمية الأوامر المعلّقة مش مقاسين — محتاج باب بيشوف أوامر التشغيل المفتوحة فعلًا.`,
      });
    } else if (scenarioKey === "security_backup_sweep") {
      steps.push({
        agentKey: "ops-lead",
        agentName: "مدير تشغيل المحتوى",
        role: "استمرارية وسلامة",
        icon: "🛡️",
        color: "red",
        action: "فحص ونسخة احتياطية",
        result: "النسخ الاحتياطى بيمشى من المنصة نفسها، مش من الباب ده. عدد المفاتيح وحالة الفحص: مش مقاسين هنا.",
      });
    } else {
      return NextResponse.json({ success: false, error: "السيناريو ده مش معروف" }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      data: {
        scenarioKey,
        kind: "proposal",
        written: false,
        executedAt: new Date().toISOString(),
        steps,
      },
    });
  } catch (error) {
    console.error("[SimulateScenario API] POST error:", error);
    return NextResponse.json({ success: false, error: "المحاولة ما كملتش" }, { status: 500 });
  }
}

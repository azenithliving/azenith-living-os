// Service: Customer Communications (Vanguard)
// إدارة التواصل مع العملاء عبر تليجرام وإشعارات

import { supabaseServer } from '@/lib/dal/unified-supabase';
import { browserNotifications } from '../browser-notifications';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';

async function sendTelegram(text: string): Promise<void> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.log('[CustomerComms] Telegram not configured — message logged:', text.slice(0, 80));
    return;
  }
  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text, parse_mode: 'HTML' }),
  }).catch((err) => console.error('[CustomerComms] Telegram send error:', err));
}

export class CustomerCommunicationsService {
  // إرسال تأكيد طلب
  async sendOrderConfirmation(customerId: string, salesOrderId: string): Promise<void> {
    const { data: customer } = await supabaseServer
      .from('users')
      .select('name, phone, email')
      .eq('id', customerId)
      .single();

    const { data: order } = await supabaseServer
      .from('sales_orders')
      .select('*')
      .eq('id', salesOrderId)
      .single();

    if (!customer || !order) return;

    await sendTelegram(
      `✅ <b>تأكيد طلب جديد</b>\n` +
      `<b>العميل:</b> ${customer.name}\n` +
      `<b>رقم الطلب:</b> ${salesOrderId.slice(0, 8)}\n` +
      `<b>الإجمالي:</b> ${order.total_amount?.toLocaleString()} EGP`
    );

    // تسجيل الحدث
    await supabaseServer.from('agent_events').insert({
      company_id: order.company_id,
      agent_profile_id: null,
      event_type: 'order_confirmation_sent',
      event_data: { customer_id: customerId, sales_order_id: salesOrderId },
      created_at: new Date().toISOString(),
    });
  }

  // إرسال تحديث إنتاج
  async sendProductionUpdate(salesOrderId: string, stageName: string): Promise<void> {
    const { data: order } = await supabaseServer
      .from('sales_orders')
      .select('customer_id')
      .eq('id', salesOrderId)
      .single();

    if (!order) return;

    const { data: customer } = await supabaseServer
      .from('users')
      .select('name, phone')
      .eq('id', order.customer_id)
      .single();

    if (!customer) return;

    const stageFlow: Record<string, string> = {
      Measurement: 'التصميم',
      Design: 'تجهيز المواد',
      'Material Prep': 'القص',
      Cutting: 'التجميع',
      Assembly: 'التشطيب',
      Finishing: 'فحص الجودة',
      QA: 'التسليم',
      Packaging: 'التسليم',
    };

    await sendTelegram(
      `🔧 <b>تحديث إنتاج</b>\n` +
      `<b>العميل:</b> ${customer.name}\n` +
      `<b>المرحلة الحالية:</b> ${stageName}\n` +
      `<b>المرحلة التالية:</b> ${stageFlow[stageName] || 'التسليم'}`
    );
  }

  // إرسال تذكير دفع
  async sendPaymentReminder(salesOrderId: string): Promise<void> {
    const { data: schedule } = await supabaseServer
      .from('payment_schedules')
      .select('*')
      .eq('sales_order_id', salesOrderId)
      .eq('paid', false)
      .order('due_date', { ascending: true })
      .limit(1)
      .single();

    if (!schedule) return;

    const { data: order } = await supabaseServer
      .from('sales_orders')
      .select('customer_id')
      .eq('id', salesOrderId)
      .single();

    if (!order) return;

    const { data: customer } = await supabaseServer
      .from('users')
      .select('name, phone')
      .eq('id', order.customer_id)
      .single();

    if (!customer) return;

    await sendTelegram(
      `💳 <b>تذكير دفع</b>\n` +
      `<b>العميل:</b> ${customer.name}\n` +
      `<b>رقم الطلب:</b> ${salesOrderId.slice(0, 8)}\n` +
      `<b>المبلغ:</b> ${schedule.amount?.toLocaleString()} EGP\n` +
      `<b>تاريخ الاستحقاق:</b> ${new Date(schedule.due_date).toLocaleDateString('ar-EG')}`
    );
  }

  // إرسال جدولة توصيل
  async sendDeliverySchedule(
    salesOrderId: string,
    deliveryDate: string,
    notes?: string
  ): Promise<void> {
    const { data: order } = await supabaseServer
      .from('sales_orders')
      .select('customer_id')
      .eq('id', salesOrderId)
      .single();

    const { data: customer } = await supabaseServer
      .from('users')
      .select('name, phone')
      .eq('id', order?.customer_id)
      .single();

    if (!customer) return;

    await sendTelegram(
      `🚚 <b>جدولة توصيل</b>\n` +
      `<b>العميل:</b> ${customer.name}\n` +
      `<b>رقم الطلب:</b> ${salesOrderId.slice(0, 8)}\n` +
      `<b>تاريخ التوصيل:</b> ${new Date(deliveryDate).toLocaleDateString('ar-EG')}` +
      (notes ? `\n<b>ملاحظات:</b> ${notes}` : '')
    );
  }

  // إشعار للمالك بحدث مهم
  async notifyOwner(eventType: string, data: unknown): Promise<void> {
    await sendTelegram(
      `📢 <b>${eventType}</b>\n${JSON.stringify(data, null, 2).slice(0, 300)}`
    );

    browserNotifications.createPayload('تحديث مهم', `${eventType}`, {
      requireInteraction: true,
    });
  }

  // متابعة العملاء غير المستجيبين
  async followUpNonResponsive(hoursSinceLastContact: number = 48): Promise<void> {
    const { data: orders } = await supabaseServer
      .from('sales_orders')
      .select('*, users(name, phone, last_contact_at)')
      .in('status', ['draft', 'quoted'])
      .lt(
        'last_contact_at',
        new Date(Date.now() - hoursSinceLastContact * 60 * 60 * 1000).toISOString()
      );

    for (const order of orders || []) {
      if (order.users?.phone) {
        console.log(
          `[CustomerComms] Follow-up needed: ${order.users.name} — ${order.users.phone}`
        );
        // Telegram alert to admin for manual follow-up
        await sendTelegram(
          `📞 <b>متابعة مطلوبة</b>\n` +
          `<b>العميل:</b> ${order.users.name}\n` +
          `<b>التليفون:</b> ${order.users.phone}\n` +
          `<b>رقم الطلب:</b> ${order.id?.slice(0, 8)}`
        );
      }
    }
  }
}

export const customerCommunications = new CustomerCommunicationsService();

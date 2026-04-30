// Service: Customer Communications (Vanguard)
// إدارة التواصل مع العملاء عبر واتساب وإشعارات

import { supabaseServer } from '@/lib/dal/unified-supabase';
import { freeWhatsApp } from '../free-whatsapp';
import { browserNotifications } from '../browser-notifications';

export class CustomerCommunicationsService {
  // إرسال تأكيد طلب
  async sendOrderConfirmation(customerId: string, salesOrderId: string): Promise<void> {
    // جلب بيانات العميل والطلب
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
    
    // إرسال واتساب
    if (customer.phone) {
      await freeWhatsApp.sendTemplate(customer.phone, 'order_confirmation', {
        customer_name: customer.name,
        order_number: salesOrderId.slice(0, 8),
        total_amount: `${order.total_amount?.toLocaleString()} EGP`
      });
    }
    
    // تسجيل الحدث
    await supabaseServer.from('agent_events').insert({
      company_id: order.company_id,
      agent_profile_id: null,
      event_type: 'order_confirmation_sent',
      event_data: { customer_id: customerId, sales_order_id: salesOrderId },
      created_at: new Date().toISOString()
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
    
    if (!customer?.phone) return;
    
    // ترتيب المراحل
    const stageFlow: Record<string, string> = {
      'Measurement': 'التصميم',
      'Design': 'تجهيز المواد',
      'Material Prep': 'القص',
      'Cutting': 'التجميع',
      'Assembly': 'التشطيب',
      'Finishing': 'فحص الجودة',
      'QA': 'التسليم',
      'Packaging': 'التسليم'
    };
    
    await freeWhatsApp.sendTemplate(customer.phone, 'production_update', {
      customer_name: customer.name,
      item_description: 'أثاثك',
      stage_name: stageName,
      next_stage: stageFlow[stageName] || 'التسليم'
    });
  }
  
  // إرسال تذكير دفع
  async sendPaymentReminder(salesOrderId: string): Promise<void> {
    // جلب الدفعة القادمة
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
    
    const { data: customer } = await supabaseServer
      .from('users')
      .select('name, phone')
      .eq('id', order?.customer_id)
      .single();
    
    if (!customer?.phone) return;
    
    await freeWhatsApp.sendTemplate(customer.phone, 'payment_reminder', {
      customer_name: customer.name,
      order_number: salesOrderId.slice(0, 8),
      amount: `${schedule.amount.toLocaleString()} EGP`,
      due_date: new Date(schedule.due_date).toLocaleDateString('ar-EG')
    });
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
    
    if (!customer?.phone) return;
    
    await freeWhatsApp.sendTemplate(customer.phone, 'delivery_schedule', {
      customer_name: customer.name,
      order_number: salesOrderId.slice(0, 8),
      delivery_date: new Date(deliveryDate).toLocaleDateString('ar-EG')
    });
  }
  
  // إشعار للمالك بحدث مهم
  async notifyOwner(eventType: string, data: any): Promise<void> {
    const notification = browserNotifications.createPayload(
      'تحديث مهم',
      `${eventType}: ${JSON.stringify(data)}`,
      { requireInteraction: true }
    );
    
    // في المتصفح، سيتم عرض الإشعار
    // TODO: push notification للمالك
  }
  
  // متابعة العملاء غير المستجيبين
  async followUpNonResponsive(hoursSinceLastContact: number = 48): Promise<void> {
    const { data: orders } = await supabaseServer
      .from('sales_orders')
      .select('*, users(name, phone, last_contact_at)')
      .in('status', ['draft', 'quoted'])
      .lt('last_contact_at', new Date(Date.now() - hoursSinceLastContact * 60 * 60 * 1000).toISOString());
    
    for (const order of (orders || [])) {
      if (order.users?.phone) {
        await freeWhatsApp.sendMessage(
          order.users.phone,
          `مرحباً ${order.users.name}، نود متابعة طلبك #${order.id.slice(0, 8)}. هل تحتاج مساعدة؟`
        );
      }
    }
  }
}

export const customerCommunications = new CustomerCommunicationsService();

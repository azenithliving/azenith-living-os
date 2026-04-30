// Service: CRM Order Workflow (Vanguard)
// إدارة workflow المبيعات من العرض للتسليم

import { supabaseServer } from '@/lib/dal/unified-supabase';

export class OrderWorkflowService {
  // إنشاء عرض سعر من طلب
  async createQuoteFromRequest(requestId: string): Promise<{
    sales_order_id: string;
    quote_amount: number;
    timeline_days: number;
  }> {
    // جلب بيانات الطلب
    const { data: request } = await supabaseServer
      .from('requests')
      .select('*, users(name, phone, email)')
      .eq('id', requestId)
      .single();
    
    if (!request) throw new Error('الطلب مش موجود');
    
    // إنشاء أمر بيع (مرحلة العرض)
    const { data: order } = await supabaseServer
      .from('sales_orders')
      .insert({
        company_id: request.company_id,
        request_id: request.id,
        customer_id: request.user_id,
        status: 'draft',
        created_by_user_id: request.user_id,
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    
    // إنشاء جدول دفعات (3 دفعات: 30%، 50%، 20%)
    const estimatedTotal = 50000;  // هيتم حسابه من BOM
    const schedule = [
      { installment: 1, amount: estimatedTotal * 0.3, due_days: 0 },
      { installment: 2, amount: estimatedTotal * 0.5, due_days: 30 },
      { installment: 3, amount: estimatedTotal * 0.2, due_days: 60 }
    ];
    
    for (const item of schedule) {
      await supabaseServer.from('payment_schedules').insert({
        sales_order_id: order.id,
        installment_number: item.installment,
        amount: item.amount,
        due_date: new Date(Date.now() + item.due_days * 24 * 60 * 60 * 1000).toISOString()
      });
    }
    
    return {
      sales_order_id: order.id,
      quote_amount: estimatedTotal,
      timeline_days: 45
    };
  }
  
  // تحويل العرض لطلب مؤكد
  async convertQuoteToOrder(salesOrderId: string): Promise<boolean> {
    const { error } = await supabaseServer
      .from('sales_orders')
      .update({
        status: 'contracted',
        contract_signed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', salesOrderId);
    
    if (error) return false;
    
    // إنشاء مهام إنتاج لكل item
    const { data: items } = await supabaseServer
      .from('sales_order_items')
      .select('*')
      .eq('sales_order_id', salesOrderId);
    
    for (const item of (items || [])) {
      await supabaseServer.from('production_jobs').insert({
        company_id: item.company_id,
        sales_order_id: salesOrderId,
        sales_order_item_id: item.id,
        status: 'pending',
        created_at: new Date().toISOString()
      });
    }
    
    return true;
  }
  
  // تحديث حالة الطلب
  async updateOrderStatus(
    salesOrderId: string, 
    newStatus: string,
    notes?: string
  ): Promise<boolean> {
    const update: any = {
      status: newStatus,
      updated_at: new Date().toISOString()
    };
    
    if (notes) {
      update.notes = notes;
    }
    
    const { error } = await supabaseServer
      .from('sales_orders')
      .update(update)
      .eq('id', salesOrderId);
    
    return !error;
  }
  
  // جلب metrics خط الأنابيب (pipeline)
  async getPipelineMetrics(companyId: string): Promise<{
    draft: number;
    quoted: number;
    contracted: number;
    in_production: number;
    ready: number;
    delivered: number;
    total_value: number;
  }> {
    const { data: orders } = await supabaseServer
      .from('sales_orders')
      .select('status, total_amount')
      .eq('company_id', companyId);
    
    const counts = {
      draft: 0,
      quoted: 0,
      contracted: 0,
      in_production: 0,
      ready: 0,
      delivered: 0,
      total_value: 0
    };
    
    for (const order of (orders || [])) {
      if (order.status in counts) {
        (counts as any)[order.status]++;
      }
      counts.total_value += order.total_amount || 0;
    }
    
    return counts;
  }
  
  // جلب الطلبات المتأخرة
  async getOverdueOrders(companyId: string): Promise<any[]> {
    const { data } = await supabaseServer
      .from('sales_orders')
      .select('*, users(name, phone)')
      .eq('company_id', companyId)
      .in('status', ['contracted', 'in_production'])
      .lt('expected_delivery', new Date().toISOString())
      .order('expected_delivery', { ascending: true });
    
    return data || [];
  }
}

export const orderWorkflow = new OrderWorkflowService();

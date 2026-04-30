// Service: Inventory (المخزون)
// إدارة المخزون والمواد الخام

import { supabaseServer } from '@/lib/dal/unified-supabase';

export interface InventoryAlert {
  item_id: string;
  item_name: string;
  current_quantity: number;
  min_stock_level: number;
  reorder_quantity: number;
}

export class InventoryService {
  // شيك توفر المواد
  async checkAvailability(bomItems: Array<{
    material_name: string;
    quantity: number;
  }>): Promise<{
    available: boolean;
    missing: Array<{ material: string; needed: number; available: number }>;
  }> {
    const missing: Array<{ material: string; needed: number; available: number }> = [];
    
    for (const item of bomItems) {
      const { data: inventory } = await supabaseServer
        .from('inventory_items')
        .select('current_quantity')
        .ilike('name', `%${item.material_name}%`)
        .single();
      
      const available = inventory?.current_quantity || 0;
      
      if (available < item.quantity) {
        missing.push({
          material: item.material_name,
          needed: item.quantity,
          available
        });
      }
    }
    
    return {
      available: missing.length === 0,
      missing
    };
  }
  
  // حجز مواد لمهمة إنتاج
  async reserveMaterials(
    productionJobId: string,
    bomItems: Array<{ material_name: string; quantity: number }>
  ): Promise<boolean> {
    for (const item of bomItems) {
      // دور على مادة في المخزون
      const { data: inventory } = await supabaseServer
        .from('inventory_items')
        .select('id, current_quantity')
        .ilike('name', `%${item.material_name}%`)
        .single();
      
      if (!inventory || inventory.current_quantity < item.quantity) {
        return false;
      }
      
      // إنشاء حجز
      await supabaseServer.from('inventory_reservations').insert({
        inventory_item_id: inventory.id,
        production_job_id: productionJobId,
        quantity_reserved: item.quantity,
        status: 'active'
      });
      
      // قلّل الكمية المتاحة
      await supabaseServer
        .from('inventory_items')
        .update({
          current_quantity: inventory.current_quantity - item.quantity,
          updated_at: new Date().toISOString()
        })
        .eq('id', inventory.id);
    }
    
    return true;
  }
  
  // استهلاك المواد المحجوزة
  async consumeMaterials(productionJobId: string): Promise<void> {
    // جلب الحجوزات
    const { data: reservations } = await supabaseServer
      .from('inventory_reservations')
      .select('*, inventory_items(name)')
      .eq('production_job_id', productionJobId)
      .eq('status', 'active');
    
    for (const res of (reservations || [])) {
      // سجل حركة
      await supabaseServer.from('inventory_movements').insert({
        inventory_item_id: res.inventory_item_id,
        movement_type: 'consumption',
        quantity: -res.quantity_reserved,
        reference_type: 'production_job',
        reference_id: productionJobId,
        created_at: new Date().toISOString()
      });
      
      // حدّث الحجز
      await supabaseServer
        .from('inventory_reservations')
        .update({ status: 'consumed' })
        .eq('id', res.id);
    }
  }
  
  // جلب تنبيهات المخزون المنخفض
  async getLowStockAlerts(companyId: string): Promise<InventoryAlert[]> {
    const { data: items } = await supabaseServer
      .from('inventory_items')
      .select('*')
      .eq('company_id', companyId)
      .lte('current_quantity', 'min_stock_level')
      .eq('is_active', true);
    
    return items?.map(item => ({
      item_id: item.id,
      item_name: item.name,
      current_quantity: item.current_quantity,
      min_stock_level: item.min_stock_level,
      reorder_quantity: item.reorder_quantity
    })) || [];
  }
  
  // تسجيل شراء جديد
  async recordPurchase(
    itemId: string,
    quantity: number,
    unitCost: number,
    supplier: string
  ): Promise<void> {
    // جلب الكمية الحالية
    const { data: item } = await supabaseServer
      .from('inventory_items')
      .select('current_quantity')
      .eq('id', itemId)
      .single();
    
    // حدّث المخزون
    await supabaseServer
      .from('inventory_items')
      .update({
        current_quantity: (item?.current_quantity || 0) + quantity,
        unit_cost: unitCost,
        supplier_info: { last_supplier: supplier, last_purchase: new Date().toISOString() },
        updated_at: new Date().toISOString()
      })
      .eq('id', itemId);
    
    // سجل الحركة
    await supabaseServer.from('inventory_movements').insert({
      inventory_item_id: itemId,
      movement_type: 'purchase',
      quantity,
      unit_cost: unitCost,
      total_cost: quantity * unitCost,
      reference_type: 'purchase_order',
      notes: `من ${supplier}`,
      created_at: new Date().toISOString()
    });
  }
  
  // جلب قيمة المخزون
  async getInventoryValue(companyId: string): Promise<{
    total_value: number;
    total_items: number;
    by_category: Record<string, number>;
  }> {
    const { data: items } = await supabaseServer
      .from('inventory_items')
      .select('*')
      .eq('company_id', companyId)
      .eq('is_active', true);
    
    let totalValue = 0;
    const byCategory: Record<string, number> = {};
    
    for (const item of (items || [])) {
      const value = item.current_quantity * (item.unit_cost || 0);
      totalValue += value;
      
      byCategory[item.category] = (byCategory[item.category] || 0) + value;
    }
    
    return {
      total_value: totalValue,
      total_items: items?.length || 0,
      by_category: byCategory
    };
  }
}

export const inventory = new InventoryService();

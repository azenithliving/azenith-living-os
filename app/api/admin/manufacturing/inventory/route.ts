/**
 * Manufacturing API - Inventory Management
 * GET /api/admin/manufacturing/inventory
 * POST /api/admin/manufacturing/inventory
 * Manage inventory items and stock levels
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/dal/unified-supabase';

// GET - Fetch inventory
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('company_id');
    const lowStock = searchParams.get('low_stock') === 'true';
    const category = searchParams.get('category');
    const search = searchParams.get('search');

    if (!companyId) {
      return NextResponse.json(
        { success: false, error: 'company_id required' },
        { status: 400 }
      );
    }

    let query = supabaseServer
      .from('inventory_items')
      .select('*')
      .eq('company_id', companyId)
      .eq('is_active', true);

    if (lowStock) {
      query = query.lte('current_quantity', 'min_stock_level');
    }

    if (category) {
      query = query.eq('category', category);
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%`);
    }

    const { data, error } = await query.order('name');

    if (error) {
      console.error('Inventory fetch error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    // Calculate stock status for each item
    const itemsWithStatus = data?.map(item => {
      const stockStatus = item.current_quantity <= item.min_stock_level
        ? 'low'
        : item.current_quantity <= item.reorder_point
          ? 'reorder'
          : 'ok';

      const daysUntilStockout = item.current_quantity > 0
        ? Math.floor(item.current_quantity / (item.reorder_quantity / 30)) // Assume 30 day reorder cycle
        : 0;

      return {
        ...item,
        stock_status: stockStatus,
        days_until_stockout: daysUntilStockout,
        reorder_needed: stockStatus !== 'ok'
      };
    });

    return NextResponse.json({
      success: true,
      data: itemsWithStatus || []
    });
  } catch (error) {
    console.error('Inventory GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Update inventory (stock in/out, adjustments)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      company_id,
      action, // 'stock_in', 'stock_out', 'adjust', 'reorder'
      inventory_item_id,
      quantity,
      unit_cost,
      reference_type,
      reference_id,
      notes,
      created_by
    } = body;

    if (!company_id || !action || !inventory_item_id) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const timestamp = new Date().toISOString();

    switch (action) {
      case 'stock_in':
      case 'stock_out': {
        const qtyChange = action === 'stock_in' ? quantity : -quantity;

        // Get current quantity
        const { data: item } = await supabaseServer
          .from('inventory_items')
          .select('current_quantity')
          .eq('id', inventory_item_id)
          .single();

        const newQuantity = (item?.current_quantity || 0) + qtyChange;

        if (newQuantity < 0) {
          return NextResponse.json(
            { success: false, error: 'Insufficient stock' },
            { status: 400 }
          );
        }

        // Update inventory
        const { error: updateError } = await supabaseServer
          .from('inventory_items')
          .update({
            current_quantity: newQuantity,
            updated_at: timestamp
          })
          .eq('id', inventory_item_id);

        if (updateError) throw updateError;

        // Record movement
        const { error: movementError } = await supabaseServer
          .from('inventory_movements')
          .insert({
            inventory_item_id,
            movement_type: action === 'stock_in' ? 'in' : 'out',
            quantity: Math.abs(quantity),
            unit_cost,
            total_cost: unit_cost ? unit_cost * quantity : null,
            reference_type,
            reference_id,
            notes,
            created_by,
            created_at: timestamp
          });

        if (movementError) throw movementError;

        return NextResponse.json({
          success: true,
          message: `Stock ${action === 'stock_in' ? 'added' : 'removed'} successfully`,
          data: { new_quantity: newQuantity }
        });
      }

      case 'adjust': {
        const { error: adjustError } = await supabaseServer
          .from('inventory_items')
          .update({
            current_quantity: quantity,
            updated_at: timestamp
          })
          .eq('id', inventory_item_id);

        if (adjustError) throw adjustError;

        await supabaseServer.from('inventory_movements').insert({
          inventory_item_id,
          movement_type: 'adjustment',
          quantity,
          notes: notes || 'Inventory adjustment',
          created_by,
          created_at: timestamp
        });

        return NextResponse.json({
          success: true,
          message: 'Inventory adjusted successfully',
          data: { new_quantity: quantity }
        });
      }

      case 'reorder': {
        // Get item details
        const { data: item } = await supabaseServer
          .from('inventory_items')
          .select('*, suppliers(*)')
          .eq('id', inventory_item_id)
          .single();

        if (!item) {
          return NextResponse.json(
            { success: false, error: 'Item not found' },
            { status: 404 }
          );
        }

        // Create purchase order
        const { data: po, error: poError } = await supabaseServer
          .from('purchase_orders')
          .insert({
            company_id,
            supplier_id: item.supplier_id,
            po_number: `PO-${Date.now()}`,
            status: 'draft',
            total_amount: item.reorder_quantity * (item.unit_cost || 0),
            order_date: timestamp,
            expected_delivery: new Date(Date.now() + (item.lead_time_days || 7) * 24 * 60 * 60 * 1000).toISOString()
          })
          .select()
          .single();

        if (poError) throw poError;

        // Create PO item
        await supabaseServer.from('purchase_order_items').insert({
          purchase_order_id: po.id,
          inventory_item_id,
          item_name: item.name,
          quantity: item.reorder_quantity,
          unit: item.unit_of_measure,
          unit_price: item.unit_cost || 0,
          total_price: item.reorder_quantity * (item.unit_cost || 0)
        });

        return NextResponse.json({
          success: true,
          message: 'Purchase order created for reorder',
          data: { purchase_order: po }
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Inventory POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

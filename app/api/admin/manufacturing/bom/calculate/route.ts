/**
 * Manufacturing API - BOM Calculation
 * POST /api/admin/manufacturing/bom/calculate
 * Calculate Bill of Materials for a design
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/dal/unified-supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      company_id,
      design_version_id,
      sales_order_item_id,
      quantity = 1,
      include_waste = true
    } = body;

    if (!company_id || (!design_version_id && !sales_order_item_id)) {
      return NextResponse.json(
        { success: false, error: 'company_id and (design_version_id or sales_order_item_id) required' },
        { status: 400 }
      );
    }

    // Get design specifications
    let specifications: any = {};
    
    if (design_version_id) {
      const { data: design } = await supabaseServer
        .from('design_versions')
        .select('design_data')
        .eq('id', design_version_id)
        .single();
      
      if (design?.design_data) {
        specifications = design.design_data;
      }
    }

    // Calculate BOM based on item type and specs
    const calculatedBOM = await calculateBOM(
      company_id,
      specifications,
      quantity,
      include_waste
    );

    // Save BOM if requested
    if (body.save && sales_order_item_id) {
      const { data: bomHeader, error: headerError } = await supabaseServer
        .from('bom_headers')
        .insert({
          company_id,
          sales_order_item_id,
          design_version_id,
          name: `BOM for Item ${sales_order_item_id.slice(0, 8)}`,
          total_cost: calculatedBOM.total_materials_cost,
          total_weight: calculatedBOM.total_weight
        })
        .select()
        .single();

      if (!headerError && bomHeader) {
        // Insert BOM items
        const bomItems = calculatedBOM.items.map((item, index) => ({
          bom_header_id: bomHeader.id,
          inventory_item_id: item.inventory_item_id,
          item_name: item.item_name,
          quantity: item.quantity,
          unit: item.unit,
          unit_cost: item.unit_cost,
          total_cost: item.total_cost,
          waste_percentage: include_waste ? 10 : 0,
          sequence_order: index
        }));

        await supabaseServer.from('bom_items').insert(bomItems);
      }
    }

    return NextResponse.json({
      success: true,
      data: calculatedBOM
    });
  } catch (error) {
    console.error('BOM calculation error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Calculate BOM based on specifications
async function calculateBOM(
  companyId: string,
  specs: any,
  quantity: number,
  includeWaste: boolean
) {
  const items: any[] = [];
  let totalCost = 0;
  let totalWeight = 0;

  // Get materials from design specs
  const materials = specs.materials || specs.materials_selected || [];
  const dimensions = specs.measurements || specs.dimensions || {};

  // Calculate wood/material needs
  if (dimensions.length && dimensions.width && dimensions.height) {
    const volume = (dimensions.length * dimensions.width * dimensions.height) / 1000000; // Convert to cubic meters
    const wasteFactor = includeWaste ? 1.15 : 1; // 15% waste

    // Primary wood material
    const woodNeeded = volume * quantity * wasteFactor;
    const woodCost = woodNeeded * 3500; // Approximate cost per cubic meter

    items.push({
      inventory_item_id: null,
      item_name: 'خشب أساسي (زان أو سنديان)',
      quantity: Math.ceil(woodNeeded * 1000), // Convert to liters for display
      unit: 'لتر',
      unit_cost: 3.5,
      total_cost: woodCost,
      waste_amount: includeWaste ? woodNeeded * 0.15 : 0,
      in_stock: false,
      available_quantity: 0
    });

    totalCost += woodCost;
    totalWeight += woodNeeded * 600; // Wood density approx 600 kg/m3
  }

  // Add selected materials
  for (const material of materials) {
    const materialName = typeof material === 'string' ? material : material.name;
    const materialQty = typeof material === 'string' ? quantity : (material.quantity || quantity);

    // Check inventory
    const { data: inventoryItem } = await supabaseServer
      .from('inventory_items')
      .select('*')
      .eq('company_id', companyId)
      .ilike('name', `%${materialName}%`)
      .single();

    const unitCost = inventoryItem?.unit_cost || 50; // Default price
    const itemCost = materialQty * unitCost;

    items.push({
      inventory_item_id: inventoryItem?.id || null,
      item_name: materialName,
      quantity: materialQty,
      unit: inventoryItem?.unit_of_measure || 'piece',
      unit_cost: unitCost,
      total_cost: itemCost,
      waste_amount: 0,
      in_stock: inventoryItem ? inventoryItem.current_quantity >= materialQty : false,
      available_quantity: inventoryItem?.current_quantity || 0
    });

    totalCost += itemCost;
  }

  // Add hardware (screws, hinges, etc.)
  const hardwareCost = quantity * 150; // Approximate
  items.push({
    inventory_item_id: null,
    item_name: 'قطع معدنية ومسامير ومفصلات',
    quantity: quantity,
    unit: 'set',
    unit_cost: 150,
    total_cost: hardwareCost,
    waste_amount: 0,
    in_stock: true,
    available_quantity: 1000
  });
  totalCost += hardwareCost;

  // Add finish materials (paint, varnish)
  const finishCost = quantity * 200;
  items.push({
    inventory_item_id: null,
    item_name: 'ورنيش ومواد تشطيب',
    quantity: quantity * 0.5,
    unit: 'liter',
    unit_cost: 400,
    total_cost: finishCost,
    waste_amount: 0,
    in_stock: true,
    available_quantity: 50
  });
  totalCost += finishCost;

  // Calculate labor hours (estimate)
  const laborHours = quantity * 8; // 8 hours per piece average

  return {
    items,
    total_materials_cost: totalCost,
    total_weight: Math.round(totalWeight * 100) / 100,
    estimated_labor_hours: laborHours,
    waste_included: includeWaste
  };
}

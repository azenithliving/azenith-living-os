/**
 * Manufacturing API - Price Calculation
 * POST /api/admin/manufacturing/price/calculate
 * Calculate pricing for furniture items
 */

import { NextRequest, NextResponse } from 'next/server';

export interface PriceCalculationRequest {
  item_type: string;
  dimensions: {
    length: number;
    width: number;
    height: number;
    unit: 'cm' | 'mm' | 'inch';
  };
  materials: string[];
  finish: string;
  quantity: number;
  complexity: 'low' | 'medium' | 'high';
}

export async function POST(request: NextRequest) {
  try {
    const body: PriceCalculationRequest = await request.json();
    const {
      item_type,
      dimensions,
      materials,
      finish,
      quantity,
      complexity
    } = body;

    // Validation
    if (!item_type || !dimensions || !materials || !finish || !quantity) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Calculate volume
    const volume = (dimensions.length * dimensions.width * dimensions.height) / 1000000; // m³

    // Base price factors
    const complexityMultiplier = {
      low: 1.0,
      medium: 1.3,
      high: 1.8
    }[complexity] || 1.0;

    // Material cost per m³
    const materialCosts: Record<string, number> = {
      'beech': 3500,
      'oak': 5000,
      'pine': 2500,
      'walnut': 8000,
      'mdf': 1500,
      'plywood': 2000,
      'glass': 3000,
      'metal': 4000
    };

    let materialCost = 0;
    for (const material of materials) {
      const matKey = Object.keys(materialCosts).find(k => 
        material.toLowerCase().includes(k)
      );
      materialCost += volume * (materialCosts[matKey || 'beech'] || 3500);
    }

    // Finish cost
    const finishCosts: Record<string, number> = {
      'natural': 500,
      'stained': 800,
      'painted': 1000,
      'lacquered': 1200,
      'varnished': 600,
      'oil': 400,
      'distressed': 1500
    };

    const finishKey = Object.keys(finishCosts).find(k => 
      finish.toLowerCase().includes(k)
    );
    const finishCost = finishCosts[finishKey || 'natural'] || 500;

    // Labor hours estimation
    const baseLaborHours = {
      'chair': 4,
      'table': 8,
      'bed': 12,
      'wardrobe': 16,
      'desk': 10,
      'cabinet': 14,
      'sofa': 20,
      'bookshelf': 10,
      'nightstand': 6,
      'dresser': 12
    }[item_type.toLowerCase()] || 8;

    const laborHours = baseLaborHours * complexityMultiplier * quantity;
    const laborRate = 100; // EGP per hour
    const laborCost = laborHours * laborRate;

    // Hardware and supplies
    const hardwareCost = quantity * 150;

    // Overhead (rent, utilities, admin) - 20%
    const subtotal = materialCost + finishCost + laborCost + hardwareCost;
    const overheadCost = subtotal * 0.20;

    // Profit margin - 25%
    const profitMargin = (subtotal + overheadCost) * 0.25;

    // Total price
    const totalPrice = subtotal + overheadCost + profitMargin;

    const breakdown = [
      {
        category: 'materials',
        description: `Materials: ${materials.join(', ')}`,
        quantity: volume * quantity,
        unit_price: materialCost / (volume * quantity || 1),
        total: materialCost
      },
      {
        category: 'finish',
        description: `Finish: ${finish}`,
        quantity: quantity,
        unit_price: finishCost / quantity,
        total: finishCost
      },
      {
        category: 'labor',
        description: `Labor (${laborHours.toFixed(1)} hours)`,
        quantity: laborHours,
        unit_price: laborRate,
        total: laborCost
      },
      {
        category: 'hardware',
        description: 'Hardware & supplies',
        quantity: quantity,
        unit_price: 150,
        total: hardwareCost
      },
      {
        category: 'overhead',
        description: 'Overhead (20%)',
        quantity: 1,
        unit_price: overheadCost,
        total: overheadCost
      },
      {
        category: 'profit',
        description: 'Profit margin (25%)',
        quantity: 1,
        unit_price: profitMargin,
        total: profitMargin
      }
    ];

    return NextResponse.json({
      success: true,
      data: {
        base_price: subtotal,
        materials_cost: materialCost,
        labor_cost: laborCost,
        overhead_cost: overheadCost,
        profit_margin: profitMargin,
        total_price: totalPrice,
        per_unit_price: totalPrice / quantity,
        labor_hours: laborHours,
        breakdown
      }
    });
  } catch (error) {
    console.error('Price calculation error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

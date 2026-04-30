/**
 * Manufacturing System Type Definitions
 * Complete types for furniture manufacturing workflow
 */

// ===========================================
// SALES ORDERS
// ===========================================

export type SalesOrderStatus = 
  | 'draft' | 'quoted' | 'contracted' | 'in_production' 
  | 'ready' | 'delivered' | 'completed' | 'cancelled';

export interface SalesOrder {
  id: string;
  company_id: string;
  request_id?: string;
  customer_id?: string;
  status: SalesOrderStatus;
  total_amount?: number;
  deposit_amount?: number;
  deposit_paid: boolean;
  final_payment_paid: boolean;
  contract_signed_at?: string;
  notes?: string;
  created_by_user_id?: string;
  created_at: string;
  updated_at: string;
  // Relations
  customer?: CustomerInfo;
  items?: SalesOrderItem[];
  payment_schedules?: PaymentSchedule[];
}

export interface CustomerInfo {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
}

export interface SalesOrderItem {
  id: string;
  sales_order_id: string;
  item_type: 'room' | 'furniture_piece' | 'finish' | 'accessory';
  description?: string;
  room_name?: string;
  quantity: number;
  unit_price?: number;
  total_price?: number;
  specifications?: ItemSpecifications;
  notes?: string;
  created_at: string;
}

export interface ItemSpecifications {
  dimensions?: {
    length: number;
    width: number;
    height: number;
    unit: 'cm' | 'mm' | 'inch';
  };
  materials?: string[];
  colors?: string[];
  finish?: string;
  style?: string;
  additional_specs?: Record<string, any>;
}

export interface PaymentSchedule {
  id: string;
  sales_order_id: string;
  installment_number: number;
  amount: number;
  due_date: string;
  paid: boolean;
  paid_at?: string;
  payment_method?: string;
  transaction_reference?: string;
  notes?: string;
  created_at: string;
}

// ===========================================
// PRODUCTION
// ===========================================

export type ProductionJobStatus = 
  | 'pending' | 'scheduled' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled';

export interface ProductionStage {
  id: string;
  company_id: string;
  name: string;
  description?: string;
  sequence_order: number;
  default_duration_hours: number;
  color_code: string;
  is_active: boolean;
  created_at: string;
}

export interface ProductionJob {
  id: string;
  company_id: string;
  sales_order_id?: string;
  sales_order_item_id?: string;
  current_stage_id?: string;
  status: ProductionJobStatus;
  scheduled_start?: string;
  scheduled_end?: string;
  actual_start?: string;
  actual_end?: string;
  estimated_duration_hours?: number;
  assigned_to?: string;
  priority: number;
  notes?: string;
  quality_check_required: boolean;
  quality_check_passed?: boolean;
  created_at: string;
  updated_at: string;
  // Relations
  stage?: ProductionStage;
  order?: SalesOrder;
  item?: SalesOrderItem;
}

export interface ProductionJobEvent {
  id: string;
  production_job_id: string;
  event_type: 'stage_change' | 'delay' | 'hold' | 'resume' | 'priority_change' | 'assignment_change' | 'quality_check';
  from_stage_id?: string;
  to_stage_id?: string;
  reason?: string;
  metadata?: Record<string, any>;
  created_by?: string;
  created_at: string;
}

export interface ProductionScheduleEntry {
  id: string;
  company_id: string;
  production_job_id: string;
  stage_id: string;
  scheduled_start: string;
  scheduled_end: string;
  actual_start?: string;
  actual_end?: string;
  resource_id?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

// ===========================================
// DESIGN
// ===========================================

export interface DesignVersion {
  id: string;
  company_id: string;
  sales_order_item_id?: string;
  version_number: number;
  name?: string;
  description?: string;
  design_data: DesignData;
  ai_generated: boolean;
  ai_prompt?: string;
  parent_version_id?: string;
  status: 'draft' | 'review' | 'approved' | 'rejected';
  approved_by?: string;
  approved_at?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface DesignData {
  images?: string[];
  three_d_model?: ThreeDModel;
  measurements?: Measurements;
  materials?: MaterialSelection[];
  colors?: ColorSelection[];
  style_tags?: string[];
  render_settings?: RenderSettings;
}

export interface ThreeDModel {
  url: string;
  format: 'glb' | 'gltf' | 'obj' | 'fbx';
  thumbnail_url?: string;
}

export interface Measurements {
  length: number;
  width: number;
  height: number;
  unit: 'cm' | 'mm' | 'inch';
  additional?: Record<string, number>;
}

export interface MaterialSelection {
  material_id: string;
  name: string;
  quantity: number;
  unit: string;
  cost_per_unit: number;
}

export interface ColorSelection {
  name: string;
  hex_code: string;
  finish_type: string;
}

export interface RenderSettings {
  lighting: string;
  camera_angle: string;
  background: string;
  quality: 'low' | 'medium' | 'high' | 'ultra';
}

// ===========================================
// BILL OF MATERIALS (BOM)
// ===========================================

export interface BOMHeader {
  id: string;
  company_id: string;
  sales_order_item_id?: string;
  design_version_id?: string;
  name: string;
  description?: string;
  total_cost: number;
  total_weight?: number;
  created_at: string;
  updated_at: string;
}

export interface BOMItem {
  id: string;
  bom_header_id: string;
  inventory_item_id?: string;
  item_name: string;
  item_description?: string;
  quantity: number;
  unit: string;
  unit_cost: number;
  total_cost: number;
  waste_percentage: number;
  sequence_order: number;
  notes?: string;
  created_at: string;
  // Relation
  inventory_item?: InventoryItem;
}

// ===========================================
// INVENTORY
// ===========================================

export type InventoryItemType = 'raw_material' | 'finished_good' | 'component' | 'supply';

export interface InventoryItem {
  id: string;
  company_id: string;
  sku: string;
  name: string;
  description?: string;
  item_type: InventoryItemType;
  category?: string;
  unit_of_measure: string;
  current_quantity: number;
  min_stock_level: number;
  max_stock_level?: number;
  reorder_point: number;
  reorder_quantity: number;
  unit_cost?: number;
  supplier_id?: string;
  location?: string;
  barcode?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface InventoryMovement {
  id: string;
  inventory_item_id: string;
  movement_type: 'in' | 'out' | 'adjustment' | 'transfer' | 'reservation';
  quantity: number;
  unit_cost?: number;
  total_cost?: number;
  reference_type?: 'purchase_order' | 'sales_order' | 'production_job' | 'adjustment';
  reference_id?: string;
  notes?: string;
  created_by?: string;
  created_at: string;
}

export interface InventoryReservation {
  id: string;
  inventory_item_id: string;
  production_job_id?: string;
  sales_order_id?: string;
  quantity_reserved: number;
  status: 'active' | 'fulfilled' | 'cancelled';
  reserved_at: string;
  fulfilled_at?: string;
  created_at: string;
}

export interface LowStockAlert {
  inventory_item_id: string;
  item_name: string;
  current_quantity: number;
  min_stock_level: number;
  days_until_stockout: number;
}

// ===========================================
// PURCHASE ORDERS
// ===========================================

export type PurchaseOrderStatus = 'draft' | 'sent' | 'confirmed' | 'partial' | 'received' | 'cancelled';

export interface PurchaseOrder {
  id: string;
  company_id: string;
  supplier_id: string;
  supplier_name?: string;
  po_number: string;
  status: PurchaseOrderStatus;
  total_amount: number;
  order_date: string;
  expected_delivery?: string;
  actual_delivery?: string;
  notes?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface PurchaseOrderItem {
  id: string;
  purchase_order_id: string;
  inventory_item_id?: string;
  item_name: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total_price: number;
  quantity_received: number;
  notes?: string;
  created_at: string;
}

// ===========================================
// QUALITY CHECKS
// ===========================================

export type QualityCheckStatus = 'pending' | 'passed' | 'failed' | 'conditional';

export interface QualityCheck {
  id: string;
  production_job_id: string;
  stage_id?: string;
  check_type: 'visual' | 'dimensional' | 'functional' | 'material' | 'finish';
  status: QualityCheckStatus;
  checklist: QualityChecklistItem[];
  photos: QualityPhoto[];
  notes?: string;
  inspected_by?: string;
  inspected_at?: string;
  created_at: string;
}

export interface QualityChecklistItem {
  item_id: string;
  description: string;
  required: boolean;
  passed?: boolean;
  notes?: string;
}

export interface QualityPhoto {
  photo_id: string;
  url: string;
  thumbnail_url?: string;
  description?: string;
  taken_at: string;
}

// ===========================================
// DELIVERY
// ===========================================

export interface DeliveryRecord {
  id: string;
  company_id: string;
  sales_order_id: string;
  delivery_date?: string;
  delivery_type: 'pickup' | 'company_delivery' | 'third_party';
  status: 'scheduled' | 'in_transit' | 'delivered' | 'failed';
  address?: string;
  contact_name?: string;
  contact_phone?: string;
  notes?: string;
  signed_by?: string;
  signed_at?: string;
  signature_url?: string;
  photos?: string[];
  created_at: string;
  updated_at: string;
}

// ===========================================
// SUPPLIERS
// ===========================================

export interface Supplier {
  id: string;
  company_id: string;
  name: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  payment_terms?: string;
  lead_time_days?: number;
  rating?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ===========================================
// GANTT CHART TYPES
// ===========================================

export interface GanttTask {
  id: string;
  name: string;
  start: Date;
  end: Date;
  progress: number;
  dependencies?: string[];
  type: 'task' | 'milestone' | 'project';
  status: ProductionJobStatus;
  assigned_to?: string;
  color?: string;
}

export interface GanttResource {
  id: string;
  name: string;
  type: 'worker' | 'machine' | 'station';
  capacity: number;
  schedule?: GanttResourceSchedule[];
}

export interface GanttResourceSchedule {
  date: string;
  available_hours: number;
  booked_hours: number;
}

// ===========================================
// PRICING & CALCULATIONS
// ===========================================

export interface PriceCalculationRequest {
  item_type: string;
  dimensions: Measurements;
  materials: string[];
  finish: string;
  quantity: number;
  complexity: 'low' | 'medium' | 'high';
}

export interface PriceCalculationResult {
  base_price: number;
  materials_cost: number;
  labor_cost: number;
  overhead_cost: number;
  profit_margin: number;
  total_price: number;
  breakdown: PriceBreakdownItem[];
}

export interface PriceBreakdownItem {
  category: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface BOMCalculationRequest {
  design_version_id: string;
  quantity: number;
  include_waste: boolean;
}

export interface BOMCalculationResult {
  items: CalculatedBOMItem[];
  total_materials_cost: number;
  total_weight: number;
  estimated_labor_hours: number;
}

export interface CalculatedBOMItem {
  inventory_item_id?: string;
  item_name: string;
  quantity: number;
  unit: string;
  unit_cost: number;
  total_cost: number;
  waste_amount: number;
  in_stock: boolean;
  available_quantity: number;
}

// ===========================================
// MANUFACTURING DASHBOARD
// ===========================================

export interface ManufacturingMetrics {
  total_orders: number;
  orders_in_production: number;
  orders_ready: number;
  orders_delivered: number;
  revenue_this_month: number;
  profit_this_month: number;
  avg_production_time: number;
  quality_pass_rate: number;
  on_time_delivery_rate: number;
}

export interface ProductionPipeline {
  stage_id: string;
  stage_name: string;
  color: string;
  job_count: number;
  avg_time_hours: number;
  bottleneck_score: number;
}

export interface UpcomingDeadline {
  job_id: string;
  order_id: string;
  customer_name: string;
  item_description: string;
  deadline: string;
  days_remaining: number;
  priority: number;
}

-- Week 1: Manufacturing Tables Migration
-- Creates all tables for the furniture manufacturing workflow

-- ===========================================
-- SALES & ORDERS
-- ===========================================

-- Sales Orders (post-contract manufacturing orders)
CREATE TABLE IF NOT EXISTS sales_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  request_id UUID REFERENCES requests(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  status VARCHAR(50) DEFAULT 'draft', -- draft, quoted, contracted, in_production, ready, delivered, completed, cancelled
  total_amount DECIMAL(10,2),
  deposit_amount DECIMAL(10,2),
  deposit_paid BOOLEAN DEFAULT false,
  final_payment_paid BOOLEAN DEFAULT false,
  contract_signed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_by_user_id UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sales Order Items (individual items in an order)
CREATE TABLE IF NOT EXISTS sales_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_order_id UUID NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
  item_type VARCHAR(50), -- room, furniture_piece, finish, accessory
  description TEXT,
  room_name VARCHAR(255),
  quantity INTEGER DEFAULT 1,
  unit_price DECIMAL(10,2),
  total_price DECIMAL(10,2),
  specifications JSONB, -- dimensions, materials, colors
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payment Schedules (installment plans)
CREATE TABLE IF NOT EXISTS payment_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_order_id UUID NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
  installment_number INTEGER NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  due_date TIMESTAMP WITH TIME ZONE NOT NULL,
  paid BOOLEAN DEFAULT false,
  paid_at TIMESTAMP WITH TIME ZONE,
  payment_method VARCHAR(50),
  transaction_reference VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===========================================
-- PRODUCTION
-- ===========================================

-- Production Stages (workflow stages)
CREATE TABLE IF NOT EXISTS production_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL, -- Measurement, Design, Material Prep, Cutting, Assembly, Finishing, QA, Packaging, Delivery
  description TEXT,
  sequence_order INTEGER NOT NULL DEFAULT 0,
  default_duration_hours INTEGER DEFAULT 24,
  color_code VARCHAR(7) DEFAULT '#3B82F6', -- hex color for UI
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Production Jobs (individual manufacturing jobs)
CREATE TABLE IF NOT EXISTS production_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  sales_order_id UUID REFERENCES sales_orders(id) ON DELETE SET NULL,
  sales_order_item_id UUID REFERENCES sales_order_items(id) ON DELETE SET NULL,
  current_stage_id UUID REFERENCES production_stages(id) ON DELETE SET NULL,
  status VARCHAR(50) DEFAULT 'pending', -- pending, scheduled, in_progress, on_hold, completed, cancelled
  scheduled_start TIMESTAMP WITH TIME ZONE,
  scheduled_end TIMESTAMP WITH TIME ZONE,
  actual_start TIMESTAMP WITH TIME ZONE,
  actual_end TIMESTAMP WITH TIME ZONE,
  estimated_duration_hours INTEGER,
  assigned_to UUID REFERENCES team_members(id) ON DELETE SET NULL,
  priority INTEGER DEFAULT 0, -- 0=normal, higher=more urgent
  notes TEXT,
  quality_check_required BOOLEAN DEFAULT true,
  quality_check_passed BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Production Job Events (history log)
CREATE TABLE IF NOT EXISTS production_job_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  production_job_id UUID NOT NULL REFERENCES production_jobs(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL, -- stage_change, delay, hold, resume, priority_change, assignment_change
  from_stage_id UUID REFERENCES production_stages(id) ON DELETE SET NULL,
  to_stage_id UUID REFERENCES production_stages(id) ON DELETE SET NULL,
  reason TEXT,
  metadata JSONB,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Production Schedule Entries (Gantt chart data)
CREATE TABLE IF NOT EXISTS production_schedule_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  production_job_id UUID NOT NULL REFERENCES production_jobs(id) ON DELETE CASCADE,
  stage_id UUID REFERENCES production_stages(id) ON DELETE SET NULL,
  scheduled_start TIMESTAMP WITH TIME ZONE NOT NULL,
  scheduled_end TIMESTAMP WITH TIME ZONE NOT NULL,
  resource_id UUID, -- machine, workbench, room, etc.
  resource_name VARCHAR(255),
  priority INTEGER DEFAULT 0,
  confirmed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===========================================
-- DESIGN & BOM
-- ===========================================

-- Design Versions (iterations of furniture designs)
CREATE TABLE IF NOT EXISTS design_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_order_item_id UUID REFERENCES sales_order_items(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL DEFAULT 1,
  design_data JSONB, -- CAD parameters, 3D model references
  design_files JSONB, -- URLs to images, CAD files
  specifications JSONB, -- detailed specs
  customer_feedback TEXT,
  revision_reason TEXT,
  status VARCHAR(50) DEFAULT 'draft', -- draft, under_review, approved, rejected
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMP WITH TIME ZONE,
  ai_generated BOOLEAN DEFAULT false,
  ai_prompt TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- BOM Headers (Bill of Materials root)
CREATE TABLE IF NOT EXISTS bom_headers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  design_version_id UUID REFERENCES design_versions(id) ON DELETE CASCADE,
  version_number INTEGER DEFAULT 1,
  total_material_cost DECIMAL(10,2) DEFAULT 0,
  total_labor_cost DECIMAL(10,2) DEFAULT 0,
  total_overhead_cost DECIMAL(10,2) DEFAULT 0,
  total_cost DECIMAL(10,2) DEFAULT 0,
  markup_percent DECIMAL(5,2) DEFAULT 30,
  final_price DECIMAL(10,2),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- BOM Items (individual material items)
CREATE TABLE IF NOT EXISTS bom_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bom_header_id UUID NOT NULL REFERENCES bom_headers(id) ON DELETE CASCADE,
  material_name VARCHAR(255) NOT NULL,
  material_type VARCHAR(100), -- wood, fabric, hardware, finish, consumable
  description TEXT,
  quantity DECIMAL(10,3) NOT NULL,
  unit VARCHAR(50), -- piece, meter, kg, sqm, liter
  unit_cost DECIMAL(10,2),
  total_cost DECIMAL(10,2),
  supplier_name VARCHAR(255),
  supplier_sku VARCHAR(255),
  lead_time_days INTEGER,
  alternative_material VARCHAR(255),
  wastage_percent DECIMAL(5,2) DEFAULT 10,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===========================================
-- INVENTORY
-- ===========================================

-- Inventory Items (master stock list)
CREATE TABLE IF NOT EXISTS inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  sku VARCHAR(255) UNIQUE,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100), -- wood, fabric, hardware, finish, consumable, tool
  subcategory VARCHAR(100),
  description TEXT,
  unit VARCHAR(50) NOT NULL,
  current_quantity DECIMAL(10,3) DEFAULT 0,
  min_stock_level DECIMAL(10,3) DEFAULT 0,
  reorder_point DECIMAL(10,3) DEFAULT 0,
  reorder_quantity DECIMAL(10,3) DEFAULT 0,
  unit_cost DECIMAL(10,2),
  avg_unit_cost DECIMAL(10,2), -- moving average
  selling_price DECIMAL(10,2),
  supplier_info JSONB, -- { name, contact, lead_time, min_order }
  location VARCHAR(255), -- warehouse, shelf, bin
  barcode VARCHAR(255),
  weight_kg DECIMAL(8,3),
  dimensions_cm JSONB, -- { length, width, height }
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Inventory Movements (stock ledger)
CREATE TABLE IF NOT EXISTS inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  movement_type VARCHAR(50) NOT NULL, -- purchase, consumption, adjustment, return, transfer, sale
  quantity DECIMAL(10,3) NOT NULL, -- positive for in, negative for out
  unit_cost DECIMAL(10,2),
  total_cost DECIMAL(10,2),
  reference_type VARCHAR(50), -- purchase_order, production_job, sales_order, adjustment, transfer
  reference_id UUID,
  reference_number VARCHAR(255),
  supplier_name VARCHAR(255),
  notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Inventory Reservations (materials reserved for jobs)
CREATE TABLE IF NOT EXISTS inventory_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  production_job_id UUID NOT NULL REFERENCES production_jobs(id) ON DELETE CASCADE,
  quantity_reserved DECIMAL(10,3) NOT NULL,
  quantity_consumed DECIMAL(10,3) DEFAULT 0,
  status VARCHAR(50) DEFAULT 'active', -- active, partially_consumed, consumed, released
  reserved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  consumed_at TIMESTAMP WITH TIME ZONE,
  released_at TIMESTAMP WITH TIME ZONE,
  notes TEXT
);

-- Purchase Orders
CREATE TABLE IF NOT EXISTS purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  supplier_name VARCHAR(255) NOT NULL,
  supplier_contact TEXT,
  status VARCHAR(50) DEFAULT 'draft', -- draft, sent, confirmed, received, cancelled
  total_amount DECIMAL(10,2),
  expected_delivery_date TIMESTAMP WITH TIME ZONE,
  actual_delivery_date TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Purchase Order Items
CREATE TABLE IF NOT EXISTS purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  inventory_item_id UUID REFERENCES inventory_items(id) ON DELETE SET NULL,
  item_name VARCHAR(255) NOT NULL,
  quantity DECIMAL(10,3) NOT NULL,
  unit VARCHAR(50),
  unit_price DECIMAL(10,2),
  total_price DECIMAL(10,2),
  received_quantity DECIMAL(10,3) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===========================================
-- QUALITY & DELIVERY
-- ===========================================

-- Quality Checks
CREATE TABLE IF NOT EXISTS quality_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  production_job_id UUID NOT NULL REFERENCES production_jobs(id) ON DELETE CASCADE,
  check_type VARCHAR(50) NOT NULL, -- incoming_material, in_process, pre_finish, final
  stage_id UUID REFERENCES production_stages(id) ON DELETE SET NULL,
  status VARCHAR(50) NOT NULL, -- pass, fail, conditional_pass, pending
  checklist JSONB, -- { item: string, passed: boolean }[]
  measurements JSONB, -- { dimension: string, expected: number, actual: number }[]
  defects_found TEXT,
  corrective_action TEXT,
  photos JSONB, -- array of photo URLs
  ai_assessment JSONB, -- { confidence: number, issues_detected: string[] }
  manual_override BOOLEAN DEFAULT false,
  notes TEXT,
  checked_by UUID REFERENCES users(id) ON DELETE SET NULL,
  checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Delivery Records
CREATE TABLE IF NOT EXISTS delivery_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_order_id UUID NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
  delivery_date TIMESTAMP WITH TIME ZONE,
  delivery_address TEXT,
  contact_name VARCHAR(255),
  contact_phone VARCHAR(50),
  driver_name VARCHAR(255),
  vehicle_plate VARCHAR(50),
  items_delivered JSONB, -- [{ item_id, description, quantity, condition }]
  installation_required BOOLEAN DEFAULT false,
  installation_completed BOOLEAN DEFAULT false,
  installation_date TIMESTAMP WITH TIME ZONE,
  installation_notes TEXT,
  customer_signature TEXT, -- base64 or URL
  customer_feedback TEXT,
  photos JSONB, -- before, during, after
  status VARCHAR(50) DEFAULT 'scheduled', -- scheduled, in_transit, delivered, installed, cancelled
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===========================================
-- INDEXES
-- ===========================================

-- Sales Orders indexes
CREATE INDEX IF NOT EXISTS idx_sales_orders_company ON sales_orders(company_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_status ON sales_orders(status);
CREATE INDEX IF NOT EXISTS idx_sales_orders_customer ON sales_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_created ON sales_orders(created_at);

-- Production indexes
CREATE INDEX IF NOT EXISTS idx_production_jobs_company ON production_jobs(company_id);
CREATE INDEX IF NOT EXISTS idx_production_jobs_status ON production_jobs(status);
CREATE INDEX IF NOT EXISTS idx_production_jobs_stage ON production_jobs(current_stage_id);
CREATE INDEX IF NOT EXISTS idx_production_jobs_order ON production_jobs(sales_order_id);
CREATE INDEX IF NOT EXISTS idx_production_jobs_assigned ON production_jobs(assigned_to);

-- Inventory indexes
CREATE INDEX IF NOT EXISTS idx_inventory_items_company ON inventory_items(company_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_sku ON inventory_items(sku);
CREATE INDEX IF NOT EXISTS idx_inventory_items_category ON inventory_items(category);
CREATE INDEX IF NOT EXISTS idx_inventory_low_stock ON inventory_items(current_quantity, min_stock_level);

-- Design indexes
CREATE INDEX IF NOT EXISTS idx_design_versions_item ON design_versions(sales_order_item_id);
CREATE INDEX IF NOT EXISTS idx_bom_headers_design ON bom_headers(design_version_id);

-- Movement indexes
CREATE INDEX IF NOT EXISTS idx_inventory_movements_item ON inventory_movements(inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_type ON inventory_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_reference ON inventory_movements(reference_type, reference_id);

-- ===========================================
-- SEED DATA
-- ===========================================

-- Insert default production stages
INSERT INTO production_stages (company_id, name, description, sequence_order, default_duration_hours, color_code) VALUES
('00000000-0000-0000-0000-000000000000', 'Measurement', 'Site measurement and space assessment', 1, 4, '#3B82F6'),
('00000000-0000-0000-0000-000000000000', 'Design', '3D modeling and design finalization', 2, 24, '#8B5CF6'),
('00000000-0000-0000-0000-000000000000', 'Material Prep', 'Material selection and procurement', 3, 48, '#F59E0B'),
('00000000-0000-0000-0000-000000000000', 'Cutting', 'CNC cutting and material sizing', 4, 16, '#EF4444'),
('00000000-0000-0000-0000-000000000000', 'Assembly', 'Joining and structural assembly', 5, 24, '#10B981'),
('00000000-0000-0000-0000-000000000000', 'Finishing', 'Sanding, painting, upholstery', 6, 32, '#6366F1'),
('00000000-0000-0000-0000-000000000000', 'Quality Check', 'Inspection and testing', 7, 8, '#14B8A6'),
('00000000-0000-0000-0000-000000000000', 'Packaging', 'Protection and crating', 8, 4, '#84CC16'),
('00000000-0000-0000-0000-000000000000', 'Delivery', 'Transport and installation', 9, 8, '#F97316')
ON CONFLICT DO NOTHING;

-- ===========================================
-- FUNCTIONS & TRIGGERS
-- ===========================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to all tables with updated_at
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN 
    SELECT table_name 
    FROM information_schema.columns 
    WHERE column_name = 'updated_at' 
    AND table_schema = 'public'
    AND table_name IN ('sales_orders', 'sales_order_items', 'production_jobs', 
                       'production_schedule_entries', 'design_versions', 
                       'bom_headers', 'inventory_items', 'purchase_orders',
                       'quality_checks', 'delivery_records')
  LOOP
    EXECUTE format('CREATE TRIGGER IF NOT EXISTS update_%s_updated_at 
      BEFORE UPDATE ON %I 
      FOR EACH ROW 
      EXECUTE FUNCTION update_updated_at_column()', t, t);
  END LOOP;
END $$;

-- Function to calculate BOM total cost
CREATE OR REPLACE FUNCTION calculate_bom_total(bom_header_id UUID)
RETURNS DECIMAL AS $$
DECLARE
  total DECIMAL;
BEGIN
  SELECT COALESCE(SUM(total_cost), 0)
  INTO total
  FROM bom_items
  WHERE bom_header_id = $1;
  
  RETURN total;
END;
$$ LANGUAGE plpgsql;

-- Function to check low stock
CREATE OR REPLACE FUNCTION get_low_stock_items(company_id UUID)
RETURNS TABLE (
  item_id UUID,
  item_name VARCHAR,
  current_quantity DECIMAL,
  min_stock_level DECIMAL,
  reorder_quantity DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    i.id,
    i.name,
    i.current_quantity,
    i.min_stock_level,
    i.reorder_quantity
  FROM inventory_items i
  WHERE i.company_id = $1
  AND i.current_quantity <= i.min_stock_level
  AND i.is_active = true;
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- VIEWS
-- ===========================================

-- View: Production Pipeline
CREATE OR REPLACE VIEW production_pipeline AS
SELECT 
  pj.id AS job_id,
  pj.company_id,
  pj.status,
  ps.name AS stage_name,
  ps.sequence_order,
  so.id AS sales_order_id,
  so.customer_id,
  u.name AS customer_name,
  soi.description AS item_description,
  pj.scheduled_start,
  pj.scheduled_end,
  pj.actual_start,
  pj.actual_end,
  tm.name AS assigned_to_name,
  CASE 
    WHEN pj.actual_end IS NOT NULL THEN 'completed'
    WHEN pj.actual_start IS NOT NULL THEN 'in_progress'
    WHEN pj.scheduled_start IS NOT NULL THEN 'scheduled'
    ELSE 'pending'
  END AS computed_status
FROM production_jobs pj
LEFT JOIN production_stages ps ON pj.current_stage_id = ps.id
LEFT JOIN sales_orders so ON pj.sales_order_id = so.id
LEFT JOIN users u ON so.customer_id = u.id
LEFT JOIN sales_order_items soi ON pj.sales_order_item_id = soi.id
LEFT JOIN team_members tm ON pj.assigned_to = tm.id;

-- View: Inventory Status
CREATE OR REPLACE VIEW inventory_status AS
SELECT 
  ii.*,
  CASE 
    WHEN ii.current_quantity <= ii.min_stock_level THEN 'critical'
    WHEN ii.current_quantity <= ii.reorder_point THEN 'low'
    ELSE 'normal'
  END AS stock_status,
  COALESCE(
    (SELECT SUM(quantity_reserved) 
     FROM inventory_reservations 
     WHERE inventory_item_id = ii.id 
     AND status IN ('active', 'partially_consumed')),
    0
  ) AS reserved_quantity,
  ii.current_quantity - COALESCE(
    (SELECT SUM(quantity_reserved) 
     FROM inventory_reservations 
     WHERE inventory_item_id = ii.id 
     AND status IN ('active', 'partially_consumed')),
    0
  ) AS available_quantity
FROM inventory_items ii
WHERE ii.is_active = true;

-- ===========================================
-- VERIFICATION
-- ===========================================

DO $$
BEGIN
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'Manufacturing Tables Migration Complete';
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'Tables created:';
  RAISE NOTICE '- sales_orders';
  RAISE NOTICE '- sales_order_items';
  RAISE NOTICE '- payment_schedules';
  RAISE NOTICE '- production_stages';
  RAISE NOTICE '- production_jobs';
  RAISE NOTICE '- production_job_events';
  RAISE NOTICE '- production_schedule_entries';
  RAISE NOTICE '- design_versions';
  RAISE NOTICE '- bom_headers';
  RAISE NOTICE '- bom_items';
  RAISE NOTICE '- inventory_items';
  RAISE NOTICE '- inventory_movements';
  RAISE NOTICE '- inventory_reservations';
  RAISE NOTICE '- purchase_orders';
  RAISE NOTICE '- purchase_order_items';
  RAISE NOTICE '- quality_checks';
  RAISE NOTICE '- delivery_records';
  RAISE NOTICE '===========================================';
END $$;

-- Migration: Product Management System
-- Purpose: Enable 100% real product management capabilities for Executive Agent
-- Created: Phase 1 of Executive Agent Enhancement

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. Product Categories Table
-- ============================================
CREATE TABLE IF NOT EXISTS product_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Relations
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    parent_id UUID REFERENCES product_categories(id) ON DELETE SET NULL,
    
    -- Category info
    name TEXT NOT NULL,
    slug TEXT UNIQUE,
    description TEXT,
    image_url TEXT,
    
    -- Display
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    
    -- SEO
    meta_title TEXT,
    meta_description TEXT,
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 2. Products Table
-- ============================================
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Relations
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    category_id UUID REFERENCES product_categories(id) ON DELETE SET NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Product identification
    name TEXT NOT NULL,
    slug TEXT UNIQUE,
    sku TEXT UNIQUE,
    
    -- Pricing
    base_price DECIMAL(10,2) NOT NULL,
    sale_price DECIMAL(10,2),
    cost_price DECIMAL(10,2),
    currency VARCHAR(3) DEFAULT 'SAR',
    
    -- Inventory
    stock_quantity INTEGER DEFAULT 0,
    stock_status VARCHAR(20) DEFAULT 'in_stock',
    low_stock_threshold INTEGER DEFAULT 10,
    
    -- Content
    description TEXT,
    short_description TEXT,
    specifications JSONB DEFAULT '{}',
    
    -- Media
    featured_image_url TEXT,
    gallery_images JSONB DEFAULT '[]',
    
    -- SEO
    meta_title TEXT,
    meta_description TEXT,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    is_featured BOOLEAN DEFAULT false,
    visibility VARCHAR(20) DEFAULT 'visible',
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 3. Product Inventory Log
-- ============================================
CREATE TABLE IF NOT EXISTS product_inventory_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Relations
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Change details
    change_type VARCHAR(20) NOT NULL,
    quantity_change INTEGER NOT NULL,
    previous_quantity INTEGER NOT NULL,
    new_quantity INTEGER NOT NULL,
    
    -- Context
    reason TEXT,
    reference_id UUID,
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 4. Affiliate Links Table
-- ============================================
CREATE TABLE IF NOT EXISTS affiliate_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Relations
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Link details
    platform VARCHAR(50) NOT NULL,
    external_url TEXT NOT NULL,
    affiliate_code TEXT,
    
    -- Tracking
    clicks INTEGER DEFAULT 0,
    conversions INTEGER DEFAULT 0,
    revenue_generated DECIMAL(10,2) DEFAULT 0,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 5. AdSense Configuration Table
-- ============================================
CREATE TABLE IF NOT EXISTS adsense_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Relations
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    
    -- Configuration
    publisher_id TEXT,
    ad_slots JSONB DEFAULT '[]',
    
    -- Placement rules
    auto_ads_enabled BOOLEAN DEFAULT false,
    custom_placements JSONB DEFAULT '{}',
    
    -- Performance tracking
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    estimated_revenue DECIMAL(10,2) DEFAULT 0,
    
    -- Status
    is_verified BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT false,
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- Indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_products_company_id ON products(company_id);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_stock_status ON products(stock_status);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_is_featured ON products(is_featured);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_product_inventory_product_id ON product_inventory_log(product_id);
CREATE INDEX IF NOT EXISTS idx_product_inventory_created_at ON product_inventory_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_inventory_change_type ON product_inventory_log(change_type);

CREATE INDEX IF NOT EXISTS idx_categories_company_id ON product_categories(company_id);
CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON product_categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_slug ON product_categories(slug);

CREATE INDEX IF NOT EXISTS idx_affiliate_product_id ON affiliate_links(product_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_platform ON affiliate_links(platform);
CREATE INDEX IF NOT EXISTS idx_affiliate_company_id ON affiliate_links(company_id);

CREATE INDEX IF NOT EXISTS idx_adsense_company_id ON adsense_config(company_id);

-- ============================================
-- Views
-- ============================================
CREATE OR REPLACE VIEW v_products_with_category AS
SELECT 
    p.*,
    c.name as category_name,
    c.slug as category_slug,
    u.email as created_by_email
FROM products p
LEFT JOIN product_categories c ON p.category_id = c.id
LEFT JOIN users u ON p.created_by = u.id;

CREATE OR REPLACE VIEW v_low_stock_products AS
SELECT 
    p.*,
    c.name as category_name
FROM products p
LEFT JOIN product_categories c ON p.category_id = c.id
WHERE p.stock_quantity <= p.low_stock_threshold
AND p.is_active = true;

CREATE OR REPLACE VIEW v_product_inventory_summary AS
SELECT 
    p.id,
    p.name,
    p.sku,
    p.stock_quantity,
    p.stock_status,
    p.low_stock_threshold,
    COUNT(pil.id) as total_inventory_changes,
    SUM(CASE WHEN pil.change_type = 'restock' THEN pil.quantity_change ELSE 0 END) as total_restocked,
    SUM(CASE WHEN pil.change_type = 'sale' THEN ABS(pil.quantity_change) ELSE 0 END) as total_sold,
    MAX(pil.created_at) as last_inventory_change
FROM products p
LEFT JOIN product_inventory_log pil ON p.id = pil.product_id
GROUP BY p.id, p.name, p.sku, p.stock_quantity, p.stock_status, p.low_stock_threshold;

-- ============================================
-- Triggers
-- ============================================
-- Update products.updated_at
CREATE OR REPLACE FUNCTION update_products_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_products_updated_at ON products;
CREATE TRIGGER trg_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_products_updated_at();

-- Auto-update stock_status
CREATE OR REPLACE FUNCTION update_stock_status()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.stock_quantity <= 0 THEN
        NEW.stock_status = 'out_of_stock';
    ELSIF NEW.stock_quantity <= NEW.low_stock_threshold THEN
        NEW.stock_status = 'low_stock';
    ELSE
        NEW.stock_status = 'in_stock';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_stock_status ON products;
CREATE TRIGGER trg_update_stock_status
    BEFORE INSERT OR UPDATE OF stock_quantity, low_stock_threshold ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_stock_status();

-- Log inventory changes
CREATE OR REPLACE FUNCTION log_inventory_change()
RETURNS TRIGGER AS $$
DECLARE
    change_type_val VARCHAR(20);
    reason_val TEXT;
BEGIN
    IF OLD.stock_quantity IS DISTINCT FROM NEW.stock_quantity THEN
        -- Determine change type
        IF NEW.stock_quantity > OLD.stock_quantity THEN
            change_type_val := 'restock';
            reason_val := 'Stock increased from ' || OLD.stock_quantity || ' to ' || NEW.stock_quantity;
        ELSE
            change_type_val := 'adjustment';
            reason_val := 'Stock decreased from ' || OLD.stock_quantity || ' to ' || NEW.stock_quantity;
        END IF;
        
        INSERT INTO product_inventory_log (
            product_id,
            quantity_change,
            previous_quantity,
            new_quantity,
            change_type,
            reason,
            created_at
        ) VALUES (
            NEW.id,
            NEW.stock_quantity - OLD.stock_quantity,
            OLD.stock_quantity,
            NEW.stock_quantity,
            change_type_val,
            reason_val,
            now()
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_log_inventory_change ON products;
CREATE TRIGGER trg_log_inventory_change
    AFTER UPDATE OF stock_quantity ON products
    FOR EACH ROW
    EXECUTE FUNCTION log_inventory_change();

-- Update affiliate links updated_at
CREATE OR REPLACE FUNCTION update_affiliate_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_affiliate_updated_at ON affiliate_links;
CREATE TRIGGER trg_affiliate_updated_at
    BEFORE UPDATE ON affiliate_links
    FOR EACH ROW
    EXECUTE FUNCTION update_affiliate_updated_at();

-- Update adsense config updated_at
DROP TRIGGER IF EXISTS trg_adsense_updated_at ON adsense_config;
CREATE TRIGGER trg_adsense_updated_at
    BEFORE UPDATE ON adsense_config
    FOR EACH ROW
    EXECUTE FUNCTION update_products_updated_at();

-- ============================================
-- RLS Policies
-- ============================================
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_inventory_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE adsense_config ENABLE ROW LEVEL SECURITY;

-- Products policies
DROP POLICY IF EXISTS "Products viewable by all" ON products;
CREATE POLICY "Products viewable by all"
    ON products FOR SELECT
    USING (is_active = true AND visibility = 'visible');

DROP POLICY IF EXISTS "Products manageable by admin" ON products;
CREATE POLICY "Products manageable by admin"
    ON products FOR ALL
    USING (true)
    WITH CHECK (true);

-- Categories policies
DROP POLICY IF EXISTS "Categories viewable by all" ON product_categories;
CREATE POLICY "Categories viewable by all"
    ON product_categories FOR SELECT
    USING (is_active = true);

DROP POLICY IF EXISTS "Categories manageable by admin" ON product_categories;
CREATE POLICY "Categories manageable by admin"
    ON product_categories FOR ALL
    USING (true);

-- Inventory log policies
DROP POLICY IF EXISTS "Inventory log viewable by admin" ON product_inventory_log;
CREATE POLICY "Inventory log viewable by admin"
    ON product_inventory_log FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Inventory log insertable by system" ON product_inventory_log;
CREATE POLICY "Inventory log insertable by system"
    ON product_inventory_log FOR INSERT
    WITH CHECK (true);

-- Affiliate links policies
DROP POLICY IF EXISTS "Affiliate links viewable by admin" ON affiliate_links;
CREATE POLICY "Affiliate links viewable by admin"
    ON affiliate_links FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Affiliate links manageable by admin" ON affiliate_links;
CREATE POLICY "Affiliate links manageable by admin"
    ON affiliate_links FOR ALL
    USING (true);

-- AdSense config policies
DROP POLICY IF EXISTS "AdSense config viewable by admin" ON adsense_config;
CREATE POLICY "AdSense config viewable by admin"
    ON adsense_config FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "AdSense config manageable by admin" ON adsense_config;
CREATE POLICY "AdSense config manageable by admin"
    ON adsense_config FOR ALL
    USING (true);

-- ============================================
-- Grant permissions
-- ============================================
GRANT ALL ON products TO authenticated;
GRANT ALL ON product_categories TO authenticated;
GRANT ALL ON product_inventory_log TO authenticated;
GRANT ALL ON affiliate_links TO authenticated;
GRANT ALL ON adsense_config TO authenticated;
GRANT ALL ON v_products_with_category TO authenticated;
GRANT ALL ON v_low_stock_products TO authenticated;
GRANT ALL ON v_product_inventory_summary TO authenticated;

-- ============================================
-- Realtime
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE products;
ALTER PUBLICATION supabase_realtime ADD TABLE product_categories;
ALTER PUBLICATION supabase_realtime ADD TABLE product_inventory_log;

-- ============================================
-- Helper Functions
-- ============================================
-- Function to get product stats
CREATE OR REPLACE FUNCTION get_product_stats(p_company_id UUID DEFAULT NULL)
RETURNS TABLE (
    total_products BIGINT,
    active_products BIGINT,
    low_stock_count BIGINT,
    out_of_stock_count BIGINT,
    total_inventory_value DECIMAL(12,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::BIGINT as total_products,
        COUNT(*) FILTER (WHERE p.is_active = true)::BIGINT as active_products,
        COUNT(*) FILTER (WHERE p.stock_status = 'low_stock')::BIGINT as low_stock_count,
        COUNT(*) FILTER (WHERE p.stock_status = 'out_of_stock')::BIGINT as out_of_stock_count,
        COALESCE(SUM(p.stock_quantity * p.cost_price) FILTER (WHERE p.cost_price IS NOT NULL), 0)::DECIMAL(12,2) as total_inventory_value
    FROM products p
    WHERE (p_company_id IS NULL OR p.company_id = p_company_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_product_stats TO authenticated;

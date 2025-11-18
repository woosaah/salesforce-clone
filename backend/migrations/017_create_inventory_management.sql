-- Migration 017: Inventory Management Module
-- Create inventory tracking system with multi-warehouse support

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- WAREHOUSES
-- ============================================================================

-- Warehouses table
CREATE TABLE warehouses (
  warehouse_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  warehouse_name VARCHAR(255) NOT NULL,
  warehouse_code VARCHAR(50),
  address JSONB, -- {street, city, state, zip, country}
  is_active BOOLEAN DEFAULT true,
  created_by UUID NOT NULL REFERENCES users(user_id),
  created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  modified_by UUID NOT NULL REFERENCES users(user_id),
  modified_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- INVENTORY ITEMS
-- ============================================================================

-- Main inventory items table
CREATE TABLE inventory_items (
  item_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
  warehouse_id UUID NOT NULL REFERENCES warehouses(warehouse_id) ON DELETE CASCADE,
  sku VARCHAR(100),
  barcode VARCHAR(100),
  quantity_on_hand DECIMAL(15, 2) DEFAULT 0,
  quantity_available DECIMAL(15, 2) DEFAULT 0, -- on_hand - committed
  quantity_committed DECIMAL(15, 2) DEFAULT 0, -- allocated to orders
  quantity_on_order DECIMAL(15, 2) DEFAULT 0, -- incoming from POs
  reorder_point DECIMAL(15, 2) DEFAULT 0,
  reorder_quantity DECIMAL(15, 2) DEFAULT 0,
  unit_cost DECIMAL(15, 2),
  bin_location VARCHAR(100), -- warehouse location (e.g., "A-12-3")
  last_counted_date DATE,
  last_restocked_date DATE,
  created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  modified_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(product_id, warehouse_id)
);

-- ============================================================================
-- STOCK MOVEMENTS
-- ============================================================================

-- Stock movements table (audit trail)
CREATE TABLE stock_movements (
  movement_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES inventory_items(item_id) ON DELETE CASCADE,
  movement_type VARCHAR(50) NOT NULL CHECK (movement_type IN ('Purchase', 'Sale', 'Transfer', 'Adjustment', 'Return')),
  quantity DECIMAL(15, 2) NOT NULL, -- positive or negative
  from_warehouse_id UUID REFERENCES warehouses(warehouse_id),
  to_warehouse_id UUID REFERENCES warehouses(warehouse_id),
  reference_type VARCHAR(50), -- 'PO', 'Invoice', 'Transfer', etc.
  reference_id UUID, -- ID of related document
  unit_cost DECIMAL(15, 2),
  total_cost DECIMAL(15, 2),
  movement_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  moved_by UUID NOT NULL REFERENCES users(user_id),
  notes TEXT,
  created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- STOCK ADJUSTMENTS
-- ============================================================================

-- Stock adjustments table
CREATE TABLE stock_adjustments (
  adjustment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES inventory_items(item_id) ON DELETE CASCADE,
  adjustment_date DATE NOT NULL,
  quantity_before DECIMAL(15, 2) NOT NULL,
  quantity_after DECIMAL(15, 2) NOT NULL,
  quantity_adjusted DECIMAL(15, 2) NOT NULL, -- positive or negative
  reason VARCHAR(100) CHECK (reason IN ('Stock Take', 'Damaged', 'Expired', 'Theft', 'Found', 'Other')),
  notes TEXT,
  adjusted_by UUID NOT NULL REFERENCES users(user_id),
  created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- BATCH LOTS
-- ============================================================================

-- Batch/lot tracking table
CREATE TABLE batch_lots (
  lot_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES inventory_items(item_id) ON DELETE CASCADE,
  lot_number VARCHAR(100) NOT NULL,
  manufacture_date DATE,
  expiry_date DATE,
  quantity DECIMAL(15, 2) DEFAULT 0,
  status VARCHAR(50) DEFAULT 'Active' CHECK (status IN ('Active', 'Expired', 'Recalled', 'Depleted')),
  notes TEXT,
  created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  modified_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(item_id, lot_number)
);

-- ============================================================================
-- TRIGGERS FOR AUTO-CALCULATION
-- ============================================================================

-- Trigger to update quantity_available when quantity_on_hand or quantity_committed changes
CREATE OR REPLACE FUNCTION update_quantity_available()
RETURNS TRIGGER AS $$
BEGIN
  NEW.quantity_available := NEW.quantity_on_hand - NEW.quantity_committed;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_quantity_available
BEFORE INSERT OR UPDATE ON inventory_items
FOR EACH ROW
EXECUTE FUNCTION update_quantity_available();

-- Trigger to update last_restocked_date when quantity increases
CREATE OR REPLACE FUNCTION update_last_restocked()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.quantity_on_hand > OLD.quantity_on_hand THEN
    NEW.last_restocked_date := CURRENT_DATE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_last_restocked
BEFORE UPDATE ON inventory_items
FOR EACH ROW
EXECUTE FUNCTION update_last_restocked();

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Warehouses indexes
CREATE INDEX idx_warehouses_tenant ON warehouses(tenant_id);

-- Inventory items indexes
CREATE INDEX idx_inventory_items_tenant ON inventory_items(tenant_id);
CREATE INDEX idx_inventory_items_product ON inventory_items(product_id);
CREATE INDEX idx_inventory_items_warehouse ON inventory_items(warehouse_id);
CREATE INDEX idx_inventory_items_sku ON inventory_items(sku);
CREATE INDEX idx_inventory_items_barcode ON inventory_items(barcode);
CREATE INDEX idx_inventory_items_low_stock ON inventory_items(quantity_available, reorder_point);

-- Stock movements indexes
CREATE INDEX idx_stock_movements_tenant ON stock_movements(tenant_id);
CREATE INDEX idx_stock_movements_item ON stock_movements(item_id);
CREATE INDEX idx_stock_movements_date ON stock_movements(movement_date);
CREATE INDEX idx_stock_movements_type ON stock_movements(movement_type);

-- Stock adjustments indexes
CREATE INDEX idx_stock_adjustments_tenant ON stock_adjustments(tenant_id);
CREATE INDEX idx_stock_adjustments_item ON stock_adjustments(item_id);
CREATE INDEX idx_stock_adjustments_date ON stock_adjustments(adjustment_date);

-- Batch lots indexes
CREATE INDEX idx_batch_lots_tenant ON batch_lots(tenant_id);
CREATE INDEX idx_batch_lots_item ON batch_lots(item_id);
CREATE INDEX idx_batch_lots_expiry ON batch_lots(expiry_date, status);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_lots ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY warehouses_tenant_isolation ON warehouses
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));

CREATE POLICY inventory_items_tenant_isolation ON inventory_items
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));

CREATE POLICY stock_movements_tenant_isolation ON stock_movements
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));

CREATE POLICY stock_adjustments_tenant_isolation ON stock_adjustments
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));

CREATE POLICY batch_lots_tenant_isolation ON batch_lots
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON warehouses TO postgres;
GRANT SELECT, INSERT, UPDATE, DELETE ON inventory_items TO postgres;
GRANT SELECT, INSERT, UPDATE, DELETE ON stock_movements TO postgres;
GRANT SELECT, INSERT, UPDATE, DELETE ON stock_adjustments TO postgres;
GRANT SELECT, INSERT, UPDATE, DELETE ON batch_lots TO postgres;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE warehouses IS 'Physical warehouse locations for inventory storage';
COMMENT ON TABLE inventory_items IS 'Stock levels per product per warehouse';
COMMENT ON TABLE stock_movements IS 'Audit trail of all inventory movements';
COMMENT ON TABLE stock_adjustments IS 'Manual stock adjustments with reasons';
COMMENT ON TABLE batch_lots IS 'Batch/lot tracking for products with expiry dates';
COMMENT ON COLUMN inventory_items.quantity_available IS 'Calculated as quantity_on_hand - quantity_committed';

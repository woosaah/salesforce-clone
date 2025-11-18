import { query } from '../config/database';

async function seedInventory() {
  try {
    console.log('🌱 Seeding Inventory Management data...');

    // Get demo tenant
    const tenantResult = await query('SELECT tenant_id FROM tenants LIMIT 1');
    if (tenantResult.length === 0) {
      console.error('❌ No tenant found. Please run base migrations and seeds first.');
      return;
    }
    const tenantId = tenantResult[0].tenant_id;

    // Get demo user
    const userResult = await query(
      'SELECT user_id FROM users WHERE tenant_id = $1 LIMIT 1',
      [tenantId]
    );
    if (userResult.length === 0) {
      console.error('❌ No user found for tenant.');
      return;
    }
    const userId = userResult[0].user_id;

    // Set tenant context
    await query(`SET app.current_tenant_id = '${tenantId}'`);

    // Create warehouses
    console.log('  🏢 Creating warehouses...');
    const warehouses = await query(
      `INSERT INTO warehouses (
        tenant_id, warehouse_name, warehouse_code, address, city, state, country,
        postal_code, phone, manager_name, is_active
      ) VALUES
        ($1, 'Main Distribution Center', 'WH-001', '123 Warehouse Ave', 'San Francisco', 'CA', 'USA', '94102', '415-555-0101', 'John Smith', true),
        ($1, 'East Coast Facility', 'WH-002', '456 Storage Blvd', 'New York', 'NY', 'USA', '10001', '212-555-0102', 'Jane Doe', true),
        ($1, 'South Regional Hub', 'WH-003', '789 Distribution Dr', 'Atlanta', 'GA', 'USA', '30301', '404-555-0103', 'Bob Johnson', true)
      RETURNING warehouse_id, warehouse_name`,
      [tenantId]
    );

    console.log(`  ✅ Created ${warehouses.length} warehouses`);

    // Get product IDs for inventory
    const products = await query(
      'SELECT product_id, product_name FROM products WHERE tenant_id = $1 LIMIT 10',
      [tenantId]
    );

    if (products.length === 0) {
      console.log('  ⚠️  No products found. Skipping inventory items.');
      return;
    }

    console.log('  📦 Creating inventory items...');

    let itemCount = 0;
    for (const warehouse of warehouses) {
      for (let i = 0; i < Math.min(products.length, 5); i++) {
        const product = products[i];
        const quantityOnHand = Math.floor(Math.random() * 1000) + 100;
        const quantityCommitted = Math.floor(Math.random() * 50);
        const quantityOnOrder = Math.floor(Math.random() * 200);
        const reorderPoint = 100;
        const reorderQuantity = 500;
        const unitCost = Math.floor(Math.random() * 50) + 10;

        await query(
          `INSERT INTO inventory_items (
            tenant_id, product_id, warehouse_id, sku, barcode,
            quantity_on_hand, quantity_committed, quantity_on_order,
            reorder_point, reorder_quantity, unit_cost, bin_location
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [
            tenantId,
            product.product_id,
            warehouse.warehouse_id,
            `SKU-${warehouse.warehouse_id.substring(0, 8)}-${product.product_id.substring(0, 8)}`,
            `BAR-${Date.now()}-${Math.random().toString(36).substring(7)}`,
            quantityOnHand,
            quantityCommitted,
            quantityOnOrder,
            reorderPoint,
            reorderQuantity,
            unitCost,
            `${String.fromCharCode(65 + Math.floor(Math.random() * 26))}${Math.floor(Math.random() * 99) + 1}-${Math.floor(Math.random() * 99) + 1}`
          ]
        );
        itemCount++;
      }
    }

    console.log(`  ✅ Created ${itemCount} inventory items`);

    // Get inventory item IDs for movements
    const items = await query(
      'SELECT item_id FROM inventory_items WHERE tenant_id = $1 LIMIT 5',
      [tenantId]
    );

    // Create stock movements
    console.log('  📊 Creating stock movements...');
    const movementTypes = ['Purchase', 'Sale', 'Transfer', 'Return', 'Adjustment'];
    let movementCount = 0;

    for (const item of items) {
      for (let i = 0; i < 3; i++) {
        const movementType = movementTypes[Math.floor(Math.random() * movementTypes.length)];
        const quantity = Math.floor(Math.random() * 50) + 10;
        const unitCost = Math.floor(Math.random() * 50) + 10;

        let fromWarehouseId = null;
        let toWarehouseId = null;

        if (movementType === 'Transfer') {
          fromWarehouseId = warehouses[0].warehouse_id;
          toWarehouseId = warehouses[1].warehouse_id;
        } else if (movementType === 'Purchase') {
          toWarehouseId = warehouses[Math.floor(Math.random() * warehouses.length)].warehouse_id;
        } else if (movementType === 'Sale') {
          fromWarehouseId = warehouses[Math.floor(Math.random() * warehouses.length)].warehouse_id;
        }

        await query(
          `INSERT INTO stock_movements (
            tenant_id, item_id, movement_type, quantity,
            from_warehouse_id, to_warehouse_id, unit_cost, notes, moved_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            tenantId,
            item.item_id,
            movementType,
            quantity,
            fromWarehouseId,
            toWarehouseId,
            unitCost,
            `${movementType} movement - automated seed data`,
            userId
          ]
        );
        movementCount++;
      }
    }

    console.log(`  ✅ Created ${movementCount} stock movements`);

    // Create stock adjustments
    console.log('  🔧 Creating stock adjustments...');
    const adjustmentReasons = ['Stock Take', 'Damaged', 'Expired', 'Theft', 'Found'];
    let adjustmentCount = 0;

    for (const item of items.slice(0, 3)) {
      const reason = adjustmentReasons[Math.floor(Math.random() * adjustmentReasons.length)];
      const quantityBefore = Math.floor(Math.random() * 500) + 100;
      const quantityAfter = reason === 'Found'
        ? quantityBefore + Math.floor(Math.random() * 50)
        : quantityBefore - Math.floor(Math.random() * 50);

      await query(
        `INSERT INTO stock_adjustments (
          tenant_id, item_id, quantity_before, quantity_after,
          adjustment_quantity, adjustment_reason, notes, adjusted_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          tenantId,
          item.item_id,
          quantityBefore,
          quantityAfter,
          quantityAfter - quantityBefore,
          reason,
          `${reason} adjustment - automated seed data`,
          userId
        ]
      );
      adjustmentCount++;
    }

    console.log(`  ✅ Created ${adjustmentCount} stock adjustments`);

    // Create batch lots
    console.log('  🏷️  Creating batch/lots...');
    const statuses = ['Active', 'Expired', 'Recalled', 'Depleted'];
    let batchCount = 0;

    for (const item of items.slice(0, 3)) {
      for (let i = 0; i < 2; i++) {
        const manufacturingDate = new Date();
        manufacturingDate.setDate(manufacturingDate.getDate() - Math.floor(Math.random() * 180));

        const expiryDate = new Date(manufacturingDate);
        expiryDate.setDate(expiryDate.getDate() + 365 + Math.floor(Math.random() * 365));

        const status = expiryDate < new Date() ? 'Expired' : 'Active';
        const quantity = Math.floor(Math.random() * 100) + 10;

        await query(
          `INSERT INTO batch_lots (
            tenant_id, item_id, batch_number, lot_number, quantity,
            manufacturing_date, expiry_date, status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            tenantId,
            item.item_id,
            `BATCH-${Date.now()}-${Math.random().toString(36).substring(7)}`,
            `LOT-${Date.now()}-${Math.random().toString(36).substring(7)}`,
            quantity,
            manufacturingDate.toISOString().split('T')[0],
            expiryDate.toISOString().split('T')[0],
            status
          ]
        );
        batchCount++;
      }
    }

    console.log(`  ✅ Created ${batchCount} batch/lots`);

    console.log('✅ Inventory Management seed data completed!');
  } catch (error) {
    console.error('❌ Error seeding Inventory Management data:', error);
    throw error;
  }
}

// Run seeder
if (require.main === module) {
  seedInventory()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export default seedInventory;

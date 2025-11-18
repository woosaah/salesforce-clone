import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { queryWithTenant } from '../config/database';

const router = Router();
router.use(authenticate);

// Get all inventory items
router.get('/items', async (req: AuthRequest, res: Response) => {
  try {
    const { warehouse_id, product_id, low_stock } = req.query;
    const tenantId = req.tenantId!;

    let whereClause = '';
    const params: any[] = [];

    if (warehouse_id) {
      whereClause += ' AND ii.warehouse_id = $' + (params.length + 1);
      params.push(warehouse_id);
    }
    if (product_id) {
      whereClause += ' AND ii.product_id = $' + (params.length + 1);
      params.push(product_id);
    }
    if (low_stock === 'true') {
      whereClause += ' AND ii.quantity_on_hand <= ii.reorder_point';
    }

    const items = await queryWithTenant(
      tenantId,
      `SELECT ii.*,
        p.product_name,
        p.product_code,
        w.warehouse_name,
        w.warehouse_code
       FROM inventory_items ii
       LEFT JOIN products p ON ii.product_id = p.product_id
       LEFT JOIN warehouses w ON ii.warehouse_id = w.warehouse_id
       WHERE 1=1 ${whereClause}
       ORDER BY p.product_name, w.warehouse_name`,
      params
    );

    res.json({ success: true, data: items });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single inventory item
router.get('/items/:itemId', async (req: AuthRequest, res: Response) => {
  try {
    const { itemId } = req.params;
    const tenantId = req.tenantId!;

    const items = await queryWithTenant(
      tenantId,
      `SELECT ii.*,
        p.product_name,
        p.product_code,
        w.warehouse_name,
        w.warehouse_code
       FROM inventory_items ii
       LEFT JOIN products p ON ii.product_id = p.product_id
       LEFT JOIN warehouses w ON ii.warehouse_id = w.warehouse_id
       WHERE ii.item_id = $1`,
      [itemId]
    );

    if (items.length === 0) {
      return res.status(404).json({ success: false, error: 'Inventory item not found' });
    }

    res.json({ success: true, data: items[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create inventory item
router.post('/items', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const {
      product_id,
      warehouse_id,
      sku,
      barcode,
      quantity_on_hand = 0,
      quantity_committed = 0,
      quantity_on_order = 0,
      reorder_point = 0,
      reorder_quantity = 0,
      unit_cost,
      bin_location
    } = req.body;

    if (!product_id || !warehouse_id) {
      return res.status(400).json({ success: false, error: 'Product ID and warehouse ID are required' });
    }

    const items = await queryWithTenant(
      tenantId,
      `INSERT INTO inventory_items (
        tenant_id, product_id, warehouse_id, sku, barcode,
        quantity_on_hand, quantity_committed, quantity_on_order,
        reorder_point, reorder_quantity, unit_cost, bin_location
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        tenantId, product_id, warehouse_id, sku, barcode,
        quantity_on_hand, quantity_committed, quantity_on_order,
        reorder_point, reorder_quantity, unit_cost, bin_location
      ]
    );

    res.status(201).json({ success: true, data: items[0] });
  } catch (error: any) {
    if (error.code === '23505') { // Unique constraint violation
      return res.status(400).json({
        success: false,
        error: 'Inventory item already exists for this product and warehouse'
      });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update inventory item
router.put('/items/:itemId', async (req: AuthRequest, res: Response) => {
  try {
    const { itemId } = req.params;
    const tenantId = req.tenantId!;
    const updates = req.body;

    const items = await queryWithTenant(
      tenantId,
      `UPDATE inventory_items SET
        sku = COALESCE($1, sku),
        barcode = COALESCE($2, barcode),
        quantity_on_hand = COALESCE($3, quantity_on_hand),
        quantity_committed = COALESCE($4, quantity_committed),
        quantity_on_order = COALESCE($5, quantity_on_order),
        reorder_point = COALESCE($6, reorder_point),
        reorder_quantity = COALESCE($7, reorder_quantity),
        unit_cost = COALESCE($8, unit_cost),
        bin_location = COALESCE($9, bin_location),
        last_counted_date = COALESCE($10, last_counted_date),
        modified_date = CURRENT_TIMESTAMP
       WHERE item_id = $11
       RETURNING *`,
      [
        updates.sku, updates.barcode, updates.quantity_on_hand,
        updates.quantity_committed, updates.quantity_on_order,
        updates.reorder_point, updates.reorder_quantity, updates.unit_cost,
        updates.bin_location, updates.last_counted_date, itemId
      ]
    );

    if (items.length === 0) {
      return res.status(404).json({ success: false, error: 'Inventory item not found' });
    }

    res.json({ success: true, data: items[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete inventory item
router.delete('/items/:itemId', async (req: AuthRequest, res: Response) => {
  try {
    const { itemId } = req.params;
    const tenantId = req.tenantId!;

    const result = await queryWithTenant(
      tenantId,
      'DELETE FROM inventory_items WHERE item_id = $1 RETURNING item_id',
      [itemId]
    );

    if (result.length === 0) {
      return res.status(404).json({ success: false, error: 'Inventory item not found' });
    }

    res.json({ success: true, message: 'Inventory item deleted' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get stock movements
router.get('/movements', async (req: AuthRequest, res: Response) => {
  try {
    const { item_id, product_id, warehouse_id, movement_type, limit = 50 } = req.query;
    const tenantId = req.tenantId!;

    let whereClause = '';
    const params: any[] = [];

    if (item_id) {
      whereClause += ' AND sm.item_id = $' + (params.length + 1);
      params.push(item_id);
    }
    if (product_id) {
      whereClause += ' AND ii.product_id = $' + (params.length + 1);
      params.push(product_id);
    }
    if (warehouse_id) {
      whereClause += ' AND (sm.from_warehouse_id = $' + (params.length + 1) +
                      ' OR sm.to_warehouse_id = $' + (params.length + 1) + ')';
      params.push(warehouse_id);
    }
    if (movement_type) {
      whereClause += ' AND sm.movement_type = $' + (params.length + 1);
      params.push(movement_type);
    }

    params.push(limit);

    const movements = await queryWithTenant(
      tenantId,
      `SELECT sm.*,
        p.product_name,
        p.product_code,
        fw.warehouse_name as from_warehouse_name,
        tw.warehouse_name as to_warehouse_name,
        u.first_name || ' ' || u.last_name as moved_by_name
       FROM stock_movements sm
       LEFT JOIN inventory_items ii ON sm.item_id = ii.item_id
       LEFT JOIN products p ON ii.product_id = p.product_id
       LEFT JOIN warehouses fw ON sm.from_warehouse_id = fw.warehouse_id
       LEFT JOIN warehouses tw ON sm.to_warehouse_id = tw.warehouse_id
       LEFT JOIN users u ON sm.moved_by = u.user_id
       WHERE 1=1 ${whereClause}
       ORDER BY sm.movement_date DESC
       LIMIT $${params.length}`,
      params
    );

    res.json({ success: true, data: movements });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create stock movement
router.post('/movements', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const userId = req.userId!;
    const {
      item_id,
      movement_type,
      quantity,
      from_warehouse_id,
      to_warehouse_id,
      reference_type,
      reference_id,
      unit_cost,
      notes
    } = req.body;

    if (!item_id || !movement_type || !quantity) {
      return res.status(400).json({
        success: false,
        error: 'Item ID, movement type, and quantity are required'
      });
    }

    const movements = await queryWithTenant(
      tenantId,
      `INSERT INTO stock_movements (
        tenant_id, item_id, movement_type, quantity,
        from_warehouse_id, to_warehouse_id, reference_type,
        reference_id, unit_cost, notes, moved_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        tenantId, item_id, movement_type, quantity,
        from_warehouse_id, to_warehouse_id, reference_type,
        reference_id, unit_cost, notes, userId
      ]
    );

    // Update inventory quantity based on movement type
    if (movement_type === 'Purchase' || movement_type === 'Return') {
      await queryWithTenant(
        tenantId,
        'UPDATE inventory_items SET quantity_on_hand = quantity_on_hand + $1 WHERE item_id = $2',
        [quantity, item_id]
      );
    } else if (movement_type === 'Sale' || movement_type === 'Adjustment') {
      await queryWithTenant(
        tenantId,
        'UPDATE inventory_items SET quantity_on_hand = quantity_on_hand - $1 WHERE item_id = $2',
        [quantity, item_id]
      );
    }

    res.status(201).json({ success: true, data: movements[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get stock adjustments
router.get('/adjustments', async (req: AuthRequest, res: Response) => {
  try {
    const { item_id, adjustment_reason, limit = 50 } = req.query;
    const tenantId = req.tenantId!;

    let whereClause = '';
    const params: any[] = [];

    if (item_id) {
      whereClause += ' AND sa.item_id = $' + (params.length + 1);
      params.push(item_id);
    }
    if (adjustment_reason) {
      whereClause += ' AND sa.adjustment_reason = $' + (params.length + 1);
      params.push(adjustment_reason);
    }

    params.push(limit);

    const adjustments = await queryWithTenant(
      tenantId,
      `SELECT sa.*,
        p.product_name,
        p.product_code,
        w.warehouse_name,
        u.first_name || ' ' || u.last_name as adjusted_by_name
       FROM stock_adjustments sa
       LEFT JOIN inventory_items ii ON sa.item_id = ii.item_id
       LEFT JOIN products p ON ii.product_id = p.product_id
       LEFT JOIN warehouses w ON ii.warehouse_id = w.warehouse_id
       LEFT JOIN users u ON sa.adjusted_by = u.user_id
       WHERE 1=1 ${whereClause}
       ORDER BY sa.adjustment_date DESC
       LIMIT $${params.length}`,
      params
    );

    res.json({ success: true, data: adjustments });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create stock adjustment
router.post('/adjustments', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const userId = req.userId!;
    const {
      item_id,
      quantity_before,
      quantity_after,
      adjustment_reason,
      notes
    } = req.body;

    if (!item_id || quantity_before === undefined || quantity_after === undefined || !adjustment_reason) {
      return res.status(400).json({
        success: false,
        error: 'Item ID, quantity before, quantity after, and adjustment reason are required'
      });
    }

    const adjustment_quantity = quantity_after - quantity_before;

    const adjustments = await queryWithTenant(
      tenantId,
      `INSERT INTO stock_adjustments (
        tenant_id, item_id, quantity_before, quantity_after,
        adjustment_quantity, adjustment_reason, notes, adjusted_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        tenantId, item_id, quantity_before, quantity_after,
        adjustment_quantity, adjustment_reason, notes, userId
      ]
    );

    // Update inventory quantity
    await queryWithTenant(
      tenantId,
      'UPDATE inventory_items SET quantity_on_hand = $1, modified_date = CURRENT_TIMESTAMP WHERE item_id = $2',
      [quantity_after, item_id]
    );

    res.status(201).json({ success: true, data: adjustments[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get low stock items
router.get('/low-stock', async (req: AuthRequest, res: Response) => {
  try {
    const { warehouse_id } = req.query;
    const tenantId = req.tenantId!;

    let whereClause = ' AND ii.quantity_on_hand <= ii.reorder_point';
    const params: any[] = [];

    if (warehouse_id) {
      whereClause += ' AND ii.warehouse_id = $' + (params.length + 1);
      params.push(warehouse_id);
    }

    const items = await queryWithTenant(
      tenantId,
      `SELECT ii.*,
        p.product_name,
        p.product_code,
        w.warehouse_name,
        w.warehouse_code,
        (ii.reorder_point - ii.quantity_on_hand) as shortage
       FROM inventory_items ii
       LEFT JOIN products p ON ii.product_id = p.product_id
       LEFT JOIN warehouses w ON ii.warehouse_id = w.warehouse_id
       WHERE 1=1 ${whereClause}
       ORDER BY (ii.reorder_point - ii.quantity_on_hand) DESC`,
      params
    );

    res.json({ success: true, data: items });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get batch/lots
router.get('/batches', async (req: AuthRequest, res: Response) => {
  try {
    const { item_id, status, expired } = req.query;
    const tenantId = req.tenantId!;

    let whereClause = '';
    const params: any[] = [];

    if (item_id) {
      whereClause += ' AND bl.item_id = $' + (params.length + 1);
      params.push(item_id);
    }
    if (status) {
      whereClause += ' AND bl.status = $' + (params.length + 1);
      params.push(status);
    }
    if (expired === 'true') {
      whereClause += ' AND bl.expiry_date < CURRENT_DATE';
    }

    const batches = await queryWithTenant(
      tenantId,
      `SELECT bl.*,
        p.product_name,
        p.product_code,
        w.warehouse_name
       FROM batch_lots bl
       LEFT JOIN inventory_items ii ON bl.item_id = ii.item_id
       LEFT JOIN products p ON ii.product_id = p.product_id
       LEFT JOIN warehouses w ON ii.warehouse_id = w.warehouse_id
       WHERE 1=1 ${whereClause}
       ORDER BY bl.expiry_date ASC`,
      params
    );

    res.json({ success: true, data: batches });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create batch/lot
router.post('/batches', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const {
      item_id,
      batch_number,
      lot_number,
      quantity,
      manufacturing_date,
      expiry_date,
      status = 'Active'
    } = req.body;

    if (!item_id || !batch_number || !quantity) {
      return res.status(400).json({
        success: false,
        error: 'Item ID, batch number, and quantity are required'
      });
    }

    const batches = await queryWithTenant(
      tenantId,
      `INSERT INTO batch_lots (
        tenant_id, item_id, batch_number, lot_number, quantity,
        manufacturing_date, expiry_date, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        tenantId, item_id, batch_number, lot_number, quantity,
        manufacturing_date, expiry_date, status
      ]
    );

    res.status(201).json({ success: true, data: batches[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update batch/lot
router.put('/batches/:batchId', async (req: AuthRequest, res: Response) => {
  try {
    const { batchId } = req.params;
    const tenantId = req.tenantId!;
    const updates = req.body;

    const batches = await queryWithTenant(
      tenantId,
      `UPDATE batch_lots SET
        quantity = COALESCE($1, quantity),
        status = COALESCE($2, status),
        modified_date = CURRENT_TIMESTAMP
       WHERE batch_id = $3
       RETURNING *`,
      [updates.quantity, updates.status, batchId]
    );

    if (batches.length === 0) {
      return res.status(404).json({ success: false, error: 'Batch/lot not found' });
    }

    res.json({ success: true, data: batches[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;

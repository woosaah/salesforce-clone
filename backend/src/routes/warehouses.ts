import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { queryWithTenant } from '../config/database';

const router = Router();
router.use(authenticate);

// Get all warehouses
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { is_active } = req.query;
    const tenantId = req.tenantId!;

    let whereClause = '';
    const params: any[] = [];

    if (is_active !== undefined) {
      whereClause = ' AND is_active = $' + (params.length + 1);
      params.push(is_active === 'true');
    }

    const warehouses = await queryWithTenant(
      tenantId,
      `SELECT w.*,
        (SELECT COUNT(*) FROM inventory_items ii WHERE ii.warehouse_id = w.warehouse_id) as item_count,
        (SELECT SUM(quantity_on_hand * unit_cost) FROM inventory_items ii WHERE ii.warehouse_id = w.warehouse_id) as total_value
       FROM warehouses w
       WHERE 1=1 ${whereClause}
       ORDER BY w.warehouse_name`,
      params
    );

    res.json({ success: true, data: warehouses });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single warehouse
router.get('/:warehouseId', async (req: AuthRequest, res: Response) => {
  try {
    const { warehouseId } = req.params;
    const tenantId = req.tenantId!;

    const warehouses = await queryWithTenant(
      tenantId,
      `SELECT w.*,
        (SELECT COUNT(*) FROM inventory_items ii WHERE ii.warehouse_id = w.warehouse_id) as item_count,
        (SELECT SUM(quantity_on_hand * unit_cost) FROM inventory_items ii WHERE ii.warehouse_id = w.warehouse_id) as total_value
       FROM warehouses w
       WHERE w.warehouse_id = $1`,
      [warehouseId]
    );

    if (warehouses.length === 0) {
      return res.status(404).json({ success: false, error: 'Warehouse not found' });
    }

    res.json({ success: true, data: warehouses[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create warehouse
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const {
      warehouse_name,
      warehouse_code,
      address,
      city,
      state,
      country,
      postal_code,
      phone,
      manager_name,
      is_active = true
    } = req.body;

    if (!warehouse_name) {
      return res.status(400).json({ success: false, error: 'Warehouse name is required' });
    }

    const warehouses = await queryWithTenant(
      tenantId,
      `INSERT INTO warehouses (
        tenant_id, warehouse_name, warehouse_code, address, city, state,
        country, postal_code, phone, manager_name, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        tenantId, warehouse_name, warehouse_code, address, city, state,
        country, postal_code, phone, manager_name, is_active
      ]
    );

    res.status(201).json({ success: true, data: warehouses[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update warehouse
router.put('/:warehouseId', async (req: AuthRequest, res: Response) => {
  try {
    const { warehouseId } = req.params;
    const tenantId = req.tenantId!;
    const updates = req.body;

    const warehouses = await queryWithTenant(
      tenantId,
      `UPDATE warehouses SET
        warehouse_name = COALESCE($1, warehouse_name),
        warehouse_code = COALESCE($2, warehouse_code),
        address = COALESCE($3, address),
        city = COALESCE($4, city),
        state = COALESCE($5, state),
        country = COALESCE($6, country),
        postal_code = COALESCE($7, postal_code),
        phone = COALESCE($8, phone),
        manager_name = COALESCE($9, manager_name),
        is_active = COALESCE($10, is_active),
        modified_date = CURRENT_TIMESTAMP
       WHERE warehouse_id = $11
       RETURNING *`,
      [
        updates.warehouse_name, updates.warehouse_code, updates.address,
        updates.city, updates.state, updates.country, updates.postal_code,
        updates.phone, updates.manager_name, updates.is_active, warehouseId
      ]
    );

    if (warehouses.length === 0) {
      return res.status(404).json({ success: false, error: 'Warehouse not found' });
    }

    res.json({ success: true, data: warehouses[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete warehouse
router.delete('/:warehouseId', async (req: AuthRequest, res: Response) => {
  try {
    const { warehouseId } = req.params;
    const tenantId = req.tenantId!;

    // Check if warehouse has inventory
    const items = await queryWithTenant(
      tenantId,
      'SELECT COUNT(*) as count FROM inventory_items WHERE warehouse_id = $1',
      [warehouseId]
    );

    if (parseInt(items[0].count) > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete warehouse with inventory items. Transfer or remove items first.'
      });
    }

    const result = await queryWithTenant(
      tenantId,
      'DELETE FROM warehouses WHERE warehouse_id = $1 RETURNING warehouse_id',
      [warehouseId]
    );

    if (result.length === 0) {
      return res.status(404).json({ success: false, error: 'Warehouse not found' });
    }

    res.json({ success: true, message: 'Warehouse deleted' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;

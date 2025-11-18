import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { queryWithTenant } from '../config/database';

const router = Router();
router.use(authenticate);

// Get all POs
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { limit = 50, offset = 0, status } = req.query;
    const tenantId = req.tenantId!;

    let whereClause = '';
    const params: any[] = [];
    if (status) {
      whereClause = 'AND po.status = $1';
      params.push(status);
    }

    const pos = await queryWithTenant(
      tenantId,
      `SELECT po.*, v.data->>'Name' as vendor_name
       FROM purchase_orders po
       LEFT JOIN object_data v ON po.vendor_id = v.record_id
       WHERE 1=1 ${whereClause}
       ORDER BY po.order_date DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    res.json({ success: true, data: { purchase_orders: pos, total: pos.length } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single PO
router.get('/:poId', async (req: AuthRequest, res: Response) => {
  try {
    const { poId } = req.params;
    const tenantId = req.tenantId!;

    const pos = await queryWithTenant(
      tenantId,
      `SELECT po.*,
        COALESCE(jsonb_agg(jsonb_build_object(
          'line_item_id', li.line_item_id, 'line_number', li.line_number,
          'description', li.description, 'quantity', li.quantity,
          'unit_price', li.unit_price, 'line_total', li.line_total
        ) ORDER BY li.line_number) FILTER (WHERE li.line_item_id IS NOT NULL), '[]') as line_items
       FROM purchase_orders po
       LEFT JOIN po_line_items li ON po.po_id = li.po_id
       WHERE po.po_id = $1
       GROUP BY po.po_id`,
      [poId]
    );

    if (pos.length === 0) {
      return res.status(404).json({ success: false, error: 'PO not found' });
    }

    res.json({ success: true, data: pos[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create PO (simplified)
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const userId = req.userId!;
    const { title, vendor_id, order_date, line_items = [] } = req.body;

    const count = await queryWithTenant<{count: string}>(
      tenantId,
      'SELECT COUNT(*) as count FROM purchase_orders WHERE tenant_id = $1',
      [tenantId]
    );
    const po_number = `PO-${String(parseInt(count[0].count) + 1).padStart(6, '0')}`;

    const pos = await queryWithTenant(
      tenantId,
      `INSERT INTO purchase_orders (
        tenant_id, po_number, title, vendor_id, order_date, status,
        owner_id, created_by, modified_by
      ) VALUES ($1, $2, $3, $4, $5, 'Draft', $6, $6, $6) RETURNING *`,
      [tenantId, po_number, title, vendor_id, order_date, userId]
    );

    res.status(201).json({ success: true, data: pos[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;

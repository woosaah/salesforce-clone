import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { queryWithTenant } from '../config/database';
import { AssetNumberGenerator } from '../utils/asset-number-generator';

const router = Router();

// All routes require authentication
router.use(authenticate);

const assetNumberGenerator = new AssetNumberGenerator();

// ============================================================================
// ASSETS ROUTES
// ============================================================================

// Get all assets
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { limit = 50, offset = 0, status, asset_type } = req.query;
    const tenantId = req.tenantId!;

    let whereClause = '';
    const params: any[] = [];

    if (status) {
      whereClause += ' AND a.status = $' + (params.length + 1);
      params.push(status);
    }

    if (asset_type) {
      whereClause += ' AND a.asset_type = $' + (params.length + 1);
      params.push(asset_type);
    }

    const assets = await queryWithTenant(
      tenantId,
      `SELECT
        a.*,
        jsonb_build_object('record_id', acc.record_id, 'data', acc.data) as account,
        jsonb_build_object('record_id', prod.record_id, 'data', prod.data) as product
      FROM assets a
      LEFT JOIN object_data acc ON a.account_id = acc.record_id
      LEFT JOIN object_data prod ON a.product_id = prod.record_id
      WHERE 1=1 ${whereClause}
      ORDER BY a.created_date DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    const countResult = await queryWithTenant(
      tenantId,
      `SELECT COUNT(*) as total FROM assets a WHERE 1=1 ${whereClause}`,
      params
    );

    res.json({
      success: true,
      data: {
        assets,
        total: parseInt(countResult[0].total),
        limit: Number(limit),
        offset: Number(offset),
      },
    });
  } catch (error: any) {
    console.error('Get assets error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch assets',
    });
  }
});

// Get single asset
router.get('/:assetId', async (req: AuthRequest, res: Response) => {
  try {
    const { assetId } = req.params;
    const tenantId = req.tenantId!;

    const assets = await queryWithTenant(
      tenantId,
      `SELECT
        a.*,
        jsonb_build_object('record_id', acc.record_id, 'data', acc.data) as account,
        jsonb_build_object('record_id', prod.record_id, 'data', prod.data) as product,
        jsonb_build_object('record_id', loc.record_id, 'data', loc.data) as location_data
      FROM assets a
      LEFT JOIN object_data acc ON a.account_id = acc.record_id
      LEFT JOIN object_data prod ON a.product_id = prod.record_id
      LEFT JOIN object_data loc ON a.location_id = loc.record_id
      WHERE a.asset_id = $1`,
      [assetId]
    );

    if (assets.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Asset not found',
      });
    }

    res.json({
      success: true,
      data: assets[0],
    });
  } catch (error: any) {
    console.error('Get asset error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch asset',
    });
  }
});

// Create asset
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const userId = req.userId!;
    const {
      asset_name,
      description,
      asset_type,
      category,
      serial_number,
      model_number,
      manufacturer,
      product_id,
      account_id,
      status = 'Available',
      condition = 'Good',
      purchase_date,
      purchase_price,
      current_value,
      salvage_value,
      depreciation_method = 'Straight Line',
      useful_life_years,
      current_location,
      building,
      floor,
      room,
      notes,
    } = req.body;

    if (!asset_name || !asset_type) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: asset_name, asset_type',
      });
    }

    // Generate asset number
    const asset_number = await assetNumberGenerator.getNextNumber(tenantId);

    const assets = await queryWithTenant(
      tenantId,
      `INSERT INTO assets (
        tenant_id, asset_number, asset_name, description,
        asset_type, category, serial_number, model_number, manufacturer,
        product_id, account_id, status, condition,
        purchase_date, purchase_price, current_value, salvage_value,
        depreciation_method, useful_life_years,
        current_location, building, floor, room, notes,
        owner_id, created_by, modified_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
        $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $25, $25
      ) RETURNING *`,
      [
        tenantId, asset_number, asset_name, description,
        asset_type, category, serial_number, model_number, manufacturer,
        product_id, account_id, status, condition,
        purchase_date, purchase_price, current_value, salvage_value,
        depreciation_method, useful_life_years,
        current_location, building, floor, room, notes, userId
      ]
    );

    res.status(201).json({
      success: true,
      data: assets[0],
    });
  } catch (error: any) {
    console.error('Create asset error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create asset',
    });
  }
});

// Update asset
router.put('/:assetId', async (req: AuthRequest, res: Response) => {
  try {
    const { assetId } = req.params;
    const tenantId = req.tenantId!;
    const userId = req.userId!;
    const updateData = req.body;

    const assets = await queryWithTenant(
      tenantId,
      `UPDATE assets SET
        asset_name = COALESCE($1, asset_name),
        description = COALESCE($2, description),
        asset_type = COALESCE($3, asset_type),
        category = COALESCE($4, category),
        serial_number = COALESCE($5, serial_number),
        status = COALESCE($6, status),
        condition = COALESCE($7, condition),
        current_location = COALESCE($8, current_location),
        notes = COALESCE($9, notes),
        modified_by = $10,
        modified_date = CURRENT_TIMESTAMP
      WHERE asset_id = $11
      RETURNING *`,
      [
        updateData.asset_name,
        updateData.description,
        updateData.asset_type,
        updateData.category,
        updateData.serial_number,
        updateData.status,
        updateData.condition,
        updateData.current_location,
        updateData.notes,
        userId,
        assetId,
      ]
    );

    res.json({
      success: true,
      data: assets[0],
    });
  } catch (error: any) {
    console.error('Update asset error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update asset',
    });
  }
});

// Delete asset
router.delete('/:assetId', async (req: AuthRequest, res: Response) => {
  try {
    const { assetId } = req.params;
    const tenantId = req.tenantId!;

    await queryWithTenant(
      tenantId,
      'DELETE FROM assets WHERE asset_id = $1',
      [assetId]
    );

    res.json({
      success: true,
      message: 'Asset deleted successfully',
    });
  } catch (error: any) {
    console.error('Delete asset error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete asset',
    });
  }
});

// ============================================================================
// MAINTENANCE RECORDS ROUTES
// ============================================================================

// Get maintenance records for an asset
router.get('/:assetId/maintenance', async (req: AuthRequest, res: Response) => {
  try {
    const { assetId } = req.params;
    const tenantId = req.tenantId!;

    const records = await queryWithTenant(
      tenantId,
      `SELECT
        mr.*,
        u.first_name, u.last_name
      FROM maintenance_records mr
      LEFT JOIN users u ON mr.performed_by_id = u.user_id
      WHERE mr.asset_id = $1
      ORDER BY mr.start_date DESC`,
      [assetId]
    );

    res.json({
      success: true,
      data: records,
    });
  } catch (error: any) {
    console.error('Get maintenance records error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch maintenance records',
    });
  }
});

// Create maintenance record
router.post('/:assetId/maintenance', async (req: AuthRequest, res: Response) => {
  try {
    const { assetId } = req.params;
    const tenantId = req.tenantId!;
    const userId = req.userId!;
    const {
      maintenance_type,
      title,
      description,
      start_date,
      completion_date,
      status = 'Scheduled',
      work_performed,
      parts_cost = 0,
      labor_cost = 0,
      other_cost = 0,
    } = req.body;

    if (!maintenance_type || !title || !start_date) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: maintenance_type, title, start_date',
      });
    }

    // Generate record number
    const countResult = await queryWithTenant<{count: string}>(
      tenantId,
      'SELECT COUNT(*) as count FROM maintenance_records WHERE tenant_id = $1',
      [tenantId]
    );
    const nextNumber = parseInt(countResult[0].count) + 1;
    const record_number = `MAINT-${String(nextNumber).padStart(6, '0')}`;

    const total_cost = (parts_cost || 0) + (labor_cost || 0) + (other_cost || 0);

    const records = await queryWithTenant(
      tenantId,
      `INSERT INTO maintenance_records (
        asset_id, tenant_id, record_number, maintenance_type, title, description,
        start_date, completion_date, status, work_performed,
        parts_cost, labor_cost, other_cost, total_cost,
        performed_by_id, created_by, modified_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $16
      ) RETURNING *`,
      [
        assetId, tenantId, record_number, maintenance_type, title, description,
        start_date, completion_date, status, work_performed,
        parts_cost, labor_cost, other_cost, total_cost,
        userId, userId
      ]
    );

    res.status(201).json({
      success: true,
      data: records[0],
    });
  } catch (error: any) {
    console.error('Create maintenance record error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create maintenance record',
    });
  }
});

// ============================================================================
// TRANSFER ROUTES
// ============================================================================

// Get transfer history for an asset
router.get('/:assetId/transfers', async (req: AuthRequest, res: Response) => {
  try {
    const { assetId } = req.params;
    const tenantId = req.tenantId!;

    const transfers = await queryWithTenant(
      tenantId,
      `SELECT
        t.*,
        from_acc.data->>'Name' as from_account_name,
        to_acc.data->>'Name' as to_account_name
      FROM asset_transfers t
      LEFT JOIN object_data from_acc ON t.from_account_id = from_acc.record_id
      LEFT JOIN object_data to_acc ON t.to_account_id = to_acc.record_id
      WHERE t.asset_id = $1
      ORDER BY t.transfer_date DESC`,
      [assetId]
    );

    res.json({
      success: true,
      data: transfers,
    });
  } catch (error: any) {
    console.error('Get transfers error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch transfers',
    });
  }
});

// Create transfer
router.post('/:assetId/transfers', async (req: AuthRequest, res: Response) => {
  try {
    const { assetId } = req.params;
    const tenantId = req.tenantId!;
    const userId = req.userId!;
    const {
      transfer_date,
      transfer_type,
      from_account_id,
      to_account_id,
      from_location,
      to_location,
      reason,
      status = 'Pending',
    } = req.body;

    if (!transfer_date || !transfer_type) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: transfer_date, transfer_type',
      });
    }

    // Generate transfer number
    const countResult = await queryWithTenant<{count: string}>(
      tenantId,
      'SELECT COUNT(*) as count FROM asset_transfers WHERE tenant_id = $1',
      [tenantId]
    );
    const nextNumber = parseInt(countResult[0].count) + 1;
    const transfer_number = `TRANS-${String(nextNumber).padStart(6, '0')}`;

    const transfers = await queryWithTenant(
      tenantId,
      `INSERT INTO asset_transfers (
        asset_id, tenant_id, transfer_number, transfer_date, transfer_type,
        from_account_id, to_account_id, from_location, to_location,
        reason, status, created_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
      ) RETURNING *`,
      [
        assetId, tenantId, transfer_number, transfer_date, transfer_type,
        from_account_id, to_account_id, from_location, to_location,
        reason, status, userId
      ]
    );

    res.status(201).json({
      success: true,
      data: transfers[0],
    });
  } catch (error: any) {
    console.error('Create transfer error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create transfer',
    });
  }
});

export default router;

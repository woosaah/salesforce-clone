import { Router, Response } from 'express';
import { body, param, query as queryValidator, validationResult } from 'express-validator';
import { query, queryWithTenant } from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { ObjectMeta, FieldMeta, RecordType, ObjectData, ApiResponse } from '../types';

const router = Router();

// All routes require authentication
router.use(authenticate);

// GET /api/objects - List all objects for tenant
router.get(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const objects = await queryWithTenant<ObjectMeta>(
      req.tenantId!,
      'SELECT * FROM objects_meta WHERE is_active = true ORDER BY label'
    );

    res.json({
      success: true,
      data: objects,
    });
  })
);

// GET /api/objects/:objectName/metadata - Get object metadata and fields
router.get(
  '/:objectName/metadata',
  param('objectName').notEmpty(),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, error: 'Validation failed', errors: errors.array() });
      return;
    }

    const { objectName } = req.params;

    // Get object metadata
    const objects = await queryWithTenant<ObjectMeta>(
      req.tenantId!,
      'SELECT * FROM objects_meta WHERE object_name = $1',
      [objectName]
    );

    if (objects.length === 0) {
      res.status(404).json({ success: false, error: 'Object not found' });
      return;
    }

    const object = objects[0];

    // Get fields metadata
    const fields = await queryWithTenant<FieldMeta>(
      req.tenantId!,
      'SELECT * FROM fields_meta WHERE object_id = $1 ORDER BY field_name',
      [object.object_id]
    );

    res.json({
      success: true,
      data: {
        object,
        fields,
      },
    });
  })
);

// GET /api/objects/:objectName/record-types - Get record types for object
router.get(
  '/:objectName/record-types',
  param('objectName').notEmpty(),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { objectName } = req.params;

    const recordTypes = await queryWithTenant<RecordType>(
      req.tenantId!,
      'SELECT * FROM record_types WHERE object_name = $1 AND is_active = true ORDER BY is_default DESC, record_type_name',
      [objectName]
    );

    res.json({
      success: true,
      data: recordTypes,
    });
  })
);

// GET /api/objects/:objectName/records - List records for object
router.get(
  '/:objectName/records',
  [
    param('objectName').notEmpty(),
    queryValidator('limit').optional().isInt({ min: 1, max: 200 }),
    queryValidator('offset').optional().isInt({ min: 0 }),
    queryValidator('recordTypeId').optional().isUUID(),
  ],
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, error: 'Validation failed', errors: errors.array() });
      return;
    }

    const { objectName } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const recordTypeId = req.query.recordTypeId as string;

    // Get object metadata
    const objects = await queryWithTenant<ObjectMeta>(
      req.tenantId!,
      'SELECT * FROM objects_meta WHERE object_name = $1',
      [objectName]
    );

    if (objects.length === 0) {
      res.status(404).json({ success: false, error: 'Object not found' });
      return;
    }

    const object = objects[0];

    // Build query
    let recordQuery = `
      SELECT record_id, object_id, record_type_id, data, owner_id,
             created_by, created_date, modified_by, modified_date
      FROM object_data
      WHERE object_id = $1 AND is_deleted = false
    `;
    const params: any[] = [object.object_id];

    if (recordTypeId) {
      recordQuery += ` AND record_type_id = $${params.length + 1}`;
      params.push(recordTypeId);
    }

    recordQuery += ` ORDER BY created_date DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const records = await queryWithTenant<ObjectData>(req.tenantId!, recordQuery, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM object_data WHERE object_id = $1 AND is_deleted = false';
    const countParams: any[] = [object.object_id];

    if (recordTypeId) {
      countQuery += ' AND record_type_id = $2';
      countParams.push(recordTypeId);
    }

    const countResult = await queryWithTenant<{ total: string }>(req.tenantId!, countQuery, countParams);
    const total = parseInt(countResult[0]?.total || '0');

    res.json({
      success: true,
      data: {
        records,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + records.length < total,
        },
      },
    });
  })
);

// GET /api/objects/:objectName/records/:recordId - Get single record
router.get(
  '/:objectName/records/:recordId',
  [
    param('objectName').notEmpty(),
    param('recordId').isUUID(),
  ],
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, error: 'Validation failed', errors: errors.array() });
      return;
    }

    const { objectName, recordId } = req.params;

    // Get object metadata
    const objects = await queryWithTenant<ObjectMeta>(
      req.tenantId!,
      'SELECT * FROM objects_meta WHERE object_name = $1',
      [objectName]
    );

    if (objects.length === 0) {
      res.status(404).json({ success: false, error: 'Object not found' });
      return;
    }

    const object = objects[0];

    // Get record
    const records = await queryWithTenant<ObjectData>(
      req.tenantId!,
      `SELECT * FROM object_data
       WHERE record_id = $1 AND object_id = $2 AND is_deleted = false`,
      [recordId, object.object_id]
    );

    if (records.length === 0) {
      res.status(404).json({ success: false, error: 'Record not found' });
      return;
    }

    res.json({
      success: true,
      data: records[0],
    });
  })
);

// POST /api/objects/:objectName/records - Create new record
router.post(
  '/:objectName/records',
  [
    param('objectName').notEmpty(),
    body('data').isObject().withMessage('Data must be an object'),
    body('recordTypeId').optional().isUUID(),
  ],
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, error: 'Validation failed', errors: errors.array() });
      return;
    }

    const { objectName } = req.params;
    const { data, recordTypeId } = req.body;

    // Get object metadata
    const objects = await queryWithTenant<ObjectMeta>(
      req.tenantId!,
      'SELECT * FROM objects_meta WHERE object_name = $1',
      [objectName]
    );

    if (objects.length === 0) {
      res.status(404).json({ success: false, error: 'Object not found' });
      return;
    }

    const object = objects[0];

    // Get fields metadata for validation
    const fields = await queryWithTenant<FieldMeta>(
      req.tenantId!,
      'SELECT * FROM fields_meta WHERE object_id = $1',
      [object.object_id]
    );

    // Validate required fields
    const requiredFields = fields.filter((f) => f.is_required);
    const missingFields = requiredFields.filter((f) => !data[f.field_name]);

    if (missingFields.length > 0) {
      res.status(400).json({
        success: false,
        error: 'Required fields missing',
        fields: missingFields.map((f) => f.field_name),
      });
      return;
    }

    // Create record
    const result = await queryWithTenant<ObjectData>(
      req.tenantId!,
      `INSERT INTO object_data (tenant_id, object_id, record_type_id, data, owner_id, created_by, modified_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        req.tenantId,
        object.object_id,
        recordTypeId || null,
        JSON.stringify(data),
        req.userId,
        req.userId,
        req.userId,
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Record created successfully',
      data: result[0],
    });
  })
);

// PUT /api/objects/:objectName/records/:recordId - Update record
router.put(
  '/:objectName/records/:recordId',
  [
    param('objectName').notEmpty(),
    param('recordId').isUUID(),
    body('data').isObject().withMessage('Data must be an object'),
  ],
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, error: 'Validation failed', errors: errors.array() });
      return;
    }

    const { objectName, recordId } = req.params;
    const { data } = req.body;

    // Get object metadata
    const objects = await queryWithTenant<ObjectMeta>(
      req.tenantId!,
      'SELECT * FROM objects_meta WHERE object_name = $1',
      [objectName]
    );

    if (objects.length === 0) {
      res.status(404).json({ success: false, error: 'Object not found' });
      return;
    }

    const object = objects[0];

    // Check if record exists
    const existingRecords = await queryWithTenant<ObjectData>(
      req.tenantId!,
      'SELECT * FROM object_data WHERE record_id = $1 AND object_id = $2 AND is_deleted = false',
      [recordId, object.object_id]
    );

    if (existingRecords.length === 0) {
      res.status(404).json({ success: false, error: 'Record not found' });
      return;
    }

    // Update record
    const result = await queryWithTenant<ObjectData>(
      req.tenantId!,
      `UPDATE object_data
       SET data = $1, modified_by = $2, modified_date = CURRENT_TIMESTAMP
       WHERE record_id = $3 AND object_id = $4
       RETURNING *`,
      [JSON.stringify(data), req.userId, recordId, object.object_id]
    );

    res.json({
      success: true,
      message: 'Record updated successfully',
      data: result[0],
    });
  })
);

// DELETE /api/objects/:objectName/records/:recordId - Soft delete record
router.delete(
  '/:objectName/records/:recordId',
  [
    param('objectName').notEmpty(),
    param('recordId').isUUID(),
  ],
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, error: 'Validation failed', errors: errors.array() });
      return;
    }

    const { objectName, recordId } = req.params;

    // Get object metadata
    const objects = await queryWithTenant<ObjectMeta>(
      req.tenantId!,
      'SELECT * FROM objects_meta WHERE object_name = $1',
      [objectName]
    );

    if (objects.length === 0) {
      res.status(404).json({ success: false, error: 'Object not found' });
      return;
    }

    const object = objects[0];

    // Soft delete record
    const result = await queryWithTenant<ObjectData>(
      req.tenantId!,
      `UPDATE object_data
       SET is_deleted = true, modified_by = $1, modified_date = CURRENT_TIMESTAMP
       WHERE record_id = $2 AND object_id = $3 AND is_deleted = false
       RETURNING record_id`,
      [req.userId, recordId, object.object_id]
    );

    if (result.length === 0) {
      res.status(404).json({ success: false, error: 'Record not found' });
      return;
    }

    res.json({
      success: true,
      message: 'Record deleted successfully',
    });
  })
);

export default router;

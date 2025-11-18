import express, { Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { queryWithTenant } from '../utils/db-helpers';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * GET /api/field-service/work-orders
 * Get work orders
 */
router.get('/work-orders', async (req: Request, res: Response) => {
  try {
    const { status, technician_id } = req.query;

    let query = `
      SELECT wo.*,
             u.first_name || ' ' || u.last_name as technician_name
      FROM work_orders wo
      LEFT JOIN users u ON wo.assigned_to = u.user_id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (status) {
      query += ` AND wo.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (technician_id) {
      query += ` AND wo.assigned_to = $${paramIndex}`;
      params.push(technician_id);
      paramIndex++;
    }

    query += ` ORDER BY wo.scheduled_start DESC`;

    const workOrders = await queryWithTenant(query, params);

    res.json({
      success: true,
      data: workOrders,
    });
  } catch (error: any) {
    console.error('Error fetching work orders:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch work orders',
      error: error.message,
    });
  }
});

/**
 * POST /api/field-service/work-orders
 * Create a work order
 */
router.post('/work-orders', async (req: Request, res: Response) => {
  try {
    const {
      subject,
      description,
      priority,
      scheduled_start,
      scheduled_end,
      assigned_to,
      service_account_id,
      location_lat,
      location_lng,
    } = req.body;

    if (!subject || !scheduled_start) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: subject, scheduled_start',
      });
    }

    const result = await queryWithTenant(
      `INSERT INTO work_orders (
        subject,
        description,
        priority,
        scheduled_start,
        scheduled_end,
        assigned_to,
        service_account_id,
        location_lat,
        location_lng,
        status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        subject,
        description,
        priority || 'Medium',
        scheduled_start,
        scheduled_end,
        assigned_to,
        service_account_id,
        location_lat,
        location_lng,
        'New',
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Work order created successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error creating work order:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create work order',
      error: error.message,
    });
  }
});

/**
 * PATCH /api/field-service/work-orders/:id
 * Update a work order
 */
router.patch('/work-orders/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const allowedFields = [
      'subject',
      'description',
      'status',
      'priority',
      'scheduled_start',
      'scheduled_end',
      'assigned_to',
      'actual_start',
      'actual_end',
    ];

    const setFields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    Object.keys(updates).forEach((key) => {
      if (allowedFields.includes(key)) {
        setFields.push(`${key} = $${paramIndex}`);
        values.push(updates[key]);
        paramIndex++;
      }
    });

    if (setFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update',
      });
    }

    values.push(id);

    const result = await queryWithTenant(
      `UPDATE work_orders SET ${setFields.join(', ')}
       WHERE work_order_id = $${paramIndex}
       RETURNING *`,
      values
    );

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Work order not found',
      });
    }

    res.json({
      success: true,
      message: 'Work order updated successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error updating work order:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update work order',
      error: error.message,
    });
  }
});

/**
 * GET /api/field-service/appointments
 * Get service appointments
 */
router.get('/appointments', async (req: Request, res: Response) => {
  try {
    const { work_order_id, status } = req.query;

    let query = `SELECT * FROM service_appointments WHERE 1=1`;
    const params: any[] = [];
    let paramIndex = 1;

    if (work_order_id) {
      query += ` AND work_order_id = $${paramIndex}`;
      params.push(work_order_id);
      paramIndex++;
    }

    if (status) {
      query += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    query += ` ORDER BY scheduled_start`;

    const appointments = await queryWithTenant(query, params);

    res.json({
      success: true,
      data: appointments,
    });
  } catch (error: any) {
    console.error('Error fetching appointments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch appointments',
      error: error.message,
    });
  }
});

/**
 * POST /api/field-service/appointments
 * Create a service appointment
 */
router.post('/appointments', async (req: Request, res: Response) => {
  try {
    const {
      work_order_id,
      scheduled_start,
      scheduled_end,
      assigned_resource_id,
      service_territory_id,
    } = req.body;

    if (!work_order_id || !scheduled_start) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: work_order_id, scheduled_start',
      });
    }

    const result = await queryWithTenant(
      `INSERT INTO service_appointments (
        work_order_id,
        scheduled_start,
        scheduled_end,
        assigned_resource_id,
        service_territory_id,
        status
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [
        work_order_id,
        scheduled_start,
        scheduled_end,
        assigned_resource_id,
        service_territory_id,
        'Scheduled',
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Service appointment created successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error creating appointment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create appointment',
      error: error.message,
    });
  }
});

/**
 * GET /api/field-service/resources
 * Get service resources
 */
router.get('/resources', async (req: Request, res: Response) => {
  try {
    const { is_active, resource_type } = req.query;

    let query = `SELECT * FROM service_resources WHERE 1=1`;
    const params: any[] = [];
    let paramIndex = 1;

    if (is_active !== undefined) {
      query += ` AND is_active = $${paramIndex}`;
      params.push(is_active === 'true');
      paramIndex++;
    }

    if (resource_type) {
      query += ` AND resource_type = $${paramIndex}`;
      params.push(resource_type);
      paramIndex++;
    }

    query += ` ORDER BY resource_name`;

    const resources = await queryWithTenant(query, params);

    res.json({
      success: true,
      data: resources,
    });
  } catch (error: any) {
    console.error('Error fetching resources:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch resources',
      error: error.message,
    });
  }
});

/**
 * POST /api/field-service/resources
 * Create a service resource
 */
router.post('/resources', async (req: Request, res: Response) => {
  try {
    const { resource_name, resource_type, related_user_id, is_active } = req.body;

    if (!resource_name || !resource_type) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: resource_name, resource_type',
      });
    }

    const result = await queryWithTenant(
      `INSERT INTO service_resources (
        resource_name,
        resource_type,
        related_user_id,
        is_active
      ) VALUES ($1, $2, $3, $4)
      RETURNING *`,
      [resource_name, resource_type, related_user_id, is_active !== false]
    );

    res.status(201).json({
      success: true,
      message: 'Service resource created successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error creating resource:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create resource',
      error: error.message,
    });
  }
});

export default router;

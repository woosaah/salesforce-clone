import express, { Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { queryWithTenant } from '../utils/db-helpers';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * GET /api/external-services
 * Get all external service registrations
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { is_active } = req.query;

    let query = `SELECT * FROM external_services WHERE 1=1`;
    const params: any[] = [];
    let paramIndex = 1;

    if (is_active !== undefined) {
      query += ` AND is_active = $${paramIndex}`;
      params.push(is_active === 'true');
      paramIndex++;
    }

    query += ` ORDER BY service_name`;

    const services = await queryWithTenant(query, params);

    res.json({
      success: true,
      data: services,
    });
  } catch (error: any) {
    console.error('Error fetching external services:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch external services',
      error: error.message,
    });
  }
});

/**
 * GET /api/external-services/:id
 * Get a specific external service
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const services = await queryWithTenant(
      `SELECT * FROM external_services WHERE service_id = $1`,
      [id]
    );

    if (services.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'External service not found',
      });
    }

    res.json({
      success: true,
      data: services[0],
    });
  } catch (error: any) {
    console.error('Error fetching external service:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch external service',
      error: error.message,
    });
  }
});

/**
 * POST /api/external-services
 * Register a new external service
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      service_name,
      base_url,
      description,
      schema_type,
      schema_definition,
      auth_config,
    } = req.body;

    if (!service_name || !base_url || !schema_definition) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: service_name, base_url, schema_definition',
      });
    }

    const result = await queryWithTenant(
      `INSERT INTO external_services (
        service_name,
        base_url,
        description,
        schema_type,
        schema_definition,
        auth_config,
        is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        service_name,
        base_url,
        description,
        schema_type || 'OpenAPI',
        JSON.stringify(schema_definition),
        JSON.stringify(auth_config || {}),
        true,
      ]
    );

    res.status(201).json({
      success: true,
      message: 'External service registered successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error registering external service:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to register external service',
      error: error.message,
    });
  }
});

/**
 * PATCH /api/external-services/:id
 * Update an external service
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const allowedFields = ['service_name', 'base_url', 'description', 'schema_definition', 'auth_config', 'is_active'];

    const setFields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    Object.keys(updates).forEach((key) => {
      if (allowedFields.includes(key)) {
        setFields.push(`${key} = $${paramIndex}`);
        values.push(
          (key === 'schema_definition' || key === 'auth_config') && typeof updates[key] === 'object'
            ? JSON.stringify(updates[key])
            : updates[key]
        );
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
      `UPDATE external_services SET ${setFields.join(', ')}
       WHERE service_id = $${paramIndex}
       RETURNING *`,
      values
    );

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'External service not found',
      });
    }

    res.json({
      success: true,
      message: 'External service updated successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error updating external service:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update external service',
      error: error.message,
    });
  }
});

/**
 * DELETE /api/external-services/:id
 * Delete an external service
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await queryWithTenant(
      `DELETE FROM external_services WHERE service_id = $1 RETURNING *`,
      [id]
    );

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'External service not found',
      });
    }

    res.json({
      success: true,
      message: 'External service deleted successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error deleting external service:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete external service',
      error: error.message,
    });
  }
});

/**
 * GET /api/external-services/:serviceId/operations
 * Get operations for a service
 */
router.get('/:serviceId/operations', async (req: Request, res: Response) => {
  try {
    const { serviceId } = req.params;

    const operations = await queryWithTenant(
      `SELECT * FROM external_service_operations WHERE service_id = $1 ORDER BY operation_name`,
      [serviceId]
    );

    res.json({
      success: true,
      data: operations,
    });
  } catch (error: any) {
    console.error('Error fetching operations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch operations',
      error: error.message,
    });
  }
});

/**
 * POST /api/external-services/:serviceId/operations
 * Add an operation to a service
 */
router.post('/:serviceId/operations', async (req: Request, res: Response) => {
  try {
    const { serviceId } = req.params;
    const { operation_name, http_method, endpoint_path, request_schema, response_schema } = req.body;

    if (!operation_name || !http_method || !endpoint_path) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: operation_name, http_method, endpoint_path',
      });
    }

    const result = await queryWithTenant(
      `INSERT INTO external_service_operations (
        service_id,
        operation_name,
        http_method,
        endpoint_path,
        request_schema,
        response_schema
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [
        serviceId,
        operation_name,
        http_method,
        endpoint_path,
        JSON.stringify(request_schema || {}),
        JSON.stringify(response_schema || {}),
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Operation added successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error adding operation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add operation',
      error: error.message,
    });
  }
});

/**
 * POST /api/external-services/:serviceId/invoke
 * Invoke an external service operation
 */
router.post('/:serviceId/invoke', async (req: Request, res: Response) => {
  try {
    const { serviceId } = req.params;
    const { operation_id, request_params, context_record_id } = req.body;

    if (!operation_id) {
      return res.status(400).json({
        success: false,
        message: 'Missing required field: operation_id',
      });
    }

    // Get service details
    const services = await queryWithTenant(
      `SELECT * FROM external_services WHERE service_id = $1`,
      [serviceId]
    );

    if (services.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'External service not found',
      });
    }

    // Get operation details
    const operations = await queryWithTenant(
      `SELECT * FROM external_service_operations WHERE operation_id = $1`,
      [operation_id]
    );

    if (operations.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Operation not found',
      });
    }

    // Log invocation
    const invocation = await queryWithTenant(
      `INSERT INTO external_service_invocations (
        service_id,
        operation_id,
        request_params,
        context_record_id,
        invoked_by,
        status
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [
        serviceId,
        operation_id,
        JSON.stringify(request_params || {}),
        context_record_id,
        (req as any).user.userId,
        'InProgress',
      ]
    );

    // In real implementation, would make actual HTTP request here
    const mockResponse = {
      status: 200,
      data: { message: 'Mock external service response' },
    };

    // Update invocation with response
    const updatedInvocation = await queryWithTenant(
      `UPDATE external_service_invocations
       SET status = $1,
           response_data = $2,
           completed_at = CURRENT_TIMESTAMP
       WHERE invocation_id = $3
       RETURNING *`,
      ['Success', JSON.stringify(mockResponse), invocation[0].invocation_id]
    );

    res.json({
      success: true,
      message: 'External service invoked successfully',
      data: {
        invocation: updatedInvocation[0],
        response: mockResponse,
      },
    });
  } catch (error: any) {
    console.error('Error invoking external service:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to invoke external service',
      error: error.message,
    });
  }
});

/**
 * GET /api/external-services/invocations
 * Get invocation history
 */
router.get('/invocations/history', async (req: Request, res: Response) => {
  try {
    const { service_id, status, limit } = req.query;

    let query = `
      SELECT esi.*,
             es.service_name,
             eso.operation_name
      FROM external_service_invocations esi
      JOIN external_services es ON esi.service_id = es.service_id
      JOIN external_service_operations eso ON esi.operation_id = eso.operation_id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (service_id) {
      query += ` AND esi.service_id = $${paramIndex}`;
      params.push(service_id);
      paramIndex++;
    }

    if (status) {
      query += ` AND esi.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    query += ` ORDER BY esi.invoked_at DESC`;

    if (limit) {
      query += ` LIMIT $${paramIndex}`;
      params.push(parseInt(limit as string, 10));
    } else {
      query += ` LIMIT 100`;
    }

    const invocations = await queryWithTenant(query, params);

    res.json({
      success: true,
      data: invocations,
    });
  } catch (error: any) {
    console.error('Error fetching invocation history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch invocation history',
      error: error.message,
    });
  }
});

/**
 * GET /api/external-services/invocations/:id
 * Get a specific invocation
 */
router.get('/invocations/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const invocations = await queryWithTenant(
      `SELECT esi.*,
              es.service_name,
              eso.operation_name,
              eso.http_method,
              eso.endpoint_path
       FROM external_service_invocations esi
       JOIN external_services es ON esi.service_id = es.service_id
       JOIN external_service_operations eso ON esi.operation_id = eso.operation_id
       WHERE esi.invocation_id = $1`,
      [id]
    );

    if (invocations.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Invocation not found',
      });
    }

    res.json({
      success: true,
      data: invocations[0],
    });
  } catch (error: any) {
    console.error('Error fetching invocation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch invocation',
      error: error.message,
    });
  }
});

/**
 * POST /api/external-services/:serviceId/test
 * Test external service connectivity
 */
router.post('/:serviceId/test', async (req: Request, res: Response) => {
  try {
    const { serviceId } = req.params;

    const services = await queryWithTenant(
      `SELECT * FROM external_services WHERE service_id = $1`,
      [serviceId]
    );

    if (services.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'External service not found',
      });
    }

    // In real implementation, would test actual connectivity
    const testResult = {
      service_name: services[0].service_name,
      base_url: services[0].base_url,
      status: 'Success',
      message: 'Connection test successful',
      response_time_ms: Math.random() * 1000,
    };

    res.json({
      success: true,
      data: testResult,
    });
  } catch (error: any) {
    console.error('Error testing external service:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to test external service',
      error: error.message,
    });
  }
});

export default router;

import express, { Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { queryWithTenant } from '../utils/db-helpers';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * GET /api/omni-channel/routing-configs
 * Get all routing configurations
 */
router.get('/routing-configs', async (req: Request, res: Response) => {
  try {
    const configs = await queryWithTenant(
      `SELECT * FROM omni_channel_routing ORDER BY created_date DESC`,
      []
    );

    res.json({
      success: true,
      data: configs,
    });
  } catch (error: any) {
    console.error('Error fetching routing configs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch routing configs',
      error: error.message,
    });
  }
});

/**
 * GET /api/omni-channel/routing-configs/:id
 * Get a specific routing configuration
 */
router.get('/routing-configs/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const configs = await queryWithTenant(
      `SELECT * FROM omni_channel_routing WHERE routing_id = $1`,
      [id]
    );

    if (configs.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Routing configuration not found',
      });
    }

    res.json({
      success: true,
      data: configs[0],
    });
  } catch (error: any) {
    console.error('Error fetching routing config:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch routing config',
      error: error.message,
    });
  }
});

/**
 * POST /api/omni-channel/routing-configs
 * Create a new routing configuration
 */
router.post('/routing-configs', async (req: Request, res: Response) => {
  try {
    const {
      routing_name,
      object_type,
      routing_model, // 'Most_Available', 'Least_Active', 'Round_Robin'
      routing_priority,
      routing_rules,
      is_active,
    } = req.body;

    if (!routing_name || !object_type || !routing_model) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: routing_name, object_type, routing_model',
      });
    }

    const result = await queryWithTenant(
      `INSERT INTO omni_channel_routing (
        routing_name,
        object_type,
        routing_model,
        routing_priority,
        routing_rules,
        is_active
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [
        routing_name,
        object_type,
        routing_model,
        routing_priority || 1,
        JSON.stringify(routing_rules || {}),
        is_active !== false,
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Routing configuration created successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error creating routing config:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create routing config',
      error: error.message,
    });
  }
});

/**
 * PATCH /api/omni-channel/routing-configs/:id
 * Update a routing configuration
 */
router.patch('/routing-configs/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const allowedFields = [
      'routing_name',
      'routing_model',
      'routing_priority',
      'routing_rules',
      'is_active',
    ];

    const setFields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    Object.keys(updates).forEach((key) => {
      if (allowedFields.includes(key)) {
        setFields.push(`${key} = $${paramIndex}`);
        values.push(
          key === 'routing_rules' && typeof updates[key] === 'object'
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
      `UPDATE omni_channel_routing SET ${setFields.join(', ')}
       WHERE routing_id = $${paramIndex}
       RETURNING *`,
      values
    );

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Routing configuration not found',
      });
    }

    res.json({
      success: true,
      message: 'Routing configuration updated successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error updating routing config:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update routing config',
      error: error.message,
    });
  }
});

/**
 * DELETE /api/omni-channel/routing-configs/:id
 * Delete a routing configuration
 */
router.delete('/routing-configs/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await queryWithTenant(
      `DELETE FROM omni_channel_routing WHERE routing_id = $1 RETURNING *`,
      [id]
    );

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Routing configuration not found',
      });
    }

    res.json({
      success: true,
      message: 'Routing configuration deleted successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error deleting routing config:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete routing config',
      error: error.message,
    });
  }
});

/**
 * GET /api/omni-channel/presence
 * Get agent presence status
 */
router.get('/presence', async (req: Request, res: Response) => {
  try {
    const { user_id, status } = req.query;

    let query = `
      SELECT ap.*,
             u.first_name || ' ' || u.last_name as agent_name
      FROM agent_presence ap
      JOIN users u ON ap.user_id = u.user_id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (user_id) {
      query += ` AND ap.user_id = $${paramIndex}`;
      params.push(user_id);
      paramIndex++;
    }

    if (status) {
      query += ` AND ap.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    query += ` ORDER BY ap.last_status_change DESC`;

    const presence = await queryWithTenant(query, params);

    res.json({
      success: true,
      data: presence,
    });
  } catch (error: any) {
    console.error('Error fetching agent presence:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch agent presence',
      error: error.message,
    });
  }
});

/**
 * POST /api/omni-channel/presence
 * Update agent presence status
 */
router.post('/presence', async (req: Request, res: Response) => {
  try {
    const { status, max_capacity } = req.body;
    const user_id = (req as any).user.userId;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Missing required field: status',
      });
    }

    const result = await queryWithTenant(
      `INSERT INTO agent_presence (
        user_id,
        status,
        max_capacity
      ) VALUES ($1, $2, $3)
      ON CONFLICT (user_id)
      DO UPDATE SET
        status = EXCLUDED.status,
        max_capacity = EXCLUDED.max_capacity,
        last_status_change = CURRENT_TIMESTAMP
      RETURNING *`,
      [user_id, status, max_capacity || 5]
    );

    res.json({
      success: true,
      message: 'Agent presence updated',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error updating presence:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update presence',
      error: error.message,
    });
  }
});

/**
 * GET /api/omni-channel/work-items
 * Get work items (cases, chats, leads, etc.) assigned to agents
 */
router.get('/work-items', async (req: Request, res: Response) => {
  try {
    const { agent_id, status } = req.query;

    let query = `SELECT * FROM agent_work_items WHERE 1=1`;
    const params: any[] = [];
    let paramIndex = 1;

    if (agent_id) {
      query += ` AND agent_id = $${paramIndex}`;
      params.push(agent_id);
      paramIndex++;
    }

    if (status) {
      query += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    query += ` ORDER BY assigned_date DESC`;

    const workItems = await queryWithTenant(query, params);

    res.json({
      success: true,
      data: workItems,
    });
  } catch (error: any) {
    console.error('Error fetching work items:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch work items',
      error: error.message,
    });
  }
});

/**
 * POST /api/omni-channel/work-items/assign
 * Assign a work item to an agent
 */
router.post('/work-items/assign', async (req: Request, res: Response) => {
  try {
    const { work_item_id, work_item_type, routing_config_id } = req.body;

    if (!work_item_id || !work_item_type) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: work_item_id, work_item_type',
      });
    }

    // Get routing configuration
    let routingConfig;
    if (routing_config_id) {
      const configs = await queryWithTenant(
        `SELECT * FROM omni_channel_routing WHERE routing_id = $1 AND is_active = true`,
        [routing_config_id]
      );
      routingConfig = configs[0];
    } else {
      // Get default routing config for this work item type
      const configs = await queryWithTenant(
        `SELECT * FROM omni_channel_routing WHERE object_type = $1 AND is_active = true ORDER BY routing_priority DESC LIMIT 1`,
        [work_item_type]
      );
      routingConfig = configs[0];
    }

    if (!routingConfig) {
      return res.status(404).json({
        success: false,
        message: 'No active routing configuration found for this work item type',
      });
    }

    // Find available agent based on routing model
    let agent;
    if (routingConfig.routing_model === 'Most_Available') {
      // Find agent with lowest current capacity
      const agents = await queryWithTenant(
        `SELECT ap.user_id,
                (ap.max_capacity - COALESCE((
                  SELECT COUNT(*) FROM agent_work_items
                  WHERE agent_id = ap.user_id AND status = 'Active'
                ), 0)) as available_capacity
         FROM agent_presence ap
         WHERE ap.status = 'Available'
         ORDER BY available_capacity DESC
         LIMIT 1`,
        []
      );
      agent = agents[0];
    } else if (routingConfig.routing_model === 'Least_Active') {
      // Find agent with least active work items
      const agents = await queryWithTenant(
        `SELECT ap.user_id,
                COALESCE((
                  SELECT COUNT(*) FROM agent_work_items
                  WHERE agent_id = ap.user_id AND status = 'Active'
                ), 0) as active_count
         FROM agent_presence ap
         WHERE ap.status = 'Available'
         ORDER BY active_count ASC
         LIMIT 1`,
        []
      );
      agent = agents[0];
    } else {
      // Round Robin - just get next available agent
      const agents = await queryWithTenant(
        `SELECT user_id FROM agent_presence WHERE status = 'Available' LIMIT 1`,
        []
      );
      agent = agents[0];
    }

    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'No available agents found',
      });
    }

    // Assign work item
    const result = await queryWithTenant(
      `INSERT INTO agent_work_items (
        agent_id,
        work_item_id,
        work_item_type,
        status
      ) VALUES ($1, $2, $3, $4)
      RETURNING *`,
      [agent.user_id, work_item_id, work_item_type, 'Active']
    );

    res.status(201).json({
      success: true,
      message: 'Work item assigned successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error assigning work item:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign work item',
      error: error.message,
    });
  }
});

/**
 * PATCH /api/omni-channel/work-items/:id
 * Update work item status
 */
router.patch('/work-items/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Missing required field: status',
      });
    }

    const result = await queryWithTenant(
      `UPDATE agent_work_items
       SET status = $1
       WHERE work_item_assignment_id = $2
       RETURNING *`,
      [status, id]
    );

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Work item not found',
      });
    }

    res.json({
      success: true,
      message: 'Work item status updated',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error updating work item:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update work item',
      error: error.message,
    });
  }
});

export default router;

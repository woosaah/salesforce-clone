import express, { Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { queryWithTenant } from '../utils/db-helpers';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * GET /api/flows
 * Get all flows
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { flow_type, is_active } = req.query;

    let query = `SELECT * FROM flows WHERE 1=1`;
    const params: any[] = [];
    let paramIndex = 1;

    if (flow_type) {
      query += ` AND flow_type = $${paramIndex}`;
      params.push(flow_type);
      paramIndex++;
    }

    if (is_active !== undefined) {
      query += ` AND is_active = $${paramIndex}`;
      params.push(is_active === 'true');
      paramIndex++;
    }

    query += ` ORDER BY flow_name`;

    const flows = await queryWithTenant(query, params);

    res.json({
      success: true,
      data: flows,
    });
  } catch (error: any) {
    console.error('Error fetching flows:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch flows',
      error: error.message,
    });
  }
});

/**
 * GET /api/flows/:id
 * Get a specific flow
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const flows = await queryWithTenant(
      `SELECT * FROM flows WHERE flow_id = $1`,
      [id]
    );

    if (flows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Flow not found',
      });
    }

    res.json({
      success: true,
      data: flows[0],
    });
  } catch (error: any) {
    console.error('Error fetching flow:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch flow',
      error: error.message,
    });
  }
});

/**
 * POST /api/flows
 * Create a flow
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { flow_name, flow_type, description, trigger_type, start_element_id } = req.body;

    if (!flow_name || !flow_type) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: flow_name, flow_type',
      });
    }

    const result = await queryWithTenant(
      `INSERT INTO flows (
        flow_name,
        flow_type,
        description,
        trigger_type,
        start_element_id,
        is_active
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [flow_name, flow_type, description, trigger_type, start_element_id, false]
    );

    res.status(201).json({
      success: true,
      message: 'Flow created successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error creating flow:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create flow',
      error: error.message,
    });
  }
});

/**
 * PATCH /api/flows/:id
 * Update a flow
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const allowedFields = ['flow_name', 'description', 'trigger_type', 'start_element_id', 'is_active'];

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
      `UPDATE flows SET ${setFields.join(', ')}
       WHERE flow_id = $${paramIndex}
       RETURNING *`,
      values
    );

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Flow not found',
      });
    }

    res.json({
      success: true,
      message: 'Flow updated successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error updating flow:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update flow',
      error: error.message,
    });
  }
});

/**
 * DELETE /api/flows/:id
 * Delete a flow
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await queryWithTenant(
      `DELETE FROM flows WHERE flow_id = $1 RETURNING *`,
      [id]
    );

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Flow not found',
      });
    }

    res.json({
      success: true,
      message: 'Flow deleted successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error deleting flow:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete flow',
      error: error.message,
    });
  }
});

/**
 * GET /api/flows/:flowId/elements
 * Get flow elements
 */
router.get('/:flowId/elements', async (req: Request, res: Response) => {
  try {
    const { flowId } = req.params;

    const elements = await queryWithTenant(
      `SELECT * FROM flow_elements WHERE flow_id = $1 ORDER BY position_x, position_y`,
      [flowId]
    );

    res.json({
      success: true,
      data: elements,
    });
  } catch (error: any) {
    console.error('Error fetching flow elements:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch flow elements',
      error: error.message,
    });
  }
});

/**
 * POST /api/flows/:flowId/elements
 * Add an element to a flow
 */
router.post('/:flowId/elements', async (req: Request, res: Response) => {
  try {
    const { flowId } = req.params;
    const { element_type, element_name, config, position_x, position_y } = req.body;

    if (!element_type || !element_name) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: element_type, element_name',
      });
    }

    const result = await queryWithTenant(
      `INSERT INTO flow_elements (
        flow_id,
        element_type,
        element_name,
        config,
        position_x,
        position_y
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [flowId, element_type, element_name, JSON.stringify(config || {}), position_x || 0, position_y || 0]
    );

    res.status(201).json({
      success: true,
      message: 'Flow element added successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error adding flow element:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add flow element',
      error: error.message,
    });
  }
});

/**
 * PATCH /api/flows/:flowId/elements/:elementId
 * Update a flow element
 */
router.patch('/:flowId/elements/:elementId', async (req: Request, res: Response) => {
  try {
    const { elementId } = req.params;
    const updates = req.body;

    const allowedFields = ['element_name', 'config', 'position_x', 'position_y'];

    const setFields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    Object.keys(updates).forEach((key) => {
      if (allowedFields.includes(key)) {
        setFields.push(`${key} = $${paramIndex}`);
        values.push(
          key === 'config' && typeof updates[key] === 'object'
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

    values.push(elementId);

    const result = await queryWithTenant(
      `UPDATE flow_elements SET ${setFields.join(', ')}
       WHERE element_id = $${paramIndex}
       RETURNING *`,
      values
    );

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Flow element not found',
      });
    }

    res.json({
      success: true,
      message: 'Flow element updated successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error updating flow element:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update flow element',
      error: error.message,
    });
  }
});

/**
 * DELETE /api/flows/:flowId/elements/:elementId
 * Remove a flow element
 */
router.delete('/:flowId/elements/:elementId', async (req: Request, res: Response) => {
  try {
    const { elementId } = req.params;

    const result = await queryWithTenant(
      `DELETE FROM flow_elements WHERE element_id = $1 RETURNING *`,
      [elementId]
    );

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Flow element not found',
      });
    }

    res.json({
      success: true,
      message: 'Flow element removed successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error removing flow element:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove flow element',
      error: error.message,
    });
  }
});

/**
 * GET /api/flows/:flowId/versions
 * Get flow versions
 */
router.get('/:flowId/versions', async (req: Request, res: Response) => {
  try {
    const { flowId } = req.params;

    const versions = await queryWithTenant(
      `SELECT * FROM flow_versions WHERE flow_id = $1 ORDER BY version_number DESC`,
      [flowId]
    );

    res.json({
      success: true,
      data: versions,
    });
  } catch (error: any) {
    console.error('Error fetching flow versions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch flow versions',
      error: error.message,
    });
  }
});

/**
 * POST /api/flows/:flowId/versions
 * Create a new flow version
 */
router.post('/:flowId/versions', async (req: Request, res: Response) => {
  try {
    const { flowId } = req.params;
    const { description } = req.body;

    // Get the latest version number
    const latestVersions = await queryWithTenant(
      `SELECT COALESCE(MAX(version_number), 0) as max_version
       FROM flow_versions WHERE flow_id = $1`,
      [flowId]
    );

    const nextVersion = latestVersions[0].max_version + 1;

    // Get current flow definition
    const flows = await queryWithTenant(
      `SELECT * FROM flows WHERE flow_id = $1`,
      [flowId]
    );

    if (flows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Flow not found',
      });
    }

    // Get flow elements
    const elements = await queryWithTenant(
      `SELECT * FROM flow_elements WHERE flow_id = $1`,
      [flowId]
    );

    const result = await queryWithTenant(
      `INSERT INTO flow_versions (
        flow_id,
        version_number,
        description,
        flow_definition,
        status
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *`,
      [
        flowId,
        nextVersion,
        description,
        JSON.stringify({ flow: flows[0], elements }),
        'Draft',
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Flow version created successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error creating flow version:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create flow version',
      error: error.message,
    });
  }
});

/**
 * POST /api/flows/:flowId/versions/:versionId/activate
 * Activate a flow version
 */
router.post('/:flowId/versions/:versionId/activate', async (req: Request, res: Response) => {
  try {
    const { versionId } = req.params;

    // Deactivate all other versions
    await queryWithTenant(
      `UPDATE flow_versions SET status = 'Inactive'
       WHERE flow_id = (SELECT flow_id FROM flow_versions WHERE version_id = $1)`,
      [versionId]
    );

    // Activate this version
    const result = await queryWithTenant(
      `UPDATE flow_versions SET status = 'Active'
       WHERE version_id = $1
       RETURNING *`,
      [versionId]
    );

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Flow version not found',
      });
    }

    res.json({
      success: true,
      message: 'Flow version activated successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error activating flow version:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to activate flow version',
      error: error.message,
    });
  }
});

/**
 * POST /api/flows/:flowId/run
 * Run a flow (create interview)
 */
router.post('/:flowId/run', async (req: Request, res: Response) => {
  try {
    const { flowId } = req.params;
    const { input_variables, context_record_id } = req.body;

    // Get active version
    const versions = await queryWithTenant(
      `SELECT * FROM flow_versions WHERE flow_id = $1 AND status = 'Active' LIMIT 1`,
      [flowId]
    );

    if (versions.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No active flow version found',
      });
    }

    // Create interview (execution instance)
    const result = await queryWithTenant(
      `INSERT INTO flow_interviews (
        flow_id,
        version_id,
        input_variables,
        context_record_id,
        status
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *`,
      [
        flowId,
        versions[0].version_id,
        JSON.stringify(input_variables || {}),
        context_record_id,
        'InProgress',
      ]
    );

    // In real implementation, would execute flow logic here

    res.status(201).json({
      success: true,
      message: 'Flow interview started successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error running flow:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to run flow',
      error: error.message,
    });
  }
});

/**
 * GET /api/flows/interviews/:interviewId
 * Get flow interview status
 */
router.get('/interviews/:interviewId', async (req: Request, res: Response) => {
  try {
    const { interviewId } = req.params;

    const interviews = await queryWithTenant(
      `SELECT fi.*,
              f.flow_name,
              fv.version_number
       FROM flow_interviews fi
       JOIN flows f ON fi.flow_id = f.flow_id
       JOIN flow_versions fv ON fi.version_id = fv.version_id
       WHERE fi.interview_id = $1`,
      [interviewId]
    );

    if (interviews.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Flow interview not found',
      });
    }

    res.json({
      success: true,
      data: interviews[0],
    });
  } catch (error: any) {
    console.error('Error fetching flow interview:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch flow interview',
      error: error.message,
    });
  }
});

/**
 * POST /api/flows/interviews/:interviewId/resume
 * Resume a paused flow interview
 */
router.post('/interviews/:interviewId/resume', async (req: Request, res: Response) => {
  try {
    const { interviewId } = req.params;
    const { resume_variables } = req.body;

    const result = await queryWithTenant(
      `UPDATE flow_interviews
       SET status = 'InProgress',
           output_variables = output_variables || $1
       WHERE interview_id = $2
       RETURNING *`,
      [JSON.stringify(resume_variables || {}), interviewId]
    );

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Flow interview not found',
      });
    }

    // In real implementation, would resume flow execution here

    res.json({
      success: true,
      message: 'Flow interview resumed successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error resuming flow interview:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to resume flow interview',
      error: error.message,
    });
  }
});

export default router;

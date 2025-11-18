import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { queryWithTenant } from '../config/database';

const router = Router();
router.use(authenticate);

// Get all approval processes
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { is_active, object_id } = req.query;
    const tenantId = req.tenantId!;

    let whereClause = '';
    const params: any[] = [];

    if (is_active !== undefined) {
      whereClause += ' AND ap.is_active = $' + (params.length + 1);
      params.push(is_active === 'true');
    }
    if (object_id) {
      whereClause += ' AND ap.object_id = $' + (params.length + 1);
      params.push(object_id);
    }

    const processes = await queryWithTenant(
      tenantId,
      `SELECT ap.*,
        o.object_name,
        COUNT(DISTINCT aps.step_id) as step_count,
        COUNT(DISTINCT pi.instance_id) as instance_count
       FROM approval_processes ap
       LEFT JOIN objects_meta o ON ap.object_id = o.object_id
       LEFT JOIN approval_steps aps ON ap.process_id = aps.process_id
       LEFT JOIN process_instances pi ON ap.process_id = pi.process_id
       WHERE 1=1 ${whereClause}
       GROUP BY ap.process_id, o.object_name
       ORDER BY ap.modified_date DESC`,
      params
    );

    res.json({ success: true, data: processes });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single approval process with steps
router.get('/:processId', async (req: AuthRequest, res: Response) => {
  try {
    const { processId } = req.params;
    const tenantId = req.tenantId!;

    const processes = await queryWithTenant(
      tenantId,
      `SELECT ap.*, o.object_name
       FROM approval_processes ap
       LEFT JOIN objects_meta o ON ap.object_id = o.object_id
       WHERE ap.process_id = $1`,
      [processId]
    );

    if (processes.length === 0) {
      return res.status(404).json({ success: false, error: 'Approval process not found' });
    }

    const process = processes[0];

    // Get steps
    const steps = await queryWithTenant(
      tenantId,
      'SELECT * FROM approval_steps WHERE process_id = $1 ORDER BY step_order',
      [processId]
    );

    process.steps = steps;

    res.json({ success: true, data: process });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create approval process
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const userId = req.userId!;
    const {
      object_id,
      process_name,
      description,
      entry_criteria,
      is_active = false
    } = req.body;

    if (!process_name || !object_id) {
      return res.status(400).json({ success: false, error: 'Process name and object are required' });
    }

    const processes = await queryWithTenant(
      tenantId,
      `INSERT INTO approval_processes (
        tenant_id, object_id, process_name, description,
        entry_criteria, is_active, created_by, modified_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
      RETURNING *`,
      [tenantId, object_id, process_name, description, entry_criteria, is_active, userId]
    );

    res.status(201).json({ success: true, data: processes[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update approval process
router.put('/:processId', async (req: AuthRequest, res: Response) => {
  try {
    const { processId } = req.params;
    const tenantId = req.tenantId!;
    const userId = req.userId!;
    const updates = req.body;

    const processes = await queryWithTenant(
      tenantId,
      `UPDATE approval_processes SET
        process_name = COALESCE($1, process_name),
        description = COALESCE($2, description),
        entry_criteria = COALESCE($3, entry_criteria),
        is_active = COALESCE($4, is_active),
        modified_by = $5,
        modified_date = CURRENT_TIMESTAMP
       WHERE process_id = $6
       RETURNING *`,
      [updates.process_name, updates.description, updates.entry_criteria, updates.is_active, userId, processId]
    );

    if (processes.length === 0) {
      return res.status(404).json({ success: false, error: 'Approval process not found' });
    }

    res.json({ success: true, data: processes[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Add step to approval process
router.post('/:processId/steps', async (req: AuthRequest, res: Response) => {
  try {
    const { processId } = req.params;
    const tenantId = req.tenantId!;
    const {
      step_order,
      step_name,
      assigned_to_type,
      assigned_to_value,
      approval_criteria,
      rejection_criteria,
      reject_behavior = 'reject_final'
    } = req.body;

    if (!step_name || !assigned_to_type) {
      return res.status(400).json({ success: false, error: 'Step name and assigned to type are required' });
    }

    const steps = await queryWithTenant(
      tenantId,
      `INSERT INTO approval_steps (
        process_id, step_order, step_name, assigned_to_type,
        assigned_to_value, approval_criteria, rejection_criteria, reject_behavior
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [processId, step_order, step_name, assigned_to_type, assigned_to_value, approval_criteria, rejection_criteria, reject_behavior]
    );

    res.status(201).json({ success: true, data: steps[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Submit record for approval
router.post('/:processId/submit', async (req: AuthRequest, res: Response) => {
  try {
    const { processId } = req.params;
    const { record_id, comments } = req.body;
    const tenantId = req.tenantId!;
    const userId = req.userId!;

    if (!record_id) {
      return res.status(400).json({ success: false, error: 'Record ID is required' });
    }

    // Check if process is active
    const processes = await queryWithTenant(
      tenantId,
      'SELECT * FROM approval_processes WHERE process_id = $1',
      [processId]
    );

    if (processes.length === 0) {
      return res.status(404).json({ success: false, error: 'Approval process not found' });
    }

    if (!processes[0].is_active) {
      return res.status(400).json({ success: false, error: 'Approval process is not active' });
    }

    // Get first step
    const steps = await queryWithTenant(
      tenantId,
      'SELECT * FROM approval_steps WHERE process_id = $1 ORDER BY step_order LIMIT 1',
      [processId]
    );

    if (steps.length === 0) {
      return res.status(400).json({ success: false, error: 'Approval process has no steps defined' });
    }

    const firstStep = steps[0];

    // Create process instance
    const instances = await queryWithTenant(
      tenantId,
      `INSERT INTO process_instances (
        process_id, record_id, status, current_step_id,
        submitted_by, submitted_date
      ) VALUES ($1, $2, 'pending', $3, $4, CURRENT_TIMESTAMP)
      RETURNING *`,
      [processId, record_id, firstStep.step_id, userId]
    );

    // Determine approver (simplified - would need more logic)
    const assignedTo = firstStep.assigned_to_value?.user_id || userId;

    // Create approval request
    const requests = await queryWithTenant(
      tenantId,
      `INSERT INTO approval_requests (
        process_id, step_id, record_id, status,
        assigned_to, submitted_by, submitted_date, comments
      ) VALUES ($1, $2, $3, 'pending', $4, $5, CURRENT_TIMESTAMP, $6)
      RETURNING *`,
      [processId, firstStep.step_id, record_id, assignedTo, userId, comments]
    );

    res.status(201).json({
      success: true,
      data: {
        instance: instances[0],
        request: requests[0]
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Approve request
router.post('/requests/:requestId/approve', async (req: AuthRequest, res: Response) => {
  try {
    const { requestId } = req.params;
    const { comments } = req.body;
    const tenantId = req.tenantId!;
    const userId = req.userId!;

    const requests = await queryWithTenant(
      tenantId,
      'SELECT * FROM approval_requests WHERE request_id = $1',
      [requestId]
    );

    if (requests.length === 0) {
      return res.status(404).json({ success: false, error: 'Approval request not found' });
    }

    const request = requests[0];

    // Update request
    await queryWithTenant(
      tenantId,
      `UPDATE approval_requests SET
        status = 'approved',
        responded_by = $1,
        response_date = CURRENT_TIMESTAMP,
        actual_approver = $1,
        comments = COALESCE($2, comments)
       WHERE request_id = $3`,
      [userId, comments, requestId]
    );

    // Check if there's a next step
    const currentStep = await queryWithTenant(
      tenantId,
      'SELECT * FROM approval_steps WHERE step_id = $1',
      [request.step_id]
    );

    const nextSteps = await queryWithTenant(
      tenantId,
      'SELECT * FROM approval_steps WHERE process_id = $1 AND step_order > $2 ORDER BY step_order LIMIT 1',
      [request.process_id, currentStep[0].step_order]
    );

    if (nextSteps.length > 0) {
      // Move to next step
      const nextStep = nextSteps[0];

      await queryWithTenant(
        tenantId,
        `UPDATE process_instances SET current_step_id = $1
         WHERE record_id = $2 AND process_id = $3`,
        [nextStep.step_id, request.record_id, request.process_id]
      );

      // Create new approval request
      const assignedTo = nextStep.assigned_to_value?.user_id || userId;

      await queryWithTenant(
        tenantId,
        `INSERT INTO approval_requests (
          process_id, step_id, record_id, status,
          assigned_to, submitted_by, submitted_date
        ) VALUES ($1, $2, $3, 'pending', $4, $5, CURRENT_TIMESTAMP)`,
        [request.process_id, nextStep.step_id, request.record_id, assignedTo, request.submitted_by]
      );

      res.json({ success: true, message: 'Approved - moved to next step' });
    } else {
      // Final approval
      await queryWithTenant(
        tenantId,
        `UPDATE process_instances SET
          status = 'approved',
          completed_date = CURRENT_TIMESTAMP
         WHERE record_id = $1 AND process_id = $2`,
        [request.record_id, request.process_id]
      );

      res.json({ success: true, message: 'Approved - process complete' });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Reject request
router.post('/requests/:requestId/reject', async (req: AuthRequest, res: Response) => {
  try {
    const { requestId } = req.params;
    const { reason } = req.body;
    const tenantId = req.tenantId!;
    const userId = req.userId!;

    if (!reason) {
      return res.status(400).json({ success: false, error: 'Rejection reason is required' });
    }

    const requests = await queryWithTenant(
      tenantId,
      'SELECT * FROM approval_requests WHERE request_id = $1',
      [requestId]
    );

    if (requests.length === 0) {
      return res.status(404).json({ success: false, error: 'Approval request not found' });
    }

    const request = requests[0];

    // Update request
    await queryWithTenant(
      tenantId,
      `UPDATE approval_requests SET
        status = 'rejected',
        responded_by = $1,
        response_date = CURRENT_TIMESTAMP,
        actual_approver = $1,
        comments = $2
       WHERE request_id = $3`,
      [userId, reason, requestId]
    );

    // Update process instance
    await queryWithTenant(
      tenantId,
      `UPDATE process_instances SET
        status = 'rejected',
        completed_date = CURRENT_TIMESTAMP
       WHERE record_id = $1 AND process_id = $2`,
      [request.record_id, request.process_id]
    );

    res.json({ success: true, message: 'Request rejected' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get pending approvals for current user
router.get('/requests/my-pending', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const userId = req.userId!;

    const requests = await queryWithTenant(
      tenantId,
      `SELECT ar.*,
        ap.process_name,
        o.object_name,
        pi.submitted_date
       FROM approval_requests ar
       JOIN approval_processes ap ON ar.process_id = ap.process_id
       JOIN objects_meta o ON ap.object_id = o.object_id
       JOIN process_instances pi ON ar.record_id = pi.record_id AND ar.process_id = pi.process_id
       WHERE ar.assigned_to = $1
         AND ar.status = 'pending'
       ORDER BY ar.submitted_date ASC`,
      [userId]
    );

    res.json({ success: true, data: requests });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Reassign approval request
router.post('/requests/:requestId/reassign', async (req: AuthRequest, res: Response) => {
  try {
    const { requestId } = req.params;
    const { new_approver_id } = req.body;
    const tenantId = req.tenantId!;

    if (!new_approver_id) {
      return res.status(400).json({ success: false, error: 'New approver ID is required' });
    }

    const requests = await queryWithTenant(
      tenantId,
      `UPDATE approval_requests SET assigned_to = $1
       WHERE request_id = $2
       RETURNING *`,
      [new_approver_id, requestId]
    );

    if (requests.length === 0) {
      return res.status(404).json({ success: false, error: 'Approval request not found' });
    }

    res.json({ success: true, data: requests[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete approval process
router.delete('/:processId', async (req: AuthRequest, res: Response) => {
  try {
    const { processId } = req.params;
    const tenantId = req.tenantId!;

    await queryWithTenant(
      tenantId,
      'DELETE FROM approval_processes WHERE process_id = $1',
      [processId]
    );

    res.json({ success: true, message: 'Approval process deleted' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;

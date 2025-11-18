import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { queryWithTenant } from '../config/database';

const router = Router();
router.use(authenticate);

// Get all cases
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { limit = 50, offset = 0, status, priority, owner_id } = req.query;
    const tenantId = req.tenantId!;

    let whereClause = '';
    const params: any[] = [];

    if (status) {
      whereClause += ' AND c.status = $' + (params.length + 1);
      params.push(status);
    }
    if (priority) {
      whereClause += ' AND c.priority = $' + (params.length + 1);
      params.push(priority);
    }
    if (owner_id) {
      whereClause += ' AND c.owner_id = $' + (params.length + 1);
      params.push(owner_id);
    }

    const cases = await queryWithTenant(
      tenantId,
      `SELECT c.*,
        acc.data->>'Name' as account_name,
        con.data->>'FirstName' || ' ' || con.data->>'LastName' as contact_name,
        (SELECT COUNT(*) FROM case_comments WHERE case_id = c.case_id) as comment_count
       FROM cases c
       LEFT JOIN object_data acc ON c.account_id = acc.record_id
       LEFT JOIN object_data con ON c.contact_id = con.record_id
       WHERE 1=1 ${whereClause}
       ORDER BY c.created_date DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    res.json({ success: true, data: { cases, total: cases.length } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single case
router.get('/:caseId', async (req: AuthRequest, res: Response) => {
  try {
    const { caseId } = req.params;
    const tenantId = req.tenantId!;

    const cases = await queryWithTenant(
      tenantId,
      `SELECT c.*,
        acc.data as account,
        con.data as contact
       FROM cases c
       LEFT JOIN object_data acc ON c.account_id = acc.record_id
       LEFT JOIN object_data con ON c.contact_id = con.record_id
       WHERE c.case_id = $1`,
      [caseId]
    );

    if (cases.length === 0) {
      return res.status(404).json({ success: false, error: 'Case not found' });
    }

    // Get comments
    const comments = await queryWithTenant(
      tenantId,
      `SELECT cc.*, u.first_name, u.last_name
       FROM case_comments cc
       JOIN users u ON cc.created_by = u.user_id
       WHERE cc.case_id = $1
       ORDER BY cc.created_date DESC`,
      [caseId]
    );

    // Get history
    const history = await queryWithTenant(
      tenantId,
      `SELECT ch.*, u.first_name, u.last_name
       FROM case_history ch
       JOIN users u ON ch.changed_by = u.user_id
       WHERE ch.case_id = $1
       ORDER BY ch.changed_date DESC`,
      [caseId]
    );

    res.json({
      success: true,
      data: {
        ...cases[0],
        comments,
        history
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create case
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const userId = req.userId!;
    const {
      subject,
      description,
      status = 'New',
      priority = 'Medium',
      origin,
      type,
      account_id,
      contact_id
    } = req.body;

    if (!subject) {
      return res.status(400).json({ success: false, error: 'Subject is required' });
    }

    const count = await queryWithTenant<{count: string}>(
      tenantId,
      'SELECT COUNT(*) as count FROM cases WHERE tenant_id = $1',
      [tenantId]
    );
    const case_number = `CASE-${String(parseInt(count[0].count) + 1).padStart(5, '0')}`;

    const cases = await queryWithTenant(
      tenantId,
      `INSERT INTO cases (
        tenant_id, case_number, subject, description, status, priority,
        origin, type, account_id, contact_id,
        owner_id, created_by, modified_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11, $11)
      RETURNING *`,
      [tenantId, case_number, subject, description, status, priority, origin, type, account_id, contact_id, userId]
    );

    res.status(201).json({ success: true, data: cases[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update case
router.put('/:caseId', async (req: AuthRequest, res: Response) => {
  try {
    const { caseId } = req.params;
    const tenantId = req.tenantId!;
    const userId = req.userId!;
    const updates = req.body;

    const cases = await queryWithTenant(
      tenantId,
      `UPDATE cases SET
        subject = COALESCE($1, subject),
        description = COALESCE($2, description),
        status = COALESCE($3, status),
        priority = COALESCE($4, priority),
        owner_id = COALESCE($5, owner_id),
        modified_by = $6,
        modified_date = CURRENT_TIMESTAMP
       WHERE case_id = $7
       RETURNING *`,
      [updates.subject, updates.description, updates.status, updates.priority, updates.owner_id, userId, caseId]
    );

    res.json({ success: true, data: cases[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Close case
router.post('/:caseId/close', async (req: AuthRequest, res: Response) => {
  try {
    const { caseId } = req.params;
    const tenantId = req.tenantId!;
    const userId = req.userId!;
    const { resolution } = req.body;

    const cases = await queryWithTenant(
      tenantId,
      `UPDATE cases SET
        status = 'Closed',
        is_closed = true,
        closed_date = CURRENT_TIMESTAMP,
        closed_by = $1,
        resolution = $2,
        modified_by = $1,
        modified_date = CURRENT_TIMESTAMP
       WHERE case_id = $3
       RETURNING *`,
      [userId, resolution, caseId]
    );

    res.json({ success: true, data: cases[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Add comment to case
router.post('/:caseId/comments', async (req: AuthRequest, res: Response) => {
  try {
    const { caseId } = req.params;
    const tenantId = req.tenantId!;
    const userId = req.userId!;
    const { comment_body, is_published = false } = req.body;

    if (!comment_body) {
      return res.status(400).json({ success: false, error: 'Comment body is required' });
    }

    const comments = await queryWithTenant(
      tenantId,
      `INSERT INTO case_comments (case_id, comment_body, is_published, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [caseId, comment_body, is_published, userId]
    );

    res.status(201).json({ success: true, data: comments[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Escalate case
router.post('/:caseId/escalate', async (req: AuthRequest, res: Response) => {
  try {
    const { caseId } = req.params;
    const tenantId = req.tenantId!;
    const userId = req.userId!;
    const { escalated_to, reason } = req.body;

    const cases = await queryWithTenant(
      tenantId,
      `UPDATE cases SET
        status = 'Escalated',
        is_escalated = true,
        escalated_to = $1,
        priority = CASE
          WHEN priority = 'Low' THEN 'Medium'
          WHEN priority = 'Medium' THEN 'High'
          ELSE priority
        END,
        modified_by = $2,
        modified_date = CURRENT_TIMESTAMP
       WHERE case_id = $3
       RETURNING *`,
      [escalated_to, userId, caseId]
    );

    // Add comment about escalation
    if (reason) {
      await queryWithTenant(
        tenantId,
        `INSERT INTO case_comments (case_id, comment_body, is_published, created_by)
         VALUES ($1, $2, false, $3)`,
        [caseId, `Case escalated: ${reason}`, userId]
      );
    }

    res.json({ success: true, data: cases[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;

import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { queryWithTenant } from '../config/database';

const router = Router();
router.use(authenticate);

// Get all solutions
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { status, is_visible_in_portal } = req.query;
    const tenantId = req.tenantId!;

    let whereClause = '';
    const params: any[] = [];

    if (status) {
      whereClause += ' AND status = $' + (params.length + 1);
      params.push(status);
    }
    if (is_visible_in_portal !== undefined) {
      whereClause += ' AND is_visible_in_portal = $' + (params.length + 1);
      params.push(is_visible_in_portal === 'true');
    }

    const solutions = await queryWithTenant(
      tenantId,
      `SELECT * FROM solutions
       WHERE 1=1 ${whereClause}
       ORDER BY created_date DESC`,
      params
    );

    res.json({ success: true, data: solutions });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single solution
router.get('/:solutionId', async (req: AuthRequest, res: Response) => {
  try {
    const { solutionId } = req.params;
    const tenantId = req.tenantId!;

    const solutions = await queryWithTenant(
      tenantId,
      `SELECT s.*,
        COALESCE(jsonb_agg(jsonb_build_object(
          'case_id', cs.case_id,
          'case_number', c.case_number,
          'subject', c.subject
        ) ORDER BY cs.created_date DESC) FILTER (WHERE cs.case_id IS NOT NULL), '[]') as related_cases
       FROM solutions s
       LEFT JOIN case_solutions cs ON s.solution_id = cs.solution_id
       LEFT JOIN cases c ON cs.case_id = c.case_id
       WHERE s.solution_id = $1
       GROUP BY s.solution_id`,
      [solutionId]
    );

    if (solutions.length === 0) {
      return res.status(404).json({ success: false, error: 'Solution not found' });
    }

    res.json({ success: true, data: solutions[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create solution
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const userId = req.userId!;
    const {
      title,
      description,
      status = 'Draft',
      is_visible_in_portal = false
    } = req.body;

    if (!title || !description) {
      return res.status(400).json({ success: false, error: 'Title and description are required' });
    }

    // Generate solution number
    const count = await queryWithTenant<{count: string}>(
      tenantId,
      'SELECT COUNT(*) as count FROM solutions WHERE tenant_id = $1',
      [tenantId]
    );
    const solution_number = `SOL-${String(parseInt(count[0].count) + 1).padStart(5, '0')}`;

    const solutions = await queryWithTenant(
      tenantId,
      `INSERT INTO solutions (
        tenant_id, solution_number, title, description,
        status, is_visible_in_portal, created_by, modified_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
      RETURNING *`,
      [tenantId, solution_number, title, description, status, is_visible_in_portal, userId]
    );

    res.status(201).json({ success: true, data: solutions[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update solution
router.put('/:solutionId', async (req: AuthRequest, res: Response) => {
  try {
    const { solutionId } = req.params;
    const tenantId = req.tenantId!;
    const userId = req.userId!;
    const updates = req.body;

    const solutions = await queryWithTenant(
      tenantId,
      `UPDATE solutions SET
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        status = COALESCE($3, status),
        is_visible_in_portal = COALESCE($4, is_visible_in_portal),
        modified_by = $5,
        modified_date = CURRENT_TIMESTAMP
       WHERE solution_id = $6
       RETURNING *`,
      [updates.title, updates.description, updates.status, updates.is_visible_in_portal, userId, solutionId]
    );

    if (solutions.length === 0) {
      return res.status(404).json({ success: false, error: 'Solution not found' });
    }

    res.json({ success: true, data: solutions[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Publish solution
router.post('/:solutionId/publish', async (req: AuthRequest, res: Response) => {
  try {
    const { solutionId } = req.params;
    const tenantId = req.tenantId!;
    const userId = req.userId!;

    const solutions = await queryWithTenant(
      tenantId,
      `UPDATE solutions SET
        status = 'Published',
        modified_by = $1,
        modified_date = CURRENT_TIMESTAMP
       WHERE solution_id = $2
       RETURNING *`,
      [userId, solutionId]
    );

    if (solutions.length === 0) {
      return res.status(404).json({ success: false, error: 'Solution not found' });
    }

    res.json({ success: true, data: solutions[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete solution
router.delete('/:solutionId', async (req: AuthRequest, res: Response) => {
  try {
    const { solutionId } = req.params;
    const tenantId = req.tenantId!;

    await queryWithTenant(
      tenantId,
      'DELETE FROM solutions WHERE solution_id = $1',
      [solutionId]
    );

    res.json({ success: true, message: 'Solution deleted' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
